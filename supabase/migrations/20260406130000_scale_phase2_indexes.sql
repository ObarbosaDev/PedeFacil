BEGIN;

-- Checkout e painel operacional: filtros por loja + pagamento + status
CREATE INDEX IF NOT EXISTS idx_orders_establishment_payment_status_created
  ON public.orders(establishment_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_establishment_type_status_created
  ON public.orders(establishment_id, order_type, status, created_at DESC);

-- Sessões de pagamento: lookup rápido de pendências e expiração
CREATE INDEX IF NOT EXISTS idx_order_payment_sessions_pending_expires
  ON public.order_payment_sessions(payment_expires_at)
  WHERE status = 'pending_payment';

CREATE INDEX IF NOT EXISTS idx_order_payment_sessions_establishment_created
  ON public.order_payment_sessions(establishment_id, created_at DESC);

-- Ledger: leitura por timeline e reconciliação por sessão
CREATE INDEX IF NOT EXISTS idx_payments_ledger_checkout_created
  ON public.payments_ledger(checkout_session_id, created_at DESC);

-- Entregas: painel de loja e painel de entregador
CREATE INDEX IF NOT EXISTS idx_order_deliveries_establishment_status_assigned
  ON public.order_deliveries(establishment_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_driver_status_assigned
  ON public.order_deliveries(driver_id, status, assigned_at DESC);

COMMIT;
