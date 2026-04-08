BEGIN;

CREATE OR REPLACE FUNCTION public.expire_overdue_active_subscriptions(
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  processed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
  v_count INTEGER := 0;
BEGIN
  WITH candidates AS (
    SELECT s.id
    FROM public.store_subscriptions s
    WHERE s.status = 'active'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end <= now()
      AND (
        s.trial_started_at IS NULL
        OR s.trial_ends_at IS NULL
        OR s.current_period_end > s.trial_ends_at
      )
    ORDER BY s.current_period_end ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.store_subscriptions s
    SET
      status = 'expired',
      metadata = COALESCE(s.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'auto_expired', true,
          'auto_expired_at', now(),
          'source', 'subscription_lifecycle_job'
        )
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN QUERY SELECT v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_pending_subscriptions(
  p_limit INTEGER DEFAULT 200,
  p_max_pending_minutes INTEGER DEFAULT 120
)
RETURNS TABLE (
  processed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
  v_max_pending_minutes INTEGER := GREATEST(15, LEAST(COALESCE(p_max_pending_minutes, 120), 10080));
  v_cutoff TIMESTAMPTZ := now() - make_interval(mins => v_max_pending_minutes);
  v_count INTEGER := 0;
BEGIN
  WITH candidates AS (
    SELECT s.id
    FROM public.store_subscriptions s
    WHERE s.status = 'pending_payment'
      AND COALESCE(s.payment_expires_at, s.updated_at, s.created_at) <= v_cutoff
    ORDER BY COALESCE(s.payment_expires_at, s.updated_at, s.created_at) ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.store_subscriptions s
    SET
      status = 'expired',
      metadata = COALESCE(s.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'auto_expired_pending', true,
          'auto_expired_pending_at', now(),
          'source', 'subscription_lifecycle_job'
        )
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_active_subscriptions(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_pending_subscriptions(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_active_subscriptions(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_pending_subscriptions(INTEGER, INTEGER) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

