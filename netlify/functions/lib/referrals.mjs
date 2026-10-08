import { randomUUID, randomBytes } from 'node:crypto';
export const REFERRAL_COUPON = 'postibou_referral_month_v1';
const prices = new Set(['price_1UO13LEnc0W23lgnnIpKJi4k','price_1UO13LEnc0W23lgnTxtNXNW6']);
const id = v => typeof v === 'string' ? v : v?.id;
const subId = invoice => id(invoice.subscription || invoice.parent?.subscription_details?.subscription);
const dt = seconds => new Date(seconds * 1000).toISOString();

export async function referralDashboard(sql, userId) {
  await sql`INSERT INTO public.postibou_referral_codes(user_id,code) VALUES (${userId}::uuid,${randomBytes(8).toString('hex').toUpperCase()}) ON CONFLICT (user_id) DO NOTHING`;
  const [code] = await sql`SELECT code FROM public.postibou_referral_codes WHERE user_id=${userId}::uuid`;
  const [counts] = await sql`SELECT
    count(*) FILTER (WHERE status IN ('linked','pending'))::int AS pending,
    count(*) FILTER (WHERE status='qualified')::int AS validated,
    count(*) FILTER (WHERE status='qualified' AND NOT EXISTS (SELECT 1 FROM public.postibou_referral_redemptions d WHERE d.referral_id=r.referral_id AND d.status<>'void'))::int AS available
    FROM public.postibou_referrals r WHERE referrer_id=${userId}::uuid`;
  const [spent] = await sql`SELECT count(*) FILTER (WHERE status='used')::int AS used, count(*) FILTER (WHERE status IN ('reserved','applied','review'))::int AS scheduled FROM public.postibou_referral_redemptions WHERE referrer_id=${userId}::uuid`;
  const [own] = await sql`SELECT status FROM public.postibou_referrals WHERE referee_id=${userId}::uuid`;
  return { code:code.code, link:'https://postibou.netlify.app/?parrain='+code.code+'#connexion', ...counts, ...spent, attributed:Boolean(own), attributionStatus:own?.status || null };
}

export async function claimReferral(sql, userId, code) {
  const [existing] = await sql`SELECT r.referrer_id,c.code FROM public.postibou_referrals r JOIN public.postibou_referral_codes c ON c.user_id=r.referrer_id WHERE referee_id=${userId}::uuid`;
  if (existing) { if(existing.code!==code) throw Error('REFERRAL_ALREADY_ASSIGNED'); return; }
  const rows = await sql`INSERT INTO public.postibou_referrals(referral_id,referrer_id,referee_id)
    SELECT ${randomUUID()}::uuid,c.user_id,u.id FROM public.postibou_referral_codes c
    JOIN neon_auth."user" p ON p.id=c.user_id JOIN neon_auth."user" u ON u.id=${userId}::uuid
    WHERE c.code=${code} AND c.user_id<>u.id AND p."emailVerified"=true AND u."emailVerified"=true
      AND lower(p.email)<>lower(u.email) AND u."createdAt">now()-interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.postibou_contract_confirmations WHERE user_id=u.id)
      AND NOT EXISTS (SELECT 1 FROM public.postibou_entitlements WHERE user_id=u.id AND stripe_subscription_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.postibou_checkout_attempts WHERE user_id=u.id)
    ON CONFLICT (referee_id) DO NOTHING RETURNING referral_id`;
  if (!rows.length) {
    const [same] = await sql`SELECT c.code FROM public.postibou_referrals r JOIN public.postibou_referral_codes c ON c.user_id=r.referrer_id WHERE referee_id=${userId}::uuid`;
    if(same?.code!==code) throw Error('REFERRAL_NOT_ELIGIBLE');
  }
}

export async function recordReferralPurchase(sql, session, subscription) {
  const [receipt] = await sql`SELECT invoice_id,paid_at,amount_paid FROM public.postibou_contract_confirmations WHERE user_id=${session.client_reference_id}::uuid AND subscription_id=${subscription.id} AND checkout_session_id=${session.id} AND email_status='sent'`;
  if (!receipt || receipt.amount_paid<=0) return;
  await sql`UPDATE public.postibou_referrals r SET status='pending',first_invoice_id=${receipt.invoice_id},first_subscription_id=${subscription.id},paid_at=${receipt.paid_at}::timestamptz,eligible_at=${receipt.paid_at}::timestamptz+interval '14 days'
    WHERE referee_id=${session.client_reference_id}::uuid AND status='linked' AND first_invoice_id IS NULL
      AND (SELECT count(*) FROM public.postibou_contract_confirmations WHERE user_id=r.referee_id)=1`;
}

// Re-read the real first payment, not a cached invoice.paid event. Unknown or
// unsupported payment states remain pending; they never earn a free month.
export async function paymentStillValid(stripe, row) {
  const invoice=await stripe.invoices.retrieve(row.first_invoice_id);
  if(invoice.id!==row.first_invoice_id || subId(invoice)!==row.first_subscription_id || invoice.status!=='paid' || invoice.amount_paid<=0 || invoice.currency!=='eur'
    || invoice.post_payment_credit_notes_amount>0 || invoice.pre_payment_credit_notes_amount>0) return false;
  const payments=await stripe.invoicePayments.list({invoice:invoice.id,status:'paid',limit:100});
  if(payments.has_more || !payments.data.length) throw Error('REFERRAL_PAYMENT_UNVERIFIED');
  let received=0;
  for(const payment of payments.data) {
    if(id(payment.invoice)!==invoice.id || payment.currency!=='eur' || payment.status!=='paid') throw Error('REFERRAL_PAYMENT_UNVERIFIED');
    let charge;
    if(payment.payment.type==='payment_intent') {
      const intent=await stripe.paymentIntents.retrieve(id(payment.payment.payment_intent));
      if(intent.status!=='succeeded' || id(intent.customer)!==id(invoice.customer)) return false;
      charge=await stripe.charges.retrieve(id(intent.latest_charge));
    } else if(payment.payment.type==='charge') charge=await stripe.charges.retrieve(id(payment.payment.charge));
    else throw Error('REFERRAL_PAYMENT_UNVERIFIED');
    if(!charge.paid || charge.status!=='succeeded' || charge.refunded || charge.amount_refunded>0 || charge.disputed || id(charge.customer)!==id(invoice.customer)) return false;
    received+=Number(payment.amount_paid)||0;
  }
  if(received<invoice.amount_paid) throw Error('REFERRAL_PAYMENT_UNVERIFIED');
  return true;
}

export async function qualifyReferrals(sql, stripe, {referrerId=null,now=()=>Date.now(),limit=10}={}) {
  const rows=await sql`SELECT * FROM public.postibou_referrals r WHERE status IN ('pending','qualified') AND eligible_at<=${new Date(now()).toISOString()}::timestamptz
    AND (${referrerId}::uuid IS NULL OR referrer_id=${referrerId}::uuid)
    AND NOT EXISTS (SELECT 1 FROM public.postibou_referral_redemptions d WHERE d.referral_id=r.referral_id AND d.status<>'void')
    ORDER BY checked_at NULLS FIRST,created_at LIMIT ${limit}`;
  let checked=0;
  for(const row of rows) {
    const [withdrawal]=await sql`SELECT request_id FROM public.postibou_withdrawal_requests WHERE user_id=${row.referee_id}::uuid AND subscription_id=${row.first_subscription_id}`;
    const valid=!withdrawal && await paymentStillValid(stripe,row);
    await sql`UPDATE public.postibou_referrals SET status=${valid?'qualified':'invalid'},qualified_at=CASE WHEN ${valid} THEN COALESCE(qualified_at,${new Date(now()).toISOString()}::timestamptz) ELSE qualified_at END,checked_at=${new Date(now()).toISOString()}::timestamptz WHERE referral_id=${row.referral_id}::uuid AND status IN ('pending','qualified')`;
    checked++;
  }
  return checked;
}

function renewalLine(invoice) {
  const lines=invoice.lines;
  if(invoice.billing_reason!=='subscription_cycle' || invoice.currency!=='eur' || invoice.collection_method!=='charge_automatically' || lines?.has_more || lines?.data?.length!==1 || Number(lines.total_count || 1)!==1 || (invoice.starting_balance || 0)!==0) return null;
  const line=lines.data[0];
  const seconds=line.period?.end-line.period?.start;
  if(line.quantity!==1 || !prices.has(id(line.price || line.pricing?.price_details?.price)) || !Number.isFinite(seconds) || seconds<27*86400 || seconds>32*86400 || line.proration || line.parent?.subscription_item_details?.proration) return null;
  return line;
}
const ownCoupon=invoice=>invoice.discounts?.some(d=>typeof d==='object'&&id(d.coupon || d.source?.coupon)===REFERRAL_COUPON);

export async function applyReferralMonth(sql,stripe,object,{now=()=>Date.now()}={}) {
  if(object.billing_reason!=='subscription_cycle' || !subId(object)) return;
  const [owner]=await sql`SELECT user_id,stripe_subscription_id FROM public.postibou_entitlements WHERE stripe_customer_id=${id(object.customer)} AND stripe_subscription_id=${subId(object)}`;
  if(!owner) return;
  let [redemption]=await sql`SELECT * FROM public.postibou_referral_redemptions WHERE invoice_id=${object.id}`;
  if(redemption?.status==='used' || redemption?.status==='void') return;
  const invoice=await stripe.invoices.retrieve(object.id,{expand:['discounts']});
  if(invoice.id!==object.id || id(invoice.customer)!==id(object.customer) || subId(invoice)!==owner.stripe_subscription_id) throw Error('REFERRAL_INVOICE_MISMATCH');
  const line=renewalLine(invoice);
  if(!line) return;
  if(!redemption) {
    if(invoice.status!=='draft' || invoice.amount_due<=0) return;
    // Up-to-date checks at the actual renewal also cover rewards still waiting
    // for the daily job and refunds that arrived just before this invoice.
    await qualifyReferrals(sql,stripe,{referrerId:owner.user_id,now,limit:20});
    const rewards=await sql`SELECT * FROM public.postibou_referrals r WHERE referrer_id=${owner.user_id}::uuid AND status='qualified'
      AND NOT EXISTS (SELECT 1 FROM public.postibou_referral_redemptions d WHERE d.referral_id=r.referral_id AND d.status<>'void') ORDER BY qualified_at,created_at LIMIT 1`;
    if(!rewards[0]) return;
    if(!await paymentStillValid(stripe,rewards[0])) { await sql`UPDATE public.postibou_referrals SET status='invalid' WHERE referral_id=${rewards[0].referral_id}::uuid`;return; }
    const coupon=await stripe.coupons.retrieve(REFERRAL_COUPON,{expand:['applies_to']});
    if(coupon.deleted || !coupon.valid || coupon.percent_off!==100 || coupon.duration!=='once' || coupon.applies_to?.products?.length!==1 || coupon.applies_to.products[0]!=='prod_VOog5UMGZt2LCL') throw Error('REFERRAL_COUPON_UNAVAILABLE');
    await sql`INSERT INTO public.postibou_referral_redemptions(redemption_id,referral_id,referrer_id,invoice_id,subscription_id,period_start,period_end)
      VALUES (${randomUUID()}::uuid,${rewards[0].referral_id}::uuid,${owner.user_id}::uuid,${invoice.id},${subId(invoice)},${dt(line.period.start)}::timestamptz,${dt(line.period.end)}::timestamptz) ON CONFLICT DO NOTHING`;
    [redemption]=await sql`SELECT * FROM public.postibou_referral_redemptions WHERE invoice_id=${invoice.id}`;
    if(!redemption) throw Error('REFERRAL_REDEMPTION_CONFLICT');
  }
  if(invoice.metadata?.postibou_referral_redemption===redemption.redemption_id && ownCoupon(invoice) && invoice.amount_due===0) {
    await sql`UPDATE public.postibou_referral_redemptions SET status=${invoice.status==='paid'?'used':'applied'},applied_at=COALESCE(applied_at,now()),used_at=CASE WHEN ${invoice.status==='paid'} THEN COALESCE(used_at,now()) ELSE used_at END WHERE redemption_id=${redemption.redemption_id}::uuid AND status NOT IN ('used','void')`;return;
  }
  if(invoice.status!=='draft') { await sql`UPDATE public.postibou_referral_redemptions SET status='review' WHERE redemption_id=${redemption.redemption_id}::uuid`;throw Error('REFERRAL_INVOICE_ALREADY_FINALIZED'); }
  const discounts=(invoice.discounts||[]).map(d=>({discount:id(d)}));
  if(discounts.length>=20 || ownCoupon(invoice)) throw Error('REFERRAL_DISCOUNT_CONFLICT');
  const payload=redemption.request_payload||{discounts:[...discounts,{coupon:REFERRAL_COUPON}],metadata:{postibou_referral_redemption:redemption.redemption_id}};
  const [saved]=await sql`UPDATE public.postibou_referral_redemptions SET request_payload=COALESCE(request_payload,${JSON.stringify(payload)}::jsonb) WHERE redemption_id=${redemption.redemption_id}::uuid RETURNING request_payload`;
  const updated=await stripe.invoices.update(invoice.id,saved.request_payload, {idempotencyKey:'postibou_referral_invoice_'+invoice.id});
  if(updated.amount_due!==0 || updated.metadata?.postibou_referral_redemption!==redemption.redemption_id) throw Error('REFERRAL_DISCOUNT_NOT_CONFIRMED');
  await sql`UPDATE public.postibou_referral_redemptions SET status='applied',applied_at=COALESCE(applied_at,now()) WHERE redemption_id=${redemption.redemption_id}::uuid AND status IN ('reserved','review','applied')`;
}

export async function settleReferralInvoice(sql,stripe,object) {
  const [row]=await sql`SELECT * FROM public.postibou_referral_redemptions WHERE invoice_id=${object.id} AND status<>'void'`;
  if(!row) return;
  const invoice=await stripe.invoices.retrieve(object.id,{expand:['discounts']});
  if(id(invoice.customer)!==id(object.customer) || subId(invoice)!==row.subscription_id) throw Error('REFERRAL_INVOICE_MISMATCH');
  if(invoice.status==='void') await sql`UPDATE public.postibou_referral_redemptions SET status='void' WHERE redemption_id=${row.redemption_id}::uuid AND status<>'used'`;
  else if(invoice.status==='paid' && invoice.amount_paid===0 && invoice.amount_due===0 && invoice.metadata?.postibou_referral_redemption===row.redemption_id && ownCoupon(invoice)) await sql`UPDATE public.postibou_referral_redemptions SET status='used',used_at=COALESCE(used_at,now()) WHERE redemption_id=${row.redemption_id}::uuid`;
  else if(invoice.status==='paid') { await sql`UPDATE public.postibou_referral_redemptions SET status='review' WHERE redemption_id=${row.redemption_id}::uuid`;throw Error('REFERRAL_INVOICE_REVIEW'); }
}
