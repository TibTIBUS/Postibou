// Read-only Stripe RPC bridge. Fictitious users and entitlement data remain local.
// The orchestrator supplies actual Stripe test responses, never an API key.
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {billingDatabase,userId} from '../tests/helpers/billing-database.mjs';
import {qualifyReferrals,referralDashboard} from '../netlify/functions/lib/referrals.mjs';
const fixtures=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.equal(fixtures.livemode,false);
assert.equal(fixtures.account,'acct_1UOADR9BDDs3b0Qj');
process.stdin.setRawMode?.(true);
const input=createInterface({input:process.stdin,terminal:false});
async function rpc(operation,parameters){
 const pending=once(input,'line');
 console.log(JSON.stringify({rpc:{operation,parameters}}));
 const [line]=await pending;const result=JSON.parse(line);
 if(result.error)throw Error(result.error);
 if(result.data?.livemode===true)throw Error('Live object refused');
 return result.data;
}
const stripe={
 invoices:{retrieve:id=>rpc('GetInvoicesInvoice',{id})},
 invoicePayments:{list:parameters=>rpc('GetInvoicePayments',parameters)},
 paymentIntents:{retrieve:id=>rpc('GetPaymentIntentsIntent',{id})},
 charges:{retrieve:id=>rpc('GetChargesCharge',{id})}
};
const db=await billingDatabase();
try{
 for(const [i,f] of fixtures.referees.entries()){
  const uid=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'][i];
  await db.db.query('INSERT INTO neon_auth."user"(id,email,"emailVerified") VALUES ($1,$2,true)',[uid,'fictitious'+i+'@example.test']);
  await db.db.query("INSERT INTO postibou_referrals(referral_id,referrer_id,referee_id,status,first_invoice_id,first_subscription_id,paid_at,eligible_at) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7)",['aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),userId,uid,f.invoice,f.subscription,new Date(fixtures.paidAt*1000),new Date((fixtures.paidAt+14*86400)*1000)]);
 }
 const before=await qualifyReferrals(db.sql,stripe,{now:()=>1000*(fixtures.paidAt+13*86400)});
 assert.equal(before,0);
 const reviewed=await qualifyReferrals(db.sql,stripe,{now:()=>1000*(fixtures.paidAt+14*86400)});
 assert.equal(reviewed,2);
 const dashboard=await referralDashboard(db.sql,userId);
 assert.equal(dashboard.available,2);assert.equal(dashboard.validated,2);
 console.log(JSON.stringify({result:{validated:dashboard.validated,available:dashboard.available,earlyQualification:before,provider:'actual Stripe sandbox API',clock:'local injected time; Stripe clock not advanced'}}));
}finally{await db.db.close();input.close();}
