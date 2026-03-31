BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE public.delivery_status AS ENUM ('assigned', 'accepted', 'picked_up', 'delivered', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'moto',
  license_plate TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_driver_email_not_blank CHECK (length(trim(email)) > 5),
  CONSTRAINT delivery_driver_name_not_blank CHECK (length(trim(full_name)) > 2),
  CONSTRAINT delivery_driver_phone_not_blank CHECK (length(trim(phone)) > 7)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_drivers_establishment_email
  ON public.delivery_drivers(establishment_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_establishment_active
  ON public.delivery_drivers(establishment_id, is_active, is_available);

CREATE TABLE IF NOT EXISTS public.order_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE RESTRICT,
  status public.delivery_status NOT NULL DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_establishment_status
  ON public.order_deliveries(establishment_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_deliveries_driver_status
  ON public.order_deliveries(driver_id, status, assigned_at DESC);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage own delivery drivers" ON public.delivery_drivers;
CREATE POLICY "Owners can manage own delivery drivers"
  ON public.delivery_drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = delivery_drivers.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = delivery_drivers.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own profile" ON public.delivery_drivers;
CREATE POLICY "Drivers can view own profile"
  ON public.delivery_drivers FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can update own profile" ON public.delivery_drivers;
CREATE POLICY "Drivers can update own profile"
  ON public.delivery_drivers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage own order deliveries" ON public.order_deliveries;
CREATE POLICY "Owners can manage own order deliveries"
  ON public.order_deliveries FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = order_deliveries.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = order_deliveries.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can view own order deliveries" ON public.order_deliveries;
CREATE POLICY "Drivers can view own order deliveries"
  ON public.order_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.delivery_drivers d
      WHERE d.id = order_deliveries.driver_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Drivers can update own order deliveries" ON public.order_deliveries;
CREATE POLICY "Drivers can update own order deliveries"
  ON public.order_deliveries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.delivery_drivers d
      WHERE d.id = order_deliveries.driver_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.delivery_drivers d
      WHERE d.id = order_deliveries.driver_id
        AND d.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_delivery_drivers_updated_at ON public.delivery_drivers;
CREATE TRIGGER update_delivery_drivers_updated_at
BEFORE UPDATE ON public.delivery_drivers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_deliveries_updated_at ON public.order_deliveries;
CREATE TRIGGER update_order_deliveries_updated_at
BEFORE UPDATE ON public.order_deliveries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
