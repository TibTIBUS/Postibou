-- One durable Checkout attempt per account. Additive migration, before deployment.
CREATE TABLE IF NOT EXISTS public.postibou_checkout_attempts (
  user_id uuid PRIMARY KEY REFERENCES public.postibou_entitlements(user_id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL UNIQUE,
  price_id text NOT NULL,
  customer_id text,
  customer_email text,
  expires_at bigint NOT NULL,
  checkout_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((customer_id IS NOT NULL AND customer_email IS NULL)
      OR (customer_id IS NULL AND customer_email IS NOT NULL))
);
ALTER TABLE public.postibou_checkout_attempts ENABLE ROW LEVEL SECURITY;
-- Access exclusively through authenticated server functions using the database owner.
-- No public/anonymous RLS policy is added.
REVOKE ALL ON public.postibou_checkout_attempts FROM PUBLIC;
