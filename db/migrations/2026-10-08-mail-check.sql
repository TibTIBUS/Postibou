CREATE TABLE IF NOT EXISTS public.postibou_operational_mail_checks (
  check_id text PRIMARY KEY,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','review')),
  payload jsonb,
  first_attempt_at timestamptz,
  lease_until timestamptz,
  provider_id text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.postibou_operational_mail_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.postibou_operational_mail_checks FROM PUBLIC;
