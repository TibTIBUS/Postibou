import { PAID_LAUNCH_READY, TERMS_VERSION } from './legal-policy.mjs';
export const config = { path: '/api/legal/status', method: 'GET' };
export default () => Response.json({ paidLaunchReady: PAID_LAUNCH_READY, termsVersion: TERMS_VERSION }, {
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
