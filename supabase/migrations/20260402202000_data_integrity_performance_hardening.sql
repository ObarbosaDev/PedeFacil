BEGIN;

-- Remove duplicidades antigas para permitir constraints de unicidade sem falhar.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id, establishment_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.loyalty_accounts
)
DELETE FROM public.loyalty_accounts t
USING ranked r
WHERE t.ctid = r.ctid
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, order_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.customer_order_links
)
DELETE FROM public.customer_order_links t
USING ranked r
WHERE t.ctid = r.ctid
  AND r.rn > 1;

-- Garante idempotência em saldo/cashback por cliente+loja.
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_accounts_customer_establishment
  ON public.loyalty_accounts(customer_id, establishment_id);

-- Evita vínculo duplicado do mesmo pedido para o mesmo cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_order_links_user_order
  ON public.customer_order_links(user_id, order_id);

-- Índices de leitura crítica para operação diária.
CREATE INDEX IF NOT EXISTS idx_orders_establishment_status_created
  ON public.orders(establishment_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_driver_status_assigned
  ON public.order_deliveries(driver_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_status_created
  ON public.whatsapp_automation_events(status, created_at);

NOTIFY pgrst, 'reload schema';

COMMIT;
