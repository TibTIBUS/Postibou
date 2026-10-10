import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseStaleReservations } from '../netlify/functions/lib/stale-reservations.mjs';
import { createUsageHandler } from '../netlify/functions/usage.mjs';
import { billingDatabase, userId } from './helpers/billing-database.mjs';

const database = await billingDatabase();
const usedOf = async () => (await database.db.query('SELECT adaptations_used FROM postibou_entitlements')).rows[0].adaptations_used;
const statuses = async () => (await database.db.query('SELECT status FROM postibou_adaptation_reservations ORDER BY created_at')).rows.map(row => row.status);
const reserve = (age, status = 'reserved') => database.db.query(
  `INSERT INTO postibou_adaptation_reservations(id,user_id,status,created_at) VALUES (gen_random_uuid(),$1,$2,now()-$3::interval)`, [userId, status, age]);
const auth = async () => Response.json({ session: { id: 's' }, user: { id: userId, emailVerified: true } });

test('a reservation cut off mid-generation gives the credit back; recent and finished ones are untouched', async () => {
  await database.reset();
  await database.db.query('DELETE FROM postibou_adaptation_reservations');
  await database.db.query(`INSERT INTO postibou_entitlements(user_id,adaptations_used) VALUES ($1,5)`, [userId]);
  await reserve('2 hours');
  await reserve('20 minutes', 'completed');
  await reserve('1 minute');
  await releaseStaleReservations(database.sql, userId);
  assert.equal(await usedOf(), 4);
  assert.deepEqual(await statuses(), ['refunded', 'completed', 'reserved']);
  await releaseStaleReservations(database.sql, userId);
  assert.equal(await usedOf(), 4, 'running twice never refunds twice');
});

test('a stale reservation from a previous paid period does not add a credit to the new period', async () => {
  await database.reset();
  await database.db.query('DELETE FROM postibou_adaptation_reservations');
  await database.db.query(`INSERT INTO postibou_entitlements(user_id,plan,stripe_subscription_status,subscription_period_start,subscription_period_end,usage_period_start,adaptations_used)
    VALUES ($1,'monthly','active',now()-interval '1 hour',now()+interval '30 days',now()-interval '1 hour',3)`, [userId]);
  await reserve('2 hours');
  await releaseStaleReservations(database.sql, userId);
  assert.equal(await usedOf(), 3);
  assert.deepEqual(await statuses(), ['refunded']);
});

test('opening the account returns the lost credit', async () => {
  await database.reset();
  await database.db.query('DELETE FROM postibou_adaptation_reservations');
  await database.db.query(`INSERT INTO postibou_entitlements(user_id,adaptations_used) VALUES ($1,10)`, [userId]);
  await reserve('1 hour');
  const usage = createUsageHandler({ fetchAuth: auth, getDatabase: () => database.sql });
  const body = await (await usage(new Request('https://postibou.com/api/usage', { headers: { Origin: 'https://postibou.com', Cookie: '__Secure-neon-auth.session_token=x' } }))).json();
  assert.equal(body.creditsRemaining, 1);
});

test('a cleanup failure never blocks the account', async () => {
  const { releaseStaleReservationsSafely } = await import('../netlify/functions/lib/stale-reservations.mjs');
  await releaseStaleReservationsSafely(async () => { throw new Error('column missing'); }, userId);
});
