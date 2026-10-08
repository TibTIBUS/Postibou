// Gifts are assigned by verified database email, never by browser input.
export async function findGift(sql, userId) {
  const rows = await sql`
    UPDATE public.postibou_gifts g SET user_id = COALESCE(g.user_id, u.id)
    FROM neon_auth."user" u
    WHERE u.id = ${userId}::uuid AND u."emailVerified" = true
      AND g.email = lower(trim(u.email)) AND (g.user_id IS NULL OR g.user_id = u.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.postibou_entitlements e WHERE e.user_id = u.id
          AND e.plan = 'monthly' AND e.stripe_subscription_status IN ('active','past_due')
          AND e.subscription_period_end > now()
      )
    RETURNING g.email AS gift_email, g.starts_at, g.ends_at, g.quota, g.adaptations_used,
      g.usage_period_start,
      date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris' AS period_start,
      (date_trunc('month', now() AT TIME ZONE 'Europe/Paris') + interval '1 month') AT TIME ZONE 'Europe/Paris' AS period_end,
      (g.starts_at <= now() AND g.ends_at > now()) AS gift_active
  `;
  return rows[0]?.gift_email ? rows[0] : null;
}
export function giftUsage(gift) {
  const used = String(gift.usage_period_start || '') === String(gift.period_start) ? Number(gift.adaptations_used) : 0;
  const active = gift.gift_active === true;
  return {
    plan: 'gift', active, quota: Number(gift.quota), adaptationsUsed: used,
    creditsRemaining: active ? Math.max(0, Number(gift.quota) - used) : 0,
    giftEndsAt: gift.ends_at, subscriptionStatus: null,
    subscriptionPeriodStart: gift.period_start,
    subscriptionPeriodEnd: new Date(gift.period_end).getTime() < new Date(gift.ends_at).getTime() ? gift.period_end : gift.ends_at,
    hasBilling: false, canCancel: false, cancelAtPeriodEnd: false
  };
}
export async function reserveGift(sql, userId, gift, reservationId) {
  return sql`
    WITH usage AS (
      UPDATE public.postibou_gifts
      SET adaptations_used = CASE WHEN usage_period_start IS DISTINCT FROM ${gift.period_start}::timestamptz THEN 1 ELSE adaptations_used + 1 END,
          usage_period_start = ${gift.period_start}::timestamptz
      WHERE email = ${gift.gift_email} AND user_id = ${userId}::uuid AND starts_at <= now() AND ends_at > now()
        AND (CASE WHEN usage_period_start IS DISTINCT FROM ${gift.period_start}::timestamptz THEN 0 ELSE adaptations_used END) < quota
      RETURNING email, usage_period_start
    )
    INSERT INTO public.postibou_adaptation_reservations (id,user_id,status,gift_email,gift_period_start)
    SELECT ${reservationId}::uuid, ${userId}::uuid, 'reserved', email, usage_period_start FROM usage RETURNING id
  `;
}
export async function refundGift(sql, userId, reservationId) {
  await sql`
    WITH released AS (
      UPDATE public.postibou_adaptation_reservations SET status = 'refunded'
      WHERE id = ${reservationId}::uuid AND user_id = ${userId}::uuid AND status = 'reserved'
      RETURNING gift_email,gift_period_start
    )
    UPDATE public.postibou_gifts g SET adaptations_used = GREATEST(g.adaptations_used - 1,0)
    FROM released r WHERE g.email = r.gift_email AND g.usage_period_start = r.gift_period_start
  `;
}
