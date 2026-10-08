import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export const userId = '11111111-1111-4111-8111-111111111111';
export const origin = 'https://postibou.netlify.app';
export const auth = async () => Response.json({ session: { id: 'test-session' }, user: { id: userId, email: 'artisan@example.fr', emailVerified: true } });
export const request = () => new Request(origin + '/api/billing/checkout', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({acceptedTerms:true,termsVersion:'2026-10-08'})
});

export async function billingDatabase() {
  const db = await PGlite.create();
  await db.exec(`
    CREATE SCHEMA neon_auth;
    CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY, "emailVerified" boolean);
    CREATE TABLE public.postibou_entitlements (
      user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id), plan text DEFAULT 'trial',
      trial_started_at timestamptz DEFAULT now(), trial_ends_at timestamptz DEFAULT now() + interval '7 days',
      adaptations_used integer DEFAULT 0, updated_at timestamptz DEFAULT now()
    );
    INSERT INTO neon_auth."user" VALUES ('${userId}', true);
  `);
  await db.exec(await readFile(new URL('../../db/migrations/2026-10-07-stripe-billing.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../db/migrations/2026-10-08-checkout-attempts.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../db/migrations/2026-10-08-legal-acceptances.sql', import.meta.url), 'utf8'));
  const queries = [];
  let failSave = false;
  const sql = async (strings, ...values) => {
    const query = strings.join('?'); queries.push({query,values});
    if (failSave && query.includes('SET checkout_session_id')) { failSave = false; throw new Error('database response lost'); }
    return (await db.sql(strings, ...values)).rows;
  };
  return { db, sql, queries, failNextSave() { failSave = true; }, async reset() {
    await db.exec('TRUNCATE postibou_withdrawal_requests, postibou_legal_acceptances, postibou_checkout_attempts, postibou_entitlements, postibou_stripe_events;');
    queries.length = 0; failSave = false;
  } };
}
