BEGIN;

-- Indices para consultas criticas em escala
CREATE INDEX IF NOT EXISTS idx_orders_establishment_status_created
  ON public.orders(establishment_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_establishment_created
  ON public.orders(establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders(customer_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_changed
  ON public.order_status_history(order_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_establishment_deadline
  ON public.order_deliveries(establishment_id, accepted_deadline_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_establishment_status_created
  ON public.whatsapp_automation_events(establishment_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkout_events_establishment_created
  ON public.checkout_events(establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_created
  ON public.audit_logs(entity_type, created_at DESC);

-- Rate limit simples para fluxos criticos
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  action_key TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (action_key, subject_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window
  ON public.api_rate_limits(window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct read api rate limits" ON public.api_rate_limits;
CREATE POLICY "No direct read api rate limits"
  ON public.api_rate_limits FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "No direct write api rate limits" ON public.api_rate_limits;
CREATE POLICY "No direct write api rate limits"
  ON public.api_rate_limits FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_action_key TEXT,
  p_subject_key TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_hits INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ;
  v_hits INTEGER;
  v_retry_after INTEGER;
BEGIN
  IF COALESCE(trim(p_action_key), '') = '' THEN
    RAISE EXCEPTION 'Acao de rate limit obrigatoria.';
  END IF;

  IF COALESCE(trim(p_subject_key), '') = '' THEN
    RAISE EXCEPTION 'Identificador de rate limit obrigatorio.';
  END IF;

  IF p_max_hits <= 0 THEN
    RAISE EXCEPTION 'Max hits deve ser maior que zero.';
  END IF;

  IF p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'Janela de rate limit invalida.';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.api_rate_limits (action_key, subject_key, window_start, hits, created_at, updated_at)
  VALUES (p_action_key, p_subject_key, v_window_start, 1, v_now, v_now)
  ON CONFLICT (action_key, subject_key, window_start)
  DO UPDATE SET
    hits = public.api_rate_limits.hits + 1,
    updated_at = excluded.updated_at
  RETURNING hits INTO v_hits;

  IF v_hits > p_max_hits THEN
    v_retry_after := GREATEST(
      1,
      p_window_seconds - floor(extract(epoch FROM (v_now - v_window_start)))::INTEGER
    );
    RETURN QUERY SELECT false, v_hits, v_retry_after;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_hits, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated, anon;

-- limpeza best effort de janelas antigas (30 dias)
DELETE FROM public.api_rate_limits
WHERE window_start < now() - interval '30 days';

COMMIT;

