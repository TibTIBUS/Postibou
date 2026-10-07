// Public Neon endpoint; no database password or administrative key is needed.
export const AUTH_URL = 'https://ep-cool-base-b1xdts2i.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth';
export const SITE_ORIGIN = 'https://postibou.netlify.app';
export const config = { path: '/api/auth/*' };
const COOKIE_PREFIX = '__Secure-neon-auth';
const routes = {
  signup: 'sign-up/email', login: 'sign-in/email', logout: 'sign-out',
  verify: 'email-otp/verify-email', resend: 'email-otp/send-verification-otp',
  recovery: 'email-otp/send-verification-otp', reset: 'email-otp/reset-password',
  session: 'get-session', google: 'sign-in/social'
};
const safeHeaders = { 'Cache-Control': 'no-store, private', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };
export function rewriteCookie(cookie) {
  const parts = cookie.split(';').map(part => part.trim());
  if (!parts[0].startsWith(COOKIE_PREFIX + '.') || parts[0].startsWith(COOKIE_PREFIX + '.local.session_data=')) return null;
  return [parts[0], ...parts.slice(1).filter(part => !/^(domain|path|samesite|partitioned|secure|httponly)(=|$)/i.test(part)), 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'].join('; ');
}
function payload(action, input) {
  if (action === 'logout') return {};
  if (action === 'google') return {
    provider: 'google', disableRedirect: true,
    callbackURL: SITE_ORIGIN + '/auth/google/retour',
    errorCallbackURL: SITE_ORIGIN + '/auth/google/retour'
  };
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_INPUT');
  const data = { email };
  if (['signup', 'login', 'reset'].includes(action)) {
    if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) throw new Error('INVALID_INPUT');
    data.password = input.password;
  }
  if (['verify', 'reset'].includes(action)) {
    if (typeof input.otp !== 'string' || !/^\d{6}$/.test(input.otp)) throw new Error('INVALID_INPUT');
    data.otp = input.otp;
  }
  if (action === 'signup') data.name = email.split('@')[0].slice(0, 80);
  if (action === 'resend') data.type = 'email-verification';
  if (action === 'recovery') data.type = 'forget-password';
  return data;
}
// Validate every session upstream. Never expose session tokens in JSON or storage.
export function createHandler(fetchAuth = fetch) {
  return async request => {
    const action = new URL(request.url).pathname.slice('/api/auth/'.length);
    const reply = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { ...safeHeaders, ...headers } });
    if (!Object.hasOwn(routes, action)) return reply({ code: 'NOT_FOUND' }, 404);
    const method = action === 'session' ? 'GET' : 'POST';
    if (request.method !== method) return reply({ code: 'METHOD_NOT_ALLOWED' }, 405, { Allow: method });
    const origin = request.headers.get('origin');
    if ((method === 'POST' && origin !== SITE_ORIGIN) || (origin && origin !== SITE_ORIGIN)) return reply({ code: 'FORBIDDEN' }, 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return reply({ code: 'FORBIDDEN' }, 403);
    try {
      let body;
      if (method === 'POST') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return reply({ code: 'INVALID_INPUT' }, 415);
        const text = await request.text();
        if (text.length > 4096) return reply({ code: 'INVALID_INPUT' }, 413);
        let input;
        try { input = JSON.parse(text); } catch { return reply({ code: 'INVALID_INPUT' }, 400); }
        if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ code: 'INVALID_INPUT' }, 400);
        body = JSON.stringify(payload(action, input));
      }
      const cookies = (request.headers.get('cookie') || '').split(';').map(c => c.trim()).filter(c => c.startsWith(COOKIE_PREFIX + '.')).join('; ');
      const headers = { Origin: SITE_ORIGIN, 'Content-Type': 'application/json', 'x-neon-auth-middleware': 'true', Cookie: cookies };
      const upstream = await fetchAuth(AUTH_URL + '/' + routes[action] + (action === 'session' ? '?disableCookieCache=true' : ''), {
        method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000)
      });
      const data = await upstream.json();
      const out = new Headers(safeHeaders);
      for (const cookie of upstream.headers.getSetCookie()) {
        const rewritten = rewriteCookie(cookie);
        if (rewritten) out.append('Set-Cookie', rewritten);
      }
      let result;
      if (!upstream.ok) {
        result = { code: typeof data?.code === 'string' ? data.code : 'AUTH_ERROR' };
      } else if (action === 'session') {
        const user = data?.user;
        result = { user: user?.emailVerified === true && data?.session ? { email: user.email, emailVerified: true } : null };
      } else if (action === 'google') {
        const destination = new URL(data.url);
        const managedInit = new URL(AUTH_URL + '/sign-in/social/init');
        const isManagedInit = destination.origin === managedInit.origin && destination.pathname === managedInit.pathname;
        if (destination.protocol !== 'https:' || (!isManagedInit && destination.hostname !== 'accounts.google.com')) throw new Error('INVALID_OAUTH_URL');
        result = { url: destination.toString() };
      } else {
        result = { success: true };
      }
      return new Response(JSON.stringify(result), { status: upstream.status, headers: out });
    } catch (error) {
      return reply({ code: error.message === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'SERVICE_UNAVAILABLE' }, error.message === 'INVALID_INPUT' ? 400 : 503);
    }
  };
}
export default createHandler();
