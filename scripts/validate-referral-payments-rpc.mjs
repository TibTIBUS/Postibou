// Stripe sandbox RPC bridge. Fictitious entitlement data remain local.
// The orchestrator supplies actual Stripe test responses, never an API key.
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {billingDatabase,userId} from '../tests/helpers/billing-database.mjs';
import {qualifyReferrals,referralDashboard,applyReferralMonth,settleReferralInvoice} from '../netlify/functions/lib/referrals.mjs';
const fixtures=JSON.parse(await readFile(process.argv[2],'utf8'));
const invoiceId=process.argv[3];
const ledgerPath=new URL('./referral-sandbox-ledger.json',import.meta.url);
let previous=[];
try{previous=JSON.parse(await readFile(ledgerPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
assert.equal(fixtures.livemode,false);
assert.equal(fixtures.account,'acct_1UOADR9BDDs3b0Qj');
process.stdin.setRawMode?.(true);
const input=createInterface({input:process.stdin,terminal:false});
async function rpc(operation,parameters,write=false){
 const pending=once(input,'line');
 console.log(JSON.stringify({rpc:{operation,parameters,write}}));
 const [line]=await pending;const result=JSON.parse(line);
 if(result.error)throw Error(result.error);
 if(result.data?.livemode===true)throw Error('Live object refused');
 return result.data;
}
let invoiceWrites=0;
const stripe={
 invoices:{retrieve:(id,options={})=>rpc('GetInvoicesInvoice',{id,...options}),update:async(id,parameters,options)=>{
  assert.equal(options.idempotencyKey,'postibou_referral_invoice_'+id);
  await saveLedger();invoiceWrites++;
  return rpc('PostInvoicesInvoice',{id,...parameters},true);
 }},
 coupons:{retrieve:(id,options={})=>rpc('GetCouponsCoupon',{id,...options})},
 invoicePayments:{list:parameters=>rpc('GetInvoicePayments',parameters)},
 paymentIntents:{retrieve:id=>rpc('GetPaymentIntentsIntent',{id})},
 charges:{retrieve:id=>rpc('GetChargesCharge',{id})}
};
const db=await billingDatabase();
async function saveLedger(){
 await writeFile(ledgerPath,JSON.stringify((await db.db.query('SELECT * FROM postibou_referral_redemptions ORDER BY created_at')).rows,null,2)+'\n');
}
try{
 await db.db.query("INSERT INTO postibou_entitlements(user_id,plan,stripe_customer_id,stripe_subscription_id,stripe_subscription_status) VALUES ($1,'monthly',$2,$3,'active')",[userId,fixtures.sponsor.customer,fixtures.sponsor.subscription]);
 for(const [i,f] of fixtures.referees.entries()){
  const uid=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'][i];
  await db.db.query('INSERT INTO neon_auth."user"(id,email,"emailVerified") VALUES ($1,$2,true)',[uid,'fictitious'+i+'@example.test']);
  await db.db.query("INSERT INTO postibou_referrals(referral_id,referrer_id,referee_id,status,first_invoice_id,first_subscription_id,paid_at,eligible_at) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7)",['aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),userId,uid,f.invoice,f.subscription,new Date(fixtures.paidAt*1000),new Date((fixtures.paidAt+14*86400)*1000)]);
 }
 for(const row of previous){
  const fields=Object.keys(row);
  await db.db.query('INSERT INTO postibou_referral_redemptions('+fields.join(',')+') VALUES ('+fields.map((_,i)=>'$'+(i+1)).join(',')+')',fields.map(k=>k==='request_payload'&&row[k]?JSON.stringify(row[k]):row[k]));
  await db.db.query("UPDATE postibou_referrals SET status='qualified',qualified_at=eligible_at WHERE referral_id=$1",[row.referral_id]);
 }
 const before=await qualifyReferrals(db.sql,stripe,{now:()=>1000*(fixtures.paidAt+13*86400)});
 assert.equal(before,0);
 const reviewed=await qualifyReferrals(db.sql,stripe,{now:()=>1000*(fixtures.paidAt+14*86400)});
 assert.equal(reviewed,2-previous.filter(r=>r.status!=='void').length);
 const dashboard=await referralDashboard(db.sql,userId);
 assert.equal(dashboard.available,2-previous.filter(r=>r.status!=='void').length);
 if(invoiceId){
  const current=await stripe.invoices.retrieve(invoiceId,{expand:['discounts']});
  assert.equal(current.livemode,false);assert.equal(current.customer,fixtures.sponsor.customer);
  const options={now:()=>1000*current.lines.data[0].period.start,allowedPrices:new Set(['price_1UOBPL9BDDs3b0QjiWXzzKiy','price_1UOBPT9BDDs3b0QjuQEiELdj']),productId:'prod_VOzNa1qUp6NCc1'};
  await applyReferralMonth(db.sql,stripe,current,options);await saveLedger();
  const firstWrites=invoiceWrites;
  await applyReferralMonth(db.sql,stripe,current,options);await saveLedger();
  assert.equal(invoiceWrites,firstWrites,'Replay must never update the invoice again');
  let invoice=await stripe.invoices.retrieve(invoiceId,{expand:['discounts']});
  assert.equal(invoice.amount_due,0);assert.equal(invoice.total,0);
  if(invoice.status==='draft')invoice=await rpc('PostInvoicesInvoiceFinalize',{id:invoiceId},true);
  assert.equal(invoice.status,'paid');assert.equal(invoice.amount_paid,0);
  await settleReferralInvoice(db.sql,stripe,invoice);await saveLedger();
  const counts=await referralDashboard(db.sql,userId);
  console.log(JSON.stringify({result:{invoice:invoiceId,status:invoice.status,total:invoice.total,amountPaid:invoice.amount_paid,available:counts.available,used:counts.used,scheduled:counts.scheduled,invoiceWrites,duplicateWrites:invoiceWrites-firstWrites,provider:'actual Stripe sandbox; application ledger isolated locally'}}));
 }else console.log(JSON.stringify({result:{validated:dashboard.validated,available:dashboard.available,earlyQualification:before,provider:'actual Stripe sandbox API',clock:'local injected time; Stripe clock not advanced'}}));
}finally{await saveLedger();await db.db.close();input.close();}
