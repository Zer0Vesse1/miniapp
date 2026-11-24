import {
  authIsConfigured, clearSession, consumeLoginAttempt, createSession,
  hasSession, passwordMatches, readPassword, resetLoginAttempts, usesCustomPassword
} from '../server/auth.js';
import { loginPage } from '../server/login-page.js';

const loginPath = '/api/auth/login';
const logoutPath = '/api/auth/logout';
const localNames = new Set(['localhost', '127.0.0.1', '[::1]']);

function error(status, message, headers) {
  return Response.json({ error: message }, { status, headers });
}

async function login(request, env, origin) {
  const custom = usesCustomPassword(env);
  const password = await readPassword(request);
  if (password === null) return loginPage(400, 'invalidRequest', { custom });
  const attempt = await consumeLoginAttempt(request, env);
  if (attempt.retryAfter) return loginPage(429, 'retryLater', { custom, headers: { 'Retry-After': String(attempt.retryAfter) } });
  if (!await passwordMatches(env, password)) return loginPage(401, 'wrongPassword', { custom });
  await resetLoginAttempts(env, attempt.scopes);
  return new Response(null, {
    status: 303,
    headers: { Location: '/', 'Set-Cookie': await createSession(env, origin) }
  });
}

async function authorize(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { pathname: path, origin } = url;
  const api = path === '/api' || path.startsWith('/api/');
  const navigation = request.method === 'GET' || request.method === 'HEAD';

  if (url.protocol !== 'https:' && !localNames.has(url.hostname)) {
    if (!navigation) return error(403, '请通过 HTTPS 访问 M_APP。');
    url.protocol = 'https:';
    return new Response(null, { status: 308, headers: { Location: url.href } });
  }
  if (!authIsConfigured(env)) {
    return api && path !== loginPath
      ? error(503, '网站访问暂时不可用。') : loginPage(503, 'unavailable');
  }
  if (!navigation && request.headers.get('Origin') !== origin) {
    return path === loginPath ? loginPage(403, 'invalidRequest', { custom: usesCustomPassword(env) }) : error(403, '请求来源无效。');
  }
  if (path === loginPath || path === logoutPath) {
    if (request.method !== 'POST') return error(405, '不支持此请求方式。', { Allow: 'POST' });
    if (path === logoutPath) return new Response(null, { status: 204, headers: { 'Set-Cookie': clearSession() } });
    return login(request, env, origin);
  }
  if (!await hasSession(request, env, origin)) {
    if (api) return error(401, '请先输入网站访问密码。');
    return loginPage(401, undefined, { custom: usesCustomPassword(env) });
  }

  const response = await context.next();
  if (api || !response.body || !response.headers.get('Content-Type')?.toLowerCase().startsWith('text/html')) return response;
  return new HTMLRewriter().on('html', {
    element(element) { element.setAttribute('data-m-app-cloud', ''); }
  }).transform(response);
}

export async function onRequest(context) {
  let response;
  try {
    response = await authorize(context);
  } catch {
    const path = new URL(context.request.url).pathname;
    if (path === loginPath || (path !== '/api' && !path.startsWith('/api/'))) response = loginPage(503, 'unavailable');
    else response = error(503, '网站访问暂时不可用。');
  }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  const body = context.request.method === 'HEAD' ? null : response.body;
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
