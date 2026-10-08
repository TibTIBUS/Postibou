import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {billingDatabase,userId,auth,origin} from './helpers/billing-database.mjs';
import {referralDashboard,claimReferral,qualifyReferrals,applyReferralMonth,settleReferralInvoice,REFERRAL_COUPON,recordReferralPurchase} from '../netlify/functions/lib/referrals.mjs';
import {createReferralsHandler} from '../netlify/functions/referrals.mjs';
import {createStripeWebhookHandler} from '../netlify/functions/stripe-webhook.mjs';
const referee='22222222-2222-4222-8222-222222222222',third='33333333-3333-4333-8333-333333333333';
const now=()=>Date.parse('2026-11-08T12:00:00Z'),paid=Date.parse('2026-10-08T12:00:00Z')/1000;
const period={start:Date.parse('2026-11-08T12:00:00Z')/1000,end:Date.parse('2026-12-08T12:00:00Z')/1000};
const launch='price_1UO13LEnc0W23lgnnIpKJi4k',standard='price_1UO13LEnc0W23lgnTxtNXNW6';
let database;
before(async()=>{database=await billingDatabase();await database.db.query('INSERT INTO neon_auth."user"(id,email,"emailVerified") VALUES ($1,$2,true),($3,$4,true)',[referee,'filleul@example.test',third,'autre@example.test']);});
after(async()=>database.db.close());
beforeEach(async()=>{await database.reset();await database.db.query('UPDATE neon_auth."user" SET "createdAt"=now()');await database.db.query("INSERT INTO postibou_entitlements(user_id,plan,stripe_customer_id,stripe_subscription_id,stripe_subscription_status) VALUES ($1,'monthly','cus_sponsor','sub_sponsor','active')",[userId]);});
const rewards=async(n=1)=>{
 for(const [i,u] of [referee,third].slice(0,n).entries())await database.db.query("INSERT INTO postibou_referrals(referral_id,referrer_id,referee_id,status,first_invoice_id,first_subscription_id,paid_at,eligible_at) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7)",['aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),userId,u,'in_first_'+i,'sub_filleul_'+i,new Date(paid*1000),new Date((paid+14*86400)*1000)]);
};
const rows=async()=> (await database.db.query('SELECT * FROM postibou_referral_redemptions ORDER BY created_at')).rows;
function fixture({amount=790,price=launch}={}){
 let refund=false,dispute=false,failAfter=false,invoiceCalls=0;
 const invoices=new Map();
 const renew=(iid='in_renew',p=period)=>({id:iid,customer:'cus_sponsor',status:'draft',billing_reason:'subscription_cycle',currency:'eur',collection_method:'charge_automatically',parent:{subscription_details:{subscription:'sub_sponsor'}},amount_paid:0,amount_due:amount,starting_balance:0,metadata:{},discounts:[],lines:{has_more:false,total_count:1,data:[{quantity:1,pricing:{price_details:{price}},period:p}]}});
 const first=(iid)=>({id:iid,customer:'cus_filleul',status:'paid',amount_paid:790,currency:'eur',parent:{subscription_details:{subscription:'sub_filleul_'+iid.at(-1)}}});
 const stripe={
  invoices:{retrieve:async(iid)=>structuredClone(iid.startsWith('in_first')?first(iid):invoices.get(iid)),update:async(iid,params,options)=>{
   invoiceCalls++;const invoice=invoices.get(iid);invoice.amount_due=0;invoice.metadata={...invoice.metadata,...params.metadata};invoice.discounts=[{id:'di_referral',source:{coupon:REFERRAL_COUPON}}];
   assert.equal(options.idempotencyKey,'postibou_referral_invoice_'+iid);assert.equal(params.discounts.at(-1).coupon,REFERRAL_COUPON);
   if(failAfter){failAfter=false;throw Error('response lost');}return structuredClone(invoice);
  }},
  invoicePayments:{list:async({invoice})=>({has_more:false,data:[{invoice,status:'paid',amount_paid:790,currency:'eur',payment:{type:'payment_intent',payment_intent:'pi_first'}}]})},
  paymentIntents:{retrieve:async()=>({status:'succeeded',customer:'cus_filleul',latest_charge:'ch_first'})},
  charges:{retrieve:async()=>({customer:'cus_filleul',paid:true,status:'succeeded',refunded:refund,amount_refunded:refund?790:0,disputed:dispute})},
  coupons:{retrieve:async()=>({id:REFERRAL_COUPON,valid:true,percent_off:100,duration:'once',applies_to:{products:['prod_VOog5UMGZt2LCL']}})}
 };
 invoices.set('in_renew',renew());return {stripe,invoices,renew,refunded:()=>{refund=true;},disputed:()=>{dispute=true;},loseResponse:()=>{failAfter=true;},calls:()=>invoiceCalls};
}

test('a verified user has one opaque stable link; dashboard contains no referee identities',async()=>{
 const [a,b]=await Promise.all([referralDashboard(database.sql,userId),referralDashboard(database.sql,userId)]);assert.equal(a.code,b.code);assert.match(a.code,/^[A-F0-9]{16}$/);assert.equal(a.available,0);assert.equal(JSON.stringify(a).includes('filleul@example.test'),false);
});
test('attribution is voluntary, idempotent, single and cannot be self assigned',async()=>{
 const a=await referralDashboard(database.sql,userId);await assert.rejects(claimReferral(database.sql,userId,a.code));
 await Promise.all([claimReferral(database.sql,referee,a.code),claimReferral(database.sql,referee,a.code)]);
 assert.equal((await database.db.query('SELECT count(*)::int n FROM postibou_referrals')).rows[0].n,1);
 const b=await referralDashboard(database.sql,third);await assert.rejects(claimReferral(database.sql,referee,b.code),/REFERRAL_ALREADY_ASSIGNED/);
});
test('old accounts and accounts already in Checkout cannot acquire a sponsor',async()=>{
 const a=await referralDashboard(database.sql,userId);await database.db.query('UPDATE neon_auth."user" SET "createdAt"=now()-interval \'8 days\' WHERE id=$1',[referee]);await assert.rejects(claimReferral(database.sql,referee,a.code));
 await database.db.query('UPDATE neon_auth."user" SET "createdAt"=now() WHERE id=$1',[referee]);
 await database.db.query("INSERT INTO postibou_entitlements(user_id) VALUES ($1)",[referee]);
 await database.db.query("INSERT INTO postibou_checkout_attempts(user_id,attempt_id,price_id,customer_email,expires_at) VALUES ($1,$2,$3,'filleul@example.test',2000000000)",[referee,third,launch]);await assert.rejects(claimReferral(database.sql,referee,a.code));
});
test('unauthenticated and cross-site API calls cannot access or attach referrals',async()=>{
 let called=false;const h=createReferralsHandler({fetchAuth:async()=>Response.json({user:null}),getDatabase:()=>{called=true;throw Error('unexpected')}});
 assert.equal((await h(new Request(origin+'/api/referrals'))).status,401);assert.equal((await h(new Request(origin+'/api/referrals',{method:'POST',headers:{Origin:'https://evil.test'}}))).status,403);assert.equal(called,false);
 const owner=createReferralsHandler({fetchAuth:auth,getDatabase:()=>database.sql});const response=await owner(new Request(origin+'/api/referrals'));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
});
test('a mere inscription or unconfirmed purchase earns no month',async()=>{
 const a=await referralDashboard(database.sql,userId);await claimReferral(database.sql,referee,a.code);
 await recordReferralPurchase(database.sql,{client_reference_id:referee,id:'cs_none'},{id:'sub_none'});const dashboard=await referralDashboard(database.sql,userId);assert.equal(dashboard.pending,1);assert.equal(dashboard.validated,0);
});
test('the fourteen days are enforced even when qualification is invoked early',async()=>{
 await rewards();const f=fixture();assert.equal(await qualifyReferrals(database.sql,f.stripe,{now:()=>Date.parse('2026-10-21T12:00:00Z')}),0);
 assert.equal((await referralDashboard(database.sql,userId)).available,0);
 await qualifyReferrals(database.sql,f.stripe,{now:()=>Date.parse('2026-10-22T12:00:00Z')});assert.equal((await referralDashboard(database.sql,userId)).available,1);
});
for(const kind of ['refund','dispute','withdrawal'])test(kind+' prevents a reward after the waiting period',async()=>{
 await rewards();const f=fixture();if(kind==='refund')f.refunded();if(kind==='dispute')f.disputed();if(kind==='withdrawal')await database.db.query("INSERT INTO postibou_withdrawal_requests(request_id,user_id,subscription_id,account_email) VALUES ($1,$2,'sub_filleul_0','filleul@example.test')",[third,referee]);await qualifyReferrals(database.sql,f.stripe,{now});assert.equal((await referralDashboard(database.sql,userId)).available,0);assert.equal((await database.db.query('SELECT status FROM postibou_referrals')).rows[0].status,'invalid');
});
test('a permission or payment verification failure fails closed instead of granting a month',async()=>{
 await rewards();const f=fixture();f.stripe.invoicePayments.list=async()=>{throw Error('restricted key permission')};await assert.rejects(qualifyReferrals(database.sql,f.stripe,{now}));assert.equal((await referralDashboard(database.sql,userId)).available,0);
});
for(const [amount,price] of [[790,launch],[990,standard]])test('one referral makes the '+amount+' cent renewal free without editing prices, subscription or schedule',async()=>{
 await rewards();const f=fixture({amount,price});await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});assert.equal(f.invoices.get('in_renew').amount_due,0);assert.equal((await rows()).length,1);assert.equal((await referralDashboard(database.sql,userId)).scheduled,1);
 f.invoices.get('in_renew').status='paid';await settleReferralInvoice(database.sql,f.stripe,f.invoices.get('in_renew'));assert.equal((await rows())[0].status,'used');assert.equal((await referralDashboard(database.sql,userId)).used,1);
});
test('successive referrals offer successive months; a duplicate event never spends another month',async()=>{
 await rewards(2);const f=fixture();await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});assert.equal(f.calls(),1);assert.equal((await referralDashboard(database.sql,userId)).available,1);
 const next={start:period.end,end:Date.parse('2027-01-08T12:00:00Z')/1000};f.invoices.set('in_next',f.renew('in_next',next));await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_next'),{now:()=>Date.parse('2026-12-08T12:00:00Z')});assert.equal((await rows()).length,2);assert.equal((await referralDashboard(database.sql,userId)).available,0);
});
test('concurrent renewal deliveries reserve the same month exactly once',async()=>{
 await rewards(2);const f=fixture();const results=await Promise.allSettled([applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now}),applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now})]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal((await rows()).length,1);assert.equal((await referralDashboard(database.sql,userId)).available,1);
});
test('Stripe response lost after applying the discount is recovered without another discount',async()=>{
 await rewards();const f=fixture();f.loseResponse();await assert.rejects(applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now}));await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});assert.equal(f.calls(),1);assert.equal((await rows())[0].status,'applied');
});
test('a database response lost after Stripe success is reconciled from the invoice metadata',async()=>{
 await rewards();const f=fixture();let fail=true;const sql=async(strings,...values)=>{const result=await database.sql(strings,...values);if(fail&&strings.join('?').includes("SET status='applied'")){fail=false;throw Error('database response lost');}return result;};await assert.rejects(applyReferralMonth(sql,f.stripe,f.invoices.get('in_renew'),{now}));await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});assert.equal(f.calls(),1);
});
test('initial, foreign, already free, prorated and mixed invoices never consume a month',async()=>{
 await rewards();const f=fixture();const initial=structuredClone(f.invoices.get('in_renew'));
 for(const changed of [{billing_reason:'subscription_create'},{customer:'cus_other'},{amount_due:0},{starting_balance:100},{status:'open'},{lines:{has_more:false,data:[{quantity:2,price:launch,period}]}},{lines:{has_more:true,data:[]}}]) {
  const candidate={...structuredClone(initial),...changed};f.invoices.set('in_renew',candidate);await applyReferralMonth(database.sql,f.stripe,candidate,{now});
 }
 assert.equal((await rows()).length,0);assert.equal(f.calls(),0);
});
test('a voided unused invoice returns its reward without erasing its audit trail',async()=>{
 await rewards();const f=fixture();await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});f.invoices.get('in_renew').status='void';await settleReferralInvoice(database.sql,f.stripe,f.invoices.get('in_renew'));assert.equal((await rows())[0].status,'void');assert.equal((await referralDashboard(database.sql,userId)).available,1);
});
test('a refund detected at renewal invalidates a previously qualified unused reward',async()=>{
 await rewards();const f=fixture();await qualifyReferrals(database.sql,f.stripe,{now});f.refunded();await applyReferralMonth(database.sql,f.stripe,f.invoices.get('in_renew'),{now});assert.equal(f.calls(),0);assert.equal((await rows()).length,0);
});
test('the signed invoice.created event reaches the referral handler and failures remain retryable',async()=>{
 let called=0;const stripe={webhooks:{constructEvent:body=>JSON.parse(body.toString())}};const h=createStripeWebhookHandler({getStripe:()=>stripe,getDatabase:()=>database.sql,getWebhookSecret:()=> 'synthetic',referralRenewal:async()=>{called++;throw Error('retry')}});const req=()=>new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'synthetic'},body:JSON.stringify({id:'evt_referral',type:'invoice.created',data:{object:{id:'in_renew'}}})});assert.equal((await h(req())).status,500);assert.equal((await h(req())).status,500);assert.equal(called,2);assert.equal((await database.db.query('SELECT status FROM postibou_stripe_events')).rows[0].status,'processing');
});
