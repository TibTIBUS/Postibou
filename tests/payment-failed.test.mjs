import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptHandler } from '../netlify/functions/adapt.mjs';
import { createStripeWebhookHandler } from '../netlify/functions/stripe-webhook.mjs';
import { createUsageHandler } from '../netlify/functions/usage.mjs';
import { billingDatabase, userId } from './helpers/billing-database.mjs';

const database = await billingDatabase();
const auth = async () => Response.json({ session: { id: 's' }, user: { id: userId, emailVerified: true } });
const okModel = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ facebook: 'F', instagram: 'I' }) } }] });
const adaptRequest = () => new Request('https://postibou.com/api/adapt', { method: 'POST', headers: { Origin: 'https://postibou.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'Chantier terminé', tone: 'warm' }) });
const usageRequest = () => new Request('https://postibou.com/api/usage', { headers: { Origin: 'https://postibou.com', Cookie: '__Secure-neon-auth.session_token=x' } });
const used = async () => (await database.db.query('SELECT adaptations_used FROM postibou_entitlements')).rows[0].adaptations_used;

async function renewalFails(status) {
  await database.reset();
  await database.db.query(`INSERT INTO postibou_entitlements(user_id,plan,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,subscription_period_start,subscription_period_end,usage_period_start,adaptations_used)
    VALUES ($1,'monthly','cus_1','sub_1','active',now()-interval '31 days',now()-interval '1 minute',now()-interval '31 days',12)`, [userId]);
  const now = Math.floor(Date.now() / 1000);
  const subscription = { id: 'sub_1', customer: 'cus_1', status, cancel_at_period_end: false, items: { data: [{ price: { id: 'p' }, current_period_start: now - 60, current_period_end: now + 30 * 86400 }] } };
  const event = { id: 'evt_' + status, type: 'invoice.payment_failed', data: { object: { customer: 'cus_1', subscription: 'sub_1' } } };
  const stripe = { webhooks: { constructEvent: () => event }, subscriptions: { retrieve: async () => subscription } };
  const webhook = createStripeWebhookHandler({ getDatabase: () => database.sql, getStripe: () => stripe, getWebhookSecret: () => 'w', referralSettlement: async () => {} });
  const response = await webhook(new Request('https://postibou.netlify.app/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'x' }, body: '{}' }));
  assert.equal(response.status, 200);
}

test('an unpaid renewal does not open the new 30-adaptation quota', async () => {
  await renewalFails('past_due');
  const adapt = createAdaptHandler({ fetchAuth: auth, getDatabase: () => database.sql, getApiKey: () => 'k', fetchModel: okModel });
  const response = await adapt(adaptRequest());
  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, 'PAYMENT_FAILED');
  const reservations = await database.db.query('SELECT count(*)::int AS n FROM postibou_adaptation_reservations');
  assert.equal(reservations.rows[0].n, 0);
});

test('the account shows zero credits and the payment problem while the renewal is unpaid', async () => {
  await renewalFails('past_due');
  const usage = createUsageHandler({ fetchAuth: auth, getDatabase: () => database.sql });
  const body = await (await usage(usageRequest())).json();
  assert.equal(body.paymentFailed, true);
  assert.equal(body.creditsRemaining, 0);
  assert.equal(body.canCancel, true);
});

test('once Stripe collects the renewal, the new quota opens', async () => {
  await renewalFails('active');
  const adapt = createAdaptHandler({ fetchAuth: auth, getDatabase: () => database.sql, getApiKey: () => 'k', fetchModel: okModel });
  const response = await adapt(adaptRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).creditsRemaining, 29);
  assert.equal(await used(), 1);
});
