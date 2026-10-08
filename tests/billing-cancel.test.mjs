import test from 'node:test';
import assert from 'node:assert/strict';
import { createCancellationHandler } from '../netlify/functions/billing-cancel.mjs';

const origin = 'https://postibou.com';
const userId = '11111111-1111-4111-8111-111111111111';
const end = 1794052800;
const start = 1791374400;
const auth = async () => Response.json({ session: { id: 's' }, user: { id: userId, emailVerified: true } });
const request = (requestOrigin = origin) => new Request(origin + '/api/billing/cancel', {
  method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: '{"subscription":"sub_someone_else"}'
});
function fixture({ scheduled = false, pending = false, customer = 'cus_123', failStripe = false, failDatabase = false } = {}) {
  const calls = [];
  const subscription = { id: 'sub_123', customer, status: 'active', schedule: scheduled ? 'sched_123' : null,
    cancel_at_period_end: !scheduled && pending, cancel_at: scheduled && pending ? end : null,
    items: { data: [{ current_period_end: end }] } };
  const phase = { start_date: start, end_date: end + 8640000, items: [{ price: { id: 'price_launch' }, quantity: 1 }],
    automatic_tax: { enabled: false }, default_tax_rates: [{ id: 'txr_123' }],
    discounts: [{ discount: 'di_123' }], default_payment_method: { id: 'pm_123' }, collection_method: 'charge_automatically' };
  const sql = async (strings, ...values) => {
    const query = strings.join('?'); calls.push(['sql', query, values]);
    if (query.includes('SELECT')) return [{ stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123' }];
    if (failDatabase) throw new Error('db offline');
    return [];
  };
  const stripe = {
    subscriptions: {
      retrieve: async id => { assert.equal(id, 'sub_123'); return subscription; },
      update: async (...args) => { calls.push(['subscription-update', ...args]); if (failStripe) throw new Error('stripe offline'); return {}; }
    },
    subscriptionSchedules: {
      retrieve: async () => ({ id: 'sched_123', status: 'active', subscription: 'sub_123', customer: 'cus_123', current_phase: { start_date: start }, phases: [phase, { start_date: phase.end_date, items: [{ price: 'price_standard' }] }] }),
      update: async (...args) => { calls.push(['schedule-update', ...args]); if (failStripe) throw new Error('stripe offline'); return {}; }
    }
  };
  return { calls, subscription, handler: createCancellationHandler({ fetchAuth: auth, getDatabase: () => sql, getStripe: () => stripe, now: () => start * 1000 + 1000 }) };
}

test('cancels an ordinary subscription at its paid boundary using the database owner', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { cancelAtPeriodEnd: true, subscriptionPeriodEnd: new Date(end * 1000).toISOString() });
  const update = calls.find(call => call[0] === 'subscription-update');
  assert.equal(update[1], 'sub_123');
  assert.deepEqual(update[2], { cancel_at_period_end: true, proration_behavior: 'none' });
  assert.match(update[3].idempotencyKey, /^postibou_cancel_sub_123_/);
  const saved = calls.find(call => call[0] === 'sql' && call[1].includes('UPDATE'));
  assert.ok(saved);
  assert.equal(saved[1].includes('adaptations_used'), false);
});

test('scheduled cancellation drops the 2027 phase, preserves billing settings and never cancels immediately', async () => {
  const { handler, calls } = fixture({ scheduled: true });
  assert.equal((await handler(request())).status, 200);
  const update = calls.find(call => call[0] === 'schedule-update');
  assert.equal(update[2].end_behavior, 'cancel');
  assert.equal(update[2].proration_behavior, 'none');
  assert.equal(update[2].phases.length, 1);
  const phase = update[2].phases[0];
  assert.equal(phase.start_date, start);
  assert.equal(phase.end_date, end);
  assert.deepEqual(phase.items, [{ price: 'price_launch', quantity: 1 }]);
  assert.deepEqual(phase.default_tax_rates, ['txr_123']);
  assert.deepEqual(phase.discounts, [{ discount: 'di_123' }]);
  assert.deepEqual(phase.automatic_tax, { enabled: false });
  assert.equal(phase.default_payment_method, 'pm_123');
  assert.equal(calls.some(call => call[0] === 'subscription-update'), false);
});

for (const scheduled of [false, true]) test(`retry repairs local state without another Stripe mutation (schedule=${scheduled})`, async () => {
  const { handler, calls } = fixture({ scheduled, pending: true });
  assert.equal((await handler(request())).status, 200);
  assert.equal(calls.some(call => call[0].endsWith('-update')), false);
  assert.ok(calls.some(call => call[0] === 'sql' && call[1].includes('UPDATE')));
});

test('customer mismatch and cross-origin requests do not mutate anything', async () => {
  const { handler, calls } = fixture({ customer: 'cus_someone_else' });
  assert.equal((await handler(request())).status, 409);
  assert.equal((await handler(request('https://attacker.example'))).status, 403);
  assert.equal(calls.some(call => call[0].endsWith('-update') || call[1]?.includes('UPDATE')), false);
});

test('anonymous requests cannot open the database or Stripe', async () => {
  const handler = createCancellationHandler({ fetchAuth: async () => Response.json({}), getDatabase: () => { throw new Error('must not call'); } });
  assert.equal((await handler(request())).status, 401);
});

test('a Stripe failure does not record a successful cancellation', async () => {
  const { handler, calls } = fixture({ scheduled: true, failStripe: true });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.some(call => call[0] === 'sql' && call[1].includes('UPDATE')), false);
});

test('database failure after Stripe success is reported, and pending cancellation can be retried', async () => {
  const { handler, calls } = fixture({ failDatabase: true });
  assert.equal((await handler(request())).status, 503);
  assert.ok(calls.some(call => call[0] === 'subscription-update'));
  const retry = fixture({ pending: true });
  assert.equal((await retry.handler(request())).status, 200);
});
