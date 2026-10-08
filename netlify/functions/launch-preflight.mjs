import { createStripeClient, getVerifiedUser } from './stripe-client.mjs';
import { confirmationMailConfig } from './lib/contract-confirmation.mjs';

export const config = { path: '/api/launch-preflight' };
// Temporary, owner-only, read-only verification. Never return credentials.
export default async function handler(request) {
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
  if (!['GET', 'POST'].includes(request.method)) return reply({ code: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.method === 'POST' && request.headers.get('origin') !== 'https://postibou.netlify.app') return reply({ code: 'NOT_FOUND' }, 404);
  if (Date.now() > Date.parse('2026-10-10T00:00:00Z') || request.headers.get('sec-fetch-site') === 'cross-site') return reply({ code: 'NOT_FOUND' }, 404);
  try {
    const user = await getVerifiedUser(request);
    if (user?.email?.toLowerCase() !== 'marie.thibaut2105@gmail.com') return reply({ code: 'NOT_FOUND' }, 404);
    const stripe = await createStripeClient();
    if (request.method === 'POST') {
      // No customer, subscription, invoice or payment is created. Immediately
      // expire this unshared session after checking the runtime write permission.
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', line_items: [{ price: 'price_1UO13LEnc0W23lgnnIpKJi4k', quantity: 1 }],
        success_url: 'https://postibou.netlify.app/', cancel_url: 'https://postibou.netlify.app/',
        metadata: { postibou_check: 'unpaid_runtime_preflight' }
      });
      const expired = await stripe.checkout.sessions.expire(session.id);
      return reply({ checkoutWriteVerified: true, liveMode: session.livemode, sessionExpired: expired.status === 'expired', paymentStatus: expired.payment_status });
    }
    const [launch, standard, coupon] = await Promise.all([
      stripe.prices.retrieve('price_1UO13LEnc0W23lgnnIpKJi4k'),
      stripe.prices.retrieve('price_1UO13LEnc0W23lgnTxtNXNW6'),
      stripe.coupons.retrieve('postibou_referral_month_v1', { expand: ['applies_to'] })
    ]);
    const pricesValid = [launch, standard].every(p => p.livemode && p.active && p.currency === 'eur' && p.recurring?.interval === 'month' && p.recurring?.interval_count === 1 && p.product === 'prod_VOog5UMGZt2LCL') && launch.unit_amount === 790 && standard.unit_amount === 990;
    const couponValid = coupon.livemode && coupon.valid && coupon.percent_off === 100 && coupon.duration === 'once' && coupon.applies_to?.products?.includes('prod_VOog5UMGZt2LCL');
    return reply({ stripe: { connected: true, livePricesValid: pricesValid, referralCouponValid: Boolean(couponValid) }, emailConfigured: Boolean(confirmationMailConfig()), webhookSecretConfigured: Boolean(globalThis.Netlify?.env?.get('STRIPE_WEBHOOK_SECRET')) });
  } catch (error) {
    return reply({ code: 'PREFLIGHT_FAILED', category: error.type === 'StripeAuthenticationError' ? 'STRIPE_AUTHENTICATION' : error.type === 'StripePermissionError' ? 'STRIPE_PERMISSION' : 'CONFIGURATION_OR_UPSTREAM' }, 503);
  }
}
