import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageHandler } from '../netlify/functions/usage.mjs';

const origin = 'https://postibou.netlify.app';
const request = new Request(origin + '/api/usage', { headers: { Origin: origin, Cookie: '__Secure-neon-auth.session_token=private' } });

test('initializes a verified account trial and returns the remaining quota', async () => {
  const queries = [];
  const sql = async (strings) => {
    if (strings.join('?').includes('UPDATE public.postibou_gifts')) return [];
    queries.push(strings.join('?'));
    return queries.length === 1 ? [] : [{ plan: 'trial', trial_started_at: '2026-10-07T00:00:00Z', trial_ends_at: new Date(Date.now() + 86400000).toISOString(), adaptations_used: 0 }];
  };
  const handler = createUsageHandler({ fetchAuth: async (_url, options) => { assert.match(options.headers.Cookie, /session_token/); return Response.json({ session: { id: 's' }, user: { id: '11111111-1111-4111-8111-111111111111', emailVerified: true } }); }, getDatabase: () => sql });
  const response = await handler(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.creditsRemaining, 10);
  assert.equal(body.active, true);
  assert.match(queries[0], /INSERT INTO public\.postibou_entitlements/);
  assert.match(queries[0], /neon_auth\."user"/);
});

test('does not create an entitlement for an unverified session', async () => {
  let openedDatabase = false;
  const handler = createUsageHandler({ fetchAuth: async () => Response.json({ session: { id: 's' }, user: { id: '11111111-1111-4111-8111-111111111111', emailVerified: false } }), getDatabase: () => { openedDatabase = true; } });
  const response = await handler(request);
  assert.equal(response.status, 401);
  assert.equal(openedDatabase, false);
});

test('returns the monthly quota and keeps access through the paid period end', async () => {
  const sql = async strings => {
    const query = strings.join('?');
    if (query.includes('UPDATE public.postibou_gifts')) return [];
    if (query.includes('INSERT INTO public.postibou_entitlements')) return [];
    assert.match(query, /SELECT[\s\S]*stripe_customer_id/);
    assert.match(query, /SELECT[\s\S]*stripe_subscription_id/);
    return [{
        plan: 'monthly', trial_started_at: '2026-10-07T00:00:00Z', trial_ends_at: '2026-10-14T00:00:00Z',
        adaptations_used: 12, stripe_subscription_status: 'active',
        subscription_period_start: '2026-10-01T00:00:00.000Z',
        subscription_period_end: new Date(Date.now() + 86400000).toISOString(),
        usage_period_start: '2026-10-01T00:00:00.000Z', cancel_at_period_end: true,
        stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123'
      }];
  };
  const handler = createUsageHandler({
    fetchAuth: async () => Response.json({ session: { id: 's' }, user: { id: '11111111-1111-4111-8111-111111111111', emailVerified: true } }),
    getDatabase: () => sql
  });
  const response = await handler(request);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.plan, 'monthly');
  assert.equal(body.quota, 30);
  assert.equal(body.creditsRemaining, 18);
  assert.equal(body.active, true);
  assert.equal(body.cancelAtPeriodEnd, true);
  assert.equal(body.hasBilling, true);
  assert.equal(body.canCancel, false);
});
