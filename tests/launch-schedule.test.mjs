import test from 'node:test';
import assert from 'node:assert/strict';
import { monthsUntilLaunchPriceEnds, fulfillPaidCheckout } from '../netlify/functions/stripe-webhook.mjs';

const at = iso => Date.parse(iso) / 1000;
const launch = 'price_1UO13LEnc0W23lgnnIpKJi4k';
const standard = 'price_1UO13LEnc0W23lgnTxtNXNW6';

test('months at 7,90 € counted from the phase start until the first 2027 renewal (Paris)', () => {
  assert.equal(monthsUntilLaunchPriceEnds(at('2026-10-08T17:59:12Z')), 3); // 8 janv. 2027
  assert.equal(monthsUntilLaunchPriceEnds(at('2026-11-30T10:00:00Z')), 2); // 30 janv. 2027
  assert.equal(monthsUntilLaunchPriceEnds(at('2026-12-15T10:00:00Z')), 1); // 15 janv. 2027
  // 1er nov. 00h30 Paris : l'échéance du 1er janv. 00h30 Paris est déjà en 2027.
  assert.equal(monthsUntilLaunchPriceEnds(at('2026-10-31T23:30:00Z')), 2);
  // 31 déc. 23h30 Paris : l'échéance du 31 janv. est la première en 2027.
  assert.equal(monthsUntilLaunchPriceEnds(at('2026-12-31T22:30:00Z')), 1);
  assert.equal(monthsUntilLaunchPriceEnds(at('2027-02-01T10:00:00Z')), 1);
});

function replayFixture(schedulePhases) {
  const calls = [];
  const subscription = { id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, schedule: 'sched_1',
    items: { data: [{ price: { id: launch }, current_period_start: at('2026-11-08T17:59:12Z'), current_period_end: at('2026-12-08T17:59:12Z') }] } };
  const stripe = {
    subscriptions: { retrieve: async () => subscription },
    subscriptionSchedules: {
      retrieve: async () => ({ id: 'sched_1', current_phase: { start_date: at('2026-10-08T17:59:12Z') }, phases: schedulePhases }),
      update: async (...args) => { calls.push(args); return {}; }
    }
  };
  return { calls, stripe };
}

test('replaying activation after a renewal never shortens the 7,90 € phase', async () => {
  const { calls, stripe } = replayFixture([{ items: [{ price: launch }] }, { items: [{ price: standard }] }]);
  const sql = async () => [{ user_id: 'u' }];
  const object = { mode: 'subscription', payment_status: 'paid', client_reference_id: '00000000-0000-0000-0000-000000000001', subscription: 'sub_1', customer: 'cus_1' };
  try { await fulfillPaidCheckout(sql, stripe, object, { confirmPurchase: async () => {}, referralPurchase: async () => {} }); } catch {}
  assert.equal(calls.length, 0);
});

test('an unscheduled subscription replayed after a renewal gets the phase counted from its start', async () => {
  const { calls, stripe } = replayFixture([{ items: [{ price: launch }] }]);
  const sql = async () => [{ user_id: 'u' }];
  const object = { mode: 'subscription', payment_status: 'paid', client_reference_id: '00000000-0000-0000-0000-000000000001', subscription: 'sub_1', customer: 'cus_1' };
  try { await fulfillPaidCheckout(sql, stripe, object, { confirmPurchase: async () => {}, referralPurchase: async () => {} }); } catch {}
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1].phases[0].duration, { interval: 'month', interval_count: 3 });
  assert.equal(calls[0][1].phases[0].start_date, at('2026-10-08T17:59:12Z'));
});
