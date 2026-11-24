import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { onRequest as authenticate } from '../functions/_middleware.js';
import { onRequest as allScopes } from '../functions/api/data/index.js';
import { onRequest as oneScope } from '../functions/api/data/[scope].js';

const site = 'https://m-app.test';
const testPassword = '  测试用口令 à passphrase+a  ';
const bundledSql = readFileSync(new URL('../migrations/0001_sync.sql', import.meta.url), 'utf8');
const runFile = promisify(execFile);

function customVerifier(password, sessionSecret) {
  const salt = randomBytes(16).toString('base64url');
  const hash = createHmac('sha256', sessionSecret).update(`m-app-custom-password-v1\n${salt}\n${password}`).digest('base64url');
  return `custom1.${salt}.${hash}`;
}

function fixture(t, chosenPassword) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(bundledSql);
  const binding = {
    prepare(sql) {
      const query = sqlite.prepare(sql);
      return {
        bind(...values) {
          const select = () => ({ results: query.all(...values) });
          return {
            all: async () => select(),
            first: async () => query.get(...values) ?? null,
            run: async () => ({ success: true, meta: query.run(...values) }),
            select
          };
        }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = statements.map((statement) => statement.select());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };

  const password = chosenPassword ?? randomBytes(32).toString('base64url');
  const sessionSecret = randomBytes(32).toString('base64url');
  const salt = randomBytes(16);
  const hash = createHash('sha256').update(salt).update(password).digest('base64url');
  const env = {
    M_APP_DB: binding,
    M_APP_PASSWORD_HASH: chosenPassword === undefined ? `${salt.toString('base64url')}.${hash}` : customVerifier(chosenPassword, sessionSecret),
    M_APP_SESSION_SECRET: sessionSecret
  };
  const originHeaders = { Origin: site, 'CF-Connecting-IP': '192.0.2.10' };

  function dispatch(req, overrides = env, fallback = () => new Response('application shell')) {
    const { pathname } = new URL(req.url);
    const scope = pathname.startsWith('/api/data/') ? pathname.slice('/api/data/'.length) : undefined;
    const context = {
      request: req,
      env: overrides,
      data: {},
      params: { scope },
      next: () => {
        if (scope !== undefined) return oneScope(context);
        if (pathname === '/api/data') return allScopes(context);
        return fallback();
      }
    };
    return authenticate(context);
  }

  function request(pathname, options = {}, overrides = env, origin = site) {
    return dispatch(new Request(`${origin}${pathname}`, options), overrides);
  }

  function login(credential = password, headers = originHeaders, overrides = env, origin = site) {
    return request('/api/auth/login', {
      method: 'POST',
      headers,
      body: new URLSearchParams({ password: credential })
    }, overrides, origin);
  }

  async function signIn() {
    const response = await login();
    assert.equal(response.status, 303);
    return response.headers.get('Set-Cookie').split(';')[0];
  }

  function read(cookie) {
    return request('/api/data', { headers: { Cookie: cookie } });
  }

  function update(pathname, cookie, data, origin = site) {
    return request(pathname, {
      method: 'PUT',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  return { request, login, signIn, read, update, password, dispatch, env };
}

test('guards static pages and data, then signs the session for this origin', async (t) => {
  const { request, login } = fixture(t);
  assert.equal((await request('/', {}, {})).status, 503);
  assert.equal((await request('/')).status, 401);
  assert.equal((await request('/index.html')).status, 401);
  assert.equal((await request('/api/data')).status, 401);
  assert.equal((await request('/api/data/parking', { method: 'PUT', headers: { Origin: site } })).status, 401);
  assert.equal((await login(undefined, { Origin: 'https://unknown.test' })).status, 403);

  const response = await login();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/');
  const setCookie = response.headers.get('Set-Cookie');
  assert.match(setCookie, /; Secure; HttpOnly; SameSite=Lax; Max-Age=[1-9]/);

  const cookie = setCookie.split(';')[0];
  assert.equal((await request('/', { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await request('/api/data', { headers: { Cookie: cookie } }, undefined, 'https://m-app-alias.test')).status, 401);
  const suffix = cookie.at(-1) === 'A' ? 'w' : 'A';
  assert.equal((await request('/api/data', { headers: { Cookie: `${cookie.slice(0, -1)}${suffix}` } })).status, 401);
  const logout = await request('/api/auth/logout', { method: 'POST', headers: { Origin: site, Cookie: cookie } });
  assert.ok(logout.ok || logout.status === 303);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
});

test('limits password retries', async (t) => {
  const { login } = fixture(t);
  const wrong = randomBytes(32).toString('base64url');
  for (let index = 0; index < 8; index += 1) assert.equal((await login(wrong)).status, 401);
  const limited = await login();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
});

test('accepts a custom text password exactly and invalidates the previous credential’s cookie', async (t) => {
  const { env, login, password, request, signIn } = fixture(t);
  const legacyCookie = await signIn();
  const customEnv = { ...env, M_APP_PASSWORD_HASH: customVerifier(testPassword, env.M_APP_SESSION_SECRET) };
  const malformed = { ...env, M_APP_PASSWORD_HASH: 'custom1.invalid' };
  const gate = await request('/', {}, customEnv);
  assert.equal(gate.status, 401);
  const markup = await gate.text();
  assert.match(markup, /<label for="site-password">网站访问密码<\/label>/);
  const input = markup.match(/<input id="site-password"[^>]*>/)?.[0] ?? '';
  assert.match(input, /type="password"/);
  assert.match(input, /maxlength="128"/);
  assert.doesNotMatch(input, /inputmode="numeric"|\bpattern=/);
  assert.equal((await request('/', {}, malformed)).status, 503);
  assert.equal((await request('/api/data', { headers: { Cookie: legacyCookie } }, customEnv)).status, 401);
  assert.equal((await login(password, undefined, customEnv)).status, 401);
  assert.equal((await login(testPassword.trim(), undefined, customEnv)).status, 401);
  const accepted = await login(testPassword, undefined, customEnv);
  assert.equal(accepted.status, 303);
  const cookie = accepted.headers.get('Set-Cookie').split(';')[0];
  const access = { headers: { Cookie: cookie } };
  assert.equal((await request('/api/data', access, customEnv)).status, 200);
  const rotated = { ...customEnv, M_APP_PASSWORD_HASH: customVerifier(testPassword, env.M_APP_SESSION_SECRET) };
  assert.equal((await request('/api/data', access, rotated)).status, 401);
});

test('treats an all-digit password as text and accepts passwords up to 128 characters', async (t) => {
  const { env, login } = fixture(t, '004218');
  assert.equal((await login('4218')).status, 401);
  assert.equal((await login('004218')).status, 303);

  const longPassword = 'a'.repeat(128);
  const longEnv = { ...env, M_APP_PASSWORD_HASH: customVerifier(longPassword, env.M_APP_SESSION_SECRET) };
  assert.equal((await login(longPassword, undefined, longEnv)).status, 303);
  const tooLong = 'a'.repeat(129);
  const tooLongEnv = { ...env, M_APP_PASSWORD_HASH: customVerifier(tooLong, env.M_APP_SESSION_SECRET) };
  assert.equal((await login(tooLong, undefined, tooLongEnv)).status, 401);
});

test('limits custom password attempts across aliases and does not count requests blocked by the per-IP limit', async (t) => {
  const { login } = fixture(t, testPassword);
  const alias = 'https://m-app-alias.test';
  const start = Date.UTC(2026, 0, 1, 12);
  let now = start;
  t.mock.method(Date, 'now', () => now);
  const submit = (password, address = '192.0.2.10', origin = site) => login(password,
    { Origin: origin, 'CF-Connecting-IP': address }, undefined, origin);

  for (let attempt = 0; attempt < 8; attempt += 1) assert.equal((await submit('wrong password')).status, 401);
  for (let attempt = 0; attempt < 4; attempt += 1) assert.equal((await submit('wrong password')).status, 429);
  assert.equal((await submit('wrong password', '192.0.2.11', alias)).status, 401);
  assert.equal((await submit('wrong password', '192.0.2.11', alias)).status, 401);
  assert.equal((await submit('wrong password', '192.0.2.12')).status, 401);
  assert.equal((await submit('wrong password', '192.0.2.12')).status, 401);
  const limited = await submit(testPassword, '192.0.2.13', alias);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '900');

  now = start + 899_000;
  assert.equal((await submit(testPassword, '192.0.2.13', alias)).status, 429);
  now = start + 900_000;
  assert.equal((await submit(testPassword, '192.0.2.13', alias)).status, 303);
});

test('shares records across sessions and rejects stale or cross-origin updates', async (t) => {
  const { signIn, read, update } = fixture(t);
  const first = await signIn();
  const second = await signIn();
  assert.deepEqual(await (await read(first)).json(), { scopes: {} });

  const parking = { place: '图书馆', area: '地下二层', number: 'C32', time: '15:03' };
  const save = await update('/api/data/parking', first, { revision: 0, data: parking });
  assert.equal(save.status, 200);
  const saved = { revision: 1, data: parking };
  assert.deepEqual(await save.json(), saved);
  const synced = await read(second);
  assert.match(synced.headers.get('Cache-Control'), /no-store/);
  assert.deepEqual(await synced.json(), { scopes: { parking: saved } });

  const stale = await update('/api/data/parking', second, { revision: 0, data: null });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'conflict', ...saved });

  const crossOrigin = await update('/api/data/parking', second, { revision: 1, data: null }, 'https://unknown.test');
  assert.equal(crossOrigin.status, 403);
  const batch = await update('/api/data', second, {
    scopes: { parking: { revision: 0, data: null }, food: { revision: 0, data: [] } }
  });
  assert.equal(batch.status, 409);
  assert.deepEqual(await (await read(first)).json(), { scopes: { parking: saved } });

  const cleared = await update('/api/data/parking', second, { revision: 1, data: null });
  assert.equal(cleared.status, 200);
  assert.deepEqual(await (await read(first)).json(), { scopes: { parking: { revision: 2, data: null } } });
});

test('signs in and syncs module records between two browsers', { skip: !process.env.M_APP_BROWSER_SMOKE }, async (t) => {
  const { password, dispatch } = fixture(t, '  browser smoke password  ');
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  // The production HTML rewriter is provided by Workers. Recreate its single
  // attribute injection for the built-page smoke test.
  globalThis.HTMLRewriter = class {
    on(tag, observer) {
      this.tag = tag;
      this.observer = observer;
      return this;
    }

    async transform(response) {
      const content = await response.text();
      const pattern = new RegExp(`<${this.tag}(?=[ >])[^>]*>`, 'i');
      const transformed = content.replace(pattern, (tag) => {
        let result = tag;
        this.observer.element({
          setAttribute(name, value) { result = `${result.slice(0, -1)} ${name}="${value}">`; }
        });
        return result;
      });
      return new Response(transformed, response);
    }
  };
  t.after(() => { delete globalThis.HTMLRewriter; });

  let base;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const request = new Request(`${base}${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined
      });
      const response = await dispatch(request, undefined, () => new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500);
      outgoing.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => server.close());
  const browserCheck = fileURLToPath(new URL('./cloudflare-browser.py', import.meta.url));
  const browser = runFile('python', [browserCheck, base], { timeout: 35_000 });
  browser.child.stdin.end(password);
  await browser;
});
