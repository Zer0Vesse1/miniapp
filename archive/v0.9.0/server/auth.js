const encoder = new TextEncoder();
const decoder = new TextDecoder();
const cookieName = '__Host-m_app_session';
const sessionSeconds = 7 * 24 * 60 * 60;
const attemptSeconds = 15 * 60;
const maxAttempts = 8;
const maxSitePasswordAttempts = 12;
const maxFormBytes = 4096;
export const maxCustomPasswordLength = 128;
const passwordPattern = /^[A-Za-z0-9_-]{43}$/;
const hashPattern = /^(?:custom1\.)?[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/;
const sessionPattern = /^(\d{1,12})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

function unbase64(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (character) => character.charCodeAt(0));
}

function base64(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function authIsConfigured(env) {
  return typeof env.M_APP_PASSWORD_HASH === 'string' && hashPattern.test(env.M_APP_PASSWORD_HASH)
    && typeof env.M_APP_SESSION_SECRET === 'string' && env.M_APP_SESSION_SECRET.length >= 32
    && Boolean(env.M_APP_DB);
}

export function usesCustomPassword(env) {
  return env.M_APP_PASSWORD_HASH?.startsWith('custom1.') === true;
}

function signingKey(env) {
  return crypto.subtle.importKey('raw', encoder.encode(env.M_APP_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function sessionInput(env, origin, token) {
  return encoder.encode(`m-app-session\n${origin}\n${env.M_APP_PASSWORD_HASH}\n${token}`);
}

function cookie(value, maxAge) {
  return `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSession() {
  return cookie('', 0);
}

export async function createSession(env, origin) {
  const expires = nowInSeconds() + sessionSeconds;
  const nonce = base64(crypto.getRandomValues(new Uint8Array(16)));
  const token = `${expires}.${nonce}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), sessionInput(env, origin, token));
  return cookie(`${token}.${base64(signature)}`, sessionSeconds);
}

export async function hasSession(request, env, origin) {
  const value = request.headers.get('Cookie')?.split(';')
    .map((entry) => entry.trim()).find((entry) => entry.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const match = sessionPattern.exec(value ?? '');
  if (!match || Number(match[1]) <= nowInSeconds()) return false;
  const [, expires, nonce, signature] = match;
  return crypto.subtle.verify('HMAC', await signingKey(env), unbase64(signature),
    sessionInput(env, origin, `${expires}.${nonce}`));
}

export async function readPassword(request) {
  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded' || !request.body) return null;
  if (Number(request.headers.get('Content-Length')) > maxFormBytes) return null;
  const reader = request.body.getReader();
  const buffer = new Uint8Array(maxFormBytes);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > maxFormBytes) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const passwords = new URLSearchParams(decoder.decode(buffer.subarray(0, length))).getAll('password');
  return passwords.length === 1 ? passwords[0] : null;
}

export async function passwordMatches(env, password) {
  if (usesCustomPassword(env)) {
    if (!password?.trim() || password.length > maxCustomPasswordLength || /[\r\n]/.test(password)) return false;
    const [, salt, signature] = env.M_APP_PASSWORD_HASH.split('.');
    return crypto.subtle.verify('HMAC', await signingKey(env), unbase64(signature),
      encoder.encode(`m-app-custom-password-v1\n${salt}\n${password}`));
  }
  if (!passwordPattern.test(password ?? '')) return false;
  const [salt, expected] = env.M_APP_PASSWORD_HASH.split('.').map(unbase64);
  const input = new Uint8Array(salt.length + password.length);
  input.set(salt);
  input.set(encoder.encode(password), salt.length);
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(actual, expected);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export async function consumeLoginAttempt(request, env) {
  const address = request.headers.get('CF-Connecting-IP') ?? 'local';
  const key = await signingKey(env);
  const signScope = async (purpose) => base64(await crypto.subtle.sign('HMAC', key, encoder.encode(purpose)));
  const limits = [[await signScope(`m-app-login\n${address}`), maxAttempts]];
  if (usesCustomPassword(env)) {
    limits.push([await signScope('m-app-login-site-custom-password-v1'), maxSitePasswordAttempts]);
  }

  const scopes = limits.map(([scope]) => scope);
  const values = limits.map(() => '(?, ?)').join(', ');
  const now = nowInSeconds();
  const resetAt = now + attemptSeconds;
  const db = env.M_APP_DB;
  // Admit the request only if every counter has room. A blocked IP spends no site-wide attempts.
  const [attempt, blocking] = await db.batch([
    db.prepare(`WITH limits(scope, max_attempts) AS (VALUES ${values}),
      available AS MATERIALIZED (
        SELECT COUNT(*) AS count
        FROM limits
        LEFT JOIN auth_attempts AS existing ON existing.scope = limits.scope AND existing.reset_at > ?
        WHERE COALESCE(existing.attempts, 0) < limits.max_attempts
      )
      INSERT INTO auth_attempts (scope, attempts, reset_at)
      SELECT limits.scope, 1, ? FROM limits CROSS JOIN available WHERE available.count = ?
      ON CONFLICT (scope) DO UPDATE SET
        attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
      RETURNING scope`).bind(...limits.flat(), now, resetAt, scopes.length, now, now),
    db.prepare(`WITH limits(scope, max_attempts) AS (VALUES ${values})
      SELECT MAX(auth_attempts.reset_at) AS reset_at
      FROM auth_attempts JOIN limits USING (scope)
      WHERE auth_attempts.attempts >= limits.max_attempts AND auth_attempts.reset_at > ?`).bind(...limits.flat(), now),
    db.prepare(`DELETE FROM auth_attempts WHERE scope IN (
      SELECT scope FROM auth_attempts WHERE reset_at <= ?1 LIMIT 32
    )`).bind(now)
  ]);
  if (attempt.results.length === scopes.length) return { scopes };
  return { retryAfter: Math.max(1, (blocking.results[0]?.reset_at ?? now + 1) - now) };
}

export async function resetLoginAttempts(env, scopes) {
  const placeholders = scopes.map(() => '?').join(', ');
  await env.M_APP_DB.prepare(`DELETE FROM auth_attempts WHERE scope IN (${placeholders})`).bind(...scopes).run();
}
