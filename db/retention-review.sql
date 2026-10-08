-- Monthly, read-only review. Counts only: no e-mail, source text or user ID.
-- A candidate is never an authorization to delete. See docs/legal/operations.md.
SELECT 'adaptation_metadata_due' AS category, count(*) AS candidates
FROM public.postibou_adaptation_reservations
WHERE status IN ('completed','refunded')
  AND COALESCE(completed_at,created_at) < now() - interval '90 days'
UNION ALL
SELECT 'unfinished_adaptations_to_reconcile', count(*)
FROM public.postibou_adaptation_reservations
WHERE status='reserved' AND created_at < now() - interval '1 day'
UNION ALL
SELECT 'checkout_attempts_to_review', count(*)
FROM public.postibou_checkout_attempts
WHERE to_timestamp(expires_at) < now() - interval '90 days'
UNION ALL
SELECT 'trial_accounts_to_review', count(*)
FROM public.postibou_entitlements
WHERE plan='trial' AND trial_ends_at < now() - interval '12 months'
  AND updated_at < now() - interval '12 months'
  AND stripe_subscription_id IS NULL
UNION ALL
SELECT 'legal_acceptances_to_classify', count(*)
FROM public.postibou_legal_acceptances
WHERE accepted_at < now() - interval '90 days'
UNION ALL
SELECT 'withdrawals_to_review', count(*)
FROM public.postibou_withdrawal_requests
WHERE status='received'
UNION ALL
SELECT 'confirmation_delivery_to_review', count(*)
FROM public.postibou_contract_confirmations
WHERE email_status='needs_review'
  OR (email_status IN ('pending','sending') AND created_at < now() - interval '1 day')
UNION ALL
SELECT 'unpaid_referrals_to_review', count(*) FROM public.postibou_referrals WHERE status='linked' AND created_at<now()-interval '12 months'
UNION ALL
SELECT 'referral_redemptions_to_review', count(*) FROM public.postibou_referral_redemptions WHERE status='review';
