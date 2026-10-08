// Real Stripe sandbox invoices, local signed webhook replay, in-memory PostgreSQL.
import Stripe from 'stripe';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {billingDatabase,auth,request,origin,userId} from '../tests/helpers/billing-database.mjs';
import {createStripeWebhookHandler} from '../netlify/functions/stripe-webhook.mjs';
import {createCancellationHandler} from '../netlify/functions/billing-cancel.mjs';
import {createUsageHandler} from '../netlify/functions/usage.mjs';
const c=JSON.parse(await readFile(process.env.POSTIBOU_CLOCK_CREDENTIALS,'utf8'));
const f=JSON.parse(await readFile(process.env.POSTIBOU_CLOCK_FIXTURES,'utf8'));
assert.equal(f.customer,'cus_VP00dp0JNmXu2x');assert.equal(f.clock,'clock_1UOC0B9BDDs3b0QjJNJOyXWH');
const stripe=new Stripe(c['uat:postibou-test'],{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),timeout:20000,maxNetworkRetries:0,stripeAccount:'acct_1UOADR9BDDs3b0Qj'});
const customer=await stripe.customers.retrieve(f.customer);assert.equal(customer.livemode,false);assert.equal(customer.test_clock,f.clock);
const sessions=await stripe.checkout.sessions.list({customer:f.customer,limit:10});
const session=sessions.data.find(s=>s.status==='complete'&&s.client_reference_id===userId);assert.ok(session,'Complete the test Checkout first');assert.equal(session.livemode,false);assert.equal(session.payment_status,'paid');
const database=await billingDatabase();await database.sql`INSERT INTO postibou_entitlements (user_id,stripe_customer_id) VALUES (${userId}::uuid,${f.customer})`;
let clock=await stripe.testHelpers.testClocks.retrieve(f.clock);
const deps={fetchAuth:auth,getDatabase:()=>database.sql,getStripe:()=>stripe,prices:f.prices};
const secret='whsec_'+randomBytes(32).toString('hex');
const webhook=createStripeWebhookHandler({...deps,getWebhookSecret:()=>secret});
const usage=createUsageHandler({...deps,now:()=>clock.frozen_time*1000});
const cancel=createCancellationHandler(deps);
const results=[];const record=x=>{results.push(x);console.log(JSON.stringify(x));};
async function replay(event){assert.equal(event.livemode,false);const payload=JSON.stringify(event);const res=await webhook(new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret})},body:payload}));assert.equal(res.status,200,JSON.stringify(await res.clone().json()));return await res.json();}
const events=await stripe.events.list({type:'checkout.session.completed',limit:100});const completed=events.data.find(e=>e.data.object.id===session.id);assert.ok(completed);await replay(completed);
let sub=await stripe.subscriptions.retrieve(session.subscription);assert.equal(sub.status,'active');assert.ok(sub.schedule);
const schedule=await stripe.subscriptionSchedules.retrieve(sub.schedule);record({check:'schedule',id:schedule.id,phases:schedule.phases.map(p=>({start:p.start_date,end:p.end_date,price:p.items[0].price}))});
async function advance(time){await stripe.testHelpers.testClocks.advance(f.clock,{frozen_time:time});for(let i=0;i<30;i++){clock=await stripe.testHelpers.testClocks.retrieve(f.clock);if(clock.status==='ready')return;assert.notEqual(clock.status,'internal_failure');await new Promise(r=>setTimeout(r,2000));}throw new Error('Clock did not become ready');}
async function invoicePaid(){const list=await stripe.invoices.list({customer:f.customer,subscription:sub.id,limit:10});let inv=list.data.find(x=>x.billing_reason==='subscription_cycle'&&x.period_end===sub.items.data[0].current_period_start);if(!inv)inv=list.data.filter(x=>x.billing_reason==='subscription_cycle').sort((a,b)=>b.created-a.created)[0];assert.ok(inv);if(inv.status==='draft'){await advance(clock.frozen_time+7200);sub=await stripe.subscriptions.retrieve(sub.id);return invoicePaid();}assert.equal(inv.status,'paid',JSON.stringify({id:inv.id,status:inv.status}));const events=await stripe.events.list({type:'invoice.paid',limit:100});const e=events.data.find(x=>x.data.object.id===inv.id);assert.ok(e);await replay(e);assert.equal((await replay(e)).duplicate,true);return inv;}
for(const expected of [790,790,990,990]){
 await database.sql`UPDATE postibou_entitlements SET adaptations_used=30 WHERE user_id=${userId}::uuid`;
 const end=sub.items.data[0].current_period_end;await advance(end+7200);sub=await stripe.subscriptions.retrieve(sub.id);const invoice=await invoicePaid();assert.equal(invoice.amount_paid,expected);assert.equal(sub.items.data[0].price.unit_amount,expected);
 const state=await(await usage(new Request(origin+'/api/usage'))).json();assert.equal(state.creditsRemaining,30);assert.equal(state.active,true);record({check:'renewal',invoice:invoice.id,amountPaid:invoice.amount_paid,periodStart:sub.items.data[0].current_period_start,credits:state.creditsRemaining});
}
const result=await cancel(request());assert.equal(result.status,200);const canceled=await result.json();record({check:'cancel-request',result:canceled});
const before=await(await usage(new Request(origin+'/api/usage'))).json();assert.equal(before.active,true);assert.equal(before.cancelAtPeriodEnd,true);
sub=await stripe.subscriptions.retrieve(sub.id);const end=sub.items.data[0].current_period_end;
await advance(end+7200);sub=await stripe.subscriptions.retrieve(sub.id);assert.equal(sub.status,'canceled');
const deleted=await stripe.events.list({type:'customer.subscription.deleted',limit:100});const e=deleted.data.find(x=>x.data.object.id===sub.id);assert.ok(e);await replay(e);
const after=await(await usage(new Request(origin+'/api/usage'))).json();assert.equal(after.active,false);record({check:'access-ended',status:sub.status,active:after.active});
await writeFile(process.env.POSTIBOU_CLOCK_REPORT,JSON.stringify({account:'acct_1UOADR9BDDs3b0Qj',customer:f.customer,clock:f.clock,subscription:sub.id,results},null,2),{mode:0o600});await database.db.close();
