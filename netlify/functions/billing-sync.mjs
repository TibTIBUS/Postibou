import { createDatabase, createStripeClient, getVerifiedUser, validPostibouRequest } from './stripe-client.mjs';
import { fulfillPaidCheckout } from './stripe-webhook.mjs';
export const config = { path: '/api/billing/sync', method: 'POST' };
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
// Recovery uses Stripe's server response and the stored own checkout attempt.
// It never trusts a session id, payment status or account id sent by the browser.
export function createBillingSyncHandler({ getUser = getVerifiedUser, getDatabase = createDatabase, getStripe = createStripeClient, fulfill = fulfillPaidCheckout } = {}) {
  return async request => {
    const reply = (body, status = 200) => Response.json(body, { status, headers });
    if (request.method !== 'POST') return reply({code:'METHOD_NOT_ALLOWED'},405);
    if (!validPostibouRequest(request,'POST')) return reply({code:'FORBIDDEN'},403);
    try {
      const user = await getUser(request);
      if (!user) return reply({code:'UNAUTHORIZED'},401);
      const sql = await getDatabase();
      const rows = await sql`SELECT checkout_session_id,attempt_id FROM postibou_checkout_attempts WHERE user_id = ${user.id}::uuid`;
      const attempt = rows[0];
      if (!attempt?.checkout_session_id) return reply({synced:false,reason:'NO_CHECKOUT'});
      const stripe = await getStripe();
      const session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
      if (session.id !== attempt.checkout_session_id || session.client_reference_id !== user.id || session.metadata?.postibou_attempt_id !== attempt.attempt_id || session.livemode !== true || session.mode !== 'subscription') return reply({code:'CHECKOUT_MISMATCH'},409);
      if (session.status !== 'complete' || session.payment_status !== 'paid') return reply({synced:false,reason:'PAYMENT_PENDING'});
      await fulfill(sql,stripe,session);
      return reply({synced:true});
    } catch(error) {
      const reason = error.type === 'StripePermissionError' ? 'STRIPE_PERMISSION' : /^[A-Z_]{2,70}$/.test(error.message || '') ? error.message : 'SERVICE_UNAVAILABLE';
      return reply({code:'SYNC_FAILED',reason},503);
    }
  };
}
export default createBillingSyncHandler();
