import { createDatabase, getVerifiedUser } from './stripe-client.mjs';
import { SITE_ORIGIN } from './auth.mjs';

export const config = { path: ['/api/admin/access', '/api/admin/users'] };
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
export function accountSummary(row, timestamp) {
  const monthly = row.plan === 'monthly';
  const paid = monthly && ['active','past_due'].includes(row.stripe_subscription_status) && new Date(row.subscription_period_end).getTime() > timestamp;
  if (row.gift_email && row.emailVerified && !paid) {
    const active = new Date(row.gift_starts_at).getTime() <= timestamp && new Date(row.gift_ends_at).getTime() > timestamp;
    const reset = String(row.gift_usage_period_start || '') !== String(row.gift_current_period_start || '');
    const used = reset ? 0 : Number(row.gift_used || 0);
    return {email:row.email,verified:true,createdAt:row.createdAt,status:active?'gift':'gift_expired',used,quota:30,remaining:active?Math.max(0,30-used):0,periodEnd:new Date(new Date(row.gift_ends_at).getTime()-1).toISOString(),cancelAtPeriodEnd:false,lastPayment:null,confirmationStatus:null};
  }
  const active = monthly ? ['active', 'past_due'].includes(row.stripe_subscription_status) && new Date(row.subscription_period_end).getTime() > timestamp
    : row.plan === 'trial' && new Date(row.trial_ends_at).getTime() > timestamp;
  const quota = row.plan ? (monthly ? 30 : 10) : 0;
  const reset = monthly && String(row.usage_period_start || '') !== String(row.subscription_period_start || '');
  const used = reset ? 0 : Number(row.adaptations_used || 0);
  const remaining = active ? Math.max(0, quota - used) : 0;
  const status = !row.emailVerified ? 'unverified' : !row.plan ? 'pending' : monthly ? (active ? 'active' : 'inactive') : active ? (remaining ? 'trial' : 'trial_exhausted') : 'expired';
  return { email: row.email, verified: row.emailVerified, createdAt: row.createdAt, status, subscriptionStatus: row.stripe_subscription_status,
    used, quota, remaining, trialEndsAt: row.trial_ends_at, periodEnd: row.subscription_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end), lastPayment: row.amount_paid == null ? null : Number(row.amount_paid),
    paidAt: row.paid_at, confirmationStatus: row.email_status };
}
export function createAdminHandler({ getUser = getVerifiedUser, getDatabase = createDatabase, now = () => Date.now() } = {}) {
  return async request => {
    const reply = (body, status = 200) => Response.json(body, { status, headers });
    if (request.method !== 'GET') return reply({ code: 'METHOD_NOT_ALLOWED' }, 405);
    if ((request.headers.get('origin') && request.headers.get('origin') !== SITE_ORIGIN) || request.headers.get('sec-fetch-site') === 'cross-site') return reply({ code: 'FORBIDDEN' }, 403);
    const url = new URL(request.url);
    if (!['/api/admin/access', '/api/admin/users'].includes(url.pathname)) return reply({ code: 'NOT_FOUND' }, 404);
    try {
      const user = await getUser(request);
      if (!user) return reply({ code: 'UNAUTHORIZED' }, 401);
      const sql = await getDatabase();
      const roles = await sql`SELECT user_id FROM public.postibou_admins WHERE user_id = ${user.id}::uuid`;
      if (url.pathname === '/api/admin/access') return reply({ admin: roles.length === 1 });
      if (!roles.length) return reply({ code: 'FORBIDDEN' }, 403);
      const filter = url.searchParams.get('filter') || 'all';
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const rawPage = url.searchParams.get('page') || '1';
      if (!['all','trial','active','gift','expired','unverified'].includes(filter) || search.length > 254 || !/^[1-9]\d{0,5}$/.test(rawPage)) return reply({ code: 'INVALID_INPUT' }, 400);
      const timestamp = now(); const date = new Date(timestamp).toISOString();
      const rows = await sql`
        WITH accounts AS (
          SELECT u.id, u.email, u."emailVerified", u."createdAt", e.*,
            g.email AS gift_email,g.starts_at AS gift_starts_at,g.ends_at AS gift_ends_at,
            g.adaptations_used AS gift_used,g.usage_period_start AS gift_usage_period_start,
            date_trunc('month', ${date}::timestamptz AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris' AS gift_current_period_start,
            CASE WHEN NOT u."emailVerified" THEN 'unverified'
              WHEN e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz THEN 'active'
              WHEN g.email IS NOT NULL AND g.starts_at <= ${date}::timestamptz AND g.ends_at > ${date}::timestamptz THEN 'gift'
              WHEN g.email IS NOT NULL AND g.ends_at <= ${date}::timestamptz AND NOT COALESCE(e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz,false) THEN 'expired'
              WHEN e.plan IS NULL THEN 'pending'
              WHEN e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz THEN 'active'
              WHEN e.plan = 'trial' AND e.trial_ends_at > ${date}::timestamptz THEN 'trial'
              ELSE 'expired' END AS segment
          FROM neon_auth."user" u LEFT JOIN public.postibou_entitlements e ON e.user_id = u.id
          LEFT JOIN public.postibou_gifts g ON g.email = lower(trim(u.email)) AND (g.user_id IS NULL OR g.user_id = u.id)
        )
        SELECT a.*, c.amount_paid, c.paid_at, c.email_status, count(*) OVER() AS filtered_count
        FROM accounts a LEFT JOIN LATERAL (
          SELECT amount_paid, paid_at, email_status FROM public.postibou_contract_confirmations
          WHERE user_id = a.id ORDER BY paid_at DESC LIMIT 1
        ) c ON true
        WHERE (${filter} = 'all' OR a.segment = ${filter}) AND position(${search} IN lower(a.email)) > 0
        ORDER BY a."createdAt" DESC, a.id LIMIT 25 OFFSET ${(Number(rawPage) - 1) * 25}
      `;
      const totals = await sql`
        SELECT count(*) AS accounts,
          count(*) FILTER (WHERE u."emailVerified" = true) AS verified,
          count(*) FILTER (WHERE u."emailVerified" = true AND g.email IS NULL AND e.plan = 'trial' AND e.trial_ends_at > ${date}::timestamptz) AS trials,
          count(*) FILTER (WHERE e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz) AS subscribers,
          COALESCE(sum(CASE WHEN e.plan = 'monthly' AND e.usage_period_start IS DISTINCT FROM e.subscription_period_start THEN 0 ELSE e.adaptations_used END), 0) AS used
        FROM neon_auth."user" u LEFT JOIN public.postibou_entitlements e ON e.user_id = u.id
          LEFT JOIN public.postibou_gifts g ON g.email = lower(trim(u.email)) AND (g.user_id IS NULL OR g.user_id = u.id)
      `;
      const pending = await sql`SELECT count(*) AS count FROM public.postibou_withdrawal_requests WHERE status = 'received'`;
      let total = rows.length ? Number(rows[0].filtered_count) : 0;
      if (!rows.length) {
        const count = await sql`
          SELECT count(*) AS count FROM neon_auth."user" u LEFT JOIN public.postibou_entitlements e ON e.user_id = u.id
          LEFT JOIN public.postibou_gifts g ON g.email = lower(trim(u.email)) AND (g.user_id IS NULL OR g.user_id = u.id)
          WHERE position(${search} IN lower(u.email)) > 0 AND (${filter} = 'all' OR ${filter} = CASE
            WHEN NOT u."emailVerified" THEN 'unverified' WHEN e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz THEN 'active' WHEN g.email IS NOT NULL AND g.starts_at <= ${date}::timestamptz AND g.ends_at > ${date}::timestamptz THEN 'gift' WHEN g.email IS NOT NULL AND g.ends_at <= ${date}::timestamptz AND NOT COALESCE(e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz,false) THEN 'expired' WHEN e.plan IS NULL THEN 'pending'
            WHEN e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due') AND e.subscription_period_end > ${date}::timestamptz THEN 'active'
            WHEN e.plan = 'trial' AND e.trial_ends_at > ${date}::timestamptz THEN 'trial' ELSE 'expired' END)
        `;
        total = Number(count[0].count);
      }
      return reply({ users: rows.map(row => accountSummary(row, timestamp)), total, page: Number(rawPage), pageSize: 25,
        summary: Object.fromEntries(Object.entries(totals[0]).map(([k,v]) => [k, Number(v)])),
        withdrawalsPending: Number(pending[0].count), checkedAt: date });
    } catch { return reply({ code: 'SERVICE_UNAVAILABLE' }, 503); }
  };
}
export default createAdminHandler();
