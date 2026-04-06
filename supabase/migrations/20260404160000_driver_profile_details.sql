BEGIN;

ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_brand TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_notes TEXT;

INSERT INTO storage.buckets (id, name, public)
SELECT 'driver-images', 'driver-images', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'driver-images'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view driver images'
  ) THEN
    CREATE POLICY "Anyone can view driver images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'driver-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload driver images'
  ) THEN
    CREATE POLICY "Authenticated users can upload driver images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'driver-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update driver images'
  ) THEN
    CREATE POLICY "Authenticated users can update driver images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'driver-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete driver images'
  ) THEN
    CREATE POLICY "Authenticated users can delete driver images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'driver-images');
  END IF;
END $$;

COMMIT;
