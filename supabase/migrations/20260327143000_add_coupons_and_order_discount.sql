DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
    CREATE TYPE public.coupon_discount_type AS ENUM ('percentage', 'fixed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type public.coupon_discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  minimum_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_discount_value NUMERIC(10,2),
  usage_limit INT,
  usage_count INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupons_discount_value_positive CHECK (discount_value > 0),
  CONSTRAINT coupons_minimum_order_nonnegative CHECK (minimum_order_value >= 0),
  CONSTRAINT coupons_max_discount_positive CHECK (max_discount_value IS NULL OR max_discount_value > 0),
  CONSTRAINT coupons_usage_limit_positive CHECK (usage_limit IS NULL OR usage_limit > 0),
  CONSTRAINT coupons_usage_count_nonnegative CHECK (usage_count >= 0),
  CONSTRAINT coupons_dates_valid CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at >= starts_at),
  CONSTRAINT coupons_code_not_blank CHECK (length(trim(code)) > 0),
  UNIQUE (establishment_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_establishment_id ON public.coupons(establishment_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active_dates ON public.coupons(is_active, starts_at, expires_at);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
CREATE POLICY "Public can view active coupons"
ON public.coupons
FOR SELECT
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (expires_at IS NULL OR expires_at >= now())
);

DROP POLICY IF EXISTS "Owners can view own coupons" ON public.coupons;
CREATE POLICY "Owners can view own coupons"
ON public.coupons
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = coupons.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can insert own coupons" ON public.coupons;
CREATE POLICY "Owners can insert own coupons"
ON public.coupons
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = coupons.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update own coupons" ON public.coupons;
CREATE POLICY "Owners can update own coupons"
ON public.coupons
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = coupons.establishment_id
      AND e.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = coupons.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can delete own coupons" ON public.coupons;
CREATE POLICY "Owners can delete own coupons"
ON public.coupons
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = coupons.establishment_id
      AND e.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.normalize_coupon_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.code := upper(trim(NEW.code));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_coupon_code_on_write ON public.coupons;
CREATE TRIGGER normalize_coupon_code_on_write
BEFORE INSERT OR UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.normalize_coupon_code();

DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;

UPDATE public.orders
SET subtotal = total
WHERE subtotal IS NULL;

ALTER TABLE public.orders ALTER COLUMN subtotal SET DEFAULT 0;
ALTER TABLE public.orders ALTER COLUMN subtotal SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_subtotal_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_subtotal_nonnegative CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_discount_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_nonnegative CHECK (discount_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_discount_not_greater_than_subtotal'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_not_greater_than_subtotal CHECK (discount_amount <= subtotal);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_total_nonnegative'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_nonnegative CHECK (total >= 0);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.apply_coupon_on_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  selected_coupon public.coupons%ROWTYPE;
  calculated_discount NUMERIC(10,2);
BEGIN
  NEW.subtotal := COALESCE(NEW.subtotal, NEW.total, 0);

  IF NEW.subtotal < 0 THEN
    RAISE EXCEPTION 'Subtotal invalido.';
  END IF;

  IF NEW.coupon_id IS NULL THEN
    NEW.discount_amount := 0;
    NEW.coupon_code := NULL;
    NEW.total := NEW.subtotal;
    RETURN NEW;
  END IF;

  SELECT *
  INTO selected_coupon
  FROM public.coupons
  WHERE id = NEW.coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom nao encontrado.';
  END IF;

  IF selected_coupon.establishment_id <> NEW.establishment_id THEN
    RAISE EXCEPTION 'Cupom nao pertence a esta loja.';
  END IF;

  IF NOT selected_coupon.is_active THEN
    RAISE EXCEPTION 'Cupom inativo.';
  END IF;

  IF selected_coupon.starts_at IS NOT NULL AND selected_coupon.starts_at > now() THEN
    RAISE EXCEPTION 'Cupom ainda nao iniciou.';
  END IF;

  IF selected_coupon.expires_at IS NOT NULL AND selected_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Cupom expirado.';
  END IF;

  IF selected_coupon.usage_limit IS NOT NULL AND selected_coupon.usage_count >= selected_coupon.usage_limit THEN
    RAISE EXCEPTION 'Cupom atingiu o limite de uso.';
  END IF;

  IF NEW.subtotal < selected_coupon.minimum_order_value THEN
    RAISE EXCEPTION 'Pedido minimo para este cupom: R$ %.', selected_coupon.minimum_order_value;
  END IF;

  IF selected_coupon.discount_type = 'percentage' THEN
    calculated_discount := round((NEW.subtotal * selected_coupon.discount_value / 100.0)::numeric, 2);
  ELSE
    calculated_discount := selected_coupon.discount_value;
  END IF;

  IF selected_coupon.max_discount_value IS NOT NULL THEN
    calculated_discount := LEAST(calculated_discount, selected_coupon.max_discount_value);
  END IF;

  calculated_discount := LEAST(GREATEST(calculated_discount, 0), NEW.subtotal);

  NEW.discount_amount := calculated_discount;
  NEW.total := NEW.subtotal - calculated_discount;
  NEW.coupon_code := selected_coupon.code;

  UPDATE public.coupons
  SET usage_count = usage_count + 1
  WHERE id = selected_coupon.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_coupon_on_order_insert ON public.orders;
CREATE TRIGGER apply_coupon_on_order_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_coupon_on_order_insert();
