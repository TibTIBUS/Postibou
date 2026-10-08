import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { billingDatabase, userId, origin } from './helpers/billing-database.mjs';
import { createAdminHandler, accountSummary } from '../netlify/functions/admin.mjs';
let database;
const other = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-10-08T18:00:00Z');
const request = path => new Request(origin + '/api/admin/' + path);
before(async () => {
  database = await billingDatabase();
  await database.db.exec(await readFile(new URL('../db/migrations/2026-10-08-admin.sql',import.meta.url),'utf8'));
  await database.db.query('INSERT INTO postibou_admins(user_id) VALUES ($1)',[userId]);
  await database.db.query('INSERT INTO neon_auth."user"(id,email,"emailVerified","createdAt") VALUES ($1,$2,true,$3)',[other,'autre@example.fr','2026-10-08T10:00:00Z']);
  await database.db.query('INSERT INTO postibou_entitlements(user_id,trial_started_at,trial_ends_at,adaptations_used) VALUES ($1,$2,$3,8)',[other,'2026-10-07T00:00:00Z','2026-10-14T00:00:00Z']);
});
after(async()=>{await database.db.close();});
const handler = id => createAdminHandler({getUser:async()=>id ? {id,email:'marie.thibaut2105@gmail.com'} : null,getDatabase:()=>database.sql,now:()=>now});
test('anonymous and non-admin users cannot read accounts, even with owner email or forged query id',async()=>{
  const before = database.queries.length;
  assert.equal((await handler(null)(request('users'))).status,401);
  assert.equal(database.queries.length,before);
  const res=await handler(other)(request('users?user_id='+userId));
  assert.equal(res.status,403);assert.equal((await res.json()).code,'FORBIDDEN');
  assert.ok(!database.queries.slice(before).some(q=>q.query.includes('FROM neon_auth')));
  assert.deepEqual(await (await handler(other)(request('access'))).json(),{admin:false});
});
test('admin reads real accounts, filter and literal email search without changing quotas',async()=>{
  assert.deepEqual(await (await handler(userId)(request('access'))).json(),{admin:true});
  const res=await handler(userId)(request('users?filter=trial&search=AUTRE'));
  assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store, private');
  const body=await res.json();assert.equal(body.total,1);assert.equal(body.users[0].email,'autre@example.fr');
  assert.equal(body.users[0].used,8);assert.equal(body.users[0].remaining,2);assert.equal(body.summary.accounts,2);
  assert.ok(!JSON.stringify(body).includes('user_id'));assert.ok(!JSON.stringify(body).includes('stripe_customer_id'));
  assert.equal((await database.db.query('SELECT adaptations_used FROM postibou_entitlements WHERE user_id=$1',[other])).rows[0].adaptations_used,8);
  const empty=await (await handler(userId)(request('users?search=%25'))).json();assert.equal(empty.total,0);
  const page=await (await handler(userId)(request('users?page=2'))).json();assert.equal(page.total,2);assert.equal(page.users.length,0);
});
test('cross-origin, wrong methods and invalid filters never return account data',async()=>{
  assert.equal((await handler(userId)(new Request(origin+'/api/admin/users',{headers:{Origin:'https://evil.example'}}))).status,403);
  assert.equal((await handler(userId)(new Request(origin+'/api/admin/users',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
  assert.equal((await handler(userId)(new Request(origin+'/api/admin/users',{method:'POST'}))).status,405);
  assert.equal((await handler(userId)(request('users?filter=bogus'))).status,400);
  assert.equal((await handler(userId)(request('users?page=-1'))).status,400);
});
test('monthly quota rollover, cancellation and exhausted trials match account access',()=>{
  const monthly={email:'x@example.fr',emailVerified:true,plan:'monthly',adaptations_used:29,stripe_subscription_status:'past_due',subscription_period_start:'2026-10-08',usage_period_start:'2026-09-08',subscription_period_end:'2026-11-08',cancel_at_period_end:true};
  const summary=accountSummary(monthly,now);assert.equal(summary.used,0);assert.equal(summary.remaining,30);assert.equal(summary.status,'active');assert.equal(summary.cancelAtPeriodEnd,true);
  const expired=accountSummary({...monthly,subscription_period_end:'2026-10-01'},now);assert.equal(expired.remaining,0);assert.equal(expired.status,'inactive');
  const trial=accountSummary({emailVerified:true,plan:'trial',trial_ends_at:'2026-10-10',adaptations_used:10},now);assert.equal(trial.status,'trial_exhausted');assert.equal(trial.remaining,0);
});
