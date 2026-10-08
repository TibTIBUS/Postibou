let authBusy = false;
let codeCooldown = 0;
let sessionCheck = null;
function authMessage(message) {
  $('#auth-message').textContent = message;
  $('#auth-message').style.display = message ? 'block' : 'none';
}
function configureAuthForm(mode) {
  if (authBusy) return;
  state.authMode = ['signup', 'login', 'verify', 'recovery', 'reset'].includes(mode) ? mode : 'login';
  const current = state.authMode;
  const copy = {
    signup: ['Bienvenue chez Postibou.', 'Créez votre compte et démarrez votre essai gratuit.', 'Créer mon compte'],
    login: ['Content de vous retrouver.', 'Connectez-vous à votre espace personnel.', 'Se connecter'],
    verify: ['Vérifiez votre e-mail.', 'Saisissez le code à 6 chiffres reçu par e-mail. Pensez à regarder vos indésirables.', 'Vérifier mon adresse'],
    recovery: ['Mot de passe oublié ?', 'Nous vous enverrons un code pour choisir un nouveau mot de passe.', 'Recevoir un code'],
    reset: ['Un nouveau départ.', 'Saisissez le code reçu et choisissez votre nouveau mot de passe.', 'Changer mon mot de passe']
  }[current];
  $('#auth-title').textContent = copy[0];
  $('#auth-description').textContent = copy[1];
  $('#auth-submit').textContent = copy[2];
  const password = ['signup', 'login', 'reset'].includes(current);
  const otp = ['verify', 'reset'].includes(current);
  $('#password-field').hidden = !password;
  $('#password').required = password;
  $('#password').disabled = !password;
  $('#password').autocomplete = current === 'login' ? 'current-password' : 'new-password';
  $('#password-label').textContent = current === 'reset' ? 'Nouveau mot de passe' : 'Votre mot de passe';
  $('#password').value = '';
  $('#otp-field').hidden = !otp;
  $('#otp').required = otp;
  $('#otp').disabled = !otp;
  $('#otp').value = '';
  $('#email').readOnly = otp;
  $('#forgot-password').hidden = current !== 'login';
  $('#resend-code').hidden = !otp;
  $('#auth-back').hidden = ['signup', 'login'].includes(current);
  $('.auth-tabs').hidden = !['signup', 'login'].includes(current);
  $('#google-button').hidden = !['signup', 'login'].includes(current);
  $$('[data-auth-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.authTab === current)));
  authMessage('');
}
const errors = {
  INVALID_INPUT: 'Vérifiez l’adresse, le code et votre mot de passe (8 à 128 caractères).',
  INVALID_EMAIL: 'Vérifiez votre adresse e-mail.',
  INVALID_EMAIL_OR_PASSWORD: 'L’e-mail ou le mot de passe est incorrect.',
  USER_ALREADY_EXISTS: 'Ce compte existe déjà. Connectez-vous ou utilisez « Mot de passe oublié ».',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ce compte existe déjà. Connectez-vous ou utilisez « Mot de passe oublié ».',
  EMAIL_NOT_VERIFIED: 'Vérifiez votre adresse avec un code reçu par e-mail.',
  INVALID_OTP: 'Ce code est incorrect. Vérifiez le dernier code reçu.',
  OTP_EXPIRED: 'Ce code a expiré. Demandez un nouveau code.',
  TOO_MANY_ATTEMPTS: 'Trop de tentatives. Attendez avant de demander un nouveau code.',
  TOO_MANY_REQUESTS: 'Trop de demandes. Réessayez dans quelques minutes.'
};
async function authRequest(action, body) {
  const response = await fetch('/api/auth/' + action, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(errors[result.code] || (response.status === 429 ? errors.TOO_MANY_REQUESTS : 'La connexion n’a pas abouti. Réessayez dans quelques instants.'));
    error.code = result.code;
    throw error;
  }
  return result;
}
function renderSession(user) {
  state.user = user;
  if (!user) { clearReferralView(); $('#account-confirmations').hidden = true; $('#confirmation-list').replaceChildren(); state.credits = 10; state.plan = 'trial'; state.quota = 10; state.usage = null; state.quotaReady = false; state.quotaError = false; }
  const nav = $('.nav-actions .login-link');
  nav.textContent = user ? 'Mon compte' : 'Se connecter';
  nav.href = user ? '#compte' : '#connexion';
  const cta = $('.nav-actions .button');
  cta.textContent = user ? 'La démonstration' : 'Créer mon compte';
  cta.href = user ? '#outil' : '#connexion';
  $('#account-email').textContent = user?.email || 'Non connecté';
  $('#account-verified').textContent = user ? 'Adresse vérifiée' : 'Non connecté';
}
async function refreshSession(guard = false) {
  if (!sessionCheck) sessionCheck = authRequest('session').finally(() => { sessionCheck = null; });
  try {
    const result = await sessionCheck;
    renderSession(result.user);
    if (result.user) {
      state.quotaReady = false;
      try {
        const response = await fetch('/api/usage', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
        const usage = await response.json();
        if (!response.ok) throw new Error('Usage unavailable');
        state.credits = Number(usage.creditsRemaining) || 0;
        state.plan = usage.plan || 'trial';
        state.quota = Number(usage.quota) || (state.plan === 'monthly' ? 30 : 10);
        state.usage = usage;
        state.quotaReady = true;
        state.quotaError = false;
        window.setPostibouUsage?.(usage);
      } catch { state.credits = 0; state.quotaReady = false; state.quotaError = true; }
      updateQuota();
      if (state.route === 'compte') { refreshContractConfirmations(); refreshReferrals(); }
    } else updateQuota();
    if (guard && !result.user && state.route === 'compte') {
      history.replaceState(null, '', '#connexion');
      navigate('connexion');
      configureAuthForm('login');
      authMessage('Votre session a expiré. Connectez-vous à nouveau.');
    }
    return result.user;
  } catch {
    renderSession(null);
    if (guard && state.route === 'compte') {
      history.replaceState(null, '', '#connexion');
      navigate('connexion');
      authMessage('Impossible de vérifier votre session. Réessayez de vous connecter.');
    }
    return null;
  }
}
async function runAuth(work) {
  if (authBusy) return;
  authBusy = true;
  authMessage('');
  const controls = ['#auth-submit', '#resend-code', '#auth-back', '#forgot-password', '#google-button', '[data-auth-tab]'];
  controls.forEach(selector => $$(selector).forEach(el => { el.disabled = true; }));
  $('#auth-form').setAttribute('aria-busy', 'true');
  try { return await work(); }
  catch (error) { authMessage(error.message || 'Connexion indisponible. Réessayez.'); }
  finally {
    authBusy = false;
    controls.forEach(selector => $$(selector).forEach(el => { el.disabled = false; }));
    $('#auth-form').removeAttribute('aria-busy');
    $('#password').value = '';
  }
}
function changeMode(mode) { authBusy = false; configureAuthForm(mode); authBusy = true; }
$('#auth-form').addEventListener('submit', event => {
  event.preventDefault();
  runAuth(async () => {
    const mode = state.authMode;
    const email = $('#email').value.trim();
    const password = $('#password').value;
    const otp = $('#otp').value.trim();
    if (mode === 'signup') {
      await authRequest('signup', { email, password });
      codeCooldown = Date.now() + 60000;
      changeMode('verify');
    } else if (mode === 'login') {
      try { await authRequest('login', { email, password }); }
      catch (error) {
        if (error.code !== 'EMAIL_NOT_VERIFIED') throw error;
        changeMode('verify');
        authMessage('Votre adresse n’est pas encore vérifiée. Cliquez sur « Renvoyer un code ».');
        return;
      }
      if (!await refreshSession()) throw new Error('Votre session n’a pas pu être ouverte. Réessayez de vous connecter.');
      location.hash = '#compte'; navigate('compte');
    } else if (mode === 'verify') {
      await authRequest('verify', { email, otp });
      if (await refreshSession()) { location.hash = '#compte'; navigate('compte'); }
      else { changeMode('login'); authMessage('Adresse vérifiée ! Vous pouvez maintenant vous connecter.'); }
    } else if (mode === 'recovery') {
      await authRequest('recovery', { email });
      codeCooldown = Date.now() + 60000;
      changeMode('reset');
      authMessage('Si un compte correspond à cette adresse, vous recevrez un code de récupération.');
    } else if (mode === 'reset') {
      await authRequest('reset', { email, otp, password });
      renderSession(null);
      changeMode('login');
      authMessage('Votre mot de passe a été changé. Connectez-vous avec le nouveau.');
    }
  });
});
$('#forgot-password').addEventListener('click', () => configureAuthForm('recovery'));
$('#auth-back').addEventListener('click', () => configureAuthForm('login'));
$('#google-button').disabled = false;
$('#google-button').addEventListener('click', () => runAuth(async () => {
  const result = await authRequest('google', {});
  // The server restricts the destination to Neon OAuth init or Google.
  // Keep the managed challenge in HttpOnly cookies, never in browser storage.
  location.assign(result.url);
}));
$('#resend-code').addEventListener('click', () => runAuth(async () => {
  if (Date.now() < codeCooldown) throw new Error('Attendez une minute entre deux envois.');
  await authRequest(state.authMode === 'reset' ? 'recovery' : 'resend', { email: $('#email').value.trim() });
  codeCooldown = Date.now() + 60000;
  authMessage('Un nouveau code a été demandé. Utilisez le dernier reçu.');
}));
$('#logout-button').addEventListener('click', async () => {
  const button = $('#logout-button');
  if (button.disabled) return;
  button.disabled = true;
  try {
    await authRequest('logout', {});
    renderSession(null);
    location.hash = '#connexion'; navigate('connexion'); configureAuthForm('login');
    authMessage('Vous êtes déconnecté.');
  } catch { notify('La déconnexion a échoué. Réessayez.'); }
  finally { button.disabled = false; }
});
window.addEventListener('pageshow', () => { if (state.route === 'compte') refreshSession(true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.route === 'compte') refreshSession(true); });
configureAuthForm('signup');
refreshSession().finally(() => {
  const error = new URLSearchParams(location.search).get('google') === 'erreur';
  if (error) {
    history.replaceState(null, '', '/#connexion');
    configureAuthForm('login');
    navigate('connexion');
    authMessage('La connexion Google n’a pas abouti. Réessayez, ou connectez-vous par e-mail.');
  } else navigate(location.hash.slice(1));
});


let confirmationCheck = 0;
async function refreshContractConfirmations() {
  const requestId = ++confirmationCheck;
  const userId = state.user?.email;
  if (!userId || state.route !== 'compte') return;
  const panel = $('#account-confirmations');
  const list = $('#confirmation-list');
  const message = $('#confirmation-message');
  try {
    const response = await fetch('/api/billing/confirmations', {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data = await response.json();
    if (requestId !== confirmationCheck || state.user?.email !== userId || state.route !== 'compte') return;
    if (!response.ok) throw new Error('Confirmation unavailable');
    list.replaceChildren();
    const rows = Array.isArray(data.confirmations) ? data.confirmations : [];
    panel.hidden = !rows.length && !state.usage?.hasBilling;
    message.textContent = rows.length ? '' : 'Votre confirmation apparaîtra ici après validation de la commande. Vous pouvez actualiser cette liste.';
    for (const row of rows) {
      if (!/^[0-9a-f-]{36}$/i.test(row.id)) continue;
      const line = document.createElement('p');
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = '/api/billing/confirmations?receipt=' + encodeURIComponent(row.id);
      link.download = 'postibou-confirmation-' + row.id + '.txt';
      const date = new Intl.DateTimeFormat('fr-FR',{dateStyle:'long'}).format(new Date(row.paidAt));
      link.textContent = 'Télécharger la confirmation du ' + date;
      line.append(link);
      const status = document.createElement('small');
      status.style.display = 'block';
      status.textContent = row.emailStatus === 'sent' ? 'E-mail confié au service d’envoi. Pensez à vérifier vos indésirables.' : 'Copie disponible ici ; envoi de l’e-mail en attente.';
      line.append(status); list.append(line);
    }
  } catch {
    if (requestId !== confirmationCheck || state.user?.email !== userId || state.route !== 'compte') return;
    panel.hidden = !state.usage?.hasBilling;
    message.textContent = 'Impossible de charger vos confirmations. Réessayez dans quelques instants.';
  }
}
$('#refresh-confirmations').addEventListener('click', refreshContractConfirmations);

let referralCheck=0,referralLink='';
// The visitor may voluntarily keep this invitation in sessionStorage for
// the Google return. No tracking cookie, localStorage or contact import.
const receivedReferral=new URLSearchParams(location.search).get('parrain');
let invitationCode=/^[A-F0-9]{16}$/.test(receivedReferral||'')?receivedReferral:null;
try { const saved=JSON.parse(sessionStorage.getItem('postibou-invitation')||'null');if(!invitationCode&&/^[A-F0-9]{16}$/.test(saved?.code||'')&&Date.now()-saved.at<7*86400000)invitationCode=saved.code; } catch {}
if(invitationCode) $('#signup-referral-invitation').hidden=false;
$('#remember-referral').addEventListener('change',event=>{try{if(event.target.checked&&invitationCode)sessionStorage.setItem('postibou-invitation',JSON.stringify({code:invitationCode,at:Date.now()}));else sessionStorage.removeItem('postibou-invitation');}catch{notify('Votre navigateur ne peut pas conserver cette invitation. Gardez votre lien pour le rouvrir après connexion.');}});
function clearReferralView(){
 referralCheck++;referralLink='';$('#referral-link').value='';$('#copy-referral').disabled=true;$('#share-referral').disabled=true;
 for(const name of ['pending','validated','available'])$('#referral-'+name).textContent='—';
 $('#referral-savings').textContent='';$('#referral-message').textContent='';$('#account-referral-invitation').hidden=true;
 $('#referral-progress').value=0;$$('[data-referral-badge]').forEach(el=>el.classList.remove('earned'));
}
async function refreshReferrals(){
 const check=++referralCheck,user=state.user?.email;if(!user||state.route!=='compte')return;
 try{
  const response=await fetch('/api/referrals',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(check!==referralCheck||state.user?.email!==user||state.route!=='compte')return;
  if(!response.ok)throw Error('unavailable');
  referralLink=data.link;$('#referral-link').value=referralLink;$('#copy-referral').disabled=false;$('#share-referral').disabled=false;
  for(const name of ['pending','validated','available'])$('#referral-'+name).textContent=Number(data[name])||0;
  const n=Number(data.validated)||0,goal=[1,3,5].find(g=>n<g)||Math.ceil((n+1)/5)*5;
  $('#referral-progress').max=goal;$('#referral-progress').value=n;$('#referral-progress').setAttribute('aria-valuetext',n+' parrainages validés sur '+goal);
  $('#referral-motivation').textContent=n===0?'Votre premier parrainage peut vous offrir votre prochain mois.':n>=5?'Vous avez déjà '+n+' parrainages validés. Chaque nouveau client abonné peut vous offrir un mois de plus.':'Déjà '+n+' parrainage'+(n>1?'s':'')+' validé'+(n>1?'s':'')+' ! Encore '+(goal-n)+' pour votre prochain badge.';
  $$('[data-referral-badge]').forEach(el=>{const earned=n>=Number(el.dataset.referralBadge);el.classList.toggle('earned',earned);el.setAttribute('aria-label',el.textContent+(earned?' — obtenu':' — à débloquer'));});
  $('#referral-savings').textContent=(Number(data.used)||0)+' mois déjà utilisé'+(data.used>1?'s':'')+' · '+(Number(data.scheduled)||0)+' réservé'+(data.scheduled>1?'s':'')+' pour une échéance.';
  $('#referral-message').textContent=data.attributed?'Votre parrainage a été enregistré. Les récompenses sont attribuées au parrain après validation.':'';
  $('#account-referral-invitation').hidden=!invitationCode||data.attributed;
 }catch{if(check===referralCheck&&state.user?.email===user)$('#referral-message').textContent='Le parrainage est momentanément indisponible. Revenez dans quelques instants.';}
}
$('#copy-referral').addEventListener('click',async()=>{if(!referralLink)return;try{await navigator.clipboard.writeText(referralLink);notify('Votre lien est copié. Partagez-le avec la personne de votre choix.');}catch{$('#referral-link').select();notify('Sélectionnez et copiez votre lien.');}});
$('#share-referral').addEventListener('click',async()=>{if(!referralLink)return;if(!navigator.share){$('#copy-referral').click();return;}try{await navigator.share({title:'Découvrez Postibou',text:'Préparez vos textes Facebook et Instagram avec Postibou. Voici mon lien de parrainage :',url:referralLink});}catch{}});
$('#claim-account-referral').addEventListener('click',async()=>{
 if(!invitationCode||!state.user)return;const button=$('#claim-account-referral');button.disabled=true;
 try{const response=await fetch('/api/referrals',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:invitationCode,accepted:true}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.code==='REFERRAL_ALREADY_ASSIGNED'?'Un parrain est déjà associé à votre compte.':'Ce lien ne peut pas être activé sur votre compte. Le parrainage concerne un nouveau compte, avant sa première souscription.');invitationCode=null;try{sessionStorage.removeItem('postibou-invitation');}catch{}const url=new URL(location.href);url.searchParams.delete('parrain');history.replaceState(null,'',url.pathname+url.search+url.hash);$('#signup-referral-invitation').hidden=true;await refreshReferrals();notify('Votre parrainage est enregistré.');}catch(error){$('#referral-message').textContent=error.message||'Le parrainage est momentanément indisponible.';}finally{button.disabled=false;}
});
