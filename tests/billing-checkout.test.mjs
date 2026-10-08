import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createStripeWebhookHandler } from '../netlify/functions/stripe-webhook.mjs';
import { createCheckoutHandler } from '../netlify/functions/billing-checkout.mjs';
import { billingDatabase, userId, auth, request } from './helpers/billing-database.mjs';

let database;
before(async () => { database = await billingDatabase(); });
beforeEach(async () => { await database.reset(); });
after(async () => { await database.db.close(); });

function fixture(timestamp = Date.parse('2026-10-08T12:00:00Z')) {
  const sessions = new Map(), keys = new Map(), subscriptions = new Map(), calls = [];
  let clock = timestamp, loseResponse = false, gate, releaseGate;
  const stripe = {
    subscriptions: { retrieve: async id => { const sub = subscriptions.get(id); if (!sub) throw new Error('subscription missing'); return structuredClone(sub); } },
    checkout: { sessions: {
      create: async (params, options) => {
        calls.push({params:structuredClone(params), options});
        if (!keys.has(options.idempotencyKey)) {
          const session = { id: 'cs_' + (sessions.size + 1), mode: params.mode, client_reference_id: params.client_reference_id,
            metadata: params.metadata, customer: params.customer || 'cus_new', created: Math.floor(clock / 1000), expires_at: params.expires_at,
            status: 'open', url: 'https://checkout.stripe.com/c/pay/cs_' + (sessions.size + 1) };
          sessions.set(session.id, session); keys.set(options.idempotencyKey, {params:structuredClone(params),session:structuredClone(session)});
        }
        const cached = keys.get(options.idempotencyKey);
        assert.deepEqual(params,cached.params,'Stripe idempotency requires identical parameters');
        if (gate) { if (calls.length === 2) releaseGate(); await gate; }
        if (loseResponse) { loseResponse = false; throw new Error('Stripe response lost'); }
        return structuredClone(cached.session);
      },
      retrieve: async id => { if (!sessions.has(id)) throw new Error('session missing'); return structuredClone(sessions.get(id)); },
      list: async params => ({ data: [...sessions.values()].filter(s => s.created >= params.created.gte && s.created <= params.created.lte).map(s=>structuredClone(s)), has_more: false })
    } }
  };
  return { stripe, sessions, subscriptions, calls, handler: createCheckoutHandler({paidLaunchReady:true,fetchAuth:auth,getDatabase:()=>database.sql,getStripe:()=>stripe,now:()=>clock}),
    forceConcurrentCreate() { gate = new Promise(resolve => {releaseGate=resolve}); }, advance(ms) {clock+=ms;}, loseNextResponse(){loseResponse=true;}, forgetKeys(){keys.clear();},
    complete(status='active') { const session=[...sessions.values()][0];session.status='complete';session.subscription='sub_new';subscriptions.set('sub_new',{id:'sub_new',status,customer:session.customer}); }
  };
}

async function savedAttempt() { return (await database.db.query('SELECT * FROM postibou_checkout_attempts')).rows[0]; }

test('two concurrent requests create one Stripe session with the exact same persisted parameters', async () => {
  const f=fixture(); f.forceConcurrentCreate(); const responses=await Promise.all([f.handler(request()),f.handler(request())]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.deepEqual(await responses[0].json(),await responses[1].json());
  assert.equal(f.sessions.size,1);assert.equal(f.calls.length,2);
  assert.deepEqual(f.calls[0],f.calls[1]);
  assert.equal((await savedAttempt()).checkout_session_id,'cs_1');
  const p=f.calls[0].params;
  assert.equal(p.line_items[0].price,'price_1UO13LEnc0W23lgnnIpKJi4k');
  assert.equal('subscription_data' in p,false);assert.equal('automatic_tax' in p,false);
  assert.match(p.integration_identifier,/postibou_checkout_[a-z]{8}$/);
});

test('returning from Checkout reuses the open session without creating another', async () => {
  const f=fixture();await f.handler(request()); const response=await f.handler(request());
  assert.equal(response.status,200);assert.equal(f.calls.length,1);assert.equal(f.sessions.size,1);
});

for (const failure of ['Stripe response','Neon save']) test(`retry after lost ${failure} recovers the same session`, async () => {
  const f=fixture(); if(failure==='Stripe response')f.loseNextResponse();else database.failNextSave();
  assert.equal((await f.handler(request())).status,503);
  assert.equal((await f.handler(request())).status,200);
  assert.equal(f.sessions.size,1);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);
});

test('a cached create response cannot hide a completed payment awaiting its webhook', async () => {
  const f=fixture();f.loseNextResponse();await f.handler(request());f.complete();
  const response=await f.handler(request());
  assert.equal(response.status,409);assert.equal((await response.json()).code,'CHECKOUT_PAYMENT_PENDING');assert.equal(f.sessions.size,1);
});

test('completed asynchronous payment blocks new Checkout sessions even after session expiry', async () => {
  const f=fixture();await f.handler(request());f.complete('incomplete');f.advance(2*3600000);
  assert.equal((await f.handler(request())).status,409);assert.equal(f.sessions.size,1);assert.equal(f.calls.length,1);
});

test('a completed orphan is recovered after 24 hours without relying on Stripe idempotency cache', async () => {
  const f=fixture();f.loseNextResponse();await f.handler(request());f.complete();f.advance(27*3600000);f.forgetKeys();
  assert.equal((await f.handler(request())).status,409);assert.equal(f.calls.length,1);assert.equal(f.sessions.size,1);
  assert.equal((await savedAttempt()).checkout_session_id,'cs_1');
});

test('two requests rotating an expired session still create only one new open session', async () => {
  const f=fixture();await f.handler(request()); const old=await savedAttempt();
  f.sessions.get('cs_1').status='expired';f.advance(2*3600000);
  const responses=await Promise.all([f.handler(request()),f.handler(request())]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(f.sessions.size,2);
  assert.notEqual((await savedAttempt()).attempt_id,old.attempt_id);
  assert.equal([...f.sessions.values()].filter(s=>s.status==='open').length,1);
});

test('an expired orphan is reconciled before a replacement is created', async () => {
  const f=fixture();f.loseNextResponse();await f.handler(request());f.sessions.get('cs_1').status='expired';f.advance(2*3600000);f.forgetKeys();
  assert.equal((await f.handler(request())).status,200);assert.equal(f.sessions.size,2);
  assert.equal([...f.sessions.values()].filter(s=>s.status==='open').length,1);
});

test('failed reconciliation leaves the existing attempt intact and creates no new payment', async () => {
  const f=fixture();f.loseNextResponse();await f.handler(request());f.advance(27*3600000);f.forgetKeys();
  const old=await savedAttempt();f.stripe.checkout.sessions.list=async()=>{throw new Error('Stripe unavailable')};
  assert.equal((await f.handler(request())).status,503);assert.equal(f.calls.length,1);
  assert.equal((await savedAttempt()).attempt_id,old.attempt_id);
});

test('session ownership is checked before returning a payment URL', async () => {
  const f=fixture();await f.handler(request());f.sessions.get('cs_1').client_reference_id='somebody-else';
  assert.equal((await f.handler(request())).status,503);assert.equal(f.sessions.size,1);
});

test('an existing subscription is blocked even when the local paid period is stale', async () => {
  await database.db.query("INSERT INTO postibou_entitlements(user_id,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,subscription_period_end) VALUES ($1,'cus_old','sub_old','active','2020-01-01')",[userId]);
  const f=fixture();assert.equal((await f.handler(request())).status,409);assert.equal(f.calls.length,0);
});

test('a stale canceled local status cannot permit a new session while Stripe still has an active subscription', async () => {
  await database.db.query("INSERT INTO postibou_entitlements(user_id,stripe_customer_id,stripe_subscription_id,stripe_subscription_status) VALUES ($1,'cus_old','sub_old','canceled')",[userId]);
  const f=fixture();f.subscriptions.set('sub_old',{id:'sub_old',customer:'cus_old',status:'active'});
  assert.equal((await f.handler(request())).status,409);assert.equal(f.calls.length,0);
});

test('a terminated subscription can subscribe again at the standard 2027 price', async () => {
  await database.db.query("INSERT INTO postibou_entitlements(user_id,stripe_customer_id,stripe_subscription_id,stripe_subscription_status) VALUES ($1,'cus_old','sub_old','canceled')",[userId]);
  const f=fixture(Date.parse('2027-01-01T12:00:00Z'));f.subscriptions.set('sub_old',{id:'sub_old',customer:'cus_old',status:'canceled'});
  assert.equal((await f.handler(request())).status,200);
  assert.equal(f.calls[0].params.line_items[0].price,'price_1UO13LEnc0W23lgnTxtNXNW6');assert.equal(f.calls[0].params.customer,'cus_old');
});

test('an open attempt keeps its exact parameters over the 2027 tariff boundary', async () => {
  const f=fixture(Date.parse('2026-12-31T22:59:50Z'));f.loseNextResponse();await f.handler(request());f.advance(20000);
  assert.equal((await f.handler(request())).status,200);assert.deepEqual(f.calls[0],f.calls[1]);
  f.sessions.get('cs_1').status='expired';f.advance(2*3600000);
  assert.equal((await f.handler(request())).status,200);assert.equal(f.calls.at(-1).params.line_items[0].price,'price_1UO13LEnc0W23lgnTxtNXNW6');
});


function webhookRequest(eventId, subId) {
  return new Request('https://postibou.netlify.app/api/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':'fake'},body:JSON.stringify({
    id:eventId,type:'checkout.session.completed',data:{object:{mode:'subscription',payment_status:'paid',client_reference_id:userId,subscription:subId}}
  })});
}
function webhookStripe(subscriptions) {
  return {webhooks:{constructEvent:body=>JSON.parse(body.toString())},subscriptions:{retrieve:async id=>subscriptions[id]}};
}
const subscription = (id,status='active') => ({id,customer:'cus_same',status,items:{data:[{price:{id:'price_1UO13LEnc0W23lgnTxtNXNW6'},current_period_start:1791453600,current_period_end:1794132000}]}});

test('concurrent paid webhooks cannot replace each other even when both initially see no subscription', async () => {
  await database.db.query('INSERT INTO postibou_entitlements(user_id) VALUES ($1)',[userId]);
  let release,reads=0;const gate=new Promise(resolve=>{release=resolve});
  const sql=async(strings,...values)=>{
    const rows=await database.sql(strings,...values);
    if(strings.join('?').includes('SELECT user_id, stripe_subscription_id')){if(++reads===2)release();await gate;}
    return rows;
  };
  const stripe=webhookStripe({sub_a:subscription('sub_a'),sub_b:subscription('sub_b')});
  const handler=createStripeWebhookHandler({getDatabase:()=>sql,getStripe:()=>stripe,getWebhookSecret:()=> 'fake'});
  const results=await Promise.all([handler(webhookRequest('evt_a','sub_a')),handler(webhookRequest('evt_b','sub_b'))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,500]);
  const row=(await database.db.query('SELECT stripe_subscription_id FROM postibou_entitlements')).rows[0];
  assert.ok(['sub_a','sub_b'].includes(row.stripe_subscription_id));
  const conflict=row.stripe_subscription_id==='sub_a'?'sub_b':'sub_a';
  assert.equal((await handler(webhookRequest('evt_retry_conflict',conflict))).status,500);
  assert.equal((await database.db.query('SELECT stripe_subscription_id FROM postibou_entitlements')).rows[0].stripe_subscription_id,row.stripe_subscription_id);
});

test('paid checkout can replace a confirmed terminal subscription, while its old events cannot overwrite the new one', async () => {
  await database.db.query("INSERT INTO postibou_entitlements(user_id,stripe_customer_id,stripe_subscription_id,stripe_subscription_status) VALUES ($1,'cus_same','sub_old','canceled')",[userId]);
  const stripe=webhookStripe({sub_old:subscription('sub_old','canceled'),sub_new:subscription('sub_new')});
  const handler=createStripeWebhookHandler({getDatabase:()=>database.sql,getStripe:()=>stripe,getWebhookSecret:()=> 'fake'});
  assert.equal((await handler(webhookRequest('evt_new','sub_new'))).status,200);
  assert.equal((await handler(webhookRequest('evt_old','sub_old'))).status,500);
  assert.equal((await database.db.query('SELECT stripe_subscription_id FROM postibou_entitlements')).rows[0].stripe_subscription_id,'sub_new');
});

test('production default keeps paid checkout closed without touching billing data or Stripe', async () => {
  let databaseCalled = false, stripeCalled = false;
  const handler = createCheckoutHandler({fetchAuth:auth,getDatabase:()=>{databaseCalled=true;throw new Error('unexpected')},getStripe:()=>{stripeCalled=true;throw new Error('unexpected')}});
  const response = await handler(request());
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,'PAID_LAUNCH_PENDING');
  assert.equal(databaseCalled,false);assert.equal(stripeCalled,false);
});

test('missing, stale or malformed terms acceptance cannot create a payment', async () => {
  const f = fixture();
  for (const body of ['{}','null','{',JSON.stringify({acceptedTerms:false,termsVersion:'2026-10-08'}),JSON.stringify({acceptedTerms:true,termsVersion:'old'})]) {
    const req = new Request('https://postibou.netlify.app/api/billing/checkout',{method:'POST',headers:{Origin:'https://postibou.netlify.app','Content-Type':'application/json'},body});
    assert.equal((await f.handler(req)).status,400);
  }
  assert.equal(f.calls.length,0);assert.equal(database.queries.length,0);
});

test('exact terms and price proof is saved once before Stripe and survives retries', async () => {
  const {TERMS_SHA256,TERMS_DOCUMENT} = await import('../netlify/functions/legal-policy.mjs');
  const f=fixture();
  const create=f.stripe.checkout.sessions.create;
  f.stripe.checkout.sessions.create=async (...args)=>{
    const rows=(await database.db.query('SELECT * FROM postibou_legal_acceptances')).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].user_id,userId);
    assert.equal(rows[0].terms_version,'2026-10-08');assert.equal(rows[0].terms_sha256,TERMS_SHA256);
    assert.equal(rows[0].terms_document,TERMS_DOCUMENT);
    assert.equal(rows[0].price_id,args[0].line_items[0].price);
    return create(...args);
  };
  f.loseNextResponse();assert.equal((await f.handler(request())).status,503);
  const first=(await database.db.query('SELECT accepted_at FROM postibou_legal_acceptances')).rows[0];
  assert.equal((await f.handler(request())).status,200);
  const rows=(await database.db.query('SELECT accepted_at FROM postibou_legal_acceptances')).rows;
  assert.equal(rows.length,1);assert.deepEqual(rows[0],first);
});

test('failure to save terms proof prevents Stripe session creation', async () => {
  const f=fixture();
  const sql=async (strings,...values)=>{
    if(strings.join('?').includes('INSERT INTO public.postibou_legal_acceptances')) throw new Error('database unavailable');
    return database.sql(strings,...values);
  };
  const handler=createCheckoutHandler({paidLaunchReady:true,fetchAuth:auth,getDatabase:()=>sql,getStripe:()=>f.stripe});
  assert.equal((await handler(request())).status,503);assert.equal(f.calls.length,0);
});
