BEGIN;

CREATE TABLE IF NOT EXISTS public.order_payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  checkout_session_id TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL DEFAULT 'mercado_pago',
  provider_reference TEXT,
  provider_event_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'failed', 'expired', 'canceled')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payment_sessions_user_created
  ON public.order_payment_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_payment_sessions_establishment_status
  ON public.order_payment_sessions(establishment_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_order_payment_sessions_updated_at ON public.order_payment_sessions;
CREATE TRIGGER update_order_payment_sessions_updated_at
BEFORE UPDATE ON public.order_payment_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_payment_sessions ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.start_order_checkout(
  p_order_id UUID,
  p_payment_method TEXT DEFAULT 'pix'
)
RETURNS TABLE (
  order_id UUID,
  checkout_session_id TEXT,
  status TEXT,
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
  v_order public.orders%ROWTYPE;
  v_establishment public.establishments%ROWTYPE;
  v_session public.order_payment_sessions%ROWTYPE;
  v_checkout_session_id TEXT;
  v_expires_at TIMESTAMPTZ := now() + interval '30 minutes';
  v_amount_cents INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF p_payment_method NOT IN ('pix', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento invalida para checkout no app.';
  END IF;

  SELECT o.*
  INTO v_order
  FROM public.orders o
  JOIN public.customer_order_links col ON col.order_id = o.id
  WHERE o.id = p_order_id
    AND col.user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido nao encontrado para esta conta.';
  END IF;

  SELECT *
  INTO v_establishment
  FROM public.establishments e
  WHERE e.id = v_order.establishment_id
  LIMIT 1;

  IF NOT COALESCE(v_establishment.accepts_marketplace_payments, false) THEN
    RAISE EXCEPTION 'Esta loja nao esta com pagamento no app liberado.';
  END IF;

  v_amount_cents := round(COALESCE(v_order.total, 0) * 100);
  IF COALESCE(v_amount_cents, 0) <= 0 THEN
    RAISE EXCEPTION 'Valor do pedido invalido para pagamento.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.order_payment_sessions ops
  WHERE ops.order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_checkout_session_id := 'ordpay_' || replace(gen_random_uuid()::text, '-', '');

    INSERT INTO public.order_payment_sessions (
      order_id,
      user_id,
      establishment_id,
      checkout_session_id,
      payment_method,
      status,
      amount_cents,
      currency,
      payment_expires_at,
      metadata
    )
    VALUES (
      v_order.id,
      v_user_id,
      v_order.establishment_id,
      v_checkout_session_id,
      p_payment_method,
      CASE WHEN v_order.payment_status = 'paid' THEN 'paid' ELSE 'pending_payment' END,
      v_amount_cents,
      'BRL',
      CASE WHEN v_order.payment_status = 'paid' THEN NULL ELSE v_expires_at END,
      jsonb_build_object(
        'order_total', v_order.total,
        'order_type', v_order.order_type,
        'customer_name', v_order.customer_name
      )
    )
    RETURNING * INTO v_session;
  ELSE
    UPDATE public.order_payment_sessions ops
    SET
      payment_method = p_payment_method,
      amount_cents = v_amount_cents,
      currency = 'BRL',
      status = CASE WHEN v_order.payment_status = 'paid' THEN 'paid' ELSE 'pending_payment' END,
      payment_expires_at = CASE WHEN v_order.payment_status = 'paid' THEN ops.payment_expires_at ELSE v_expires_at END,
      metadata = COALESCE(ops.metadata, '{}'::jsonb) || jsonb_build_object(
        'order_total', v_order.total,
        'order_type', v_order.order_type,
        'customer_name', v_order.customer_name
      ),
      updated_at = now()
    WHERE ops.id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  IF v_order.payment_status <> 'paid' THEN
    UPDATE public.orders
    SET
      payment_status = 'pending',
      updated_at = now()
    WHERE id = v_order.id;
  END IF;

  RETURN QUERY
  SELECT
    v_session.order_id,
    v_session.checkout_session_id,
    v_session.status,
    v_session.payment_method,
    v_session.amount_cents,
    v_session.currency,
    v_session.payment_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.start_order_checkout(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_order_checkout(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_order_payment_webhook(
  p_checkout_session_id TEXT,
  p_provider_event_id TEXT,
  p_provider_name TEXT DEFAULT 'mercado_pago',
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  order_id UUID,
  payment_status public.order_payment_status,
  processed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.order_payment_sessions%ROWTYPE;
  v_payment_status public.order_payment_status := 'pending'::public.order_payment_status;
BEGIN
  IF COALESCE(trim(p_checkout_session_id), '') = '' THEN
    RAISE EXCEPTION 'Checkout session obrigatoria.';
  END IF;

  IF COALESCE(trim(p_provider_event_id), '') = '' THEN
    RAISE EXCEPTION 'Provider event id obrigatorio.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.order_payment_sessions ops
  WHERE ops.checkout_session_id = trim(p_checkout_session_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order checkout session nao encontrada.';
  END IF;

  IF v_session.status = 'paid' THEN
    SELECT o.payment_status INTO v_payment_status
    FROM public.orders o
    WHERE o.id = v_session.order_id;

    RETURN QUERY SELECT v_session.order_id, COALESCE(v_payment_status, 'paid'::public.order_payment_status), false;
    RETURN;
  END IF;

  UPDATE public.order_payment_sessions ops
  SET
    status = 'paid',
    provider_name = COALESCE(NULLIF(trim(p_provider_name), ''), ops.provider_name),
    provider_event_id = trim(p_provider_event_id),
    paid_at = now(),
    payment_expires_at = NULL,
    metadata = COALESCE(ops.metadata, '{}'::jsonb) || jsonb_build_object('webhook_payload', COALESCE(p_payload, '{}'::jsonb)),
    updated_at = now()
  WHERE ops.id = v_session.id;

  UPDATE public.orders o
  SET
    payment_status = 'paid',
    updated_at = now()
  WHERE o.id = v_session.order_id;

  RETURN QUERY SELECT v_session.order_id, 'paid'::public.order_payment_status, true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_payment_webhook(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment_webhook(TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.revalidate_order_payment(
  p_checkout_session_id TEXT,
  p_provider_event_id TEXT,
  p_provider_name TEXT DEFAULT 'manual_revalidate',
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  order_id UUID,
  payment_status public.order_payment_status,
  processed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.confirm_order_payment_webhook(
    p_checkout_session_id,
    p_provider_event_id,
    p_provider_name,
    p_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revalidate_order_payment(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revalidate_order_payment(TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_pending_order_payment_sessions(
  p_expire_after_minutes INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF p_expire_after_minutes < 5 THEN
    p_expire_after_minutes := 5;
  END IF;

  UPDATE public.order_payment_sessions ops
  SET
    status = 'expired',
    updated_at = now()
  WHERE ops.status = 'pending_payment'
    AND (
      (ops.payment_expires_at IS NOT NULL AND ops.payment_expires_at < now())
      OR
      (ops.payment_expires_at IS NULL AND ops.created_at < now() - make_interval(mins => p_expire_after_minutes))
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pending_order_payment_sessions(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_pending_order_payment_sessions(INTEGER) TO authenticated;

COMMIT;
