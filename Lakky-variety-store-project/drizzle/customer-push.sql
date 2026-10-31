-- ============================================================================
-- Customer phone notifications (Web Push)
-- Project: xvndgihoazznycssakbj
-- Safe to re-run.
--
-- One row per phone/browser that agreed to receive notifications. A customer
-- can have several (phone + laptop). Rows are deleted when they switch it off
-- or when the phone reports the subscription is gone.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_push_subscriptions (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_push_subscriptions_customer_idx
  ON public.customer_push_subscriptions (customer_id);

-- Same lockdown rules as every other table: RLS on, no public access.
ALTER TABLE public.customer_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_push_subscriptions FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.customer_push_subscriptions_id_seq FROM anon, authenticated, PUBLIC;

COMMIT;
