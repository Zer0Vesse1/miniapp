import '../work/cooking.js';
import '../work/experiences.js';
import '../work/mahjong.js';
import '../work/people.js';

const ownerId = 'm-app-personal';
const scopes = new Set(['parking', 'food', 'people', 'cooking', 'mahjong']);
const recordIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const requestLimit = 12 * 1024 * 1024;
// At most 750 KB of UTF-8 per part, comfortably below D1's two-megabyte row limit.
const partLength = 250_000;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, maxLength, required = false) {
  return typeof value === 'string' && value.length <= maxLength && (!required || Boolean(value.trim()));
}

function validRecords(records, kind) {
  if (!Array.isArray(records)) return false;
  const ids = new Set();
  for (const record of records) {
    if (!isObject(record) || record.kind !== kind
      || typeof record.id !== 'string' || !recordIdPattern.test(record.id)
      || record.id === 'parking' || record.id === 'none' || ids.has(record.id)
      || !isText(record.title, 30, true) || !isText(record.summary, 180)
      || !isText(record.detail, 1000) || !isText(record.time, 32, true)) return false;
    ids.add(record.id);
    if (Object.hasOwn(record, 'experiences')) {
      globalThis.RecordExperiences.normalize(record.experiences, kind);
    }
    if (kind === 'people' && Object.hasOwn(record, 'person')) {
      globalThis.PeopleCards.normalizePerson(record.person, { strict: true });
    }
    if (kind === 'cooking' && Object.hasOwn(record, 'recipe')) {
      globalThis.CookingGuide.normalizeRecipe(record.recipe, { strict: true });
    }
    if (kind === 'cooking' && Object.hasOwn(record, 'durationMinutes')) {
      globalThis.CookingGuide.normalizeDuration(record.durationMinutes);
    }
  }
  return true;
}

function validScopeData(scope, data) {
  switch (scope) {
    case 'parking':
      return data === null || (isObject(data) && isText(data.place, 28, true)
        && isText(data.area, 18) && isText(data.number, 12) && isText(data.time, 32, true));
    case 'food':
    case 'cooking':
      return validRecords(data, scope);
    case 'people':
      if (!isObject(data) || !isObject(data.settings) || !['recent', 'name'].includes(data.sort)) return false;
      globalThis.PeopleCards.normalizeSettings(data.settings, { strict: true });
      return validRecords(data.records, scope);
    case 'mahjong':
      if (!isObject(data)) return false;
      globalThis.MahjongCalculator.normalizeState(data, { strict: true });
      return true;
    default:
      return false;
  }
}

async function readInput(request) {
  const length = Number(request.headers.get('Content-Length'));
  if (length > requestLimit) return { error: 'payload_too_large', status: 413 };
  if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return { error: 'invalid_content_type', status: 415 };
  }
  const reader = request.body?.getReader();
  if (!reader) return { error: 'invalid_data', status: 400 };

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > requestLimit) {
        await reader.cancel().catch(() => {});
        return { error: 'payload_too_large', status: 413 };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return { body: JSON.parse(chunks.join('')) };
  } catch {
    return { error: 'invalid_data', status: 400 };
  } finally {
    reader.releaseLock();
  }
}

function toParts(data) {
  const contents = JSON.stringify(data);
  const parts = [];
  let start = 0;
  while (start < contents.length) {
    let end = Math.min(start + partLength, contents.length);
    // Keep supplementary characters together when storing the parts separately.
    if (end < contents.length && /[\uD800-\uDBFF]/.test(contents[end - 1])) end -= 1;
    parts.push(contents.slice(start, end));
    start = end;
  }
  return parts;
}

async function readScopes(db, scope) {
  const filter = scope === undefined ? '' : 'AND entry.scope = ?2';
  const params = scope === undefined ? [ownerId] : [ownerId, scope];
  const { results } = await db.prepare(`
    SELECT entry.scope, entry.revision, part.contents
    FROM app_sync AS entry
    JOIN app_sync_parts AS part USING (owner_id, scope)
    WHERE entry.owner_id = ?1 ${filter}
    ORDER BY entry.scope, part.position
  `).bind(...params).all();

  const entries = new Map();
  for (const row of results) {
    if (!entries.has(row.scope)) entries.set(row.scope, { revision: row.revision, parts: [] });
    entries.get(row.scope).parts.push(row.contents);
  }
  return Object.fromEntries([...entries].map(([name, { revision, parts }]) => [
    name, { revision, data: JSON.parse(parts.join('')) }
  ]));
}

async function writeScopes(db, entries) {
  // Every statement in this batch shares a transaction. The write token gates the
  // parts so a stale version on any scope leaves all existing values untouched.
  const writeToken = crypto.randomUUID();
  const values = entries.map(() => '(?, ?)').join(', ');
  const revisions = db.prepare(`
    WITH requested(scope, revision) AS (VALUES ${values}),
    matching AS MATERIALIZED (
      SELECT COUNT(*) AS matched
      FROM requested
      LEFT JOIN app_sync AS existing ON existing.owner_id = ? AND existing.scope = requested.scope
      WHERE COALESCE(existing.revision, 0) = requested.revision
    )
    INSERT INTO app_sync (owner_id, scope, revision, write_token)
    SELECT ?, requested.scope, requested.revision + 1, ?
    FROM requested CROSS JOIN matching
    WHERE matching.matched = ?
    ON CONFLICT (owner_id, scope) DO UPDATE SET
      revision = excluded.revision, write_token = excluded.write_token
    RETURNING scope, revision
  `).bind(...entries.flatMap(([scope, entry]) => [scope, entry.revision]), ownerId, ownerId, writeToken, entries.length);

  const wipePreviousParts = db.prepare(`
    DELETE FROM app_sync_parts
    WHERE owner_id = ?1 AND scope IN (
      SELECT scope FROM app_sync WHERE owner_id = ?1 AND write_token = ?2
    )
  `).bind(ownerId, writeToken);

  const newParts = entries.map(([scope, entry]) => {
    const parts = toParts(entry.data);
    const partValues = parts.map((_, position) => `(${position}, ?${position + 4})`).join(', ');
    return db.prepare(`
      WITH parts(position, contents) AS (VALUES ${partValues})
      INSERT INTO app_sync_parts (owner_id, scope, position, contents)
      SELECT ?1, ?2, position, contents FROM parts
      WHERE EXISTS (SELECT 1 FROM app_sync WHERE owner_id = ?1 AND scope = ?2 AND write_token = ?3)
    `).bind(ownerId, scope, writeToken, ...parts);
  });

  const [{ results }] = await db.batch([revisions, wipePreviousParts, ...newParts]);
  if (results.length === 0) return null;
  return Object.fromEntries(entries.map(([scope, { revision, data }]) => [
    scope, { revision: revision + 1, data }
  ]));
}

export async function handleDataRequest({ env, request }, scope) {
  if (scope !== undefined && !scopes.has(scope)) return json({ error: 'unknown_scope' }, 404);
  const allow = scope === undefined ? 'GET, PUT' : 'PUT';
  if (!allow.split(', ').includes(request.method)) {
    return json({ error: 'method_not_allowed' }, 405, { Allow: allow });
  }
  const db = env.M_APP_DB;
  if (!db) return json({ error: 'sync_unavailable' }, 503);
  try {
    if (request.method === 'GET') return json({ scopes: await readScopes(db) });

    const input = await readInput(request);
    if (input.error) return json({ error: input.error }, input.status);
    const { body } = input;
    const entries = scope === undefined
      ? (isObject(body?.scopes) ? Object.entries(body.scopes) : [])
      : [[scope, body]];
    try {
      const valid = entries.length > 0 && entries.length <= scopes.size && entries.every(([name, entry]) => (
        scopes.has(name) && isObject(entry) && Number.isSafeInteger(entry.revision)
        && entry.revision >= 0 && entry.revision < Number.MAX_SAFE_INTEGER && validScopeData(name, entry.data)
      ));
      if (!valid) return json({ error: 'invalid_data' }, 400);
    } catch {
      return json({ error: 'invalid_data' }, 400);
    }

    const updated = await writeScopes(db, entries);
    if (updated) return json(scope === undefined ? { scopes: updated } : updated[scope]);
    if (scope === undefined) return json({ error: 'conflict' }, 409);
    const latest = (await readScopes(db, scope))[scope] ?? { revision: 0, data: null };
    return json({ error: 'conflict', ...latest }, 409);
  } catch {
    return json({ error: 'sync_unavailable' }, 503);
  }
}
