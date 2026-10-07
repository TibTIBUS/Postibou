import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptHandler } from '../netlify/functions/adapt.mjs';

const origin = 'https://postibou.netlify.app';
const sessionFetch = async () => Response.json({ session: { id: 's1' }, user: { id: '11111111-1111-4111-8111-111111111111', emailVerified: true } });

function makeDatabase(initialUsed = 0) {
  const db = { used: initialUsed, reservations: new Map(), end: new Date(Date.now() + 86400000).toISOString() };
  db.sql = async (strings, ...values) => {
    const query = strings.join('?');
    if (query.includes('WITH usage AS')) {
      if (db.used >= 10 || Date.parse(db.end) <= Date.now()) return [];
      db.used++;
      db.reservations.set(values[1], 'reserved');
      return [{ id: values[1] }];
    }
    if (query.includes('UPDATE public.postibou_adaptation_reservations SET status = \'completed\'')) {
      db.reservations.set(values[0], 'completed'); return [{ id: values[0] }];
    }
    if (query.includes('SELECT adaptations_used, trial_ends_at')) return [{ adaptations_used: db.used, trial_ends_at: db.end }];
    if (query.includes('SELECT trial_ends_at, adaptations_used')) return [{ trial_ends_at: db.end, adaptations_used: db.used }];
    if (query.includes('WITH released AS')) {
      const id = values[0];
      if (db.reservations.get(id) === 'reserved') { db.reservations.set(id, 'refunded'); db.used--; }
      return [];
    }
    return [];
  };
  return db;
}

function request(body, headers = {}) {
  return new Request(origin + '/api/adapt', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

test('generates two adapted publications and reserves one trial credit', async () => {
  const db = makeDatabase();
  let modelRequest;
  const handler = createAdaptHandler({ fetchAuth: sessionFetch, getDatabase: () => db.sql, getApiKey: () => 'test-key', fetchModel: async (url, options) => { modelRequest = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: JSON.stringify({ facebook: 'Facebook prêt', instagram: 'Instagram prêt' }) } }] }); } });
  const response = await handler(request({ source: 'Terrasse terminée', tone: 'warm' }));
  const output = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual([output.facebook, output.instagram], ['Facebook prêt', 'Instagram prêt']);
  assert.equal(output.creditsRemaining, 9);
  assert.equal(db.used, 1);
  assert.match(modelRequest.messages[1].content, /Terrasse terminée/);
  assert.equal(modelRequest.model, 'google/gemini-3.1-flash-lite');
});

test('refunds the reserved credit when OpenRouter fails', async () => {
  const db = makeDatabase();
  const handler = createAdaptHandler({ fetchAuth: sessionFetch, getDatabase: () => db.sql, getApiKey: () => 'test-key', fetchModel: async () => new Response('{}', { status: 503 }) });
  const response = await handler(request({ source: 'Chantier terminé', tone: 'commercial' }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: 'GENERATION_FAILED' });
  assert.equal(db.used, 0);
  assert.equal([...db.reservations.values()][0], 'refunded');
});

test('enforces the ten credit limit before calling OpenRouter', async () => {
  const db = makeDatabase(10);
  let calls = 0;
  const handler = createAdaptHandler({ fetchAuth: sessionFetch, getDatabase: () => db.sql, getApiKey: () => 'test-key', fetchModel: async () => { calls++; return Response.json({}); } });
  const response = await handler(request({ source: 'Chantier terminé', tone: 'warm' }));
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { code: 'QUOTA_EXHAUSTED' });
  assert.equal(calls, 0);
});

test('rejects an unauthenticated or cross-origin generation', async () => {
  const unauthenticated = createAdaptHandler({ fetchAuth: async () => Response.json({}), getDatabase: () => { throw new Error('should not open DB'); } });
  assert.equal((await unauthenticated(request({ source: 'Texte', tone: 'warm' }))).status, 401);
  const authenticated = createAdaptHandler({ fetchAuth: sessionFetch, getDatabase: () => { throw new Error('should not open DB'); } });
  assert.equal((await authenticated(request({ source: 'Texte', tone: 'warm' }, { Origin: 'https://attacker.example' }))).status, 403);
});
