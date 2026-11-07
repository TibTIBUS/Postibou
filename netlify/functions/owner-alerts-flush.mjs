// Reprise quotidienne bornée des alertes propriétaire. Les reprises au fil du
// trafic (sessions, webhooks Stripe, lectures admin) suffisent un jour normal,
// mais un jour creux ne doit pas laisser une alerte sans reprise :
// - flushOwnerAlerts : au plus 20 reprises par exécution, mêmes variables
//   d'environnement et même canal que les autres fonctions (aucun secret neuf),
//   chaque tentative réelle décomptée du plafond journalier partagé ;
// - sweepExpiredOwnerAlerts : marquage terminal visible — « failed » (erreurs
//   certaines, compteur épuisé) ou « a_verifier » (livraison ambiguë âgée de
//   plus de 24 h, jamais renvoyée après expiration de l'idempotence) ;
// - incident : s'il reste des échecs ou des « à vérifier » sur 7 jours, UNE
//   alerte récapitulative par jour (dedupe_key daté) prévient le propriétaire
//   via le même chemin testé. Si le fournisseur est en panne, ce récapitulatif
//   échoue aussi : l'état reste conservé en base, sans promesse de zéro perte.
// Jamais d'erreur propagée : une panne de la reprise ne casse rien d'autre.
import { neon } from '@neondatabase/serverless';
import { enqueueOwnerAlert, flushOwnerAlerts, sweepExpiredOwnerAlerts } from './lib/owner-alert.mjs';

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
      await sweepExpiredOwnerAlerts(sql);
      const failed = await sql`
        SELECT status, kind, count(*)::int AS n FROM public.postibou_owner_alerts
        WHERE status IN ('failed','a_verifier') AND created_at > now() - interval '7 days'
        GROUP BY status, kind ORDER BY status, kind
      `;
      let incident = 0;
      if (failed.length) {
        const total = failed.reduce((sum, row) => sum + row.n, 0);
        await enqueueOwnerAlert(sql, {
          kind: 'Incident alertes e-mail',
          dedupeKey: 'owner-alerts-incident/' + parisDate(),
          email: OPERATOR_EMAIL,
          lines: [
            total + ' alerte(s) propriétaire à traiter sur les 7 derniers jours :',
            ...failed.map(row => '- ' + row.kind + ' (' + (row.status === 'a_verifier' ? 'livraison à vérifier' : 'envoi en échec') + ') : ' + row.n),
            "Les lignes « failed » ne sont plus retentées automatiquement ; les lignes « à vérifier » ne sont jamais renvoyées (doublon possible).",
            "Vérifier la clé Resend et le domaine d'envoi, puis relancer ou confirmer manuellement."
          ],
          fetchEmail
        });
        incident = 1;
      }
      return { flushed: true, failedKinds: failed.length, incident };
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
