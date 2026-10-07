ALTER TABLE public.postibou_entitlements
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_period_start timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS postibou_entitlements_stripe_customer_id_uq
  ON public.postibou_entitlements (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS postibou_entitlements_stripe_subscription_id_uq
  ON public.postibou_entitlements (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.postibou_stripe_events (
  event_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
