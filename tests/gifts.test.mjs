import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {billingDatabase,userId,origin,auth,request as checkoutRequest} from './helpers/billing-database.mjs';
import {findGift,giftUsage,reserveGift,refundGift} from '../netlify/functions/lib/gifts.mjs';
import {createUsageHandler} from '../netlify/functions/usage.mjs';
import {createAdaptHandler} from '../netlify/functions/adapt.mjs';
import {createCheckoutHandler} from '../netlify/functions/billing-checkout.mjs';
import {accountSummary} from '../netlify/functions/admin.mjs';
import {randomUUID} from 'node:crypto';
let database;
before(async()=>{database=await billingDatabase();await database.db.exec(`INSERT INTO postibou_gifts(email,starts_at,ends_at) VALUES ('artisan@example.fr',now()-interval '1 month',now()+interval '3 months');`);});
after(async()=>database.db.close());
const output=async()=>Response.json({choices:[{message:{content:JSON.stringify({facebook:'Texte Facebook',instagram:'Texte Instagram'})}}]});
const adaptRequest=()=>new Request(origin+'/api/adapt',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({source:'Terrasse terminée',tone:'warm',mode:'magic'})});

test('a verified gift account gets 30 credits without billing, and cannot create a paid checkout while gifted',async()=>{
 const response=await createUsageHandler({fetchAuth:auth,getDatabase:()=>database.sql})(new Request(origin+'/api/usage'));
 const usage=await response.json();assert.equal(usage.plan,'gift');assert.equal(usage.creditsRemaining,30);assert.equal(usage.hasBilling,false);assert.equal(usage.canCancel,false);
 const checkout=await createCheckoutHandler({fetchAuth:auth,getDatabase:()=>database.sql,paidLaunchReady:true,mailReady:()=>true,getStripe:()=>{throw Error('must not create Stripe session');}})(checkoutRequest());
 assert.equal(checkout.status,409);assert.equal((await checkout.json()).code,'GIFT_ALREADY_ACTIVE');
});

test('unverified or foreign accounts cannot claim a gift',async()=>{
 await database.db.exec(`UPDATE neon_auth."user" SET "emailVerified"=false WHERE id='${userId}';`);
 assert.equal(await findGift(database.sql,userId),null);
 await database.db.exec(`UPDATE neon_auth."user" SET "emailVerified"=true WHERE id='${userId}'; INSERT INTO neon_auth."user"(id,"emailVerified",email) VALUES ('22222222-2222-4222-8222-222222222222',true,'other@example.test');`);
 assert.equal(await findGift(database.sql,'22222222-2222-4222-8222-222222222222'),null);
});

test('both generation modes reserve one gift credit; AI failure returns it',async()=>{
 const response=await createAdaptHandler({fetchAuth:auth,getDatabase:()=>database.sql,getApiKey:()=> 'test',fetchModel:output})(adaptRequest());
 assert.equal(response.status,200);assert.equal((await response.json()).creditsRemaining,29);
 const failed=await createAdaptHandler({fetchAuth:auth,getDatabase:()=>database.sql,getApiKey:()=> 'test',fetchModel:async()=>new Response('{}',{status:503})})(adaptRequest());
 assert.equal(failed.status,502);assert.equal(giftUsage(await findGift(database.sql,userId)).creditsRemaining,29);
});

test('the monthly cap is atomic and unused credits do not roll over',async()=>{
 const gift=await findGift(database.sql,userId);
 const attempts=await Promise.all(Array.from({length:35},()=>reserveGift(database.sql,userId,gift,randomUUID())));
 assert.equal(attempts.filter(rows=>rows.length).length,29);
 assert.equal(giftUsage(await findGift(database.sql,userId)).creditsRemaining,0);
 await database.db.exec(`UPDATE postibou_gifts SET usage_period_start=usage_period_start-interval '1 month';`);
 const next=await findGift(database.sql,userId);assert.equal(giftUsage(next).creditsRemaining,30);
 const id=randomUUID();await reserveGift(database.sql,userId,next,id);
 assert.equal(giftUsage(await findGift(database.sql,userId)).creditsRemaining,29);
 await refundGift(database.sql,userId,id);await refundGift(database.sql,userId,id);
 assert.equal(giftUsage(await findGift(database.sql,userId)).creditsRemaining,30);
});

test('a delayed refund cannot give an extra credit in a later gift month',async()=>{
 const gift=await findGift(database.sql,userId);const id=randomUUID();await reserveGift(database.sql,userId,gift,id);
 await database.db.exec(`UPDATE postibou_adaptation_reservations SET gift_period_start=gift_period_start-interval '1 month' WHERE id='${id}';`);
 await refundGift(database.sql,userId,id);assert.equal(giftUsage(await findGift(database.sql,userId)).creditsRemaining,29);
});

test('gift expiry blocks AI and provides subscription choice; an active paid account takes precedence',async()=>{
 await database.db.exec(`UPDATE postibou_gifts SET ends_at=now()-interval '1 second';`);
 const expired=await findGift(database.sql,userId);assert.equal(giftUsage(expired).creditsRemaining,0);assert.equal(giftUsage(expired).active,false);
 const response=await createAdaptHandler({fetchAuth:auth,getDatabase:()=>database.sql,getApiKey:()=> 'test',fetchModel:()=>{throw Error('no model after expiry');}})(adaptRequest());
 assert.equal(response.status,403);assert.equal((await response.json()).code,'GIFT_EXPIRED');
 await database.db.exec(`UPDATE postibou_entitlements SET plan='monthly',stripe_subscription_status='active',subscription_period_end=now()+interval '1 month' WHERE user_id='${userId}';`);
 assert.equal(await findGift(database.sql,userId),null);
});

test('admin distinguishes gifted access from a paid subscription',()=>{
 const now=Date.parse('2026-10-08T19:00:00Z');const row={email:'artisan@example.fr',emailVerified:true,plan:'trial',gift_email:'artisan@example.fr',gift_starts_at:'2026-09-30T22:00:00Z',gift_ends_at:'2026-12-31T23:00:00Z',gift_usage_period_start:'2026-09-30T22:00:00Z',gift_current_period_start:'2026-09-30T22:00:00Z',gift_used:2};
 const summary=accountSummary(row,now);assert.equal(summary.status,'gift');assert.equal(summary.remaining,28);assert.equal(summary.lastPayment,null);
});
