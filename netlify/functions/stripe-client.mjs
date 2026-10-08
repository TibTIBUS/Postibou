import { AUTH_URL, SITE_ORIGIN } from './auth.mjs';

export const stripeApiVersion = '2026-08-26.dahlia';

export async function createStripeClient(apiKey = globalThis.Netlify?.env?.get('STRIPE_SECRET_KEY')) {
  if (!apiKey) throw new Error('STRIPE_NOT_CONFIGURED');
  const StripeClient = (await import('stripe')).default;
  return new StripeClient(apiKey, { apiVersion: stripeApiVersion });
}

export async function getVerifiedUser(request, fetchAuth = fetch) {
  const cookies = (request.headers.get('cookie') || '').split(';')
    .map(part => part.trim())
    .filter(part => part.startsWith('__Secure-neon-auth.'))
    .join('; ');
  const response = await fetchAuth(AUTH_URL + '/get-session?disableCookieCache=true', {
    headers: { Origin: SITE_ORIGIN, 'x-neon-auth-middleware': 'true', Cookie: cookies },
    signal: AbortSignal.timeout(12000)
  });
  const data = response.ok ? await response.json() : null;
  if (!data?.session || data.user?.emailVerified !== true || !data.user?.id) return null;
  return { id: data.user.id, email: data.user.email };
}

export function validPostibouRequest(request, method) {
  return request.method === method
    && request.headers.get('origin') === SITE_ORIGIN
    && request.headers.get('sec-fetch-site') !== 'cross-site';
}

export async function createDatabase() {
  const connectionString = globalThis.Netlify?.env?.get('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  const { neon } = await import('@neondatabase/serverless');
  return neon(connectionString);
}
