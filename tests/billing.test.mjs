import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutHandler } from '../netlify/functions/billing-checkout.mjs';
import { createPortalHandler } from '../netlify/functions/billing-portal.mjs';

const origin = 'https://postibou.netlify.app';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'artisan@example.fr' };
const auth = async () => Response.json({ session: { id: 's1' }, user: { ...user, emailVerified: true } });

function request(path, headers = {}) {
  return new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: '{}' });
}

function database(account) {
  const sql = async strings => strings.join('?').includes('SELECT stripe_customer_id')
    ? [account]
    : [];
  return sql;
}

test('creates a launch-price Checkout Session without adding a Stripe trial', async () => {
  let payload;
  const handler = createCheckoutHandler({
    fetchAuth: auth,
    getDatabase: () => database({ stripe_customer_id: null, stripe_subscription_status: null, subscription_period_end: null }),
    getStripe: () => ({ checkout: { sessions: { create: async data => { payload = data; return { url: 'https://checkout.stripe.com/c/pay/cs_test' }; } } } }),
    now: () => Date.parse('2026-10-07T12:00:00Z')
  });
  const response = await handler(request('/api/billing/checkout'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.url, 'https://checkout.stripe.com/c/pay/cs_test');
  assert.deepEqual(payload.line_items, [{ price: 'price_1UO13LEnc0W23lgnnIpKJi4k', quantity: 1 }]);
  assert.equal(payload.mode, 'subscription');
  assert.equal(payload.client_reference_id, user.id);
  assert.equal('subscription_data' in payload, false);
  assert.equal('automatic_tax' in payload, false);
});

test('uses the standard price for subscriptions started in 2027', async () => {
  let payload;
  const handler = createCheckoutHandler({
    fetchAuth: auth,
    getDatabase: () => database({ stripe_customer_id: 'cus_existing', stripe_subscription_status: 'canceled', subscription_period_end: '2026-12-31T00:00:00Z' }),
    getStripe: () => ({ checkout: { sessions: { create: async data => { payload = data; return { url: 'https://checkout.stripe.com/c/pay/cs_test' }; } } } }),
    now: () => Date.parse('2027-01-01T12:00:00Z')
  });
  const response = await handler(request('/api/billing/checkout'));
  assert.equal(response.status, 200);
  assert.equal(payload.line_items[0].price, 'price_1UO13LEnc0W23lgnTxtNXNW6');
  assert.equal(payload.customer, 'cus_existing');
});

test('blocks a second active subscription and cross-origin checkout', async () => {
  let stripeCalled = false;
  const deps = {
    fetchAuth: auth,
    getDatabase: () => database({ stripe_customer_id: 'cus_existing', stripe_subscription_status: 'active', subscription_period_end: new Date(Date.now() + 86400000).toISOString() }),
    getStripe: () => { stripeCalled = true; return {}; }
  };
  const handler = createCheckoutHandler(deps);
  assert.equal((await handler(request('/api/billing/checkout'))).status, 409);
  assert.equal(stripeCalled, false);
  assert.equal((await handler(request('/api/billing/checkout', { Origin: 'https://attacker.example' }))).status, 403);
});

test('creates a customer portal session for the signed-in owner', async () => {
  let payload;
  const handler = createPortalHandler({
    fetchAuth: auth,
    getDatabase: () => database({ stripe_customer_id: 'cus_123' }),
    getStripe: () => ({ billingPortal: { sessions: { create: async data => { payload = data; return { url: 'https://billing.stripe.com/p/session/test' }; } } } })
  });
  const response = await handler(request('/api/billing/portal'));
  assert.equal(response.status, 200);
  assert.equal(payload.customer, 'cus_123');
  assert.equal(payload.return_url, origin + '/#compte');
});
