import { createDatabase, getVerifiedUser } from './stripe-client.mjs';
export const config = { path: '/api/billing/confirmations', method: 'GET' };
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie' };
export function createConfirmationsHandler({ getDatabase = createDatabase, fetchAuth = fetch } = {}) {
  return async request => {
    if (request.method !== 'GET') return Response.json({ code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers });
    if (request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ code: 'FORBIDDEN' }, { status: 403, headers });
    try {
      const user = await getVerifiedUser(request, fetchAuth);
      if (!user) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401, headers });
      const receiptId = new URL(request.url).searchParams.get('receipt');
      if (receiptId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiptId)) return Response.json({ code: 'INVALID_INPUT' }, { status: 400, headers });
      const sql = await getDatabase();
      if (receiptId) {
        const rows = await sql`SELECT confirmation_document FROM public.postibou_contract_confirmations WHERE receipt_id = ${receiptId}::uuid AND user_id = ${user.id}::uuid`;
        if (!rows[0]) return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
        return new Response(rows[0].confirmation_document, { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="postibou-confirmation-' + receiptId + '.txt"' } });
      }
      const rows = await sql`SELECT receipt_id, paid_at, amount_paid, currency, terms_version, email_status
        FROM public.postibou_contract_confirmations WHERE user_id = ${user.id}::uuid ORDER BY paid_at DESC LIMIT 50`;
      return Response.json({ confirmations: rows.map(row => ({ id: row.receipt_id, paidAt: row.paid_at, amountPaid: row.amount_paid,
        currency: row.currency, termsVersion: row.terms_version, emailStatus: row.email_status === 'sent' ? 'sent' : 'pending' })) }, { headers });
    } catch { return Response.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503, headers }); }
  };
}
export default createConfirmationsHandler();
