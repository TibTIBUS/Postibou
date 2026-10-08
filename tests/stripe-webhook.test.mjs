import test from 'node:test';
import assert from 'node:assert/strict';
import { createStripeWebhookHandler } from '../netlify/functions/stripe-webhook.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const event = {
  id: 'evt_checkout_1',
  type: 'checkout.session.completed',
  data: { object: { mode: 'subscription', payment_status: 'paid', client_reference_id: userId, subscription: 'sub_123' } }
};

function request() {
  return new Request('https://postibou.netlify.app/api/stripe/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'test-signature' }, body: JSON.stringify(event)
  });
}

test('verifies paid checkout, schedules the 2027 price change, and records entitlement', async () => {
  const calls = [];
  const stripe = {
    webhooks: { constructEvent: (body, signature, secret) => {
      assert.ok(body instanceof Buffer); assert.equal(signature, 'test-signature'); assert.equal(secret, 'whsec_test'); return event;
    } },
    subscriptions: { retrieve: async id => {
      assert.equal(id, 'sub_123');
      return { id, customer: 'cus_123', status: 'active', cancel_at_period_end: false, schedule: null, items: { data: [{ price: { id: 'price_1UO13LEnc0W23lgnnIpKJi4k' }, current_period_start: 1791374400, current_period_end: 1794052800 }] } };
    } },
    subscriptionSchedules: {
      create: async (params, options) => { calls.push(['schedule-create', params, options]); return { id: 'sub_sched_1', current_phase: { start_date: 1791374400, end_date: 1794052800 } }; },
      update: async (id, params, options) => { calls.push(['schedule-update', id, params, options]); return {}; }
    }
  };
  const queries = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?'); queries.push({ query, values });
    if (query.includes('INSERT INTO public.postibou_stripe_events')) return [{ event_id: event.id }];
    if (query.includes('FROM public.postibou_entitlements WHERE user_id')) return [{ user_id: userId }];
    if (query.includes("SET plan = 'monthly'")) return [{user_id: userId}];
    return [];
  };
  const handler = createStripeWebhookHandler({ getStripe: () => stripe, getDatabase: () => sql, getWebhookSecret: () => 'whsec_test' });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(calls[0][0], 'schedule-create');
  const update = calls.find(call => call[0] === 'schedule-update');
  assert.ok(update);
  assert.equal(update[2].end_behavior, 'release');
  assert.deepEqual(update[2].phases[0].duration, { interval: 'month', interval_count: 3 });
  assert.equal('iterations' in update[2].phases[0], false);
  assert.equal(update[2].phases[1].items[0].price, 'price_1UO13LEnc0W23lgnTxtNXNW6');
  assert.equal(update[2].phases[0].proration_behavior, 'none');
  assert.ok(queries.some(({ query }) => query.includes("SET plan = 'monthly'")));
  assert.ok(queries.some(({ query }) => query.includes("SET status = 'processed'")));
});

test('a delayed paid-checkout event does not recreate future phases after scheduled cancellation', async () => {
  let scheduled = false;
  const queries = [];
  const subscription = { id: 'sub_123', customer: 'cus_123', status: 'active', cancel_at: 1794052800,
    cancel_at_period_end: false, schedule: 'sched_1', items: { data: [{ price: { id: 'price_1UO13LEnc0W23lgnnIpKJi4k' }, current_period_start: 1791374400, current_period_end: 1794052800 }] } };
  const sql = async (strings, ...values) => {
    const query = strings.join('?'); queries.push({query, values});
    if (query.includes('INSERT INTO public.postibou_stripe_events')) return [{ event_id: event.id }];
    if (query.includes('SELECT user_id')) return [{ user_id: userId }];
    if (query.includes("SET plan = 'monthly'")) return [{user_id: userId}];
    return [];
  };
  const stripe = {
    webhooks: { constructEvent: () => event }, subscriptions: { retrieve: async () => subscription },
    subscriptionSchedules: { retrieve: async () => { scheduled = true; throw new Error('must not schedule'); } }
  };
  const response = await createStripeWebhookHandler({ getStripe: () => stripe, getDatabase: () => sql, getWebhookSecret: () => 'test' })(request());
  assert.equal(response.status, 200);
  assert.equal(scheduled, false);
  const persisted = queries.find(({query}) => query.includes("SET plan = 'monthly'"));
  assert.equal(persisted.values[7], true);
});

test('an out-of-order subscription update persists the current cancellation instead of stale event fields', async () => {
  const staleEvent = { id: 'evt_stale', type: 'customer.subscription.updated', data: { object: { id: 'sub_123', customer: 'cus_123', cancel_at: null, cancel_at_period_end: false } } };
  let retrieved = false;
  let saved;
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    if (query.includes('INSERT INTO')) return [{event_id: staleEvent.id}];
    if (query.includes('SELECT user_id')) return [{user_id: userId}];
    if (query.includes("SET plan = 'monthly'")) saved = values;
    if (query.includes("SET plan = 'monthly'")) return [{user_id: userId}];
    return [];
  };
  const stripe = { webhooks: { constructEvent: () => staleEvent }, subscriptions: { retrieve: async id => {
    retrieved = true; assert.equal(id, 'sub_123');
    return { id, customer: 'cus_123', status: 'active', cancel_at: 1794052800, items: { data: [{ current_period_start: 1791374400, current_period_end: 1794052800 }] } };
  } } };
  assert.equal((await createStripeWebhookHandler({ getStripe: () => stripe, getDatabase: () => sql, getWebhookSecret: () => 'test' })(request())).status, 200);
  assert.equal(retrieved, true);
  assert.equal(saved[7], true);
});


test('missing or forged Stripe signature is rejected before database access', async () => {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe('sk_test_synthetic_only');
  let databaseCalled = false;
  const handler = createStripeWebhookHandler({getStripe:()=>stripe,getWebhookSecret:()=> 'whsec_synthetic_only',getDatabase:()=>{databaseCalled=true;throw new Error('unexpected')}});
  for(const signature of [null,'t=0,v1=invalid']) {
    const headers={'Content-Type':'application/json'};if(signature)headers['Stripe-Signature']=signature;
    const response=await handler(new Request('https://postibou.netlify.app/api/stripe/webhook',{method:'POST',headers,body:JSON.stringify(event)}));
    assert.equal(response.status,400);assert.equal((await response.json()).code,'INVALID_SIGNATURE');
  }
  assert.equal(databaseCalled,false);
});
