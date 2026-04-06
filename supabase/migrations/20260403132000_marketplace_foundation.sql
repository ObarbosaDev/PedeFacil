ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS delivery_operation_mode TEXT NOT NULL DEFAULT 'own_fleet',
  ADD COLUMN IF NOT EXISTS auto_dispatch_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_marketplace_payments BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_meal_voucher BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS default_driver_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatch_timeout_seconds INTEGER NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'establishments_delivery_operation_mode_valid'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_delivery_operation_mode_valid
      CHECK (delivery_operation_mode IN ('own_fleet', 'shared_fleet', 'hybrid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'establishments_platform_fee_percent_valid'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_platform_fee_percent_valid
      CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'establishments_default_driver_payout_nonnegative'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_default_driver_payout_nonnegative
      CHECK (default_driver_payout >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'establishments_dispatch_timeout_seconds_valid'
  ) THEN
    ALTER TABLE public.establishments
      ADD CONSTRAINT establishments_dispatch_timeout_seconds_valid
      CHECK (dispatch_timeout_seconds BETWEEN 15 AND 300);
  END IF;
END $$;
