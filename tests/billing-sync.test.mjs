import test from 'node:test';
import assert from 'node:assert/strict';
import {createBillingSyncHandler} from '../netlify/functions/billing-sync.mjs';
const origin='https://postibou.com';
const req=()=>new Request(origin+'/api/billing/sync',{method:'POST',headers:{Origin:origin},body:JSON.stringify({session:'foreign',user:'foreign',paid:true})});
function fixture(changes={}) {
  let fulfilled=0,retrieved=[];
  const session={id:'cs_own',client_reference_id:'own',metadata:{postibou_attempt_id:'attempt'},livemode:true,mode:'subscription',status:'complete',payment_status:'paid',...changes};
  const handler=createBillingSyncHandler({getUser:async()=>({id:'own'}),getDatabase:async()=>async()=>[{checkout_session_id:'cs_own',attempt_id:'attempt'}],getStripe:async()=>({checkout:{sessions:{retrieve:async id=>{retrieved.push(id);return session;}}}}),fulfill:async()=>{fulfilled++;}});
  return {handler,get fulfilled(){return fulfilled;},retrieved};
}
test('recovery ignores browser claims and fulfills only stored own payment verified by Stripe',async()=>{
  const f=fixture();const response=await f.handler(req());assert.equal(response.status,200);assert.deepEqual(await response.json(),{synced:true});assert.deepEqual(f.retrieved,['cs_own']);assert.equal(f.fulfilled,1);
});
test('unpaid, foreign, test-mode and metadata mismatches never grant service',async()=>{
  for(const changes of [{payment_status:'unpaid'},{client_reference_id:'other'},{livemode:false},{metadata:{postibou_attempt_id:'other'}}]){
    const f=fixture(changes);await f.handler(req());assert.equal(f.fulfilled,0);
  }
});
test('anonymous or cross-origin calls never reach billing and all reads are private',async()=>{
  let called=false;const h=createBillingSyncHandler({getUser:async()=>null,getDatabase:async()=>{called=true;}});
  assert.equal((await h(req())).status,401);assert.equal(called,false);
  assert.equal((await h(new Request(origin+'/api/billing/sync',{method:'POST',headers:{Origin:'https://evil.example'}}))).status,403);
  assert.equal((await h(new Request(origin+'/api/billing/sync'))).status,405);
});
