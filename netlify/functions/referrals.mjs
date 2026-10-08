import {createDatabase,getVerifiedUser,validPostibouRequest} from './stripe-client.mjs';
import {claimReferral,referralDashboard} from './lib/referrals.mjs';
export const config={path:'/api/referrals',method:['GET','POST']};
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
export function createReferralsHandler({getDatabase=createDatabase,fetchAuth=fetch}={}) {
 return async request=>{
  const reply=(body,status=200)=>Response.json(body,{status,headers});
  if(!['GET','POST'].includes(request.method))return reply({code:'METHOD_NOT_ALLOWED'},405);
  if(request.headers.get('sec-fetch-site')==='cross-site' || (request.method==='POST'&&!validPostibouRequest(request,'POST')))return reply({code:'FORBIDDEN'},403);
  try{
   const user=await getVerifiedUser(request,fetchAuth);if(!user)return reply({code:'UNAUTHORIZED'},401);
   const sql=await getDatabase();
   if(request.method==='POST'){
    if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({code:'INVALID_INPUT'},415);
    const text=await request.text();if(text.length>256)return reply({code:'INVALID_INPUT'},400);
    let body;try{body=JSON.parse(text);}catch{return reply({code:'INVALID_INPUT'},400);}
    if(body.accepted!==true||!/^[A-F0-9]{16}$/.test(body.code||''))return reply({code:'INVALID_INPUT'},400);
    await claimReferral(sql,user.id,body.code);
   }
   return reply(await referralDashboard(sql,user.id));
  }catch(error){const safe=['REFERRAL_ALREADY_ASSIGNED','REFERRAL_NOT_ELIGIBLE'].includes(error.message);return reply({code:safe?error.message:'SERVICE_UNAVAILABLE'},safe?409:503);}
 };
}
export default createReferralsHandler();
