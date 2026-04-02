-- Subscription and billing core for store owner access control
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_billing_cycle') THEN
    CREATE TYPE public.plan_billing_cycle AS ENUM ('monthly', 'yearly');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('pending_payment', 'active', 'past_due', 'canceled', 'expired');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL CHECK (plan_slug IN ('essencial', 'profissional', 'premium')),
  billing_cycle public.plan_billing_cycle NOT NULL DEFAULT 'monthly',
  status public.subscription_status NOT NULL DEFAULT 'pending_payment',
  payment_method TEXT NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'card')),
  checkout_session_id TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL DEFAULT 'internal_demo',
  provider_reference TEXT,
  provider_event_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  pix_code TEXT,
  pix_qr_url TEXT,
  payment_expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_subscriptions_user_open
  ON public.store_subscriptions(user_id)
  WHERE status IN ('pending_payment', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_user_created
  ON public.store_subscriptions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status_period
  ON public.store_subscriptions(status, current_period_end DESC);

DROP TRIGGER IF EXISTS update_store_subscriptions_updated_at ON public.store_subscriptions;
CREATE TRIGGER update_store_subscriptions_updated_at
BEFORE UPDATE ON public.store_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subscription_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  checkout_session_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_name, provider_event_id)
);

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own store subscriptions" ON public.store_subscriptions;
CREATE POLICY "Users can view own store subscriptions"
  ON public.store_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct read on subscription webhook events" ON public.subscription_webhook_events;
CREATE POLICY "No direct read on subscription webhook events"
  ON public.subscription_webhook_events FOR SELECT
  USING (false);

CREATE OR REPLACE FUNCTION public.get_plan_price_cents(
  p_plan_slug TEXT,
  p_billing_cycle public.plan_billing_cycle
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_plan_slug = 'essencial' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 7900 ELSE 6300 END;
  ELSIF p_plan_slug = 'profissional' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 14900 ELSE 11900 END;
  ELSIF p_plan_slug = 'premium' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 24900 ELSE 19900 END;
  END IF;

  RAISE EXCEPTION 'Plano inválido: %', p_plan_slug;
END;
$$;

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
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_payment_method NOT IN ('pix', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
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
BEGIN
  IF COALESCE(trim(p_checkout_session_id), '') = '' THEN
    RAISE EXCEPTION 'Checkout session inválida.';
  END IF;

  IF COALESCE(trim(p_provider_event_id), '') = '' THEN
    RAISE EXCEPTION 'Provider event id é obrigatório.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscription_webhook_events e
    WHERE e.provider_name = p_provider_name
      AND e.provider_event_id = p_provider_event_id
  ) THEN
    RETURN QUERY
    SELECT s.id, s.status, s.current_period_end
    FROM public.store_subscriptions s
    WHERE s.checkout_session_id = p_checkout_session_id
    ORDER BY s.created_at DESC
    LIMIT 1;
    RETURN;
  END IF;

  SELECT *
  INTO v_sub
  FROM public.store_subscriptions s
  WHERE s.checkout_session_id = p_checkout_session_id
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada para checkout session: %', p_checkout_session_id;
  END IF;

  IF v_user_id IS NOT NULL AND v_sub.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissão para confirmar esta assinatura.';
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
      provider_name = p_provider_name,
      provider_event_id = p_provider_event_id,
      paid_at = now(),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      metadata = COALESCE(v_sub.metadata, '{}'::jsonb) || jsonb_build_object('last_webhook_at', now())
    WHERE id = v_sub.id;
  END IF;

  INSERT INTO public.subscription_webhook_events (
    provider_name,
    provider_event_id,
    checkout_session_id,
    payload
  )
  VALUES (
    p_provider_name,
    p_provider_event_id,
    p_checkout_session_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (provider_name, provider_event_id) DO NOTHING;

  RETURN QUERY
  SELECT s.id, s.status, s.current_period_end
  FROM public.store_subscriptions s
  WHERE s.id = v_sub.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_store_subscription()
RETURNS TABLE (
  subscription_id UUID,
  plan_slug TEXT,
  billing_cycle public.plan_billing_cycle,
  status public.subscription_status,
  payment_method TEXT,
  checkout_session_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  paid_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  payment_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.plan_slug,
    s.billing_cycle,
    s.status,
    s.payment_method,
    s.checkout_session_id,
    s.amount_cents,
    s.currency,
    s.paid_at,
    s.current_period_end,
    s.payment_expires_at,
    s.created_at
  FROM public.store_subscriptions s
  WHERE s.user_id = auth.uid()
  ORDER BY
    CASE s.status
      WHEN 'active' THEN 1
      WHEN 'pending_payment' THEN 2
      WHEN 'past_due' THEN 3
      WHEN 'canceled' THEN 4
      WHEN 'expired' THEN 5
      ELSE 6
    END,
    s.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_store_panel(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;
