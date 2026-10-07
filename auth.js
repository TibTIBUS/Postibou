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
    signup: ['Bienvenue chez Postibou.', 'Créez votre compte. L’outil est encore en démonstration.', 'Créer mon compte'],
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
  const controls = ['#auth-submit', '#resend-code', '#auth-back', '#forgot-password', '[data-auth-tab]'];
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
refreshSession().finally(() => navigate(location.hash.slice(1)));
