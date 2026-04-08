BEGIN;

CREATE OR REPLACE FUNCTION public.rollover_expired_trials_to_pending_payment(
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
      AND s.trial_started_at IS NOT NULL
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at <= now()
    ORDER BY s.trial_ends_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.store_subscriptions s
    SET
      status = 'pending_payment',
      payment_method = COALESCE(NULLIF(s.payment_method, ''), 'pix'),
      checkout_session_id = 'chk_' || replace(gen_random_uuid()::text, '-', ''),
      provider_name = 'mercado_pago',
      provider_reference = NULL,
      provider_event_id = NULL,
      payment_expires_at = now() + interval '30 minutes',
      paid_at = NULL,
      current_period_start = NULL,
      current_period_end = NULL,
      metadata = COALESCE(s.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'trial_converted_to_pending', true,
          'trial_converted_at', now(),
          'source', 'trial_auto_rollover'
        )
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rollover_expired_trials_to_pending_payment(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollover_expired_trials_to_pending_payment(INTEGER) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

