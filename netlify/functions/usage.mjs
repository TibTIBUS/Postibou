import { AUTH_URL, SITE_ORIGIN } from './auth.mjs';

export const config = { path: '/api/usage', method: 'GET' };
const COOKIE_PREFIX = '__Secure-neon-auth.';
const responseHeaders = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };

export function createUsageHandler({ fetchAuth = fetch, getDatabase } = {}) {
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
        SELECT plan, trial_started_at, trial_ends_at, adaptations_used
        FROM public.postibou_entitlements WHERE user_id = ${session.user.id}::uuid
      `;
      const account = rows[0];
      if (!account) return reply({ code: 'ACCOUNT_UNAVAILABLE' }, 503);
      const active = account.plan === 'trial' && new Date(account.trial_ends_at).getTime() > Date.now();
      const used = Number(account.adaptations_used);
      const remaining = active ? Math.max(0, 10 - used) : 0;
      return reply({ plan: account.plan, trialStartedAt: account.trial_started_at, trialEndsAt: account.trial_ends_at, adaptationsUsed: used, creditsRemaining: remaining, active });
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
