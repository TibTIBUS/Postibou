import {confirmationMailConfig} from './contract-confirmation.mjs';
import {TERMS_DOCUMENT} from '../legal-policy.mjs';
export const CHECK_ID='postibou-confirmation-test-2026-10-08';
export async function runMailSmokeCheck(sql,{getConfig=confirmationMailConfig,send=fetch}={}) {
 const [row]=await sql`SELECT * FROM public.postibou_operational_mail_checks WHERE check_id=${CHECK_ID}`;
 if(!row||row.status==='accepted'||row.status==='review')return;
 const config=getConfig();if(!config)throw Error('MAIL_CHECK_NOT_CONFIGURED');
 const summary='TEST POSTIBOU — aucune souscription\n\nCeci est un essai technique demandé par l’éditeur. Aucun contrat, abonnement ou paiement n’a été créé. Les deux pièces jointes vérifient le transport du récapitulatif et des conditions. Aucun montant n’est dû.\n\nCe message vérifie uniquement l’envoi ; il ne valide pas un parcours de paiement.\n';
 const payload=row.payload||{from:'Postibou <'+config.from+'>',to:[row.recipient_email],reply_to:'gestion.localia@gmail.com',subject:'TEST POSTIBOU — aucune souscription',text:summary,attachments:[{filename:'postibou-test-confirmation.txt',content:Buffer.from(summary).toString('base64')},{filename:'postibou-test-conditions.txt',content:Buffer.from('TEST — document joint à titre technique, aucune acceptation ni souscription.\n\n'+TERMS_DOCUMENT).toString('base64')}]};
 const [claimed]=await sql`UPDATE public.postibou_operational_mail_checks SET status='sending',payload=COALESCE(payload,${JSON.stringify(payload)}::jsonb),first_attempt_at=COALESCE(first_attempt_at,now()),lease_until=now()+interval '2 minutes' WHERE check_id=${CHECK_ID} AND status IN ('pending','sending') AND (lease_until IS NULL OR lease_until<now()) AND (first_attempt_at IS NULL OR first_attempt_at>now()-interval '23 hours') RETURNING *`;
 if(!claimed){await sql`UPDATE public.postibou_operational_mail_checks SET status='review' WHERE check_id=${CHECK_ID} AND status IN ('pending','sending') AND first_attempt_at<=now()-interval '23 hours'`;return;}
 const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json','Idempotency-Key':CHECK_ID},body:JSON.stringify(claimed.payload),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('MAIL_CHECK_NOT_ACCEPTED');const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error('MAIL_CHECK_NOT_ACCEPTED');
 await sql`UPDATE public.postibou_operational_mail_checks SET status='accepted',provider_id=${result.id},accepted_at=now(),lease_until=NULL WHERE check_id=${CHECK_ID}`;
}
