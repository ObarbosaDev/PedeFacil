BEGIN;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid')),
  ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_batch_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_order_deliveries_driver_payout_status
  ON public.order_deliveries(driver_id, payout_status, delivered_at DESC);

UPDATE public.order_deliveries
SET payout_status = COALESCE(payout_status, 'pending')
WHERE payout_status IS NULL;

COMMIT;
