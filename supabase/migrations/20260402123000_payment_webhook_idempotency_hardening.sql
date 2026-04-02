BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_plan_payment_webhook(
  p_checkout_session_id TEXT,
  p_provider_event_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_provider_name TEXT DEFAULT 'internal_demo'
)
RETURNS TABLE (
  subscription_id UUID,
  status public.subscription_status,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub public.store_subscriptions%ROWTYPE;
  v_period_start TIMESTAMPTZ := now();
  v_period_end TIMESTAMPTZ;
  v_checkout_session_id TEXT;
  v_provider_event_id TEXT;
  v_provider_name TEXT;
  v_inserted_event_id UUID;
  v_existing_event_checkout_session_id TEXT;
BEGIN
  v_checkout_session_id := trim(COALESCE(p_checkout_session_id, ''));
  v_provider_event_id := lower(trim(COALESCE(p_provider_event_id, '')));
  v_provider_name := lower(trim(COALESCE(NULLIF(p_provider_name, ''), 'internal_demo')));

  IF v_checkout_session_id = '' THEN
    RAISE EXCEPTION 'Checkout session invalida.';
  END IF;

  IF v_provider_event_id = '' THEN
    RAISE EXCEPTION 'Provider event id obrigatorio.';
  END IF;

  SELECT *
  INTO v_sub
  FROM public.store_subscriptions s
  WHERE s.checkout_session_id = v_checkout_session_id
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura nao encontrada para a sessao informada.';
  END IF;

  IF v_user_id IS NOT NULL AND v_sub.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissao para confirmar esta assinatura.';
  END IF;

  INSERT INTO public.subscription_webhook_events (
    provider_name,
    provider_event_id,
    checkout_session_id,
    payload
  )
  VALUES (
    v_provider_name,
    v_provider_event_id,
    v_checkout_session_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (provider_name, provider_event_id) DO NOTHING
  RETURNING id INTO v_inserted_event_id;

  IF v_inserted_event_id IS NULL THEN
    SELECT e.checkout_session_id
    INTO v_existing_event_checkout_session_id
    FROM public.subscription_webhook_events e
    WHERE e.provider_name = v_provider_name
      AND e.provider_event_id = v_provider_event_id
    LIMIT 1;

    IF v_existing_event_checkout_session_id IS NOT NULL
       AND v_existing_event_checkout_session_id <> v_checkout_session_id THEN
      RAISE EXCEPTION 'Evento de pagamento ja foi utilizado em outra sessao.';
    END IF;

    RETURN QUERY
    SELECT s.id, s.status, s.current_period_end
    FROM public.store_subscriptions s
    WHERE s.id = v_sub.id;
    RETURN;
  END IF;

  IF v_sub.billing_cycle = 'monthly' THEN
    v_period_end := v_period_start + interval '1 month';
  ELSE
    v_period_end := v_period_start + interval '1 year';
  END IF;

  IF v_sub.status <> 'active' THEN
    UPDATE public.store_subscriptions
    SET
      status = 'active',
      provider_name = v_provider_name,
      provider_event_id = v_provider_event_id,
      paid_at = now(),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      metadata = COALESCE(v_sub.metadata, '{}'::jsonb) || jsonb_build_object('last_webhook_at', now())
    WHERE id = v_sub.id;
  END IF;

  RETURN QUERY
  SELECT s.id, s.status, s.current_period_end
  FROM public.store_subscriptions s
  WHERE s.id = v_sub.id;
END;
$$;

COMMIT;

