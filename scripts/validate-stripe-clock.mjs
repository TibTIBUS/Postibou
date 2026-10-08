// Isolated manual Stripe clock verification. Never uses Neon or Netlify production.
import Stripe from 'stripe';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {billingDatabase,auth,request,userId} from '../tests/helpers/billing-database.mjs';
import {createCheckoutHandler} from '../netlify/functions/billing-checkout.mjs';
const credentials=JSON.parse(await readFile(process.env.POSTIBOU_CLOCK_CREDENTIALS,'utf8'));
const stripe=new Stripe(credentials['uat:postibou-test'],{apiVersion:'2026-08-26.dahlia',httpClient:Stripe.createFetchHttpClient(),timeout:20000,maxNetworkRetries:0,stripeAccount:'acct_1UOADR9BDDs3b0Qj'});
const customerId='cus_VP00dp0JNmXu2x',clockId='clock_1UOC0B9BDDs3b0QjJNJOyXWH';
const prices={launch:'price_1UOBPL9BDDs3b0QjiWXzzKiy',standard:'price_1UOBPT9BDDs3b0QjuQEiELdj'};
const customer=await stripe.customers.retrieve(customerId);assert.equal(customer.livemode,false);assert.equal(customer.test_clock,clockId);
const clock=await stripe.testHelpers.testClocks.retrieve(clockId);assert.equal(clock.status,'ready');
for(const [name,id] of Object.entries(prices)) {const p=await stripe.prices.retrieve(id);assert.equal(p.livemode,false);assert.equal(p.unit_amount,name==='launch'?790:990);assert.equal(p.currency,'eur');assert.equal(p.recurring.interval,'month');}
const subscriptions=await stripe.subscriptions.list({customer:customerId,status:'all',limit:10});
assert.equal(subscriptions.data.length,0,'Use the existing clock subscription instead of creating another');
const existing=await stripe.checkout.sessions.list({customer:customerId,limit:10});
assert.ok(!existing.data.some(s=>s.status==='open'||s.status==='complete'),'A clock Checkout already exists; use its URL');
const database=await billingDatabase();
await database.sql`INSERT INTO postibou_entitlements (user_id,stripe_customer_id) VALUES (${userId}::uuid,${customerId})`;
const handler=createCheckoutHandler({paidLaunchReady:true,fetchAuth:auth,getDatabase:()=>database.sql,getStripe:()=>stripe,prices});
const response=await handler(request());const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
await writeFile(process.env.POSTIBOU_CLOCK_FIXTURES,JSON.stringify({customer:customerId,clock:clockId,frozen:clock.frozen_time,prices,url:result.url}),{mode:0o600});
console.log(JSON.stringify({check:'clock-checkout-created',...result,customer:customerId,clock:clockId,frozen:clock.frozen_time}));await database.db.close();
