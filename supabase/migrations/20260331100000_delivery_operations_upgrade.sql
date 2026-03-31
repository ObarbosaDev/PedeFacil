BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_driver_mode') THEN
    CREATE TYPE public.delivery_driver_mode AS ENUM ('online', 'busy', 'paused', 'offline');
  END IF;
END $$;

ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS availability_mode public.delivery_driver_mode NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS max_active_deliveries INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payout_per_delivery NUMERIC(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'delivery_drivers_max_active_positive'
      AND conrelid = 'public.delivery_drivers'::regclass
  ) THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT delivery_drivers_max_active_positive CHECK (max_active_deliveries >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'delivery_drivers_payout_nonnegative'
      AND conrelid = 'public.delivery_drivers'::regclass
  ) THEN
    ALTER TABLE public.delivery_drivers
      ADD CONSTRAINT delivery_drivers_payout_nonnegative CHECK (payout_per_delivery >= 0);
  END IF;
END $$;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS accepted_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at_store_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_token TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_code TEXT,
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS issue_reason TEXT;

UPDATE public.order_deliveries
SET accepted_deadline_at = COALESCE(accepted_deadline_at, assigned_at + interval '5 minutes')
WHERE accepted_deadline_at IS NULL;

UPDATE public.order_deliveries
SET tracking_token = COALESCE(tracking_token, encode(gen_random_bytes(8), 'hex'))
WHERE tracking_token IS NULL;

UPDATE public.order_deliveries
SET confirmation_code = COALESCE(confirmation_code, lpad((floor(random() * 10000))::int::text, 4, '0'))
WHERE confirmation_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_deliveries_tracking_token
  ON public.order_deliveries(tracking_token);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_deliveries_eta_positive'
      AND conrelid = 'public.order_deliveries'::regclass
  ) THEN
    ALTER TABLE public.order_deliveries
      ADD CONSTRAINT order_deliveries_eta_positive CHECK (eta_minutes IS NULL OR eta_minutes > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_deliveries_payout_nonnegative'
      AND conrelid = 'public.order_deliveries'::regclass
  ) THEN
    ALTER TABLE public.order_deliveries
      ADD CONSTRAINT order_deliveries_payout_nonnegative CHECK (payout_amount >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_delivery_tracking(p_tracking_token TEXT)
RETURNS TABLE (
  delivery_id UUID,
  tracking_token TEXT,
  delivery_status public.delivery_status,
  confirmation_code TEXT,
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  arrived_at_store_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  eta_minutes INTEGER,
  issue_reason TEXT,
  customer_name TEXT,
  order_total NUMERIC,
  establishment_name TEXT,
  driver_name TEXT,
  driver_phone TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    od.id AS delivery_id,
    od.tracking_token,
    od.status AS delivery_status,
    od.confirmation_code,
    od.assigned_at,
    od.accepted_at,
    od.arrived_at_store_at,
    od.picked_up_at,
    od.delivered_at,
    od.eta_minutes,
    od.issue_reason,
    o.customer_name,
    o.total AS order_total,
    e.name AS establishment_name,
    d.full_name AS driver_name,
    d.phone AS driver_phone
  FROM public.order_deliveries od
  JOIN public.orders o ON o.id = od.order_id
  JOIN public.establishments e ON e.id = od.establishment_id
  JOIN public.delivery_drivers d ON d.id = od.driver_id
  WHERE od.tracking_token = p_tracking_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_tracking(TEXT) TO anon, authenticated;

COMMIT;
