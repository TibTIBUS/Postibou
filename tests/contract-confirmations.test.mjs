import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { billingDatabase, userId, auth, origin, request as checkoutRequest } from './helpers/billing-database.mjs';
import { TERMS_VERSION, TERMS_SHA256, TERMS_DOCUMENT } from '../netlify/functions/legal-policy.mjs';
import { ensureContractConfirmation, deliverContractConfirmation, contractEmailPayload } from '../netlify/functions/lib/contract-confirmation.mjs';
import { createConfirmationsHandler } from '../netlify/functions/billing-confirmations.mjs';
import { createStripeWebhookHandler } from '../netlify/functions/stripe-webhook.mjs';
import { createCheckoutHandler } from '../netlify/functions/billing-checkout.mjs';
const attemptId = '22222222-2222-4222-8222-222222222222';
const price = 'price_1UO13LEnc0W23lgnnIpKJi4k';
const session = { id:'cs_test_contract', mode:'subscription', payment_status:'paid', customer:'cus_contract',
  client_reference_id:userId, subscription:'sub_contract', invoice:'in_initial', metadata:{postibou_attempt_id:attemptId}, customer_details:{email:'different-billing@example.test'} };
const subscription = { id:'sub_contract', customer:'cus_contract', status:'active',
  cancel_at_period_end:false,items:{data:[{price:{id:price},current_period_start:1791453600,current_period_end:1794132000}]} };
const originalInvoice = { id:'in_initial',status:'paid',billing_reason:'subscription_create',currency:'eur',amount_paid:790,
  customer:'cus_contract',parent:{subscription_details:{subscription:'sub_contract'}},status_transitions:{paid_at:1791453600},
  lines:{data:[{quantity:1,pricing:{price_details:{price}},period:{start:1791453600,end:1794132000}}]} };
let database;
before(async()=>{ database=await billingDatabase(); });
beforeEach(async()=>{
  await database.reset();
  await database.db.query('UPDATE neon_auth."user" SET email=$1 WHERE id=$2',['artisan@example.fr',userId]);
  await database.db.query('INSERT INTO postibou_entitlements(user_id) VALUES ($1)',[userId]);
  await database.db.query('INSERT INTO postibou_legal_acceptances(attempt_id,user_id,terms_version,terms_sha256,terms_document,price_id) VALUES ($1,$2,$3,$4,$5,$6)',[attemptId,userId,TERMS_VERSION,TERMS_SHA256,TERMS_DOCUMENT,price]);
});
after(async()=>database.db.close());
const stripeFixture = () => ({ invoices:{retrieve:async invoiceId=>{assert.equal(invoiceId,'in_initial');return structuredClone(originalInvoice);}} });
const record = async()=> (await database.db.query('SELECT * FROM postibou_contract_confirmations')).rows[0];
const receipt = ()=>ensureContractConfirmation(database.sql,stripeFixture(),session,subscription);
const config = ()=>({key:'re_synthetic_only',from:'postibou@notifications.example.test'});
const deliver = (row,fetchEmail,sql=database.sql)=>deliverContractConfirmation(sql,row,{getConfig:config,fetchEmail});
const releaseLease = ()=>database.db.query("UPDATE postibou_contract_confirmations SET email_lease_until=now()-interval '1 minute'");

test('confirmation snapshots the original invoice and exact accepted terms, addressed to the verified account',async()=>{
  const row=await receipt();
  assert.equal(row.recipient_email,'artisan@example.fr');
  assert.equal(row.amount_paid,790);assert.equal(row.terms_document,TERMS_DOCUMENT);
  assert.equal(row.confirmation_sha256,createHash('sha256').update(row.confirmation_document).digest('hex'));
  assert.ok(row.confirmation_document.includes('7,90 €'));assert.ok(row.confirmation_document.includes('9,90 €'));
  assert.ok(row.confirmation_document.includes('----- CONDITIONS ACCEPTÉES -----\n\n'+TERMS_DOCUMENT));
  assert.ok(row.confirmation_document.includes('ne remplace pas une facture'));
  const payload=contractEmailPayload(row,config().from);
  assert.deepEqual(payload.to,['artisan@example.fr']);
  assert.equal(Buffer.from(payload.attachments[1].content,'base64').toString(),TERMS_DOCUMENT);
  assert.equal(Buffer.from(payload.attachments[0].content,'base64').toString(),row.confirmation_document);
});

test('concurrent events produce one immutable confirmation; a retry never reads new terms or a new monthly invoice',async()=>{
  const rows=await Promise.all([receipt(),receipt()]);assert.equal(rows[0].receipt_id,rows[1].receipt_id);
  await database.db.query("UPDATE neon_auth.\"user\" SET email='new-account@example.fr' WHERE id=$1",[userId]);
  const next=await ensureContractConfirmation(database.sql,{invoices:{retrieve:()=>{throw new Error('must not reread')}}},session,{...subscription,items:{data:[{price:{id:'new_price'}}]}});
  assert.equal(next.recipient_email,'artisan@example.fr');assert.equal(next.confirmation_document,rows[0].confirmation_document);
  await assert.rejects(database.db.query("UPDATE postibou_contract_confirmations SET confirmation_document='changed'"),/POSTIBOU_CONFIRMATION_IMMUTABLE/);
});

test('missing or mismatched ownership, invoice, currency, date or terms checksum cannot create a confirmation',async()=>{
  const cases=[{...session,customer:'cus_other'},{...session,metadata:{}},{...session,client_reference_id:'33333333-3333-4333-8333-333333333333'}, {...session,payment_status:'unpaid'}];
  for(const candidate of cases)await assert.rejects(ensureContractConfirmation(database.sql,stripeFixture(),candidate,subscription));
  for(const changes of [{status:'open'},{currency:'usd'},{customer:'cus_other'},{parent:{subscription_details:{subscription:'sub_other'}}},{billing_reason:'subscription_cycle'},{status_transitions:{paid_at:null}},{lines:{data:[]}}]){
    await assert.rejects(ensureContractConfirmation(database.sql,{invoices:{retrieve:async()=>({...originalInvoice,...changes})}},session,subscription));
  }
  await database.db.query("UPDATE postibou_legal_acceptances SET terms_sha256=repeat('a',64)");
  await assert.rejects(receipt(),/CONTRACT_PROOF_MISSING/);assert.equal(await record(),undefined);
});

test('the owner can download the exact durable document, without caching; another user receives 404',async()=>{
  const row=await receipt();
  const handler=createConfirmationsHandler({getDatabase:()=>database.sql,fetchAuth:auth});
  const response=await handler(new Request(origin+'/api/billing/confirmations?receipt='+row.receipt_id));
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal(await response.text(),row.confirmation_document);
  const list=await handler(new Request(origin+'/api/billing/confirmations'));const data=await list.json();
  assert.equal(data.confirmations.length,1);assert.equal('recipient_email' in data.confirmations[0],false);
  const otherAuth=async()=>Response.json({session:{id:'s_other'},user:{id:'33333333-3333-4333-8333-333333333333',emailVerified:true,email:'other@example.test'}});
  const other=createConfirmationsHandler({getDatabase:()=>database.sql,fetchAuth:otherAuth});
  assert.equal((await other(new Request(origin+'/api/billing/confirmations?receipt='+row.receipt_id))).status,404);
});

test('anonymous, cross-site, invalid receipt and wrong method cannot expose contract documents',async()=>{
  let dbCalls=0;
  const handler=createConfirmationsHandler({getDatabase:()=>{dbCalls++;throw Error('unexpected')},fetchAuth:async()=>Response.json({user:null})});
  assert.equal((await handler(new Request(origin+'/api/billing/confirmations'))).status,401);
  assert.equal((await handler(new Request(origin+'/api/billing/confirmations',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
  assert.equal((await handler(new Request(origin+'/api/billing/confirmations',{method:'POST'}))).status,405);
  const signed=createConfirmationsHandler({fetchAuth:auth,getDatabase:()=>{dbCalls++;throw Error('unexpected')}});
  assert.equal((await signed(new Request(origin+'/api/billing/confirmations?receipt=invalid'))).status,400);
  assert.equal(dbCalls,0);
});

test('mail configuration is required before creating a payment, even when launch is open',async()=>{
  let billingCalled=false;
  const handler=createCheckoutHandler({paidLaunchReady:true,mailReady:()=>false,fetchAuth:auth,getDatabase:()=>{billingCalled=true;throw Error('unexpected')}});
  const response=await handler(checkoutRequest());assert.equal(response.status,503);
  assert.equal((await response.json()).code,'CONFIRMATION_EMAIL_UNAVAILABLE');assert.equal(billingCalled,false);
});

test('mail send persists one exact payload and idempotency key and never resends a confirmed delivery',async()=>{
  const row=await receipt();let sends=0;
  await deliver(row,async(url,request)=>{sends++;assert.equal(url,'https://api.resend.com/emails');
    assert.equal(request.headers['Idempotency-Key'],'postibou-contract/'+row.receipt_id);
    assert.equal(JSON.parse(request.body).to[0],'artisan@example.fr');return Response.json({id:'email_provider_1'});});
  const sent=await record();assert.equal(sent.email_status,'sent');assert.ok(sent.email_sent_at);
  await deliver(sent,()=>{throw Error('must not resend')});assert.equal(sends,1);
  await assert.rejects(database.db.query("UPDATE postibou_contract_confirmations SET email_payload='{}'::jsonb"),/POSTIBOU_EMAIL_PAYLOAD_IMMUTABLE/);
});

test('a lost provider response retries the same payload within the key window, even across sender changes',async()=>{
  const row=await receipt();const calls=[];
  await assert.rejects(deliver(row,async(url,options)=>{calls.push(options);throw Error('accepted but response lost')}));
  assert.equal((await record()).email_status,'sending');await releaseLease();
  await deliverContractConfirmation(database.sql,await record(),{getConfig:()=>({...config(),from:'new-sender@example.test'}),fetchEmail:async(url,options)=>{calls.push(options);return Response.json({id:'same_email'});}});
  assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);
  assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
});

test('concurrent webhook attempts cannot send simultaneously during the lease',async()=>{
  const row=await receipt();let sends=0,started,release;
  const startedGate=new Promise(r=>started=r);const finish=new Promise(r=>release=r);
  const first=deliver(row,async()=>{sends++;started();await finish;return Response.json({id:'one_mail'})});
  await startedGate;await assert.rejects(deliver(row,async()=>{sends++;return Response.json({id:'second_mail'})}));
  release();await first;assert.equal(sends,1);
});

test('delivery with an unknown outcome stops automatic retries before the provider key expires',async()=>{
  const row=await receipt();await assert.rejects(deliver(row,async()=>{throw Error('timeout')}));
  await database.db.query("UPDATE postibou_contract_confirmations SET email_first_attempt_at=now()-interval '25 hours',email_lease_until=now()-interval '1 minute'");
  let sent=false;await assert.rejects(deliver(await record(),async()=>{sent=true;return Response.json({id:'duplicate'})}));
  assert.equal(sent,false);assert.equal((await record()).email_status,'needs_review');
});

test('a database response lost after saving sent status does not duplicate the mail',async()=>{
  const row=await receipt();let sends=0;
  const sql=async(strings,...values)=>{const result=await database.sql(strings,...values);if(strings.join('?').includes("email_status = 'sent'"))throw Error('DB response lost');return result;};
  await assert.rejects(deliver(row,async()=>{sends++;return Response.json({id:'saved_email'})},sql));
  await deliver(await record(),async()=>{sends++;return Response.json({id:'duplicate'})});assert.equal(sends,1);
});

test('failed confirmation delivery leaves paid quota inactive; retry activates it only after the same mail is accepted',async()=>{
  let available=false,sends=0;
  const stripe={...stripeFixture(),webhooks:{constructEvent:body=>JSON.parse(body.toString())},subscriptions:{retrieve:async()=>subscription},
    subscriptionSchedules:{create:async()=>({id:'sched_contract',current_phase:{start_date:1791453600}}),update:async()=>({})}};
  const confirmer=async(sql,client,checkout,sub)=>{
    const row=await ensureContractConfirmation(sql,client,checkout,sub);
    await deliver(row,async()=>{sends++;if(!available)throw Error('temporary mail failure');return Response.json({id:'accepted_confirmation'})});
  };
  const handler=createStripeWebhookHandler({getDatabase:()=>database.sql,getStripe:()=>stripe,getWebhookSecret:()=> 'test',confirmPurchase:confirmer});
  const req=()=>new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'synthetic'},body:JSON.stringify({id:'evt_contract',type:'checkout.session.completed',data:{object:session}})});
  assert.equal((await handler(req())).status,500);
  assert.equal((await database.db.query('SELECT plan FROM postibou_entitlements')).rows[0].plan,'trial');
  assert.equal((await database.db.query('SELECT status FROM postibou_stripe_events')).rows[0].status,'processing');
  available=true;await releaseLease();assert.equal((await handler(req())).status,200);
  assert.equal((await database.db.query('SELECT plan FROM postibou_entitlements')).rows[0].plan,'monthly');
  const replay=await handler(req());assert.equal((await replay.json()).duplicate,true);assert.equal(sends,2);
});

test('early lifecycle events cannot activate a new subscription through a previously mapped customer',async()=>{
  await database.db.query("UPDATE postibou_entitlements SET stripe_customer_id='cus_contract',stripe_subscription_id='sub_old',stripe_subscription_status='canceled'");
  const stripe={webhooks:{constructEvent:body=>JSON.parse(body.toString())},subscriptions:{retrieve:async()=>{throw Error('must wait for confirmed Checkout')}}};
  const handler=createStripeWebhookHandler({getDatabase:()=>database.sql,getStripe:()=>stripe,getWebhookSecret:()=> 'test'});
  for(const [type,object] of [['customer.subscription.created',subscription],['customer.subscription.updated',subscription],['invoice.paid',originalInvoice]]) {
    const response=await handler(new Request(origin+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'synthetic'},body:JSON.stringify({id:'evt_early_'+type,type,data:{object}})}));
    assert.equal(response.status,200);
    const account=(await database.db.query('SELECT plan,stripe_subscription_id FROM postibou_entitlements')).rows[0];
    assert.equal(account.plan,'trial');assert.equal(account.stripe_subscription_id,'sub_old');
  }
});
