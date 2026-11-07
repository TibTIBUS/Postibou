// Reprise quotidienne bornée des alertes propriétaire. Les reprises au fil du
// trafic (sessions, webhooks Stripe, lectures admin) suffisent un jour normal,
// mais un jour creux ne doit pas laisser une alerte silencieusement coincée :
// - flushOwnerAlerts : au plus 20 reprises par exécution, mêmes variables
//   d'environnement et même canal que les autres fonctions (aucun secret neuf) ;
// - balayage : les lignes encore en attente après 24 h passent en « failed »
//   (abandon assumé et visible en base) au lieu de rester « pending » muettes ;
// - incident : s'il reste des échecs sur 7 jours, UNE alerte récapitulative par
//   jour (dedupe_key daté) prévient le propriétaire via le même chemin testé.
// Jamais d'erreur propagée : une panne de la reprise ne casse rien d'autre.
import { neon } from '@neondatabase/serverless';
import { enqueueOwnerAlert, flushOwnerAlerts } from './lib/owner-alert.mjs';

const FLUSH_LIMIT = 20;
// Adresse du propriétaire, identique à celle des autres alertes (destination
// déjà validée pour les alertes Postibou le 07/11/2026).
const OPERATOR_EMAIL = 'contact@localiapro.fr';

export const config = { schedule: '0 6 * * *' }; // 6 h UTC : récapitulatif dans la matinée, heure de Paris.

export function createFlushHandler({ getDatabase, fetchEmail = fetch, parisDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()) } = {}) {
  return async () => {
    let sql;
    try {
      sql = getDatabase ? await getDatabase() : createDatabase();
    } catch {
      return { flushed: false, reason: 'DATABASE_UNAVAILABLE' };
    }
    try {
      await flushOwnerAlerts(sql, { limit: FLUSH_LIMIT, fetchEmail });
      const abandoned = await sql`
        UPDATE public.postibou_owner_alerts SET status = 'failed', lease_until = NULL
        WHERE status IN ('pending','sending') AND created_at <= now() - interval '24 hours'
        RETURNING id
      `;
      const failed = await sql`
        SELECT kind, count(*)::int AS n FROM public.postibou_owner_alerts
        WHERE status = 'failed' AND created_at > now() - interval '7 days'
        GROUP BY kind ORDER BY kind
      `;
      let incident = 0;
      if (failed.length) {
        const total = failed.reduce((sum, row) => sum + row.n, 0);
        await enqueueOwnerAlert(sql, {
          kind: 'Incident alertes e-mail',
          dedupeKey: 'owner-alerts-incident/' + parisDate(),
          email: OPERATOR_EMAIL,
          lines: [
            total + ' alerte(s) propriétaire en échec sur les 7 derniers jours :',
            ...failed.map(row => '- ' + row.kind + ' : ' + row.n),
            'Ces alertes ne sont plus retentées automatiquement.',
            "Vérifier la clé Resend et le domaine d'envoi, puis relancer manuellement si besoin."
          ],
          fetchEmail
        });
        incident = 1;
      }
      return { flushed: true, abandoned: abandoned.length, failedKinds: failed.length, incident };
    } catch {
      return { flushed: false, reason: 'FLUSH_ERROR' };
    }
  };
}

function createDatabase() {
  const connectionString = globalThis.Netlify?.env?.get('DATABASE_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return neon(connectionString);
}

export default createFlushHandler();
