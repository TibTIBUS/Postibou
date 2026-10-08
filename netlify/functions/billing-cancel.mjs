import { createDatabase, createStripeClient, getVerifiedUser, validPostibouRequest } from './stripe-client.mjs';

export const config = { path: '/api/billing/cancel', method: 'POST' };
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => Response.json(body, { status, headers });
const idOf = value => typeof value === 'string' ? value : value?.id;

// Keep the current phase's billing settings when dropping its future price changes.
function finalPhase(phase, end) {
  const result = {
    start_date: phase.start_date, end_date: end, proration_behavior: 'none',
    items: phase.items.map(item => ({
      price: idOf(item.price), quantity: item.quantity,
      ...(item.tax_rates?.length ? { tax_rates: item.tax_rates.map(idOf) } : {}),
      ...(item.billing_thresholds ? { billing_thresholds: item.billing_thresholds } : {}),
      ...(item.discounts?.length ? { discounts: item.discounts.map(discountParams) } : {})
    }))
  };
  for (const key of ['application_fee_percent', 'billing_cycle_anchor', 'billing_thresholds', 'collection_method', 'currency', 'description', 'metadata']) {
    if (phase[key] != null) result[key] = phase[key];
  }
  for (const key of ['default_payment_method', 'on_behalf_of']) {
    if (phase[key]) result[key] = idOf(phase[key]);
  }
  if (phase.default_tax_rates) result.default_tax_rates = phase.default_tax_rates.map(idOf);
  if (phase.discounts) result.discounts = phase.discounts.length ? phase.discounts.map(discountParams) : '';
  if (phase.automatic_tax) {
    result.automatic_tax = { enabled: phase.automatic_tax.enabled };
    if (phase.automatic_tax.liability) result.automatic_tax.liability = {
      type: phase.automatic_tax.liability.type,
      ...(phase.automatic_tax.liability.account ? { account: idOf(phase.automatic_tax.liability.account) } : {})
    };
  }
  if (phase.transfer_data) result.transfer_data = {
    destination: idOf(phase.transfer_data.destination),
    ...(phase.transfer_data.amount_percent != null ? { amount_percent: phase.transfer_data.amount_percent } : {})
  };
  if (phase.invoice_settings) {
    result.invoice_settings = {};
    for (const key of ['days_until_due', 'custom_fields', 'description', 'footer']) {
      if (phase.invoice_settings[key] != null) result.invoice_settings[key] = phase.invoice_settings[key];
    }
    if (phase.invoice_settings.account_tax_ids) result.invoice_settings.account_tax_ids = phase.invoice_settings.account_tax_ids.map(idOf);
    if (phase.invoice_settings.issuer) result.invoice_settings.issuer = {
      type: phase.invoice_settings.issuer.type,
      ...(phase.invoice_settings.issuer.account ? { account: idOf(phase.invoice_settings.issuer.account) } : {})
    };
  }
  return result;
}

function discountParams(discount) {
  for (const key of ['discount', 'coupon', 'promotion_code']) {
    if (discount[key]) return { [key]: idOf(discount[key]) };
  }
  throw new Error('INVALID_DISCOUNT');
}

export function createCancellationHandler({ fetchAuth = fetch, getDatabase = createDatabase, getStripe = createStripeClient, now = () => Date.now() } = {}) {
  return async request => {
    if (!validPostibouRequest(request, 'POST')) return reply({ code: 'FORBIDDEN' }, 403);
    try {
      const user = await getVerifiedUser(request, fetchAuth);
      if (!user) return reply({ code: 'UNAUTHORIZED' }, 401);
      const sql = await getDatabase();
      const rows = await sql`SELECT stripe_customer_id, stripe_subscription_id FROM public.postibou_entitlements WHERE user_id = ${user.id}::uuid`;
      const account = rows[0];
      if (!account?.stripe_customer_id || !account?.stripe_subscription_id) return reply({ code: 'NO_SUBSCRIPTION' }, 404);
      const stripe = await getStripe();
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
      if (subscription.id !== account.stripe_subscription_id || idOf(subscription.customer) !== account.stripe_customer_id) return reply({ code: 'SUBSCRIPTION_MISMATCH' }, 409);
      const item = subscription.items?.data?.[0];
      const end = Number(item?.current_period_end ?? subscription.current_period_end);
      if (!['active', 'past_due'].includes(subscription.status) || !Number.isFinite(end) || end * 1000 <= now()) return reply({ code: 'SUBSCRIPTION_INACTIVE' }, 409);
      // Repeated confirmations also repair local state after a transient database failure.
      let cancellationEnd = subscription.cancel_at ? Number(subscription.cancel_at) : end;
      if (!subscription.cancel_at_period_end && !subscription.cancel_at) {
        const options = { idempotencyKey: `postibou_cancel_${subscription.id}_${end}` };
        if (subscription.schedule) {
          const schedule = await stripe.subscriptionSchedules.retrieve(idOf(subscription.schedule));
          if (schedule.status !== 'active' || idOf(schedule.subscription) !== subscription.id || idOf(schedule.customer) !== account.stripe_customer_id) return reply({ code: 'SCHEDULE_MISMATCH' }, 409);
          const phase = schedule.phases?.find(value => value.start_date === schedule.current_phase?.start_date);
          if (!phase?.items?.length || phase.start_date >= end) throw new Error('CURRENT_PHASE_UNAVAILABLE');
          await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: 'cancel', proration_behavior: 'none', phases: [finalPhase(phase, end)]
          }, options);
        } else {
          await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true, proration_behavior: 'none' }, options);
        }
        cancellationEnd = end;
      }
      await sql`
        UPDATE public.postibou_entitlements
        SET cancel_at_period_end = true, subscription_period_end = to_timestamp(${cancellationEnd}::bigint), updated_at = now()
        WHERE user_id = ${user.id}::uuid AND stripe_subscription_id = ${subscription.id} AND stripe_customer_id = ${account.stripe_customer_id}
      `;
      return reply({ cancelAtPeriodEnd: true, subscriptionPeriodEnd: new Date(cancellationEnd * 1000).toISOString() });
    } catch {
      return reply({ code: 'CANCELLATION_UNAVAILABLE' }, 503);
    }
  };
}

export default createCancellationHandler();
