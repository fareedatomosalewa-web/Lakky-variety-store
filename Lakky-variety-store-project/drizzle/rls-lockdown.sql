-- v1.7 RLS lockdown: public API (anon/authenticated) cannot read or write anything.
-- Only the server owner connection works (table owner bypasses RLS).
-- Applies to EVERY table in public, present and future-proof pattern (re-run after new tables).
DO $$
DECLARE r record;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, public', r.tablename);
  END LOOP;
END $$;
