BEGIN;

CREATE OR REPLACE FUNCTION public.ops_subscription_reconciliation_snapshot(
  p_lookback_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  generated_at TIMESTAMPTZ,
  pending_over_2h INTEGER,
  active_expired_count INTEGER,
  trial_expired_still_active INTEGER,
  approved_payments_lookback INTEGER,
  failed_payments_lookback INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours INTEGER := GREATEST(1, LEAST(COALESCE(p_lookback_hours, 24), 168));
BEGIN
  RETURN QUERY
  SELECT
    now() AS generated_at,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.store_subscriptions s
      WHERE s.status = 'pending_payment'
        AND COALESCE(s.payment_expires_at, s.updated_at, s.created_at) <= now() - interval '2 hours'
    ) AS pending_over_2h,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.store_subscriptions s
      WHERE s.status = 'active'
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end <= now()
    ) AS active_expired_count,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.store_subscriptions s
      WHERE s.status = 'active'
        AND s.trial_started_at IS NOT NULL
        AND s.trial_ends_at IS NOT NULL
        AND s.trial_ends_at <= now()
    ) AS trial_expired_still_active,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.payments_ledger l
      WHERE lower(COALESCE(l.status, '')) = 'approved'
        AND l.created_at >= now() - make_interval(hours => v_hours)
    ) AS approved_payments_lookback,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.payments_ledger l
      WHERE lower(COALESCE(l.status, '')) IN ('rejected', 'failed', 'cancelled', 'canceled')
        AND l.created_at >= now() - make_interval(hours => v_hours)
    ) AS failed_payments_lookback;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_subscription_reconciliation_snapshot(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_subscription_reconciliation_snapshot(INTEGER) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

