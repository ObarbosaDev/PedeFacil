BEGIN;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS recipient_name TEXT;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS delivered_lat DOUBLE PRECISION;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS delivered_lng DOUBLE PRECISION;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS delivered_accuracy_meters NUMERIC;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS gps_bypass_reason TEXT;

INSERT INTO storage.buckets (id, name, public)
SELECT 'delivery-proofs', 'delivery-proofs', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'delivery-proofs'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view delivery proofs'
  ) THEN
    CREATE POLICY "Anyone can view delivery proofs"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'delivery-proofs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload delivery proofs'
  ) THEN
    CREATE POLICY "Authenticated users can upload delivery proofs"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'delivery-proofs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update delivery proofs'
  ) THEN
    CREATE POLICY "Authenticated users can update delivery proofs"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'delivery-proofs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete delivery proofs'
  ) THEN
    CREATE POLICY "Authenticated users can delete delivery proofs"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'delivery-proofs');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_delivery_tracking(TEXT);

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
  proof_image_url TEXT,
  recipient_name TEXT,
  delivered_lat DOUBLE PRECISION,
  delivered_lng DOUBLE PRECISION,
  delivered_accuracy_meters NUMERIC,
  gps_bypass_reason TEXT,
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
    od.proof_image_url,
    od.recipient_name,
    od.delivered_lat,
    od.delivered_lng,
    od.delivered_accuracy_meters,
    od.gps_bypass_reason,
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
