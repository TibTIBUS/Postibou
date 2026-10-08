CREATE TABLE IF NOT EXISTS public.postibou_admins (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.postibou_admins FROM PUBLIC;
ALTER TABLE public.postibou_admins ENABLE ROW LEVEL SECURITY;
-- Bind the role to the existing verified identity, never to future signups.
INSERT INTO public.postibou_admins (user_id)
SELECT id FROM neon_auth."user"
WHERE lower(email) = 'marie.thibaut2105@gmail.com' AND "emailVerified" = true
ON CONFLICT (user_id) DO NOTHING;
