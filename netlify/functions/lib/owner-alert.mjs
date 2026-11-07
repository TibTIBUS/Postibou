// Alertes e-mail au propriÃ©taire : nouvelle inscription, premier passage payant.
// File persistante (table postibou_owner_alerts) : l'Ã©vÃ©nement est enregistrÃ© une
// seule fois (dedupe_key unique), la livraison est tentÃ©e immÃ©diatement puis
// reprise au fil du trafic existant (flushOwnerAlerts : sessions utilisateurs,
// webhooks Stripe, lectures admin dont la revue pÃ©riodique de l'exploitant)
// jusqu'Ã  succÃ¨s ou abandon. Jamais d'erreur propagÃ©e : le flux mÃ©tier n'est
// pas bloquÃ© par une alerte.
const ALERT_TO = 'contact@localiapro.fr'; // destination validÃ©e par le propriÃ©taire le 07/11/2026
const MAX_ATTEMPTS = 8;
// Marqueur technique non personnel : alias dÃ©diÃ©s aux essais internes.
const TEST_ALIAS_PATTERN = /\+postibou\.essai@/i;

const safeEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(value);
const money = cents => Number.isSafeInteger(cents) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100) : null;
const parisNow = () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date());

function alertConfig() {
  const key = globalThis.Netlify?.env?.get('RESEND_API_KEY');
  const from = globalThis.Netlify?.env?.get('POSTIBOU_EMAIL_FROM');
  return key && safeEmail(from) ? { key, from } : null;
}

// Comptes internes marquÃ©s [TEST] : administrateurs (donnÃ©e existante, non
// versionnÃ©e) ou alias d'essai conventionnÃ©. Aucune adresse personnelle ici.
async function isInternalAccount(sql, userId, email) {
  if (TEST_ALIAS_PATTERN.test(String(email || ''))) return true;
  if (userId) {
    try {
      const rows = await sql`SELECT user_id FROM public.postibou_admins WHERE user_id = ${userId}::uuid`;
      if (rows.length) return true;
    } catch { /* en cas de doute, pas de marquage */ }
  }
  return false;
}

function buildPayload({ kind, email, test, lines = [], amountCents = null }) {
  if (!safeEmail(email) || typeof kind !== 'string' || !kind) return null;
  const amount = money(amountCents);
  return {
    subject: `${test ? '[TEST] ' : ''}Postibou â ${kind}`,
    text: [
      `${kind}${test ? ' (compte de test)' : ''} â ${parisNow()} (heure de Paris).`,
      `Compte : ${email}`,
      ...(amount ? [`Montant : ${amount}`] : []),
      ...lines,
      '',
      'Administration : https://postibou.com/#administration'
    ].join('\n')
  };
}

// Enregistre l'Ã©vÃ©nement une seule fois, puis tente la livraison. Ne lÃ¨ve rien.
export async function enqueueOwnerAlert(sql, { kind, dedupeKey, userId = null, email, lines = [], amountCents = null, fetchEmail = fetch } = {}) {
  try {
    if (typeof dedupeKey !== 'string' || !dedupeKey || dedupeKey.length > 180) return;
    const test = await isInternalAccount(sql, userId, email);
    const payload = buildPayload({ kind, email, test, lines, amountCents });
    if (!payload) return;
    const inserted = await sql`
      INSERT INTO public.postibou_owner_alerts (dedupe_key, kind, payload)
      VALUES (${dedupeKey}, ${kind}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id
    `;
    if (inserted.length) await deliverOwnerAlert(sql, inserted[0].id, { fetchEmail });
  } catch { /* L'alerte propriÃ©taire ne bloque jamais le flux mÃ©tier. */ }
}

// Reprise des alertes en attente au fil du trafic existant (sessions, webhooks,
// lectures admin). AppelÃ©e par usage.mjs, stripe-webhook.mjs et admin.mjs.
export async function flushOwnerAlerts(sql, { limit = 3, fetchEmail = fetch } = {}) {
  try {
    const pending = await sql`
      SELECT id FROM public.postibou_owner_alerts
      WHERE status IN ('pending','sending')
        AND (lease_until IS NULL OR lease_until < now())
        AND created_at > now() - interval '24 hours'
      ORDER BY created_at
      LIMIT ${limit}
    `;
    for (const row of pending) await deliverOwnerAlert(sql, row.id, { fetchEmail });
  } catch { /* idem : silencieux par conception. */ }
}

async function deliverOwnerAlert(sql, id, { fetchEmail = fetch } = {}) {
  const claimed = await sql`
    UPDATE public.postibou_owner_alerts
    SET status = 'sending', lease_until = now() + interval '2 minutes', attempts = attempts + 1
    WHERE id = ${id}::uuid AND status IN ('pending','sending') AND attempts < ${MAX_ATTEMPTS}
      AND (lease_until IS NULL OR lease_until < now())
    RETURNING dedupe_key, payload, attempts
  `;
  if (!claimed[0]) {
    await sql`UPDATE public.postibou_owner_alerts SET status = 'failed', lease_until = NULL
      WHERE id = ${id}::uuid AND status IN ('pending','sending') AND attempts >= ${MAX_ATTEMPTS}`;
    return;
  }
  const config = alertConfig();
  if (!config) {
    await sql`UPDATE public.postibou_owner_alerts SET status = 'pending', lease_until = now() + interval '15 minutes' WHERE id = ${id}::uuid`;
    return;
  }
  const alert = claimed[0];
  try {
    const response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'postibou-owner-alert/' + alert.dedupe_key },
      body: JSON.stringify({ from: `Postibou <${config.from}>`, to: [ALERT_TO], subject: alert.payload.subject, text: alert.payload.text }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('OWNER_ALERT_DELIVERY_FAILED');
    const result = await response.json();
    if (!result?.id || typeof result.id !== 'string' || result.id.length > 150) throw new Error('OWNER_ALERT_DELIVERY_FAILED');
    await sql`UPDATE public.postibou_owner_alerts SET status = 'sent', provider_id = ${result.id}, sent_at = now(), lease_until = NULL WHERE id = ${id}::uuid`;
  } catch {
    // Livraison incertaine : la ligne repasse en attente et sera reprise.
    await sql`UPDATE public.postibou_owner_alerts SET status = 'pending', lease_until = now() + interval '15 minutes' WHERE id = ${id}::uuid AND status = 'sending'`;
  }
}
