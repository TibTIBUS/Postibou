import {createDatabase,createStripeClient} from './stripe-client.mjs';
import {qualifyReferrals} from './lib/referrals.mjs';
// 05:15 UTC: 07:15 Paris in summer, 06:15 in winter. No public URL.
export const config={schedule:'15 5 * * *'};
export default async()=>{
 const sql=await createDatabase();
 const [pending]=await sql`SELECT count(*)::int AS n FROM public.postibou_referrals WHERE status IN ('pending','qualified') AND eligible_at<=now()`;
 if(!pending.n)return;
 await qualifyReferrals(sql,await createStripeClient(),{limit:10});
};
