BEGIN;

-- ============================================
-- Operacao da loja (lotada / agendamento)
-- ============================================

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS busy_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS busy_pause_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS busy_message TEXT,
  ADD COLUMN IF NOT EXISTS accepts_scheduled_orders BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.establishment_growth_settings (
  establishment_id UUID PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  busy_eta_extra_minutes INTEGER NOT NULL DEFAULT 0,
  schedule_horizon_hours INTEGER NOT NULL DEFAULT 24,
  cashback_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_cashback_per_order NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT growth_busy_eta_nonnegative CHECK (busy_eta_extra_minutes >= 0),
  CONSTRAINT growth_schedule_horizon_valid CHECK (schedule_horizon_hours BETWEEN 1 AND 168),
  CONSTRAINT growth_cashback_percent_valid CHECK (cashback_percent >= 0 AND cashback_percent <= 100),
  CONSTRAINT growth_cashback_cap_nonnegative CHECK (max_cashback_per_order IS NULL OR max_cashback_per_order >= 0)
);

INSERT INTO public.establishment_growth_settings (establishment_id)
SELECT e.id
FROM public.establishments e
ON CONFLICT (establishment_id) DO NOTHING;

DROP TRIGGER IF EXISTS update_establishment_growth_settings_updated_at ON public.establishment_growth_settings;
CREATE TRIGGER update_establishment_growth_settings_updated_at
BEFORE UPDATE ON public.establishment_growth_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.establishment_growth_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own growth settings" ON public.establishment_growth_settings;
CREATE POLICY "Owners can view own growth settings"
  ON public.establishment_growth_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_growth_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage own growth settings" ON public.establishment_growth_settings;
CREATE POLICY "Owners can manage own growth settings"
  ON public.establishment_growth_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_growth_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_growth_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.establishment_delivery_time_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  fee_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
  eta_extra_minutes INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_time_rule_fee_delta_nonnegative CHECK (fee_delta >= 0),
  CONSTRAINT delivery_time_rule_eta_nonnegative CHECK (eta_extra_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_delivery_time_rules_establishment_active
  ON public.establishment_delivery_time_rules(establishment_id, is_active, priority DESC);

DROP TRIGGER IF EXISTS update_establishment_delivery_time_rules_updated_at ON public.establishment_delivery_time_rules;
CREATE TRIGGER update_establishment_delivery_time_rules_updated_at
BEFORE UPDATE ON public.establishment_delivery_time_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.establishment_delivery_time_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active delivery time rules" ON public.establishment_delivery_time_rules;
CREATE POLICY "Public can view active delivery time rules"
  ON public.establishment_delivery_time_rules FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Owners can manage own delivery time rules" ON public.establishment_delivery_time_rules;
CREATE POLICY "Owners can manage own delivery time rules"
  ON public.establishment_delivery_time_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_delivery_time_rules.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_delivery_time_rules.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS cashier_name TEXT,
  ADD COLUMN IF NOT EXISTS cashback_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_used NUMERIC(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_eta_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_eta_nonnegative CHECK (eta_minutes IS NULL OR eta_minutes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_source_channel_valid'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_source_channel_valid CHECK (source_channel IN ('app', 'attendant', 'whatsapp'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_cashback_earned_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_cashback_earned_nonnegative CHECK (cashback_earned >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_cashback_used_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_cashback_used_nonnegative CHECK (cashback_used >= 0);
  END IF;
END $$;

ALTER TABLE public.loyalty_accounts
  ADD COLUMN IF NOT EXISTS cashback_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loyalty_accounts_cashback_balance_nonnegative'
      AND conrelid = 'public.loyalty_accounts'::regclass
  ) THEN
    ALTER TABLE public.loyalty_accounts
      ADD CONSTRAINT loyalty_accounts_cashback_balance_nonnegative CHECK (cashback_balance >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_accept_new_order(
  p_establishment_id UUID
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  resume_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store public.establishments%ROWTYPE;
BEGIN
  SELECT e.*
  INTO v_store
  FROM public.establishments e
  WHERE e.id = p_establishment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Loja nao encontrada.', NULL::timestamptz;
    RETURN;
  END IF;

  IF v_store.busy_mode_enabled = true
     AND v_store.busy_pause_until IS NOT NULL
     AND v_store.busy_pause_until > now() THEN
    RETURN QUERY
    SELECT
      false,
      COALESCE(NULLIF(trim(v_store.busy_message), ''), 'Loja lotada no momento.'),
      v_store.busy_pause_until;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.can_accept_new_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_accept_new_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_order_operational_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_store public.establishments%ROWTYPE;
  v_growth public.establishment_growth_settings%ROWTYPE;
  v_now_local TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_rule public.establishment_delivery_time_rules%ROWTYPE;
  v_eta_extra INTEGER := 0;
BEGIN
  SELECT e.*
  INTO v_store
  FROM public.establishments e
  WHERE e.id = NEW.establishment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja nao encontrada.';
  END IF;

  SELECT g.*
  INTO v_growth
  FROM public.establishment_growth_settings g
  WHERE g.establishment_id = NEW.establishment_id;

  IF NEW.is_scheduled THEN
    IF NOT v_store.accepts_scheduled_orders THEN
      RAISE EXCEPTION 'Loja nao aceita pedidos agendados no momento.';
    END IF;

    IF NEW.scheduled_for IS NULL THEN
      RAISE EXCEPTION 'Horario agendado obrigatorio.';
    END IF;

    IF NEW.scheduled_for < now() + interval '15 minutes' THEN
      RAISE EXCEPTION 'Horario agendado precisa ter pelo menos 15 minutos de antecedencia.';
    END IF;

    IF NEW.scheduled_for > now() + make_interval(hours => COALESCE(v_growth.schedule_horizon_hours, 24)) THEN
      RAISE EXCEPTION 'Horario agendado fora da janela permitida pela loja.';
    END IF;
  ELSE
    NEW.scheduled_for := NULL;

    IF v_store.busy_mode_enabled = true
       AND v_store.busy_pause_until IS NOT NULL
       AND v_store.busy_pause_until > now() THEN
      RAISE EXCEPTION '%', COALESCE(NULLIF(trim(v_store.busy_message), ''), 'Loja lotada no momento.');
    END IF;
  END IF;

  SELECT r.*
  INTO v_rule
  FROM public.establishment_delivery_time_rules r
  WHERE r.establishment_id = NEW.establishment_id
    AND r.is_active = true
    AND (
      (r.start_time <= r.end_time AND v_now_local >= r.start_time AND v_now_local < r.end_time)
      OR
      (r.start_time > r.end_time AND (v_now_local >= r.start_time OR v_now_local < r.end_time))
    )
  ORDER BY r.priority DESC, r.created_at DESC
  LIMIT 1;

  v_eta_extra := COALESCE(v_growth.busy_eta_extra_minutes, 0) + COALESCE(v_rule.eta_extra_minutes, 0);
  NEW.eta_minutes := COALESCE(NEW.eta_minutes, 0) + GREATEST(v_eta_extra, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_operational_rules ON public.orders;
CREATE TRIGGER trg_enforce_order_operational_rules
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_operational_rules();

CREATE OR REPLACE FUNCTION public.apply_cashback_on_delivered_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_percent NUMERIC(5,2);
  v_cap NUMERIC(10,2);
  v_cashback NUMERIC(10,2);
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  SELECT g.cashback_percent, g.max_cashback_per_order
  INTO v_percent, v_cap
  FROM public.establishment_growth_settings g
  WHERE g.establishment_id = NEW.establishment_id;

  v_percent := COALESCE(v_percent, 0);
  IF v_percent <= 0 THEN
    RETURN NEW;
  END IF;

  v_cashback := round((COALESCE(NEW.subtotal, 0) * v_percent / 100.0)::numeric, 2);
  IF v_cap IS NOT NULL THEN
    v_cashback := LEAST(v_cashback, v_cap);
  END IF;
  v_cashback := GREATEST(v_cashback, 0);

  UPDATE public.orders
  SET cashback_earned = v_cashback
  WHERE id = NEW.id;

  IF NEW.customer_id IS NOT NULL AND v_cashback > 0 THEN
    INSERT INTO public.loyalty_accounts (customer_id, establishment_id, points, cashback_balance)
    VALUES (NEW.customer_id, NEW.establishment_id, 0, v_cashback)
    ON CONFLICT (customer_id, establishment_id)
    DO UPDATE SET cashback_balance = COALESCE(public.loyalty_accounts.cashback_balance, 0) + v_cashback;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_cashback_on_delivered_order ON public.orders;
CREATE TRIGGER trg_apply_cashback_on_delivered_order
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_cashback_on_delivered_order();

-- ============================================
-- Reputacao de entrega
-- ============================================

CREATE TABLE IF NOT EXISTS public.driver_delivery_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL UNIQUE REFERENCES public.order_deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_feedback_rating_valid CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_driver_feedback_driver_created
  ON public.driver_delivery_feedback(driver_id, created_at DESC);

ALTER TABLE public.driver_delivery_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view feedback from own store" ON public.driver_delivery_feedback;
CREATE POLICY "Owners can view feedback from own store"
  ON public.driver_delivery_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = driver_delivery_feedback.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated can insert driver feedback" ON public.driver_delivery_feedback;
CREATE POLICY "Authenticated can insert driver feedback"
  ON public.driver_delivery_feedback FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE VIEW public.driver_reputation_metrics AS
SELECT
  d.id AS driver_id,
  d.establishment_id,
  d.full_name,
  COUNT(od.id)::INTEGER AS deliveries_total,
  COUNT(*) FILTER (WHERE od.status = 'delivered')::INTEGER AS deliveries_completed,
  AVG(f.rating)::NUMERIC(10,2) AS avg_rating,
  COUNT(f.id)::INTEGER AS ratings_total,
  COUNT(*) FILTER (
    WHERE od.status = 'delivered'
      AND od.accepted_deadline_at IS NOT NULL
      AND od.accepted_at IS NOT NULL
      AND od.accepted_at > od.accepted_deadline_at
  )::INTEGER AS late_acceptances
FROM public.delivery_drivers d
LEFT JOIN public.order_deliveries od ON od.driver_id = d.id
LEFT JOIN public.driver_delivery_feedback f ON f.delivery_id = od.id
GROUP BY d.id, d.establishment_id, d.full_name;

-- ============================================
-- Pagamentos (ledger + reprocessamento + expiracao)
-- ============================================

CREATE TABLE IF NOT EXISTS public.payments_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  provider_payment_id TEXT,
  provider_event_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  amount_cents INTEGER,
  currency TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_ledger_checkout_processed
  ON public.payments_ledger(checkout_session_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_ledger_provider_payment
  ON public.payments_ledger(provider_name, provider_payment_id);

ALTER TABLE public.payments_ledger ENABLE ROW LEVEL SECURITY;

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
  );

CREATE OR REPLACE FUNCTION public.expire_pending_store_subscriptions(
  p_expire_after_minutes INTEGER DEFAULT 60
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

  UPDATE public.store_subscriptions s
  SET
    status = 'expired',
    updated_at = now()
  WHERE s.status = 'pending_payment'
    AND (
      (s.payment_expires_at IS NOT NULL AND s.payment_expires_at < now())
      OR
      (s.payment_expires_at IS NULL AND s.created_at < now() - make_interval(mins => p_expire_after_minutes))
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pending_store_subscriptions(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_pending_store_subscriptions(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.revalidate_plan_payment(
  p_checkout_session_id TEXT,
  p_provider_event_id TEXT,
  p_provider_name TEXT DEFAULT 'manual_revalidate',
  p_payload JSONB DEFAULT '{}'::jsonb
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
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.confirm_plan_payment_webhook(
    p_checkout_session_id,
    p_provider_event_id,
    p_provider_name,
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revalidate_plan_payment(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revalidate_plan_payment(TEXT, TEXT, TEXT, JSONB) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
