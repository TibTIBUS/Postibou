import { createDatabase, createStripeClient, getVerifiedUser, validPostibouRequest } from './stripe-client.mjs';
import { SITE_ORIGIN } from './auth.mjs';
import { randomUUID } from 'node:crypto';

export const config = { path: '/api/billing/checkout', method: 'POST' };
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => Response.json(body, { status, headers });
const priceLaunch = 'price_1UO13LEnc0W23lgnnIpKJi4k';
const priceStandard = 'price_1UO13LEnc0W23lgnTxtNXNW6';
const launchEndsAt = Date.parse('2026-12-31T23:00:00.000Z');
const terminalStatuses = new Set(['canceled', 'incomplete_expired']);
const idOf = value => typeof value === 'string' ? value : value?.id;

async function acquireAttempt(sql, user, account, timestamp, previousId = null) {
  const id = randomUUID();
  const rows = await sql`
    INSERT INTO public.postibou_checkout_attempts
      (user_id, attempt_id, price_id, customer_id, customer_email, expires_at)
    VALUES (${user.id}::uuid, ${id}::uuid, ${timestamp < launchEndsAt ? priceLaunch : priceStandard},
            ${account.stripe_customer_id || null}, ${account.stripe_customer_id ? null : user.email}, ${Math.floor(timestamp / 1000) + 3600})
    ON CONFLICT (user_id) DO UPDATE
      SET attempt_id = EXCLUDED.attempt_id, price_id = EXCLUDED.price_id,
          customer_id = EXCLUDED.customer_id, customer_email = EXCLUDED.customer_email,
          expires_at = EXCLUDED.expires_at, checkout_session_id = NULL, created_at = now()
      WHERE postibou_checkout_attempts.attempt_id = ${previousId}::uuid
    RETURNING *
  `;
  if (rows[0]) return rows[0];
  const current = await sql`SELECT * FROM public.postibou_checkout_attempts WHERE user_id = ${user.id}::uuid`;
  if (!current[0]) throw new Error('CHECKOUT_ATTEMPT_UNAVAILABLE');
  return current[0];
}

function parameters(attempt, userId) {
  // Every retry uses the snapshot persisted in Neon, including price, email and expiry.
  const suffix = attempt.attempt_id.replaceAll('-', '').slice(0, 8).split('').map(char => String.fromCharCode(97 + parseInt(char, 16))).join('');
  return {
    mode: 'subscription', line_items: [{ price: attempt.price_id, quantity: 1 }],
    ...(attempt.customer_id ? { customer: attempt.customer_id } : { customer_email: attempt.customer_email }),
    client_reference_id: userId, metadata: { postibou_attempt_id: attempt.attempt_id },
    success_url: SITE_ORIGIN + '/?billing=success#compte', cancel_url: SITE_ORIGIN + '/#abonnement',
    expires_at: Number(attempt.expires_at), integration_identifier: 'postibou_checkout_' + suffix
  };
}

async function rememberSession(sql, userId, attempt, session) {
  if (!session?.id || session.mode !== 'subscription' || session.client_reference_id !== userId
    || session.metadata?.postibou_attempt_id !== attempt.attempt_id) throw new Error('CHECKOUT_SESSION_MISMATCH');
  const rows = await sql`
    UPDATE public.postibou_checkout_attempts SET checkout_session_id = ${session.id}
    WHERE user_id = ${userId}::uuid AND attempt_id = ${attempt.attempt_id}::uuid
      AND (checkout_session_id IS NULL OR checkout_session_id = ${session.id})
    RETURNING attempt_id
  `;
  if (!rows.length) throw new Error('CHECKOUT_ATTEMPT_CHANGED');
}

// A function may stop after Stripe created a session but before Neon saved its id.
// Before rotating an expired attempt, find that session even after Stripe has
// discarded its 24-hour idempotency cache. A completed payment must never be lost.
async function recoverSession(stripe, attempt, userId) {
  let after;
  for (let page = 0; page < 20; page++) {
    const sessions = await stripe.checkout.sessions.list({
      created: { gte: Number(attempt.expires_at) - 3660, lte: Number(attempt.expires_at) },
      limit: 100, ...(after ? { starting_after: after } : {})
    });
    const found = sessions.data.find(session => session.client_reference_id === userId && session.metadata?.postibou_attempt_id === attempt.attempt_id);
    if (found) return found;
    if (!sessions.has_more) return null;
    after = sessions.data.at(-1)?.id;
    if (!after) break;
  }
  throw new Error('CHECKOUT_RECONCILIATION_INCOMPLETE');
}

export function createCheckoutHandler({ fetchAuth = fetch, getDatabase = createDatabase, getStripe = createStripeClient, now = () => Date.now() } = {}) {
  return async request => {
    if (!validPostibouRequest(request, 'POST')) return reply({ code: 'FORBIDDEN' }, 403);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return reply({ code: 'INVALID_INPUT' }, 415);
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
        SELECT stripe_customer_id, stripe_subscription_id, stripe_subscription_status, subscription_period_end
        FROM public.postibou_entitlements WHERE user_id = ${user.id}::uuid
      `;
      const account = rows[0];
      if (!account) return reply({ code: 'ACCOUNT_UNAVAILABLE' }, 503);
      if (['active', 'past_due', 'trialing', 'unpaid', 'paused', 'incomplete'].includes(account.stripe_subscription_status)) {
        return reply({ code: 'SUBSCRIPTION_ALREADY_ACTIVE' }, 409);
      }
      const stripe = await getStripe();
      if (account.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
        if (idOf(subscription.customer) !== account.stripe_customer_id) throw new Error('SUBSCRIPTION_MISMATCH');
        if (!terminalStatuses.has(subscription.status)) return reply({ code: 'SUBSCRIPTION_ALREADY_ACTIVE' }, 409);
      }
      let attempt = await acquireAttempt(sql, user, account, now());
      for (let retry = 0; retry < 3; retry++) {
        let session;
        if (attempt.checkout_session_id) {
          session = await stripe.checkout.sessions.retrieve(attempt.checkout_session_id);
        } else if (Number(attempt.expires_at) * 1000 <= now()) {
          session = await recoverSession(stripe, attempt, user.id);
          if (session) await rememberSession(sql, user.id, attempt, session);
          else {
            // Wait a minute past the fixed expiry, then rotate with a database CAS.
            if (Number(attempt.expires_at) * 1000 + 60000 > now()) return reply({ code: 'CHECKOUT_RETRY_LATER' }, 409);
            attempt = await acquireAttempt(sql, user, account, now(), attempt.attempt_id);
            continue;
          }
        } else {
          const created = await stripe.checkout.sessions.create(parameters(attempt, user.id), {
            idempotencyKey: 'postibou_checkout_v2_' + attempt.attempt_id
          });
          await rememberSession(sql, user.id, attempt, created);
          // Idempotent create can return the original cached response after payment.
          session = await stripe.checkout.sessions.retrieve(created.id);
        }
        if (session.mode !== 'subscription' || session.client_reference_id !== user.id
          || session.metadata?.postibou_attempt_id !== attempt.attempt_id) throw new Error('CHECKOUT_SESSION_MISMATCH');
        if (session.status === 'complete') {
          const subId = idOf(session.subscription);
          if (!subId) return reply({ code: 'CHECKOUT_PAYMENT_PENDING' }, 409);
          const subscription = await stripe.subscriptions.retrieve(subId);
          if (idOf(subscription.customer) !== idOf(session.customer)) throw new Error('SUBSCRIPTION_MISMATCH');
          if (!terminalStatuses.has(subscription.status)) return reply({ code: 'CHECKOUT_PAYMENT_PENDING' }, 409);
        } else if (session.status === 'open') {
          if (!session.url?.startsWith('https://checkout.stripe.com/')) throw new Error('CHECKOUT_URL_UNAVAILABLE');
          return reply({ url: session.url });
        } else if (session.status !== 'expired') throw new Error('CHECKOUT_STATUS_UNAVAILABLE');
        attempt = await acquireAttempt(sql, user, account, now(), attempt.attempt_id);
      }
      return reply({ code: 'CHECKOUT_RETRY_LATER' }, 409);
    } catch {
      return reply({ code: 'SERVICE_UNAVAILABLE' }, 503);
    }
  };
}

export default createCheckoutHandler();
