BEGIN;

ALTER TABLE public.store_subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_user_trial
  ON public.store_subscriptions(user_id, trial_started_at DESC)
  WHERE trial_started_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.start_store_trial(
  p_plan_slug TEXT DEFAULT 'profissional',
  p_trial_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  subscription_id UUID,
  checkout_session_id TEXT,
  plan_slug TEXT,
  billing_cycle public.plan_billing_cycle,
  status public.subscription_status,
  payment_method TEXT,
  amount_cents INTEGER,
  currency TEXT,
  payment_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_trial_days INTEGER := GREATEST(1, LEAST(COALESCE(p_trial_days, 30), 30));
  v_trial_end TIMESTAMPTZ := v_now + make_interval(days => v_trial_days);
  v_open_subscription public.store_subscriptions%ROWTYPE;
  v_amount_cents INTEGER;
  v_checkout_id TEXT := 'trl_' || replace(gen_random_uuid()::text, '-', '');
  v_target_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF p_plan_slug NOT IN ('essencial', 'profissional', 'premium') THEN
    RAISE EXCEPTION 'Plano invalido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.store_subscriptions s
    WHERE s.user_id = v_user_id
      AND s.trial_started_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Seu periodo de teste gratis ja foi utilizado nesta conta.';
  END IF;

  v_amount_cents := public.get_plan_price_cents(p_plan_slug, 'monthly');

  SELECT s.*
  INTO v_open_subscription
  FROM public.store_subscriptions s
  WHERE s.user_id = v_user_id
    AND s.status IN ('pending_payment', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_open_subscription.status = 'active' THEN
    RETURN QUERY
    SELECT
      v_open_subscription.id,
      v_open_subscription.checkout_session_id,
      v_open_subscription.plan_slug,
      v_open_subscription.billing_cycle,
      v_open_subscription.status,
      v_open_subscription.payment_method,
      v_open_subscription.amount_cents,
      v_open_subscription.currency,
      v_open_subscription.payment_expires_at;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.store_subscriptions s
    SET
      plan_slug = p_plan_slug,
      billing_cycle = 'monthly',
      status = 'active',
      payment_method = 'pix',
      checkout_session_id = v_checkout_id,
      provider_name = 'trial_30d',
      provider_reference = NULL,
      provider_event_id = NULL,
      amount_cents = v_amount_cents,
      currency = 'BRL',
      payment_expires_at = NULL,
      paid_at = v_now,
      current_period_start = v_now,
      current_period_end = v_trial_end,
      canceled_at = NULL,
      trial_started_at = v_now,
      trial_ends_at = v_trial_end,
      metadata = COALESCE(s.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'source', 'trial_30_days',
          'is_trial', true,
          'trial_days', v_trial_days,
          'trial_started_at', v_now,
          'trial_ends_at', v_trial_end
        )
    WHERE s.id = v_open_subscription.id
    RETURNING s.id INTO v_target_id;
  ELSE
    INSERT INTO public.store_subscriptions (
      user_id,
      plan_slug,
      billing_cycle,
      status,
      payment_method,
      checkout_session_id,
      provider_name,
      amount_cents,
      currency,
      payment_expires_at,
      paid_at,
      current_period_start,
      current_period_end,
      trial_started_at,
      trial_ends_at,
      metadata
    )
    VALUES (
      v_user_id,
      p_plan_slug,
      'monthly',
      'active',
      'pix',
      v_checkout_id,
      'trial_30d',
      v_amount_cents,
      'BRL',
      NULL,
      v_now,
      v_now,
      v_trial_end,
      v_now,
      v_trial_end,
      jsonb_build_object(
        'source', 'trial_30_days',
        'is_trial', true,
        'trial_days', v_trial_days,
        'trial_started_at', v_now,
        'trial_ends_at', v_trial_end
      )
    )
    RETURNING id INTO v_target_id;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.checkout_session_id,
    s.plan_slug,
    s.billing_cycle,
    s.status,
    s.payment_method,
    s.amount_cents,
    s.currency,
    s.payment_expires_at
  FROM public.store_subscriptions s
  WHERE s.id = v_target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_store_trial(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_store_trial(TEXT, INTEGER) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

