// Manual integration test: synthetic Stripe customer, test prices, in-memory SQL only.
// This test schedules then cancels the fixture subscription at the paid period end.
import Stripe from 'stripe';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {billingDatabase,auth,request,origin,userId} from '../tests/helpers/billing-database.mjs';
import {createStripeWebhookHandler} from '../netlify/functions/stripe-webhook.mjs';
import {createCancellationHandler} from '../netlify/functions/billing-cancel.mjs';
import {createUsageHandler} from '../netlify/functions/usage.mjs';
const required = name => { if (!process.env[name]) throw new Error('Missing private file path: ' + name); return process.env[name]; };
const credentialsFile = required('POSTIBOU_STRIPE_SANDBOX_FILE');
const fixturesFile = required('POSTIBOU_STRIPE_SANDBOX_FIXTURES');
const eventFile = required('POSTIBOU_STRIPE_SANDBOX_EVENT');
const credentials=JSON.parse(await readFile(credentialsFile,'utf8'));
assert.match(credentials.secret_key,/^(sk|rk|rkcs)_test_/);
const stripe=new Stripe(credentials.secret_key,{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:0,timeout:20000});
const fixture=JSON.parse(await readFile(fixturesFile,'utf8'));
const event=JSON.parse(await readFile(eventFile,'utf8'));
assert.equal(event.livemode,false);
assert.equal(event.type,'checkout.session.completed');
assert.equal(event.data.object.customer,fixture.customer);
assert.equal(event.data.object.client_reference_id,userId);
assert.equal(event.data.object.payment_status,'paid');
const customer=await stripe.customers.retrieve(fixture.customer);
assert.equal(customer.livemode,false);
assert.ok(!customer.deleted);
for (const [name,id] of Object.entries(fixture.prices)) {
 const price=await stripe.prices.retrieve(id);
 assert.equal(price.livemode,false);assert.equal(price.currency,'eur');
 assert.equal(price.unit_amount,name==='launch'?790:990);
 assert.equal(price.recurring.interval,'month');
}
const database=await billingDatabase();
await database.sql`INSERT INTO postibou_entitlements (user_id,stripe_customer_id) VALUES (${userId}::uuid,${fixture.customer})`;
const deps={fetchAuth:auth,getDatabase:()=>database.sql,getStripe:()=>stripe,prices:fixture.prices};
const {randomBytes} = await import('node:crypto');
// Sign a local replay of a genuine sandbox event; this is not Stripe network delivery.
const secret = 'whsec_' + randomBytes(32).toString('hex');
const webhook=createStripeWebhookHandler({...deps,getWebhookSecret:()=>secret});
const usage=createUsageHandler(deps);
const payload=JSON.stringify(event);
const webhookRequest=()=>new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret})},body:payload});
const response=await webhook(webhookRequest());
console.log(JSON.stringify({check:'actual-Stripe-event-local-replay',status:response.status,result:await response.json()}));
assert.equal(response.status,200);
const entitlement=await (await usage(new Request(origin+'/api/usage'))).json();
console.log(JSON.stringify({check:'activation',result:entitlement}));
assert.equal(entitlement.plan,'monthly');assert.equal(entitlement.creditsRemaining,30);assert.equal(entitlement.active,true);
const subscription=await stripe.subscriptions.retrieve(event.data.object.subscription);
const schedule=await stripe.subscriptionSchedules.retrieve(subscription.schedule);
console.log(JSON.stringify({check:'scheduled-prices',phases:schedule.phases.map(p=>({start:p.start_date,end:p.end_date,price:p.items[0].price})),endBehavior:schedule.end_behavior}));
assert.equal(schedule.phases[0].items[0].price,fixture.prices.launch);assert.equal(schedule.phases[1].items[0].price,fixture.prices.standard);
assert.ok(schedule.phases[1].start_date>=Date.parse('2026-12-31T23:00:00Z')/1000);
const duplicate=await webhook(webhookRequest());assert.equal((await duplicate.json()).duplicate,true);console.log(JSON.stringify({check:'event-replay-idempotent',passed:true}));
const cancel=createCancellationHandler(deps);
for(let i=0;i<2;i++){
 const result=await cancel(request());console.log(JSON.stringify({check:'cancellation',attempt:i+1,status:result.status,result:await result.json()}));assert.equal(result.status,200);
}
const after=await (await usage(new Request(origin+'/api/usage'))).json();assert.equal(after.cancelAtPeriodEnd,true);assert.equal(after.creditsRemaining,30);assert.equal(after.active,true);
const final=await stripe.subscriptions.retrieve(subscription.id);
const finalSchedule=await stripe.subscriptionSchedules.retrieve(final.schedule);
assert.equal(finalSchedule.end_behavior,'cancel');assert.equal(finalSchedule.phases.length,1);assert.equal(finalSchedule.phases[0].end_date,final.items.data[0].current_period_end);
console.log(JSON.stringify({check:'paid-access-retained',passed:true,periodEnd:after.subscriptionPeriodEnd}));

await database.db.close();
