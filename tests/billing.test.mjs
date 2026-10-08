import test from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutHandler } from '../netlify/functions/billing-checkout.mjs';
import { createPortalHandler } from '../netlify/functions/billing-portal.mjs';
import { TERMS_VERSION } from '../netlify/functions/legal-policy.mjs';

const origin = 'https://postibou.netlify.app';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'artisan@example.fr' };
const auth = async () => Response.json({ session: { id: 's1' }, user: { ...user, emailVerified: true } });

function request(path, headers = {}) {
  return new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({acceptedTerms:true,termsVersion:TERMS_VERSION}) });
}

function database(account) {
  const sql = async strings => strings.join('?').includes('SELECT stripe_customer_id')
    ? [account]
    : [];
  return sql;
}

test('blocks a second active subscription and cross-origin checkout', async () => {
  let stripeCalled = false;
  const deps = {
    paidLaunchReady: true, mailReady: () => true,
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
