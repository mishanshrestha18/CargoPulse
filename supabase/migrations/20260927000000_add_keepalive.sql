-- Keeps the Supabase free-tier project from auto-pausing.
--
-- Free projects pause after 7 days with no database activity. A scheduled job
-- (.github/workflows/keepalive.yml) calls keepalive_ping() once a day, which
-- performs a real write and so resets the inactivity timer.
--
-- The table stays locked down: RLS is on with no policies, so anon cannot read
-- or write it directly. The security-definer function below is the only way in,
-- and all it can do is bump a timestamp and a counter on one row.

CREATE TABLE IF NOT EXISTS public.keepalive (
  id          integer     PRIMARY KEY DEFAULT 1,
  last_ping   timestamptz NOT NULL DEFAULT now(),
  ping_count  bigint      NOT NULL DEFAULT 0,
  CONSTRAINT keepalive_singleton CHECK (id = 1)
);

INSERT INTO public.keepalive (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS on, zero policies: no direct table access for anon or authenticated.
ALTER TABLE public.keepalive ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.keepalive_ping()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.keepalive
     SET last_ping  = now(),
         ping_count = ping_count + 1
   WHERE id = 1
  RETURNING last_ping;
$$;

REVOKE ALL ON FUNCTION public.keepalive_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive_ping() TO anon, authenticated;
