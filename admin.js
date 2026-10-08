let adminAccessCheck = 0;
let adminRequest = 0;
let adminFilter = 'all';
let adminPage = 1;
function clearAdmin() {
  adminRequest++;
  state.isAdmin = false;
  $$('[data-admin-link]').forEach(el => el.hidden = true);
  $('#admin-content').hidden = true;
  $('#admin-rows').replaceChildren();
  for (const key of ['accounts','trials','subscribers','used']) $('#admin-' + key).textContent = '—';
}
async function refreshAdminAccess() {
  const check = ++adminAccessCheck;
  clearAdmin();
  if (!state.user) return;
  try {
    const response = await fetch('/api/admin/access', {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data = await response.json();
    if (check !== adminAccessCheck || !state.user) return;
    state.isAdmin = response.ok && data.admin === true;
    $$('[data-admin-link]').forEach(el => el.hidden = !state.isAdmin);
    if (state.route === 'administration') await refreshAdmin();
  } catch { if (check === adminAccessCheck && state.route === 'administration') $('#admin-message').textContent = 'Impossible de vérifier votre accès. Actualisez la page.'; }
}
const adminDate = value => value ? new Date(value).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'}) : '—';
async function refreshAdmin() {
  const requestId = ++adminRequest;
  $('#admin-content').hidden = true;
  $('#admin-rows').replaceChildren();
  const message = $('#admin-message');
  if (!state.user) { message.textContent = 'Connectez-vous à votre compte administrateur.'; return; }
  if (!state.isAdmin) { message.textContent = 'Cet espace est réservé à l’administrateur.'; return; }
  message.textContent = 'Chargement des données…';
  $('#admin-refresh').disabled = true;
  try {
    const params = new URLSearchParams({filter:adminFilter,page:String(adminPage),search:$('#admin-search').value.trim()});
    const response = await fetch('/api/admin/users?' + params, {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const data = await response.json();
    if (requestId !== adminRequest || !state.user || state.route !== 'administration') return;
    if (!response.ok) { if ([401,403].includes(response.status)) clearAdmin(); throw Error(response.status === 403 ? 'Accès administrateur refusé.' : 'Les données sont momentanément indisponibles. Réessayez.'); }
    $('#admin-content').hidden = false;
    for (const key of ['accounts','trials','subscribers','used']) $('#admin-' + key).textContent = data.summary[key];
    $('#admin-updated').textContent = 'Données Postibou actualisées à ' + new Date(data.checkedAt).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'}) + ' (heure de Paris). Adaptations utilisées : total des périodes actuellement enregistrées.';
    $('#admin-alerts').textContent = data.withdrawalsPending ? data.withdrawalsPending + ' demande(s) de rétractation à traiter dans Neon et Stripe.' : '';
    const labels = {unverified:'E-mail non vérifié',pending:'Essai non démarré',active:'Abonné',inactive:'Abonnement inactif',trial:'Essai gratuit',trial_exhausted:'Essai : crédits épuisés',expired:'Essai terminé'};
    for (const user of data.users) {
      const row = document.createElement('tr');
      const cells = [user.email, labels[user.status] + (user.cancelAtPeriodEnd ? ' · Résiliation prévue' : '') + (user.subscriptionStatus === 'past_due' ? ' · Paiement en retard' : ''),
        user.used + ' / ' + user.quota + ' · ' + user.remaining + ' restant(s)',
        adminDate(user.periodEnd || user.trialEndsAt), user.lastPayment == null ? '—' : (user.lastPayment / 100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}) + ' · ' + adminDate(user.paidAt),
        user.confirmationStatus === 'sent' ? 'Envoi accepté' : user.confirmationStatus ? 'À vérifier : ' + user.confirmationStatus : '—'];
      for (const value of cells) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
      $('#admin-rows').append(row);
    }
    $('#admin-page').textContent = 'Page ' + data.page + ' · ' + data.total + ' compte(s) trouvé(s)';
    $('#admin-prev').disabled = adminPage <= 1;
    $('#admin-next').disabled = adminPage * data.pageSize >= data.total;
    message.textContent = data.users.length ? '' : 'Aucun compte ne correspond à cette recherche.';
  } catch (error) { if (requestId === adminRequest) message.textContent = error.message || 'Chargement impossible.'; }
  finally { if (requestId === adminRequest) $('#admin-refresh').disabled = false; }
}
$('#admin-refresh').addEventListener('click', refreshAdmin);
$('#admin-search-form').addEventListener('submit', event => {event.preventDefault();adminPage=1;refreshAdmin();});
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {adminFilter=button.dataset.filter;adminPage=1;$$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));refreshAdmin();}));
$('#admin-prev').addEventListener('click', () => {if(adminPage>1){adminPage--;refreshAdmin();}});
$('#admin-next').addEventListener('click', () => {adminPage++;refreshAdmin();});
