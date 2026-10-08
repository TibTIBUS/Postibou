import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {createWithdrawalHandler} from '../netlify/functions/withdrawal.mjs';
import {billingDatabase,auth,userId,origin} from './helpers/billing-database.mjs';
let database;
before(async()=>{database=await billingDatabase();});
beforeEach(async()=>database.reset());after(async()=>database.db.close());
const req=(body={confirmed:true},source=origin)=>new Request(origin+'/api/billing/withdrawal',{method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify(body)});
const handler=()=>createWithdrawalHandler({fetchAuth:auth,getDatabase:()=>database.sql});
test('cannot record another origin, anonymous request or missing confirmation',async()=>{
  assert.equal((await handler()(req({},'https://other.example'))).status,403);
  assert.equal((await handler()(req({}))).status,400);
  assert.equal((await createWithdrawalHandler({fetchAuth:async()=>Response.json({})})(req())).status,401);
  assert.equal(database.queries.length,0);
});
test('a free trial is not a paid contract',async()=>{
  assert.equal((await handler()(req())).status,409);
  assert.equal((await database.db.query('SELECT count(*) FROM postibou_withdrawal_requests')).rows[0].count,0);
});
test('records own contract and returns the same dated durable receipt when retried',async()=>{
  await database.db.query("INSERT INTO postibou_entitlements(user_id,stripe_subscription_id) VALUES ($1,'sub_owner')",[userId]);
  const h=handler();const first=await h(req());assert.equal(first.status,200);
  const result=await first.json();assert.match(result.receipt,/sub_owner/);assert.match(result.receipt,/artisan@example.fr/);
  assert.match(result.receipt,/Je vous notifie ma rétractation/);assert.match(result.receipt,/Date et heure de réception/);
  const retry=await (await h(req())).json();assert.deepEqual(retry,result);
  assert.equal((await database.db.query('SELECT count(*) FROM postibou_withdrawal_requests')).rows[0].count,1);
});
