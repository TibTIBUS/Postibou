import { findGift, giftUsage } from './lib/gifts.mjs';
import { AUTH_URL, SITE_ORIGIN } from './auth.mjs';

export const config = { path: '/api/usage', method: 'GET' };
const COOKIE_PREFIX = '__Secure-neon-auth.';
const responseHeaders = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

export function createUsageHandler({ fetchAuth = fetch, getDatabase, now = () => Date.now() } = {}) {
  return async request => {
    const reply = (body, status = 200) => Response.json(body, { status, headers: responseHeaders });
    if (request.method !== 'GET') return reply({ code: 'METHOD_NOT_ALLOWED' }, 405);
    if (request.headers.get('origin') && request.headers.get('origin') !== SITE_ORIGIN) return reply({ code: 'FORBIDDEN' }, 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return reply({ code: 'FORBIDDEN' }, 403);
    try {
      const cookies = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE_PREFIX)).join('; ');
      const sessionResponse = await fetchAuth(AUTH_URL + '/get-session?disableCookieCache=true', {
        headers: { Origin: SITE_ORIGIN, 'x-neon-auth-middleware': 'true', Cookie: cookies },
        signal: AbortSignal.timeout(12000)
      });
      if (!sessionResponse.ok) return reply({ code: 'AUTH_UNAVAILABLE' }, 503);
      const session = await sessionResponse.json();
      if (!session?.session || session.user?.emailVerified !== true || !session.user?.id) return reply({ code: 'UNAUTHORIZED' }, 401);

      const sql = getDatabase ? await getDatabase() : await createDatabase();
      await sql`
        INSERT INTO public.postibou_entitlements (user_id)
        SELECT id FROM neon_auth."user" WHERE id = ${session.user.id}::uuid AND "emailVerified" = true
        ON CONFLICT (user_id) DO NOTHING
      `;
      const rows = await sql`
        SELECT plan, trial_started_at, trial_ends_at, adaptations_used,
               stripe_subscription_status, subscription_period_start, subscription_period_end,
               usage_period_start, cancel_at_period_end, stripe_customer_id, stripe_subscription_id
        FROM public.postibou_entitlements WHERE user_id = ${session.user.id}::uuid
      `;
      const account = rows[0];
      if (!account) return reply({ code: 'ACCOUNT_UNAVAILABLE' }, 503);
      const gift = await findGift(sql, session.user.id);
      if (gift) return reply(giftUsage(gift));
      const trialActive = account.plan === 'trial' && new Date(account.trial_ends_at).getTime() > now();
      const subscriptionActive = account.plan === 'monthly'
        && ['active', 'past_due'].includes(account.stripe_subscription_status)
        && account.subscription_period_end
        && new Date(account.subscription_period_end).getTime() > now();
      const active = trialActive || subscriptionActive;
      const quota = account.plan === 'monthly' ? 30 : 10;
      const periodReset = account.plan === 'monthly'
        && String(account.usage_period_start || '') !== String(account.subscription_period_start || '');
      const used = periodReset ? 0 : Number(account.adaptations_used);
      // Renouvellement impayé : la nouvelle période n'ouvre pas de crédits tant que Stripe n'a pas encaissé.
      const paymentFailed = subscriptionActive && account.stripe_subscription_status === 'past_due';
      const remaining = active && !paymentFailed ? Math.max(0, quota - used) : 0;
      return reply({
        plan: account.plan, trialStartedAt: account.trial_started_at, trialEndsAt: account.trial_ends_at,
        subscriptionStatus: account.stripe_subscription_status, subscriptionPeriodStart: account.subscription_period_start,
        subscriptionPeriodEnd: account.subscription_period_end, cancelAtPeriodEnd: account.cancel_at_period_end,
        hasBilling: Boolean(account.stripe_customer_id),
        canCancel: Boolean(subscriptionActive && account.stripe_subscription_id && !account.cancel_at_period_end),
        adaptationsUsed: used, quota, creditsRemaining: remaining, active, paymentFailed
      });
    } catch {
      return reply({ code: 'SERVICE_UNAVAILABLE' }, 503);
    }
  };
}

async function createDatabase() {
  const connectionString = globalThis.Netlify?.env?.get('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  const { neon } = await import('@neondatabase/serverless');
  return neon(connectionString);
}

export default createUsageHandler();

