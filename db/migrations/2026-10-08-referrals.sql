CREATE TABLE IF NOT EXISTS public.postibou_referral_codes (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-F0-9]{16}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.postibou_referrals (
  referral_id uuid PRIMARY KEY,
  referrer_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  referee_id uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'linked' CHECK (status IN ('linked','pending','qualified','invalid')),
  rules_version text NOT NULL DEFAULT '2026-10-08-v1',
  first_invoice_id text UNIQUE,
  first_subscription_id text,
  paid_at timestamptz,
  eligible_at timestamptz,
  qualified_at timestamptz,
  checked_at timestamptz,
  CHECK (referrer_id <> referee_id),
  CHECK (eligible_at IS NULL OR eligible_at >= paid_at + interval '14 days')
);
CREATE INDEX IF NOT EXISTS postibou_referrals_referrer ON public.postibou_referrals(referrer_id);
CREATE TABLE IF NOT EXISTS public.postibou_referral_redemptions (
  redemption_id uuid PRIMARY KEY,
  referral_id uuid NOT NULL REFERENCES public.postibou_referrals(referral_id),
  referrer_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  invoice_id text NOT NULL UNIQUE,
  subscription_id text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','applied','used','void','review')),
  request_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  used_at timestamptz,
  CHECK (period_end > period_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS postibou_referral_reward_once ON public.postibou_referral_redemptions(referral_id) WHERE status <> 'void';
CREATE UNIQUE INDEX IF NOT EXISTS postibou_referral_period_once ON public.postibou_referral_redemptions(referrer_id,subscription_id,period_start) WHERE status <> 'void';
ALTER TABLE public.postibou_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postibou_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postibou_referral_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.postibou_referral_codes, public.postibou_referrals, public.postibou_referral_redemptions FROM PUBLIC;
