const start=document.querySelector('#start');
const form=document.querySelector('#confirm');
const message=document.querySelector('#message');
const receipt=document.querySelector('#receipt');
let receiptUrl;
start.addEventListener('click',()=>{form.hidden=false;start.hidden=true;form.querySelector('button').focus();});
form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;message.textContent='Enregistrement de votre déclaration…';
  try {
    const response=await fetch('/api/billing/withdrawal',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(!response.ok) throw new Error(({UNAUTHORIZED:'Connectez-vous à votre compte Postibou avant de confirmer.',NO_CONTRACT:'Aucun abonnement n’est rattaché à ce compte. Vous pouvez utiliser le formulaire par e-mail ou courrier.'})[result.code]||'L’enregistrement n’a pas abouti. Réessayez ou envoyez votre déclaration par e-mail.');
    if(receiptUrl) URL.revokeObjectURL(receiptUrl);
    receiptUrl=URL.createObjectURL(new Blob([result.receipt],{type:'text/plain;charset=utf-8'}));receipt.href=receiptUrl;receipt.hidden=false;receipt.click();
    message.textContent='Votre déclaration a été enregistrée le '+new Date(result.receivedAt).toLocaleString('fr-FR')+'. Conservez son accusé de réception. Localia traitera les suites applicables.';
    form.hidden=true;
  }catch(error){message.textContent=error.message;button.disabled=false;}
});
