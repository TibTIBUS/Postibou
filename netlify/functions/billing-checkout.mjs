import { createDatabase, createStripeClient, getVerifiedUser, validPostibouRequest } from './stripe-client.mjs';
import { SITE_ORIGIN } from './auth.mjs';
import { randomBytes } from 'node:crypto';

export const config = { path: '/api/billing/checkout', method: 'POST' };
const headers = { 'Cache-Control': 'no-store, private', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => Response.json(body, { status, headers });
const priceLaunch = 'price_1UO13LEnc0W23lgnnIpKJi4k';
const priceStandard = 'price_1UO13LEnc0W23lgnTxtNXNW6';
const launchEndsAt = Date.parse('2026-12-31T23:00:00.000Z');

export function createCheckoutHandler({ fetchAuth = fetch, getDatabase = createDatabase, getStripe = createStripeClient, now = () => Date.now() } = {}) {
  return async request => {
    if (!validPostibouRequest(request, 'POST')) return reply({ code: 'FORBIDDEN' }, 403);
    if ((request.headers.get('content-type') || '').toLowerCase().startsWith('application/json') === false) return reply({ code: 'INVALID_INPUT' }, 415);
    try {
      const user = await getVerifiedUser(request, fetchAuth);
      if (!user) return reply({ code: 'UNAUTHORIZED' }, 401);
      const sql = await getDatabase();
      await sql`
        INSERT INTO public.postibou_entitlements (user_id)
        SELECT id FROM neon_auth."user" WHERE id = ${user.id}::uuid AND "emailVerified" = true
        ON CONFLICT (user_id) DO NOTHING
      `;
      const rows = await sql`
        SELECT stripe_customer_id, stripe_subscription_status, subscription_period_end
        FROM public.postibou_entitlements WHERE user_id = ${user.id}::uuid
      `;
      const account = rows[0];
      if (!account) return reply({ code: 'ACCOUNT_UNAVAILABLE' }, 503);
      if (['active', 'past_due', 'trialing'].includes(account.stripe_subscription_status)
        && account.subscription_period_end && new Date(account.subscription_period_end).getTime() > now()) {
        return reply({ code: 'SUBSCRIPTION_ALREADY_ACTIVE' }, 409);
      }

      const stripe = await getStripe();
      const launch = now() < launchEndsAt;
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: launch ? priceLaunch : priceStandard, quantity: 1 }],
        ...(account.stripe_customer_id ? { customer: account.stripe_customer_id } : { customer_email: user.email }),
        client_reference_id: user.id,
        success_url: SITE_ORIGIN + '/?billing=success#compte',
        cancel_url: SITE_ORIGIN + '/#abonnement',
        integration_identifier: 'postibou_checkout_' + randomBytes(16).toString('hex').slice(0, 8)
      });
      if (!session?.url || !session.url.startsWith('https://checkout.stripe.com/')) return reply({ code: 'CHECKOUT_UNAVAILABLE' }, 503);
      return reply({ url: session.url });
    } catch {
      return reply({ code: 'SERVICE_UNAVAILABLE' }, 503);
    }
  };
}

export default createCheckoutHandler();
