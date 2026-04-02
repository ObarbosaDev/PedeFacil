BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_payment_method') THEN
    CREATE TYPE public.order_payment_method AS ENUM ('pix', 'credit_card', 'debit_card', 'cash');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_payment_status') THEN
    CREATE TYPE public.order_payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method public.order_payment_method NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS payment_status public.order_payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_delivery_fee_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_fee_nonnegative CHECK (delivery_fee >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_service_fee_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_service_fee_nonnegative CHECK (service_fee >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.establishment_delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zip_prefix TEXT NOT NULL,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  free_over_value NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_zone_fee_nonnegative CHECK (fee >= 0),
  CONSTRAINT delivery_zone_min_order_nonnegative CHECK (min_order_value >= 0),
  CONSTRAINT delivery_zone_free_over_nonnegative CHECK (free_over_value IS NULL OR free_over_value >= 0),
  CONSTRAINT delivery_zone_zip_prefix_not_blank CHECK (length(trim(zip_prefix)) >= 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_zone_unique_prefix
  ON public.establishment_delivery_zones(establishment_id, zip_prefix);

CREATE INDEX IF NOT EXISTS idx_delivery_zone_establishment_active
  ON public.establishment_delivery_zones(establishment_id, is_active);

ALTER TABLE public.establishment_delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active delivery zones" ON public.establishment_delivery_zones;
CREATE POLICY "Public can view active delivery zones"
  ON public.establishment_delivery_zones FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Owners can manage own delivery zones" ON public.establishment_delivery_zones;
CREATE POLICY "Owners can manage own delivery zones"
  ON public.establishment_delivery_zones FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_delivery_zones.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_delivery_zones.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_establishment_delivery_zones_updated_at ON public.establishment_delivery_zones;
CREATE TRIGGER update_establishment_delivery_zones_updated_at
BEFORE UPDATE ON public.establishment_delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.establishment_sla_settings (
  establishment_id UUID PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  received_minutes INTEGER NOT NULL DEFAULT 5,
  confirmed_minutes INTEGER NOT NULL DEFAULT 10,
  in_preparation_minutes INTEGER NOT NULL DEFAULT 25,
  ready_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sla_received_positive CHECK (received_minutes > 0),
  CONSTRAINT sla_confirmed_positive CHECK (confirmed_minutes > 0),
  CONSTRAINT sla_in_preparation_positive CHECK (in_preparation_minutes > 0),
  CONSTRAINT sla_ready_positive CHECK (ready_minutes > 0)
);

ALTER TABLE public.establishment_sla_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own SLA settings" ON public.establishment_sla_settings;
CREATE POLICY "Owners can view own SLA settings"
  ON public.establishment_sla_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_sla_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can upsert own SLA settings" ON public.establishment_sla_settings;
CREATE POLICY "Owners can upsert own SLA settings"
  ON public.establishment_sla_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_sla_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_sla_settings.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_establishment_sla_settings_updated_at ON public.establishment_sla_settings;
CREATE TRIGGER update_establishment_sla_settings_updated_at
BEFORE UPDATE ON public.establishment_sla_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.establishment_sla_settings (establishment_id)
SELECT id
FROM public.establishments
ON CONFLICT (establishment_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.checkout_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT checkout_event_name_valid CHECK (event_name IN ('menu_view', 'add_to_cart', 'checkout_view', 'order_submitted')),
  CONSTRAINT checkout_session_not_blank CHECK (length(trim(session_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_checkout_events_establishment_event_created
  ON public.checkout_events(establishment_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkout_events_session_created
  ON public.checkout_events(session_id, created_at DESC);

ALTER TABLE public.checkout_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert checkout events" ON public.checkout_events;
CREATE POLICY "Public can insert checkout events"
  ON public.checkout_events FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can view own checkout events" ON public.checkout_events;
CREATE POLICY "Owners can view own checkout events"
  ON public.checkout_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = checkout_events.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own checkout events" ON public.checkout_events;
CREATE POLICY "Users can view own checkout events"
  ON public.checkout_events FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
