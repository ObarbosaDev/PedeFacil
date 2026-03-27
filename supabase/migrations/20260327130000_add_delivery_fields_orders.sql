ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_street TEXT,
  ADD COLUMN IF NOT EXISTS delivery_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_complement TEXT,
  ADD COLUMN IF NOT EXISTS delivery_reference TEXT;
