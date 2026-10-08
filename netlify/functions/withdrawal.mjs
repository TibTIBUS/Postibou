import { randomUUID } from 'node:crypto';
import { createDatabase, getVerifiedUser, validPostibouRequest } from './stripe-client.mjs';
export const config = { path: '/api/billing/withdrawal', method: 'POST' };
const headers = {'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
const reply = (body,status=200)=>Response.json(body,{status,headers});
export function createWithdrawalHandler({fetchAuth=fetch,getDatabase=createDatabase}={}) {
  return async request=>{
    if(!validPostibouRequest(request,'POST')) return reply({code:'FORBIDDEN'},403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return reply({code:'INVALID_INPUT'},415);
    try {
      const user=await getVerifiedUser(request,fetchAuth);
      if(!user) return reply({code:'UNAUTHORIZED'},401);
      const raw=await request.text();
      if(raw.length>2048) return reply({code:'INVALID_INPUT'},400);
      let input;try {input=JSON.parse(raw);}catch{return reply({code:'INVALID_INPUT'},400);}
      if(input?.confirmed!==true) return reply({code:'CONFIRMATION_REQUIRED'},400);
      const sql=await getDatabase();
      const rows=await sql`
        INSERT INTO public.postibou_withdrawal_requests (request_id,user_id,subscription_id,account_email)
        SELECT ${randomUUID()}::uuid, user_id, stripe_subscription_id, ${user.email}
        FROM public.postibou_entitlements WHERE user_id=${user.id}::uuid AND stripe_subscription_id IS NOT NULL
        ON CONFLICT (user_id,subscription_id) DO NOTHING
      `;
      const saved=await sql`
        SELECT w.request_id,w.subscription_id,w.account_email,w.received_at
        FROM public.postibou_withdrawal_requests w
        JOIN public.postibou_entitlements e ON e.user_id=w.user_id AND e.stripe_subscription_id=w.subscription_id
        WHERE w.user_id=${user.id}::uuid
      `;
      if(!saved[0]) return reply({code:'NO_CONTRACT'},409);
      const proof=saved[0];
      const receivedAt=new Date(proof.received_at).toISOString();
      const receipt=[
        'Postibou — Accusé de réception de votre déclaration de rétractation',
        'Destinataire : Thibaut MARIE, EI, Localia ; SIREN 892 882 796',
        '92 rue des quatre rues, 50710 Créances, France',
        'Contact : gestion.localia@gmail.com ; 06 85 22 47 20',
        'Référence : '+proof.request_id,
        'Compte : '+proof.account_email,
        'Contrat : '+proof.subscription_id,
        'Date et heure de réception (UTC) : '+receivedAt,
        'Déclaration reçue : Je vous notifie ma rétractation du contrat portant sur mon abonnement Postibou.',
        'La déclaration est enregistrée. Les suites, notamment le remboursement applicable, sont traitées par Localia.',
        'Cet accusé ne constitue pas une confirmation de remboursement ni une renonciation à vos droits.'
      ].join('\n');
      return reply({requestId:proof.request_id,receivedAt,receipt});
    } catch {return reply({code:'SERVICE_UNAVAILABLE'},503);}
  };
}
export default createWithdrawalHandler();
