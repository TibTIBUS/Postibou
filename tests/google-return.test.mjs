import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleReturn } from '../netlify/functions/google-return.mjs';
import { SITE_ORIGIN } from '../netlify/functions/auth.mjs';
const callback = suffix => new Request(SITE_ORIGIN + '/auth/google/retour' + suffix, {
  headers: { Cookie: '__Secure-neon-auth.session_challenge=opaque', Referer: 'https://accounts.google.com/' }
});
test('missing verifier and cancellation return safely without invoking SDK', async () => {
  const handler = createGoogleReturn(() => { throw new Error('Must not exchange'); });
  for (const query of ['', '?error=access_denied', '?error=denied&neon_auth_session_verifier=opaque']) {
    const response = await handler(callback(query));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), SITE_ORIGIN + '/?google=erreur#connexion');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.getSetCookie().length, 2);
    assert.ok(response.headers.getSetCookie().every(cookie => cookie.includes('Max-Age=0')));
  }
});
test('maps successful SDK exchange, preserves token and cleanup, discards session cache and untrusted destination', async () => {
  const response = await createGoogleReturn(async options => {
    assert.equal(options.request.headers.get('origin'), SITE_ORIGIN);
    assert.equal(options.sameSite, 'lax');
    assert.ok(options.cookieSecret.length >= 32);
    return {
      action: 'redirect_oauth', redirectUrl: new URL('https://attacker.example'),
      cookies: ['__Secure-neon-auth.session_token=signed; SameSite=None; Partitioned; Domain=neon.tech; Path=/', '__Secure-neon-auth.local.session_data=unused; Path=/']
    };
  })(callback('?neon_auth_session_verifier=opaque&redirect=https://attacker.example'));
  assert.equal(response.headers.get('location'), SITE_ORIGIN + '/#compte');
  assert.equal(response.headers.getSetCookie().length, 3);
  assert.ok(response.headers.getSetCookie().every(cookie => !/Domain=|Partitioned|local.session_data/.test(cookie)));
  assert.ok(response.headers.getSetCookie().every(cookie => cookie.includes('SameSite=Lax') && cookie.includes('HttpOnly')));
});
test('failed SDK exchange, unavailable upstream or empty token do not count as success', async () => {
  for (const process of [async () => { throw new Error('Network'); }, async () => ({ action: 'redirect_login', redirectUrl: new URL('https://attacker.example') }), async () => ({ action: 'redirect_oauth', redirectUrl: new URL(SITE_ORIGIN), cookies: ['__Secure-neon-auth.session_token=; Max-Age=0'] })]) {
    const response = await createGoogleReturn(process)(callback('?neon_auth_session_verifier=opaque'));
    assert.equal(response.headers.get('location'), SITE_ORIGIN + '/?google=erreur#connexion');
  }
});
