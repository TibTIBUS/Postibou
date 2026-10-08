CREATE TABLE IF NOT EXISTS public.postibou_gifts (
  email text PRIMARY KEY CHECK (email = lower(trim(email))),
  user_id uuid UNIQUE REFERENCES neon_auth."user"(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  quota integer NOT NULL DEFAULT 30 CHECK (quota = 30),
  usage_period_start timestamptz,
  adaptations_used integer NOT NULL DEFAULT 0 CHECK (adaptations_used BETWEEN 0 AND 30),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.postibou_adaptation_reservations
  ADD COLUMN IF NOT EXISTS gift_email text REFERENCES public.postibou_gifts(email),
  ADD COLUMN IF NOT EXISTS gift_period_start timestamptz;
