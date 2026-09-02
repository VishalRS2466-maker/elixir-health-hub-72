CREATE TABLE public.passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_type text NOT NULL DEFAULT 'platform',
  backed_up boolean NOT NULL DEFAULT false,
  nickname text NOT NULL DEFAULT 'This device',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX passkey_credentials_user_idx ON public.passkey_credentials(user_id);
GRANT SELECT, UPDATE, DELETE ON public.passkey_credentials TO authenticated;
GRANT ALL ON public.passkey_credentials TO service_role;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own passkeys read" ON public.passkey_credentials FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own passkeys rename" ON public.passkey_credentials FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own passkeys delete" ON public.passkey_credentials FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  challenge text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webauthn_challenges_challenge_idx ON public.webauthn_challenges(challenge);
GRANT ALL ON public.webauthn_challenges TO service_role;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'sensitive',
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE INDEX reauth_sessions_user_idx ON public.reauth_sessions(user_id);
GRANT ALL ON public.reauth_sessions TO service_role;
ALTER TABLE public.reauth_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_user_idx ON public.security_events(user_id, created_at DESC);
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security events" ON public.security_events FOR SELECT TO authenticated USING (user_id = auth.uid());