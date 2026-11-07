// Alertes e-mail au propriétaire : nouvelle inscription, premier passage payant.
// File persistante (table postibou_owner_alerts) : l'événement est enregistré une
// seule fois (dedupe_key unique), la livraison est tentée immédiatement puis
// reprise au fil du trafic existant (flushOwnerAlerts : sessions utilisateurs,
// webhooks Stripe, lectures admin) et par une fonction planifiée quotidienne,
// jusqu'à succès ou abandon. Jamais d'erreur propagée : le flux métier n'est
// pas bloqué par une alerte.
//
// Plafond journalier persisté (postibou_owner_alert_budget) : chaque tentative
// réelle consomme une unité du budget du jour (heure de Paris), quel que soit
// le chemin d'envoi (création, trafic, cron, incident). Budget épuisé => alerte
// reportée SANS consommer sa fenêtre : la fenêtre de 24 h ne court qu'à partir
// de la PREMIÈRE tentative (first_attempt_at), jamais depuis la création.
//
// Erreurs certaines (rejet 4xx de Resend, configuration absente : rien n'a été
// envoyé) : retentables, compteur borné à MAX_ATTEMPTS, puis « failed ».
// Livraisons ambiguës (timeout, réseau, 5xx, réponse illisible : l'e-mail a pu
// partir) : retentées uniquement dans les 24 h suivant la première tentative
// (fenêtre de la clé d'idempotence Resend) ; au-delà => « a_verifier », visible
// en base et dans le récapitulatif quotidien, jamais renvoyé automatiquement.
const ALERT_TO = 'contact@localiapro.fr'; // destination validée par le propriétaire le 07/11/2026
const MAX_ATTEMPTS = 8;
// Plafond journalier PB, tous chemins confondus : le quota Resend Free
// (100 envois/jour) est partagé avec les autres outils du même compte.
const DAILY_SEND_LIMIT = 25;
// Marqueur technique non personnel : alias dédiés aux essais internes.
const TEST_ALIAS_PATTERN = /\+postibou\.essai@/i;

const safeEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(value);
const money = cents => Number.isSafeInteger(cents) ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100) : null;
const parisNow = () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date());

function alertConfig() {
  const key = globalThis.Netlify?.env?.get('RESEND_API_KEY');
  const from = globalThis.Netlify?.env?.get('POSTIBOU_EMAIL_FROM');
  return key && safeEmail(from) ? { key, from } : null;
}

// Comptes internes marqués [TEST] : administrateurs (donnée existante, non
// versionnée) ou alias d'essai conventionné. Aucune adresse personnelle ici.
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
    subject: `${test ? '[TEST] ' : ''}Postibou — ${kind}`,
    text: [
      `${kind}${test ? ' (compte de test)' : ''} — ${parisNow()} (heure de Paris).`,
      `Compte : ${email}`,
      ...(amount ? [`Montant : ${amount}`] : []),
      ...lines,
      '',
      'Administration : https://postibou.com/#administration'
    ].join('\n')
  };
}

// Enregistre l'événement une seule fois, puis tente la livraison. Ne lève rien.
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
  } catch { /* L'alerte propriétaire ne bloque jamais le flux métier. */ }
}

// Reprise des alertes en attente au fil du trafic existant (sessions, webhooks,
// lectures admin) et depuis la fonction planifiée quotidienne. Aucune fenêtre
// depuis la création : une alerte reportée par le plafond reste éligible.
export async function flushOwnerAlerts(sql, { limit = 3, fetchEmail = fetch } = {}) {
  try {
    const pending = await sql`
      SELECT id FROM public.postibou_owner_alerts
      WHERE status IN ('pending','sending')
        AND (lease_until IS NULL OR lease_until < now())
      ORDER BY created_at
      LIMIT ${limit}
    `;
    for (const row of pending) await deliverOwnerAlert(sql, row.id, { fetchEmail });
  } catch { /* idem : silencieux par conception. */ }
}

// Marquage terminal des alertes qui ne peuvent plus être retentées :
// compteur épuisé => « failed » ; ambiguïté âgée de plus de 24 h => « a_verifier ».
export async function sweepExpiredOwnerAlerts(sql) {
  try {
    await sql`
      UPDATE public.postibou_owner_alerts SET status = 'failed', lease_until = NULL
      WHERE status IN ('pending','sending') AND attempts >= ${MAX_ATTEMPTS}
    `;
    await sql`
      UPDATE public.postibou_owner_alerts SET status = 'a_verifier', lease_until = NULL
      WHERE status IN ('pending','sending') AND last_error_kind = 'ambiguous'
        AND first_attempt_at <= now() - interval '24 hours'
    `;
  } catch { /* idem. */ }
}

async function deliverOwnerAlert(sql, id, { fetchEmail = fetch } = {}) {
  const budget = await sql`
    INSERT INTO public.postibou_owner_alert_budget (day, sends)
    VALUES ((now() AT TIME ZONE 'Europe/Paris')::date, 1)
    ON CONFLICT (day) DO UPDATE SET sends = postibou_owner_alert_budget.sends + 1
    WHERE postibou_owner_alert_budget.sends < ${DAILY_SEND_LIMIT}
    RETURNING sends
  `;
  if (!budget.length) return; // plafond du jour atteint : reporté, fenêtre non consommée
  const claimed = await sql`
    UPDATE public.postibou_owner_alerts
    SET status = 'sending', lease_until = now() + interval '2 minutes', attempts = attempts + 1,
        first_attempt_at = COALESCE(first_attempt_at, now())
    WHERE id = ${id}::uuid AND status IN ('pending','sending') AND attempts < ${MAX_ATTEMPTS}
      AND (lease_until IS NULL OR lease_until < now())
      AND (last_error_kind IS DISTINCT FROM 'ambiguous' OR first_attempt_at > now() - interval '24 hours')
    RETURNING dedupe_key, payload, attempts
  `;
  if (!claimed[0]) {
    await sql`
      UPDATE public.postibou_owner_alerts
      SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'a_verifier' END, lease_until = NULL
      WHERE id = ${id}::uuid AND status IN ('pending','sending')
        AND (attempts >= ${MAX_ATTEMPTS}
          OR (last_error_kind = 'ambiguous' AND first_attempt_at <= now() - interval '24 hours'))
    `;
    return;
  }
  const config = alertConfig();
  if (!config) {
    await sql`UPDATE public.postibou_owner_alerts SET status = 'pending', lease_until = now() + interval '15 minutes', last_error_kind = 'certain' WHERE id = ${id}::uuid`;
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
    if (!response.ok) {
      // 4xx : rejet certain, rien n'est parti. 5xx : livraison incertaine.
      const errorKind = response.status >= 400 && response.status < 500 ? 'certain' : 'ambiguous';
      await sql`UPDATE public.postibou_owner_alerts SET status = 'pending', lease_until = now() + interval '15 minutes', last_error_kind = ${errorKind} WHERE id = ${id}::uuid AND status = 'sending'`;
      return;
    }
    const result = await response.json();
    if (!result?.id || typeof result.id !== 'string' || result.id.length > 150) {
      await sql`UPDATE public.postibou_owner_alerts SET status = 'pending', lease_until = now() + interval '15 minutes', last_error_kind = 'ambiguous' WHERE id = ${id}::uuid AND status = 'sending'`;
      return;
    }
    await sql`UPDATE public.postibou_owner_alerts SET status = 'sent', provider_id = ${result.id}, sent_at = now(), lease_until = NULL, last_error_kind = NULL WHERE id = ${id}::uuid`;
  } catch {
    // Livraison incertaine (timeout, réseau) : retentable dans la fenêtre de 24 h
    // après la première tentative seulement, puis « a_verifier ».
    await sql`UPDATE public.postibou_owner_alerts SET status = 'pending', lease_until = now() + interval '15 minutes', last_error_kind = 'ambiguous' WHERE id = ${id}::uuid AND status = 'sending'`;
  }
}
