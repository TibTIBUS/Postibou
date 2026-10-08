import { createDatabase, createStripeClient, getVerifiedUser, validPostibouRequest } from './stripe-client.mjs';
import { SITE_ORIGIN } from './auth.mjs';

export const config = { path: '/api/billing/portal', method: 'POST' };
const headers = { 'Cache-Control': 'no-store, private', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => Response.json(body, { status, headers });

export function createPortalHandler({ fetchAuth = fetch, getDatabase = createDatabase, getStripe = createStripeClient } = {}) {
  return async request => {
    if (!validPostibouRequest(request, 'POST')) return reply({ code: 'FORBIDDEN' }, 403);
    try {
      const user = await getVerifiedUser(request, fetchAuth);
      if (!user) return reply({ code: 'UNAUTHORIZED' }, 401);
      const sql = await getDatabase();
      const rows = await sql`SELECT stripe_customer_id FROM public.postibou_entitlements WHERE user_id = ${user.id}::uuid`;
      const customer = rows[0]?.stripe_customer_id;
      if (!customer) return reply({ code: 'NO_BILLING_ACCOUNT' }, 404);
      const stripe = await getStripe();
      const session = await stripe.billingPortal.sessions.create({ customer, return_url: SITE_ORIGIN + '/#compte' });
      if (!session?.url || !session.url.startsWith('https://billing.stripe.com/')) return reply({ code: 'PORTAL_UNAVAILABLE' }, 503);
      return reply({ url: session.url });
    } catch {
      return reply({ code: 'SERVICE_UNAVAILABLE' }, 503);
    }
  };
}

export default createPortalHandler();
