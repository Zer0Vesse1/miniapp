import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
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
const bundledSql = readFileSync(new URL('../migrations/0001_sync.sql', import.meta.url), 'utf8');
const runFile = promisify(execFile);

function fixture(t) {
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

  const password = randomBytes(32).toString('base64url');
  const salt = randomBytes(16);
  const hash = createHash('sha256').update(salt).update(password).digest('base64url');
  const env = {
    M_APP_DB: binding,
    M_APP_PASSWORD_HASH: `${salt.toString('base64url')}.${hash}`,
    M_APP_SESSION_SECRET: randomBytes(32).toString('base64url')
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

  function login(credential = password, headers = originHeaders) {
    return request('/api/auth/login', {
      method: 'POST',
      headers,
      body: new URLSearchParams({ password: credential })
    });
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

  return { request, login, signIn, read, update, password, dispatch };
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
  const { password, dispatch } = fixture(t);
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
