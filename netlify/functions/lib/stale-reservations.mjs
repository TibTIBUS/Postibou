// Rend les crédits d'adaptations restées « reserved » : la fonction a été coupée
// (délai dépassé, crash) avant d'avoir marqué la réservation terminée ou remboursée.
// Appelé à chaque lecture du compte et avant chaque nouvelle réservation : pas de
// tâche planifiée, donc pas de réveil inutile de la base.
// 10 minutes : bien au-delà du délai maximal d'une génération (12 s + 30 s).
export async function releaseStaleReservations(sql, userId) {
  await sql`
    WITH stale AS (
      UPDATE public.postibou_adaptation_reservations
      SET status = 'refunded', completed_at = now()
      WHERE user_id = ${userId}::uuid AND status = 'reserved'
        AND created_at < now() - interval '10 minutes'
      RETURNING created_at, gift_email, gift_period_start
    ),
    account AS (
      UPDATE public.postibou_entitlements e
      SET adaptations_used = GREATEST(e.adaptations_used - (
            SELECT count(*) FROM stale s
            WHERE s.gift_email IS NULL
              AND (e.plan <> 'monthly' OR e.usage_period_start IS NULL OR s.created_at >= e.usage_period_start)
          )::int, 0),
          updated_at = now()
      WHERE e.user_id = ${userId}::uuid
        AND EXISTS (SELECT 1 FROM stale WHERE gift_email IS NULL)
      RETURNING 1
    )
    UPDATE public.postibou_gifts g
    SET adaptations_used = GREATEST(g.adaptations_used - (
          SELECT count(*) FROM stale s WHERE s.gift_email = g.email AND s.gift_period_start = g.usage_period_start
        )::int, 0)
    WHERE g.user_id = ${userId}::uuid
      AND EXISTS (SELECT 1 FROM stale s WHERE s.gift_email = g.email AND s.gift_period_start = g.usage_period_start)
  `;
}

// Le nettoyage ne doit jamais empêcher l'utilisateur de travailler.
export async function releaseStaleReservationsSafely(sql, userId) {
  try { await releaseStaleReservations(sql, userId); } catch { /* réessayé au prochain appel */ }
}
