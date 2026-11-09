import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

for (const mode of ['login','verify','login-error','verify-no-session','reset','account']) {
 test('auth landing: '+mode,async()=>{
  const nodes=new Map();
  const el=()=>({style:{},dataset:{},value:'',hidden:false,disabled:false,textContent:'',handlers:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(type,fn){this.handlers[type]=fn;},replaceChildren(){},append(){}});
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,el());return nodes.get(selector);};
  let signed=mode==='account';const routes=[];
  const state={route:mode==='account'?'compte':'connexion',user:null};
  const context=vm.createContext({$, $$:s=>[$(s)],state,Response,AbortSignal,URL,URLSearchParams,Intl,Date,JSON,Error,Number,String,Boolean,
   location:{search:'',hash:mode==='account'?'#compte':'#connexion',href:'https://postibou.com/#connexion'},history:{replaceState(){}},sessionStorage:{getItem:()=>null,removeItem(){},setItem(){}},window:{addEventListener(){}},document:{addEventListener(){},createElement:el},navigator:{},notify(){},updateQuota(){},navigate(route){routes.push(route);state.route=route;},
   fetch:async url=>{
    if(url==='/api/auth/session')return Response.json({user:signed?{email:'fixture@example.test'}:null});
    if(url==='/api/auth/login'){if(mode==='login-error')return Response.json({code:'INVALID_EMAIL_OR_PASSWORD'},{status:401});signed=true;return Response.json({});}
    if(url==='/api/auth/verify'){signed=mode!=='verify-no-session';return Response.json({});}
    if(url==='/api/auth/reset')return Response.json({});
    if(url==='/api/usage')return Response.json({plan:'gift',quota:30,creditsRemaining:30});
    if(url==='/api/referrals')return Response.json({});
    if(url==='/api/billing/confirmations')return Response.json({confirmations:[]});
    throw Error('Unexpected request '+url);
   }
  });
  vm.runInContext(await readFile(new URL('../auth.js',import.meta.url),'utf8'),context);
  for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('.nav-actions .login-link').href,signed?'#compte':'#connexion');
  if(mode==='account'){assert.equal(state.route,'compte');return;}
  context.mode=mode.startsWith('verify')?'verify':mode==='reset'?'reset':'login';
  vm.runInContext('configureAuthForm(mode)',context);$('#email').value='fixture@example.test';$('#password').value='local-fixture-only';$('#otp').value='123456';
  $('#auth-form').handlers.submit({preventDefault(){}});
  for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));
  if(['login','verify'].includes(mode)){
   assert.equal(context.location.hash,'#outil');assert.equal(state.route,'outil');assert.equal($('.nav-actions .button').textContent,'Préparer un texte');assert.equal($('.nav-actions .login-link').href,'#compte');
  }else{
   assert.equal(state.route,'connexion');assert.ok(!routes.includes('outil'));assert.ok($('#auth-message').textContent);
  }
 });
}
