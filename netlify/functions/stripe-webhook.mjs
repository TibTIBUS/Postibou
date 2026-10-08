import { createDatabase, createStripeClient } from './stripe-client.mjs';
import { recordReferralPurchase, applyReferralMonth, settleReferralInvoice } from './lib/referrals.mjs';
import { confirmContractPurchase } from './lib/contract-confirmation.mjs';

export const config = { path: '/api/stripe/webhook', method: 'POST' };
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => Response.json(body, { status, headers });
const launchPrice = 'price_1UO13LEnc0W23lgnnIpKJi4k';
const standardPrice = 'price_1UO13LEnc0W23lgnTxtNXNW6';
const launchCutover = Date.parse('2026-12-31T23:00:00.000Z') / 1000;

function seconds(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

function subscriptionPeriod(subscription) {
  const item = subscription.items?.data?.[0];
  return {
    start: seconds(item?.current_period_start ?? subscription.current_period_start),
    end: seconds(item?.current_period_end ?? subscription.current_period_end)
  };
}

function customerId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

function subscriptionId(value) {
  if (typeof value === 'string') return value;
  if (value?.id) return value.id;
  return null;
}

function monthsUntilLaunchPriceEnds(periodEnd) {
  if (!periodEnd || periodEnd >= launchCutover) return 1;
  const end = new Date(periodEnd * 1000);
  const cutover = new Date(launchCutover * 1000);
  const monthDistance = (cutover.getUTCFullYear() - end.getUTCFullYear()) * 12 + cutover.getUTCMonth() - end.getUTCMonth();
  return 2 + Math.max(0, monthDistance);
}

async function scheduleLaunchPriceChange(stripe, subscription, prices) {
  if (subscription.cancel_at_period_end || subscription.cancel_at || subscription.status !== 'active') return;
  const item = subscription.items?.data?.[0];
  const priceId = typeof item?.price === 'string' ? item.price : item?.price?.id;
  if (priceId !== prices.launch) return;
  const period = subscriptionPeriod(subscription);
  if (!period.start || !period.end) throw new Error('SUBSCRIPTION_PERIOD_UNAVAILABLE');
  const schedule = subscription.schedule
    ? await stripe.subscriptionSchedules.retrieve(subscription.schedule)
    : await stripe.subscriptionSchedules.create(
      { from_subscription: subscription.id },
      { idempotencyKey: 'postibou_schedule_' + subscription.id }
    );
  const start = schedule.current_phase?.start_date || period.start;
  const intervalCount = monthsUntilLaunchPriceEnds(period.end);
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    proration_behavior: 'none',
    phases: [
      { start_date: start, duration: { interval: 'month', interval_count: intervalCount }, items: [{ price: prices.launch, quantity: 1 }], proration_behavior: 'none' },
      { duration: { interval: 'month', interval_count: 1 }, items: [{ price: prices.standard, quantity: 1 }], proration_behavior: 'none' }
    ]
  }, { idempotencyKey: 'postibou_phase_update_' + subscription.id });
}

async function persistSubscription(sql, userId, subscription, previousSubscriptionId = null) {
  const customer = customerId(subscription.customer);
  const period = subscriptionPeriod(subscription);
  return await sql`
    UPDATE public.postibou_entitlements
    SET plan = 'monthly',
        stripe_customer_id = ${customer},
        stripe_subscription_id = ${subscription.id},
        stripe_subscription_status = ${subscription.status},
        subscription_period_start = CASE WHEN ${period.start}::bigint IS NULL THEN NULL ELSE to_timestamp(${period.start}::bigint) END,
        subscription_period_end = CASE WHEN ${period.end}::bigint IS NULL THEN NULL ELSE to_timestamp(${period.end}::bigint) END,
        cancel_at_period_end = ${Boolean(subscription.cancel_at_period_end || subscription.cancel_at)},
        adaptations_used = CASE
          WHEN subscription_period_start IS DISTINCT FROM CASE WHEN ${period.start}::bigint IS NULL THEN NULL ELSE to_timestamp(${period.start}::bigint) END THEN 0
          ELSE adaptations_used
        END,
        usage_period_start = CASE
          WHEN subscription_period_start IS DISTINCT FROM CASE WHEN ${period.start}::bigint IS NULL THEN NULL ELSE to_timestamp(${period.start}::bigint) END
          THEN CASE WHEN ${period.start}::bigint IS NULL THEN NULL ELSE to_timestamp(${period.start}::bigint) END
          ELSE usage_period_start
        END,
        updated_at = now()
    WHERE user_id = ${userId}::uuid
      AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ${subscription.id}
           OR stripe_subscription_id = ${previousSubscriptionId})
    RETURNING user_id
  `;
}

export function createStripeWebhookHandler({ getDatabase = createDatabase, getStripe = createStripeClient, getWebhookSecret = () => globalThis.Netlify?.env?.get('STRIPE_WEBHOOK_SECRET'), confirmPurchase = confirmContractPurchase, referralPurchase = recordReferralPurchase, referralRenewal = applyReferralMonth, referralSettlement = settleReferralInvoice, prices = { launch: launchPrice, standard: standardPrice } } = {}) {
  return async request => {
    if (request.method !== 'POST') return reply({ code: 'METHOD_NOT_ALLOWED' }, 405);
    const signature = request.headers.get('stripe-signature');
    const secret = getWebhookSecret();
    if (!signature) return reply({ code: 'INVALID_SIGNATURE' }, 400);
    if (!secret) return reply({ code: 'WEBHOOK_NOT_CONFIGURED' }, 503);
    let raw;
    try {
      raw = await request.text();
      if (raw.length > 256_000) return reply({ code: 'PAYLOAD_TOO_LARGE' }, 413);
    } catch { return reply({ code: 'INVALID_PAYLOAD' }, 400); }

    let stripe;
    try { stripe = await getStripe(); } catch { return reply({ code: 'WEBHOOK_NOT_CONFIGURED' }, 503); }
    let event;
    try { event = stripe.webhooks.constructEvent(Buffer.from(raw), signature, secret); }
    catch { return reply({ code: 'INVALID_SIGNATURE' }, 400); }
    try {
      const sql = await getDatabase();
      const inserted = await sql`
        INSERT INTO public.postibou_stripe_events (event_id, status)
        VALUES (${event.id}, 'processing')
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `;
      if (!inserted.length) {
        const rows = await sql`SELECT status FROM public.postibou_stripe_events WHERE event_id = ${event.id}`;
        if (rows[0]?.status === 'processed') return reply({ received: true, duplicate: true });
      }

      const object = event.data?.object;
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
        if (object?.mode === 'subscription' && object.payment_status === 'paid') {
          const userId = object.client_reference_id;
          const subId = subscriptionId(object.subscription);
          if (!userId || !subId) throw new Error('CHECKOUT_REFERENCE_MISSING');
          const subscription = await stripe.subscriptions.retrieve(subId);
          const mapped = await sql`SELECT user_id, stripe_subscription_id FROM public.postibou_entitlements WHERE user_id = ${userId}::uuid`;
          if (!mapped.length) throw new Error('POSTIBOU_ACCOUNT_MISSING');
          const previousId = mapped[0].stripe_subscription_id;
          if (previousId && previousId !== subscription.id) {
            const previous = await stripe.subscriptions.retrieve(previousId);
            if (!['canceled', 'incomplete_expired'].includes(previous.status)) throw new Error('SUBSCRIPTION_CONFLICT');
          }
          // Provide the accepted contract before granting paid service access.
          // If mail is unavailable, Stripe retries this event; no paid quota is activated.
          await confirmPurchase(sql, stripe, object, subscription);
          // Claim the mapping atomically before scheduling; two different completed
          // sessions must never silently replace one another's active subscription.
          const saved = await persistSubscription(sql, userId, subscription, previousId || null);
          if (!saved.length) throw new Error('SUBSCRIPTION_CONFLICT');
          await scheduleLaunchPriceChange(stripe, subscription, prices);
          await referralPurchase(sql, object, subscription);
        }
      // Lifecycle events may precede Checkout: they can refresh an already
      // confirmed subscription, never activate a new one through an old customer.
      } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
        const customer = customerId(object?.customer);
        const rows = customer ? await sql`SELECT user_id, stripe_subscription_id FROM public.postibou_entitlements WHERE stripe_customer_id = ${customer}` : [];
        if (rows[0]?.user_id && rows[0].stripe_subscription_id === object.id) {
          // Stripe can deliver events out of order. Persist today's state so an older
          // update cannot undo a cancellation already confirmed by the customer.
          const subscription = event.type === 'customer.subscription.deleted'
            ? object : await stripe.subscriptions.retrieve(object.id);
          await persistSubscription(sql, rows[0].user_id, subscription);
        }
      } else if (event.type === 'invoice.created') {
        await referralRenewal(sql, stripe, object);
      } else if (event.type === 'invoice.voided') {
        await referralSettlement(sql, stripe, object);
      } else if (['invoice.paid', 'invoice.payment_failed'].includes(event.type)) {
        if (event.type === 'invoice.paid') await referralSettlement(sql, stripe, object);
        const customer = customerId(object?.customer);
        const subId = subscriptionId(object?.subscription || object?.parent?.subscription_details?.subscription);
        const rows = customer ? await sql`SELECT user_id, stripe_subscription_id FROM public.postibou_entitlements WHERE stripe_customer_id = ${customer}` : [];
        if (rows[0]?.user_id && subId && rows[0].stripe_subscription_id === subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          await persistSubscription(sql, rows[0].user_id, subscription);
        }
      }
      await sql`UPDATE public.postibou_stripe_events SET status = 'processed', processed_at = now() WHERE event_id = ${event.id}`;
      return reply({ received: true });
    } catch {
      return reply({ code: 'WEBHOOK_PROCESSING_FAILED' }, 500);
    }
  };
}

export default createStripeWebhookHandler();
