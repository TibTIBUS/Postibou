import { randomBytes } from 'node:crypto';
import { processAuthMiddleware } from '@neondatabase/auth/server';
import { AUTH_URL, SITE_ORIGIN, rewriteCookie } from './auth.mjs';

export const config = { path: '/auth/google/retour', method: 'GET' };
const challengeNames = ['__Secure-neon-auth.session_challenge', '__Secure-neon-auth.session_challange'];
const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

export function createGoogleReturn(processCallback = processAuthMiddleware) {
  return async request => {
    const headers = new Headers({
      'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    });
    let success = false;
    const url = new URL(request.url);
    const verifier = url.searchParams.get('neon_auth_session_verifier');
    // The SDK validates the managed verifier against the browser's HttpOnly
    // challenge cookie. It performs the protocol exchange; no app-built exchange.
    if (request.method === 'GET' && verifier && verifier.length <= 4096 && !url.searchParams.has('error')) {
      try {
        const upstreamHeaders = new Headers(request.headers);
        upstreamHeaders.set('Origin', SITE_ORIGIN);
        const result = await processCallback({
          request: new Request(request.url, { headers: upstreamHeaders }),
          pathname: '/auth/google/retour', skipRoutes: [], loginUrl: '/connexion',
          baseUrl: AUTH_URL, sameSite: 'lax', logger: silentLogger,
          // This app always checks sessions upstream and never uses the SDK's
          // local session cache. Discard its minted cache cookie; the temporary
          // signing key is not persisted or used to authorize a user.
          cookieSecret: randomBytes(32).toString('hex')
        });
        if (result.action === 'redirect_oauth') {
          for (const cookie of result.cookies) {
            const rewritten = rewriteCookie(cookie);
            if (rewritten) {
              headers.append('Set-Cookie', rewritten);
              if (/^__Secure-neon-auth\.session_token=[^;]/.test(rewritten) && !/Max-Age=0(?:;|$)/i.test(rewritten)) success = true;
            }
          }
        }
      } catch { /* Never log the callback URL, verifier, or cookies. */ }
    }
    for (const name of challengeNames) headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    headers.set('Location', SITE_ORIGIN + (success ? '/#compte' : '/?google=erreur#connexion'));
    // Fixed destination also removes all OAuth parameters from browser history.
    return new Response(null, { status: 303, headers });
  };
}
export default createGoogleReturn();
