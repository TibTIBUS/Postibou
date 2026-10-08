import test from 'node:test';
import assert from 'node:assert/strict';
import {billingDatabase} from './helpers/billing-database.mjs';
import {runMailSmokeCheck,CHECK_ID} from '../netlify/functions/lib/mail-smoke-check.mjs';
test('the authorized mail check addresses only the seeded recipient, includes both attachments and sends once',async()=>{
 const {db,sql}=await billingDatabase();try{
 let sends=0;const deps={getConfig:()=>({key:'synthetic_only',from:'postibou@notifications.example.test'}),send:async(url,options)=>{sends++;const payload=JSON.parse(options.body);assert.deepEqual(payload.to,['owner@example.test']);assert.equal(payload.attachments.length,2);assert.match(payload.subject,/aucune souscription/);assert.match(Buffer.from(payload.attachments[0].content,'base64').toString(),/Aucun contrat/);return Response.json({id:'provider_test'});}};
 await runMailSmokeCheck(sql,deps);assert.equal(sends,0);
 await db.query('INSERT INTO postibou_operational_mail_checks(check_id,recipient_email) VALUES ($1,$2)',[CHECK_ID,'owner@example.test']);
 await runMailSmokeCheck(sql,deps);await runMailSmokeCheck(sql,deps);assert.equal(sends,1);assert.equal((await db.query('SELECT status FROM postibou_operational_mail_checks')).rows[0].status,'accepted');
 }finally{await db.close();}
});
test('an uncertain mail check is retried with a fixed key/payload and stops before expiry',async()=>{
 const {db,sql}=await billingDatabase();try{
 await db.query('INSERT INTO postibou_operational_mail_checks(check_id,recipient_email) VALUES ($1,$2)',[CHECK_ID,'owner@example.test']);const calls=[];
 const deps={getConfig:()=>({key:'synthetic_only',from:'postibou@notifications.example.test'}),send:async(url,options)=>{calls.push(options);throw Error('response lost');}};
 await assert.rejects(runMailSmokeCheck(sql,deps));await runMailSmokeCheck(sql,deps);assert.equal(calls.length,1);
 await db.exec("UPDATE postibou_operational_mail_checks SET lease_until=now()-interval '1 minute'");await assert.rejects(runMailSmokeCheck(sql,deps));assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
 await db.exec("UPDATE postibou_operational_mail_checks SET first_attempt_at=now()-interval '25 hours',lease_until=now()-interval '1 minute'");await runMailSmokeCheck(sql,deps);assert.equal(calls.length,2);assert.equal((await db.query('SELECT status FROM postibou_operational_mail_checks')).rows[0].status,'review');
 }finally{await db.close();}
});
