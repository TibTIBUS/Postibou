import {createDatabase} from './stripe-client.mjs';
import {runMailSmokeCheck} from './lib/mail-smoke-check.mjs';
// Temporary one-message validation. No public route, and never runs after
// the explicitly authorized test date. Remove after acceptance is recorded.
export const config={schedule:'*/5 * * * *'};
export default async()=>{
 if(new Date().toISOString().slice(0,10)!=='2026-10-08')return;
 await runMailSmokeCheck(await createDatabase());
};
