CREATE TABLE IF NOT EXISTS public.postibou_owner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text UNIQUE NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS postibou_owner_alerts_pending ON public.postibou_owner_alerts (created_at) WHERE status IN ('pending','sending');

-- Plafond journalier persisté et suivi des tentatives (ajout du 07/11/2026).
ALTER TABLE public.postibou_owner_alerts DROP CONSTRAINT IF EXISTS postibou_owner_alerts_status_check;
ALTER TABLE public.postibou_owner_alerts ADD CONSTRAINT postibou_owner_alerts_status_check CHECK (status IN ('pending','sending','sent','failed','a_verifier'));
ALTER TABLE public.postibou_owner_alerts ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz;
ALTER TABLE public.postibou_owner_alerts ADD COLUMN IF NOT EXISTS last_error_kind text;
CREATE TABLE IF NOT EXISTS public.postibou_owner_alert_budget (
  day date PRIMARY KEY,
  sends integer NOT NULL DEFAULT 0
);
