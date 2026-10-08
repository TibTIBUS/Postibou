CREATE TABLE IF NOT EXISTS public.postibou_legal_acceptances (
  attempt_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  terms_version text NOT NULL,
  terms_sha256 text NOT NULL CHECK (length(terms_sha256) = 64),
  terms_document text NOT NULL,
  price_id text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS postibou_legal_acceptances_user ON public.postibou_legal_acceptances(user_id);
CREATE TABLE IF NOT EXISTS public.postibou_withdrawal_requests (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  subscription_id text NOT NULL,
  account_email text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'received',
  UNIQUE (user_id, subscription_id)
);
