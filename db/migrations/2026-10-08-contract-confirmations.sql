CREATE TABLE IF NOT EXISTS public.postibou_contract_confirmations (
  receipt_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  attempt_id uuid NOT NULL REFERENCES public.postibou_legal_acceptances(attempt_id),
  subscription_id text NOT NULL UNIQUE,
  checkout_session_id text NOT NULL UNIQUE,
  invoice_id text NOT NULL,
  recipient_email text NOT NULL,
  terms_version text NOT NULL,
  terms_sha256 text NOT NULL CHECK (length(terms_sha256)=64),
  terms_document text NOT NULL,
  confirmation_document text NOT NULL,
  confirmation_sha256 text NOT NULL CHECK (length(confirmation_sha256)=64),
  paid_at timestamptz NOT NULL,
  amount_paid integer NOT NULL CHECK (amount_paid>=0),
  currency text NOT NULL CHECK (currency='eur'),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sending','sent','needs_review')),
  email_payload jsonb,
  email_first_attempt_at timestamptz,
  email_lease_until timestamptz,
  email_provider_id text,
  email_sent_at timestamptz,
  CHECK (period_end>period_start),
  CHECK (email_status<>'sent' OR (email_provider_id IS NOT NULL AND email_sent_at IS NOT NULL))
);
ALTER TABLE public.postibou_contract_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.postibou_contract_confirmations FROM PUBLIC;
-- Contract evidence is immutable; only mail delivery tracking may be updated.
CREATE OR REPLACE FUNCTION public.postibou_confirmation_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['email_status','email_payload','email_first_attempt_at','email_lease_until','email_provider_id','email_sent_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['email_status','email_payload','email_first_attempt_at','email_lease_until','email_provider_id','email_sent_at']) THEN
    RAISE EXCEPTION 'POSTIBOU_CONFIRMATION_IMMUTABLE';
  END IF;
  IF OLD.email_payload IS NOT NULL AND NEW.email_payload IS DISTINCT FROM OLD.email_payload THEN
    RAISE EXCEPTION 'POSTIBOU_EMAIL_PAYLOAD_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER postibou_confirmation_immutable
BEFORE UPDATE ON public.postibou_contract_confirmations
FOR EACH ROW EXECUTE FUNCTION public.postibou_confirmation_immutable();
