BEGIN;

-- Reparo defensivo da RPC de checkout de planos.
-- Motivo: evitar falhas de "function not found in schema cache" em ambientes
-- onde a migration base nao foi aplicada corretamente ou o cache ficou desatualizado.

CREATE OR REPLACE FUNCTION public.start_plan_checkout(
  p_plan_slug TEXT,
  p_billing_cycle public.plan_billing_cycle,
  p_payment_method TEXT DEFAULT 'pix'
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
  v_open_subscription public.store_subscriptions%ROWTYPE;
  v_amount_cents INTEGER;
  v_checkout_id TEXT;
  v_expires_at TIMESTAMPTZ := now() + interval '30 minutes';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF p_payment_method NOT IN ('pix', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento invalida.';
  END IF;

  v_amount_cents := public.get_plan_price_cents(p_plan_slug, p_billing_cycle);

  SELECT *
  INTO v_open_subscription
  FROM public.store_subscriptions s
  WHERE s.user_id = v_user_id
    AND s.status IN ('pending_payment', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF FOUND AND v_open_subscription.status = 'active' THEN
    RETURN QUERY
    SELECT
      v_open_subscription.id,
      COALESCE(v_open_subscription.checkout_session_id, ''),
      v_open_subscription.plan_slug,
      v_open_subscription.billing_cycle,
      v_open_subscription.status,
      v_open_subscription.payment_method,
      v_open_subscription.amount_cents,
      v_open_subscription.currency,
      v_open_subscription.payment_expires_at;
    RETURN;
  END IF;

  v_checkout_id := 'chk_' || replace(gen_random_uuid()::text, '-', '');

  IF FOUND THEN
    UPDATE public.store_subscriptions
    SET
      plan_slug = p_plan_slug,
      billing_cycle = p_billing_cycle,
      payment_method = p_payment_method,
      checkout_session_id = v_checkout_id,
      status = 'pending_payment',
      provider_name = 'internal_demo',
      provider_reference = NULL,
      provider_event_id = NULL,
      amount_cents = v_amount_cents,
      currency = 'BRL',
      payment_expires_at = v_expires_at,
      paid_at = NULL,
      current_period_start = NULL,
      current_period_end = NULL,
      canceled_at = NULL,
      metadata = jsonb_build_object('source', 'plans_checkout', 'generated_at', now())
    WHERE id = v_open_subscription.id;

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
    WHERE s.id = v_open_subscription.id;

    RETURN;
  END IF;

  RETURN QUERY
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
    metadata
  )
  VALUES (
    v_user_id,
    p_plan_slug,
    p_billing_cycle,
    'pending_payment',
    p_payment_method,
    v_checkout_id,
    'internal_demo',
    v_amount_cents,
    'BRL',
    v_expires_at,
    jsonb_build_object('source', 'plans_checkout', 'generated_at', now())
  )
  RETURNING
    id,
    checkout_session_id,
    plan_slug,
    billing_cycle,
    status,
    payment_method,
    amount_cents,
    currency,
    payment_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.start_plan_checkout(TEXT, public.plan_billing_cycle, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_plan_checkout(TEXT, public.plan_billing_cycle, TEXT) TO authenticated;

-- Forca recarga do cache de schema do PostgREST
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

