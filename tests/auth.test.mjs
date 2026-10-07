import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, rewriteCookie, SITE_ORIGIN } from '../netlify/functions/auth.mjs';
const request = (action, body, extra = {}) => new Request(`${SITE_ORIGIN}/api/auth/${action}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { origin: SITE_ORIGIN, 'content-type': 'application/json', ...extra },
  body: body === undefined ? undefined : JSON.stringify(body)
});
test('rejects cross-origin writes, arbitrary routes and wrong methods before contacting Neon', async () => {
  const handler = createHandler(() => { throw new Error('Must not contact upstream'); });
  assert.equal((await handler(request('signup', {}, { origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await handler(request('delete-user', {}))).status, 404);
  assert.equal((await handler(request('logout'))).status, 405);
  assert.equal((await handler(request('session', {}))).status, 405);
  assert.equal((await handler(request('signup', { email: 'bad', password: '12345678' }))).status, 400);
});
test('filters cookies and fields, keeps tokens out of response, rewrites first-party secure cookie', async () => {
  const handler = createHandler(async (url, options) => {
    assert.ok(url.endsWith('/sign-up/email'));
    assert.equal(options.headers.Cookie, '__Secure-neon-auth.session_token=signed');
    assert.equal(options.headers['x-neon-auth-middleware'], 'true');
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['email', 'name', 'password']);
    return Response.json({ token: 'secret', user: { email: body.email }, session: { token: 'secret' } }, {
      headers: { 'set-cookie': '__Secure-neon-auth.session_token=signed; Domain=neon.tech; Path=/auth; SameSite=None; Partitioned; Max-Age=604800' }
    });
  });
  const response = await handler(request('signup', { email: 'example@example.com', password: 'testpass123', role: 'admin', callbackURL: 'https://attacker.example' }, { cookie: 'unrelated=private; __Secure-neon-auth.session_token=signed' }));
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=|Partitioned|SameSite=None/);
  assert.match(cookie, /Path=\//);
});
test('only exposes verified users from validated managed sessions', async () => {
  for (const data of [null, { session: {}, user: { email: 'private@example.com', emailVerified: false } }, { user: { email: 'private@example.com', emailVerified: true } }]) {
    const response = await createHandler(async () => Response.json(data))(request('session'));
    assert.deepEqual(await response.json(), { user: null });
  }
  const response = await createHandler(async (url) => {
    assert.ok(url.endsWith('/get-session?disableCookieCache=true'));
    return Response.json({ session: { token: 'secret' }, user: { id: 'id', email: 'test@example.com', emailVerified: true, role: 'admin' } });
  })(request('session'));
  assert.deepEqual(await response.json(), { user: { email: 'test@example.com', emailVerified: true } });
});
test('recovery and verification use distinct OTP purposes; invalid codes rejected', async () => {
  const calls = [];
  const handler = createHandler(async (url, options) => { calls.push([url, JSON.parse(options.body)]); return Response.json({ success: true }); });
  await handler(request('recovery', { email: 'test@example.com', type: 'sign-in' }));
  await handler(request('resend', { email: 'test@example.com' }));
  assert.equal(calls[0][1].type, 'forget-password');
  assert.equal(calls[1][1].type, 'email-verification');
  assert.equal((await handler(request('verify', { email: 'test@example.com', otp: 'ABCDEF' }))).status, 400);
});
test('preserves deletion cookies and does not leak upstream errors or transport details', async () => {
  assert.match(rewriteCookie('__Secure-neon-auth.session_token=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'), /Max-Age=0/);
  assert.equal(rewriteCookie('unrelated=secret'), null);
  let response = await createHandler(async () => Response.json({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'private info', token: 'secret' }, { status: 401 }))(request('login', { email: 'test@example.com', password: 'testpass123' }));
  assert.deepEqual(await response.json(), { code: 'INVALID_EMAIL_OR_PASSWORD' });
  response = await createHandler(async () => { throw new Error('secret details'); })(request('session'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'SERVICE_UNAVAILABLE' });
});
