BEGIN;

ALTER TABLE IF EXISTS public.subscription_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.payments_ledger FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_payment_sessions FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.subscription_webhook_events FROM anon, authenticated;

DROP POLICY IF EXISTS "Customers can view own order payment sessions" ON public.order_payment_sessions;
CREATE POLICY "Customers can view own order payment sessions"
  ON public.order_payment_sessions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Store owners can view order payment sessions from own establishments" ON public.order_payment_sessions;
CREATE POLICY "Store owners can view order payment sessions from own establishments"
  ON public.order_payment_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = order_payment_sessions.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can view own payments ledger" ON public.payments_ledger;
CREATE POLICY "Owners can view own payments ledger"
  ON public.payments_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.store_subscriptions s
      WHERE s.checkout_session_id = payments_ledger.checkout_session_id
        AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_payment_sessions ops
      JOIN public.establishments e ON e.id = ops.establishment_id
      WHERE ops.checkout_session_id = payments_ledger.checkout_session_id
        AND e.owner_id = auth.uid()
    )
  );

COMMIT;
