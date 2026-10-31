-- ============================================================================
-- Lakky Variety Store — public schema lockdown (v2)
-- Project: xvndgihoazznycssakbj
-- Purpose:
--   1. RLS ON for every table in public (including push_subscriptions).
--   2. No public/anon/authenticated write access to ANY table.
--   3. Customers may read only safe product columns (active products).
--   4. Future tables created by the app role are private by default.
-- The application talks to Postgres server-side as the `postgres` role
-- (BYPASSRLS), so it keeps working unchanged. The app's own admin guard and
-- customer-session scoping enforce who can see orders.
-- Re-run after adding new tables if they are created by another role.
-- ============================================================================

BEGIN;

-- 1. Enable RLS on every current table in public.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2. Remove every privilege from the public API roles.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- 3. Customers can read products, but only non-sensitive columns and only
--    active products. Internal pricing/stock fields stay private.
GRANT SELECT (
  id, name, description, base_price, status, active,
  restocked_at, discount_type, discount_value, discount_start,
  discount_end, new_tag_days, created_at
) ON public.products TO anon, authenticated;

DROP POLICY IF EXISTS products_customer_read ON public.products;
CREATE POLICY products_customer_read
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (active IS TRUE);

-- 4. Future objects created by `postgres` must not inherit public access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

COMMIT;
