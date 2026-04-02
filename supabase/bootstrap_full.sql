-- Bootstrap completo do banco Pede Facil
-- Gerado automaticamente em 2026-04-02 00:30:18


-- ===== BEGIN 20260327041152_0f50d952-3198-4fdb-a9a3-1c4cc13b8474.sql =====


-- Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'store_owner', 'attendant');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('received', 'confirmed', 'in_preparation', 'ready', 'delivered', 'cancelled');

-- Create order type enum
CREATE TYPE public.order_type AS ENUM ('pickup', 'delivery');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Establishments table
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  whatsapp TEXT NOT NULL,
  opening_hours TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active establishments" ON public.establishments FOR SELECT USING (is_active = true);
CREATE POLICY "Owners can manage own establishments" ON public.establishments FOR ALL USING (auth.uid() = owner_id);
CREATE TRIGGER update_establishments_updated_at BEFORE UPDATE ON public.establishments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Owners can manage categories" ON public.categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.establishments WHERE id = establishment_id AND owner_id = auth.uid())
);
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view available products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Owners can manage products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.establishments WHERE id = establishment_id AND owner_id = auth.uid())
);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'received',
  order_type order_type NOT NULL DEFAULT 'pickup',
  observation TEXT,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view orders" ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.establishments WHERE id = establishment_id AND owner_id = auth.uid())
);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners can update orders" ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.establishments WHERE id = establishment_id AND owner_id = auth.uid())
);
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view order items" ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.establishments e ON e.id = o.establishment_id
    WHERE o.id = order_id AND e.owner_id = auth.uid()
  )
);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);

-- Loyalty accounts table
CREATE TABLE public.loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, establishment_id)
);
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view loyalty accounts" ON public.loyalty_accounts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.establishments WHERE id = establishment_id AND owner_id = auth.uid())
);
CREATE POLICY "Anyone can create loyalty accounts" ON public.loyalty_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners can update loyalty accounts" ON public.loyalty_accounts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.establishments WHERE id = establishment_id AND owner_id = auth.uid())
);
CREATE TRIGGER update_loyalty_updated_at BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');

-- Auto-assign store_owner role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'store_owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ===== END 20260327041152_0f50d952-3198-4fdb-a9a3-1c4cc13b8474.sql =====


-- ===== BEGIN 20260327123000_order_status_history.sql =====

-- Historico de status dos pedidos
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  old_status public.order_status,
  new_status public.order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view order status history"
ON public.order_status_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = establishment_id
      AND e.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, establishment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NEW.establishment_id, NULL, NEW.status, auth.uid());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, establishment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NEW.establishment_id, OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;

CREATE TRIGGER trg_log_order_status_change
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

-- ===== END 20260327123000_order_status_history.sql =====


-- ===== BEGIN 20260327130000_add_delivery_fields_orders.sql =====

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_street TEXT,
  ADD COLUMN IF NOT EXISTS delivery_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS delivery_complement TEXT,
  ADD COLUMN IF NOT EXISTS delivery_reference TEXT;

-- ===== END 20260327130000_add_delivery_fields_orders.sql =====


-- ===== BEGIN 20260327143000_add_coupons_and_order_discount.sql =====

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

-- ===== END 20260327143000_add_coupons_and_order_discount.sql =====


-- ===== BEGIN 20260327160000_whatsapp_automation_base.sql =====

CREATE TABLE IF NOT EXISTS public.whatsapp_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  provider_name TEXT NOT NULL DEFAULT 'webhook',
  webhook_url TEXT,
  webhook_secret TEXT,
  send_on_new_order BOOLEAN NOT NULL DEFAULT true,
  send_on_status_change BOOLEAN NOT NULL DEFAULT true,
  send_out_of_hours BOOLEAN NOT NULL DEFAULT false,
  out_of_hours_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  template_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, event_key)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  event_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_status_created
  ON public.whatsapp_automation_events(status, created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_events_establishment
  ON public.whatsapp_automation_events(establishment_id, created_at DESC);

ALTER TABLE public.whatsapp_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own whatsapp settings" ON public.whatsapp_automation_settings;
CREATE POLICY "Owners can view own whatsapp settings"
ON public.whatsapp_automation_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_settings.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can insert own whatsapp settings" ON public.whatsapp_automation_settings;
CREATE POLICY "Owners can insert own whatsapp settings"
ON public.whatsapp_automation_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_settings.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update own whatsapp settings" ON public.whatsapp_automation_settings;
CREATE POLICY "Owners can update own whatsapp settings"
ON public.whatsapp_automation_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_settings.establishment_id
      AND e.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_settings.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can view own whatsapp templates" ON public.whatsapp_message_templates;
CREATE POLICY "Owners can view own whatsapp templates"
ON public.whatsapp_message_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_message_templates.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can insert own whatsapp templates" ON public.whatsapp_message_templates;
CREATE POLICY "Owners can insert own whatsapp templates"
ON public.whatsapp_message_templates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_message_templates.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update own whatsapp templates" ON public.whatsapp_message_templates;
CREATE POLICY "Owners can update own whatsapp templates"
ON public.whatsapp_message_templates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_message_templates.establishment_id
      AND e.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_message_templates.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can delete own whatsapp templates" ON public.whatsapp_message_templates;
CREATE POLICY "Owners can delete own whatsapp templates"
ON public.whatsapp_message_templates
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_message_templates.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can view own whatsapp events" ON public.whatsapp_automation_events;
CREATE POLICY "Owners can view own whatsapp events"
ON public.whatsapp_automation_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_events.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "System can insert whatsapp events" ON public.whatsapp_automation_events;
CREATE POLICY "System can insert whatsapp events"
ON public.whatsapp_automation_events
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can update own whatsapp events" ON public.whatsapp_automation_events;
CREATE POLICY "Owners can update own whatsapp events"
ON public.whatsapp_automation_events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_events.establishment_id
      AND e.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = whatsapp_automation_events.establishment_id
      AND e.owner_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS update_whatsapp_automation_settings_updated_at ON public.whatsapp_automation_settings;
CREATE TRIGGER update_whatsapp_automation_settings_updated_at
BEFORE UPDATE ON public.whatsapp_automation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_message_templates_updated_at ON public.whatsapp_message_templates;
CREATE TRIGGER update_whatsapp_message_templates_updated_at
BEFORE UPDATE ON public.whatsapp_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_automation_event(
  p_establishment_id UUID,
  p_order_id UUID,
  p_customer_phone TEXT,
  p_event_key TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  automation public.whatsapp_automation_settings%ROWTYPE;
  has_active_template BOOLEAN;
BEGIN
  SELECT *
  INTO automation
  FROM public.whatsapp_automation_settings
  WHERE establishment_id = p_establishment_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF automation.is_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  IF COALESCE(trim(automation.webhook_url), '') = '' THEN
    RETURN;
  END IF;

  IF p_event_key = 'new_order' AND automation.send_on_new_order IS NOT TRUE THEN
    RETURN;
  END IF;

  IF p_event_key LIKE 'status_%' AND automation.send_on_status_change IS NOT TRUE THEN
    RETURN;
  END IF;

  IF p_event_key = 'out_of_hours' AND automation.send_out_of_hours IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_message_templates t
    WHERE t.establishment_id = p_establishment_id
      AND t.event_key = p_event_key
      AND t.is_active = true
  )
  INTO has_active_template;

  IF has_active_template IS NOT TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.whatsapp_automation_events (
    establishment_id,
    order_id,
    customer_phone,
    event_key,
    payload,
    status,
    attempts
  )
  VALUES (
    p_establishment_id,
    p_order_id,
    p_customer_phone,
    p_event_key,
    COALESCE(p_payload, '{}'::jsonb),
    'pending',
    0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_order_whatsapp_automation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  event_key TEXT;
  event_payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_payload := jsonb_build_object(
      'order_id', NEW.id,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'status', NEW.status,
      'order_type', NEW.order_type,
      'subtotal', NEW.subtotal,
      'discount_amount', NEW.discount_amount,
      'total', NEW.total,
      'coupon_code', NEW.coupon_code,
      'created_at', NEW.created_at
    );

    PERFORM public.enqueue_whatsapp_automation_event(
      NEW.establishment_id,
      NEW.id,
      NEW.customer_phone,
      'new_order',
      event_payload
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    event_key :=
      CASE NEW.status
        WHEN 'confirmed' THEN 'status_confirmed'
        WHEN 'in_preparation' THEN 'status_in_preparation'
        WHEN 'ready' THEN 'status_ready'
        WHEN 'delivered' THEN 'status_delivered'
        WHEN 'cancelled' THEN 'status_cancelled'
        ELSE NULL
      END;

    IF event_key IS NULL THEN
      RETURN NEW;
    END IF;

    event_payload := jsonb_build_object(
      'order_id', NEW.id,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'previous_status', OLD.status,
      'status', NEW.status,
      'order_type', NEW.order_type,
      'subtotal', NEW.subtotal,
      'discount_amount', NEW.discount_amount,
      'total', NEW.total,
      'coupon_code', NEW.coupon_code,
      'updated_at', NEW.updated_at
    );

    PERFORM public.enqueue_whatsapp_automation_event(
      NEW.establishment_id,
      NEW.id,
      NEW.customer_phone,
      event_key,
      event_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_whatsapp_automation_event_trigger ON public.orders;
CREATE TRIGGER order_whatsapp_automation_event_trigger
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_whatsapp_automation_event();

INSERT INTO public.whatsapp_message_templates (establishment_id, event_key, template_text, is_active)
SELECT
  e.id,
  template.event_key,
  template.template_text,
  true
FROM public.establishments e
CROSS JOIN (
  VALUES
    ('new_order', 'Pedido novo por aqui! Pedido #{order_id} recebido com sucesso.'),
    ('status_confirmed', 'Seu pedido #{order_id} foi confirmado e j� entrou na fila.'),
    ('status_in_preparation', 'Seu pedido #{order_id} est� em preparo. J� j� sai da�.'),
    ('status_ready', 'Seu pedido #{order_id} est� pronto! Pode passar para retirar.'),
    ('status_delivered', 'Pedido #{order_id} finalizado. Valeu por comprar com a gente!'),
    ('status_cancelled', 'Pedido #{order_id} foi cancelado. Se precisar, chama a loja aqui.'),
    ('out_of_hours', 'Estamos fora do hor�rio agora. Assim que abrir, te respondemos por aqui.')
) AS template(event_key, template_text)
ON CONFLICT (establishment_id, event_key) DO NOTHING;

INSERT INTO public.whatsapp_automation_settings (establishment_id)
SELECT e.id
FROM public.establishments e
ON CONFLICT (establishment_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_establishment_whatsapp_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_automation_settings (establishment_id)
  VALUES (NEW.id)
  ON CONFLICT (establishment_id) DO NOTHING;

  INSERT INTO public.whatsapp_message_templates (establishment_id, event_key, template_text, is_active)
  VALUES
    (NEW.id, 'new_order', 'Pedido novo por aqui! Pedido #{order_id} recebido com sucesso.', true),
    (NEW.id, 'status_confirmed', 'Seu pedido #{order_id} foi confirmado e j� entrou na fila.', true),
    (NEW.id, 'status_in_preparation', 'Seu pedido #{order_id} est� em preparo. J� j� sai da�.', true),
    (NEW.id, 'status_ready', 'Seu pedido #{order_id} est� pronto! Pode passar para retirar.', true),
    (NEW.id, 'status_delivered', 'Pedido #{order_id} finalizado. Valeu por comprar com a gente!', true),
    (NEW.id, 'status_cancelled', 'Pedido #{order_id} foi cancelado. Se precisar, chama a loja aqui.', true),
    (NEW.id, 'out_of_hours', 'Estamos fora do hor�rio agora. Assim que abrir, te respondemos por aqui.', true)
  ON CONFLICT (establishment_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_establishment_created_whatsapp_defaults ON public.establishments;
CREATE TRIGGER on_establishment_created_whatsapp_defaults
AFTER INSERT ON public.establishments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_establishment_whatsapp_defaults();


-- ===== END 20260327160000_whatsapp_automation_base.sql =====


-- ===== BEGIN 20260329100000_client_accounts.sql =====

-- Client accounts and personalization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'customer'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'customer';
  END IF;
END $$;

-- Assign role based on signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
  v_user_type TEXT;
BEGIN
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'store_owner');

  IF v_user_type = 'customer' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'store_owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Casa',
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  complement TEXT,
  reference TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, establishment_id)
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own profile" ON public.customer_profiles;
CREATE POLICY "Customers can view own profile"
  ON public.customer_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customer_profiles;
CREATE POLICY "Customers can insert own profile"
  ON public.customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own profile" ON public.customer_profiles;
CREATE POLICY "Customers can update own profile"
  ON public.customer_profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own profile" ON public.customer_profiles;
CREATE POLICY "Customers can delete own profile"
  ON public.customer_profiles FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can view own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can view own addresses"
  ON public.customer_addresses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can insert own addresses"
  ON public.customer_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can update own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can update own addresses"
  ON public.customer_addresses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can delete own addresses"
  ON public.customer_addresses FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can view own favorites" ON public.customer_favorites;
CREATE POLICY "Customers can view own favorites"
  ON public.customer_favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own favorites" ON public.customer_favorites;
CREATE POLICY "Customers can insert own favorites"
  ON public.customer_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can delete own favorites" ON public.customer_favorites;
CREATE POLICY "Customers can delete own favorites"
  ON public.customer_favorites FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON public.customer_profiles;
CREATE TRIGGER update_customer_profiles_updated_at
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_customer_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customer_profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_customer_profile_created ON auth.users;
CREATE TRIGGER on_auth_customer_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_profile();

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_per_user
  ON public.customer_addresses (user_id)
  WHERE is_default = true;

-- ===== END 20260329100000_client_accounts.sql =====


-- ===== BEGIN 20260329113000_platform_hardening.sql =====

-- Platform hardening: audit trail and customer order history
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON public.audit_logs(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_user_id OR actor_user_id IS NULL);

DROP POLICY IF EXISTS "Store owners can view own establishment audit logs" ON public.audit_logs;
CREATE POLICY "Store owners can view own establishment audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.owner_id = auth.uid()
        AND audit_logs.entity_type = 'establishment'
        AND audit_logs.entity_id = e.id::text
    )
    OR actor_user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    metadata,
    ip_address,
    user_agent
  )
  VALUES (
    p_actor_user_id,
    p_actor_role,
    p_entity_type,
    p_entity_id,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.customer_order_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_order_links_user_created
  ON public.customer_order_links(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_order_links_establishment
  ON public.customer_order_links(establishment_id, created_at DESC);

ALTER TABLE public.customer_order_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own order links" ON public.customer_order_links;
CREATE POLICY "Customers can view own order links"
  ON public.customer_order_links FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own order links" ON public.customer_order_links;
CREATE POLICY "Customers can insert own order links"
  ON public.customer_order_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Store owners can view order links from their establishment" ON public.customer_order_links;
CREATE POLICY "Store owners can view order links from their establishment"
  ON public.customer_order_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = customer_order_links.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

-- ===== END 20260329113000_platform_hardening.sql =====


-- ===== BEGIN 20260330090000_growth_ops_upgrade.sql =====

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

-- ===== END 20260330090000_growth_ops_upgrade.sql =====


-- ===== BEGIN 20260330110000_delivery_drivers_mvp.sql =====

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

-- ===== END 20260330110000_delivery_drivers_mvp.sql =====


-- ===== BEGIN 20260330123000_delivery_whatsapp_templates.sql =====

BEGIN;

INSERT INTO public.whatsapp_message_templates (establishment_id, event_key, template_text, is_active)
SELECT
  e.id,
  'delivery_out_for_delivery',
  'Seu pedido #{order_id} saiu para entrega. Já já chega aí.',
  true
FROM public.establishments e
ON CONFLICT (establishment_id, event_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_establishment_whatsapp_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_automation_settings (establishment_id)
  VALUES (NEW.id)
  ON CONFLICT (establishment_id) DO NOTHING;

  INSERT INTO public.whatsapp_message_templates (establishment_id, event_key, template_text, is_active)
  VALUES
    (NEW.id, 'new_order', 'Pedido novo por aqui! Pedido #{order_id} recebido com sucesso.', true),
    (NEW.id, 'status_confirmed', 'Seu pedido #{order_id} foi confirmado e já entrou na fila.', true),
    (NEW.id, 'status_in_preparation', 'Seu pedido #{order_id} está em preparo. Já já sai daí.', true),
    (NEW.id, 'status_ready', 'Seu pedido #{order_id} está pronto! Pode passar para retirar.', true),
    (NEW.id, 'status_delivered', 'Pedido #{order_id} finalizado. Valeu por comprar com a gente!', true),
    (NEW.id, 'status_cancelled', 'Pedido #{order_id} foi cancelado. Se precisar, chama a loja aqui.', true),
    (NEW.id, 'delivery_out_for_delivery', 'Seu pedido #{order_id} saiu para entrega. Já já chega aí.', true),
    (NEW.id, 'out_of_hours', 'Estamos fora do horário agora. Assim que abrir, te respondemos por aqui.', true)
  ON CONFLICT (establishment_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;

-- ===== END 20260330123000_delivery_whatsapp_templates.sql =====


-- ===== BEGIN 20260330130000_delivery_accepted_whatsapp_template.sql =====

BEGIN;

INSERT INTO public.whatsapp_message_templates (establishment_id, event_key, template_text, is_active)
SELECT
  e.id,
  'delivery_accepted_by_driver',
  'Boa! Seu pedido #{order_id} já foi aceito por um entregador e vai sair em instantes.',
  true
FROM public.establishments e
ON CONFLICT (establishment_id, event_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_establishment_whatsapp_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_automation_settings (establishment_id)
  VALUES (NEW.id)
  ON CONFLICT (establishment_id) DO NOTHING;

  INSERT INTO public.whatsapp_message_templates (establishment_id, event_key, template_text, is_active)
  VALUES
    (NEW.id, 'new_order', 'Pedido novo por aqui! Pedido #{order_id} recebido com sucesso.', true),
    (NEW.id, 'status_confirmed', 'Seu pedido #{order_id} foi confirmado e já entrou na fila.', true),
    (NEW.id, 'status_in_preparation', 'Seu pedido #{order_id} está em preparo. Já já sai daí.', true),
    (NEW.id, 'status_ready', 'Seu pedido #{order_id} está pronto! Pode passar para retirar.', true),
    (NEW.id, 'status_delivered', 'Pedido #{order_id} finalizado. Valeu por comprar com a gente!', true),
    (NEW.id, 'status_cancelled', 'Pedido #{order_id} foi cancelado. Se precisar, chama a loja aqui.', true),
    (NEW.id, 'delivery_accepted_by_driver', 'Boa! Seu pedido #{order_id} já foi aceito por um entregador e vai sair em instantes.', true),
    (NEW.id, 'delivery_out_for_delivery', 'Seu pedido #{order_id} saiu para entrega. Já já chega aí.', true),
    (NEW.id, 'out_of_hours', 'Estamos fora do horário agora. Assim que abrir, te respondemos por aqui.', true)
  ON CONFLICT (establishment_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;

-- ===== END 20260330130000_delivery_accepted_whatsapp_template.sql =====


-- ===== BEGIN 20260331100000_delivery_operations_upgrade.sql =====

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

-- ===== END 20260331100000_delivery_operations_upgrade.sql =====


-- ===== BEGIN 20260401120000_store_subscription_billing.sql =====

-- Subscription and billing core for store owner access control
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_billing_cycle') THEN
    CREATE TYPE public.plan_billing_cycle AS ENUM ('monthly', 'yearly');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('pending_payment', 'active', 'past_due', 'canceled', 'expired');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slug TEXT NOT NULL CHECK (plan_slug IN ('essencial', 'profissional', 'premium')),
  billing_cycle public.plan_billing_cycle NOT NULL DEFAULT 'monthly',
  status public.subscription_status NOT NULL DEFAULT 'pending_payment',
  payment_method TEXT NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'card')),
  checkout_session_id TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL DEFAULT 'internal_demo',
  provider_reference TEXT,
  provider_event_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  pix_code TEXT,
  pix_qr_url TEXT,
  payment_expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_subscriptions_user_open
  ON public.store_subscriptions(user_id)
  WHERE status IN ('pending_payment', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_user_created
  ON public.store_subscriptions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status_period
  ON public.store_subscriptions(status, current_period_end DESC);

DROP TRIGGER IF EXISTS update_store_subscriptions_updated_at ON public.store_subscriptions;
CREATE TRIGGER update_store_subscriptions_updated_at
BEFORE UPDATE ON public.store_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subscription_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  checkout_session_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_name, provider_event_id)
);

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own store subscriptions" ON public.store_subscriptions;
CREATE POLICY "Users can view own store subscriptions"
  ON public.store_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct read on subscription webhook events" ON public.subscription_webhook_events;
CREATE POLICY "No direct read on subscription webhook events"
  ON public.subscription_webhook_events FOR SELECT
  USING (false);

CREATE OR REPLACE FUNCTION public.get_plan_price_cents(
  p_plan_slug TEXT,
  p_billing_cycle public.plan_billing_cycle
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_plan_slug = 'essencial' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 7900 ELSE 6300 END;
  ELSIF p_plan_slug = 'profissional' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 14900 ELSE 11900 END;
  ELSIF p_plan_slug = 'premium' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 24900 ELSE 19900 END;
  END IF;

  RAISE EXCEPTION 'Plano inv�lido: %', p_plan_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_plan_checkout(
  p_plan_slug TEXT,
  p_billing_cycle public.plan_billing_cycle,
  p_payment_method TEXT DEFAULT 'pix'
)
RETURNS TABLE (
  subscription_id UUID,
  checkout_session_id TEXT,
  plan_slug TEXT,
  billing_cycle public.plan_billing_cycle,
  status public.subscription_status,
  payment_method TEXT,
  amount_cents INTEGER,
  currency TEXT,
  payment_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_open_subscription public.store_subscriptions%ROWTYPE;
  v_amount_cents INTEGER;
  v_checkout_id TEXT;
  v_expires_at TIMESTAMPTZ := now() + interval '30 minutes';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usu�rio n�o autenticado.';
  END IF;

  IF p_payment_method NOT IN ('pix', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento inv�lida.';
  END IF;

  v_amount_cents := public.get_plan_price_cents(p_plan_slug, p_billing_cycle);

  SELECT *
  INTO v_open_subscription
  FROM public.store_subscriptions s
  WHERE s.user_id = v_user_id
    AND s.status IN ('pending_payment', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF FOUND AND v_open_subscription.status = 'active' THEN
    RETURN QUERY
    SELECT
      v_open_subscription.id,
      COALESCE(v_open_subscription.checkout_session_id, ''),
      v_open_subscription.plan_slug,
      v_open_subscription.billing_cycle,
      v_open_subscription.status,
      v_open_subscription.payment_method,
      v_open_subscription.amount_cents,
      v_open_subscription.currency,
      v_open_subscription.payment_expires_at;
    RETURN;
  END IF;

  v_checkout_id := 'chk_' || replace(gen_random_uuid()::text, '-', '');

  IF FOUND THEN
    UPDATE public.store_subscriptions
    SET
      plan_slug = p_plan_slug,
      billing_cycle = p_billing_cycle,
      payment_method = p_payment_method,
      checkout_session_id = v_checkout_id,
      status = 'pending_payment',
      provider_name = 'internal_demo',
      provider_reference = NULL,
      provider_event_id = NULL,
      amount_cents = v_amount_cents,
      currency = 'BRL',
      payment_expires_at = v_expires_at,
      paid_at = NULL,
      current_period_start = NULL,
      current_period_end = NULL,
      canceled_at = NULL,
      metadata = jsonb_build_object('source', 'plans_checkout', 'generated_at', now())
    WHERE id = v_open_subscription.id;

    RETURN QUERY
    SELECT
      s.id,
      s.checkout_session_id,
      s.plan_slug,
      s.billing_cycle,
      s.status,
      s.payment_method,
      s.amount_cents,
      s.currency,
      s.payment_expires_at
    FROM public.store_subscriptions s
    WHERE s.id = v_open_subscription.id;

    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.store_subscriptions (
    user_id,
    plan_slug,
    billing_cycle,
    status,
    payment_method,
    checkout_session_id,
    provider_name,
    amount_cents,
    currency,
    payment_expires_at,
    metadata
  )
  VALUES (
    v_user_id,
    p_plan_slug,
    p_billing_cycle,
    'pending_payment',
    p_payment_method,
    v_checkout_id,
    'internal_demo',
    v_amount_cents,
    'BRL',
    v_expires_at,
    jsonb_build_object('source', 'plans_checkout', 'generated_at', now())
  )
  RETURNING
    id,
    checkout_session_id,
    plan_slug,
    billing_cycle,
    status,
    payment_method,
    amount_cents,
    currency,
    payment_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_plan_payment_webhook(
  p_checkout_session_id TEXT,
  p_provider_event_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_provider_name TEXT DEFAULT 'internal_demo'
)
RETURNS TABLE (
  subscription_id UUID,
  status public.subscription_status,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub public.store_subscriptions%ROWTYPE;
  v_period_start TIMESTAMPTZ := now();
  v_period_end TIMESTAMPTZ;
BEGIN
  IF COALESCE(trim(p_checkout_session_id), '') = '' THEN
    RAISE EXCEPTION 'Checkout session inv�lida.';
  END IF;

  IF COALESCE(trim(p_provider_event_id), '') = '' THEN
    RAISE EXCEPTION 'Provider event id � obrigat�rio.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscription_webhook_events e
    WHERE e.provider_name = p_provider_name
      AND e.provider_event_id = p_provider_event_id
  ) THEN
    RETURN QUERY
    SELECT s.id, s.status, s.current_period_end
    FROM public.store_subscriptions s
    WHERE s.checkout_session_id = p_checkout_session_id
    ORDER BY s.created_at DESC
    LIMIT 1;
    RETURN;
  END IF;

  SELECT *
  INTO v_sub
  FROM public.store_subscriptions s
  WHERE s.checkout_session_id = p_checkout_session_id
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura n�o encontrada para checkout session: %', p_checkout_session_id;
  END IF;

  IF v_user_id IS NOT NULL AND v_sub.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Sem permiss�o para confirmar esta assinatura.';
  END IF;

  IF v_sub.billing_cycle = 'monthly' THEN
    v_period_end := v_period_start + interval '1 month';
  ELSE
    v_period_end := v_period_start + interval '1 year';
  END IF;

  IF v_sub.status <> 'active' THEN
    UPDATE public.store_subscriptions
    SET
      status = 'active',
      provider_name = p_provider_name,
      provider_event_id = p_provider_event_id,
      paid_at = now(),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      metadata = COALESCE(v_sub.metadata, '{}'::jsonb) || jsonb_build_object('last_webhook_at', now())
    WHERE id = v_sub.id;
  END IF;

  INSERT INTO public.subscription_webhook_events (
    provider_name,
    provider_event_id,
    checkout_session_id,
    payload
  )
  VALUES (
    p_provider_name,
    p_provider_event_id,
    p_checkout_session_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (provider_name, provider_event_id) DO NOTHING;

  RETURN QUERY
  SELECT s.id, s.status, s.current_period_end
  FROM public.store_subscriptions s
  WHERE s.id = v_sub.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_store_subscription()
RETURNS TABLE (
  subscription_id UUID,
  plan_slug TEXT,
  billing_cycle public.plan_billing_cycle,
  status public.subscription_status,
  payment_method TEXT,
  checkout_session_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  paid_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  payment_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.plan_slug,
    s.billing_cycle,
    s.status,
    s.payment_method,
    s.checkout_session_id,
    s.amount_cents,
    s.currency,
    s.paid_at,
    s.current_period_end,
    s.payment_expires_at,
    s.created_at
  FROM public.store_subscriptions s
  WHERE s.user_id = auth.uid()
  ORDER BY
    CASE s.status
      WHEN 'active' THEN 1
      WHEN 'pending_payment' THEN 2
      WHEN 'past_due' THEN 3
      WHEN 'canceled' THEN 4
      WHEN 'expired' THEN 5
      ELSE 6
    END,
    s.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_store_panel(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- ===== END 20260401120000_store_subscription_billing.sql =====


-- ===== BEGIN 20260401133000_account_security_upgrade.sql =====

-- Account security upgrade: optional OTP, trusted devices and step-up controls
CREATE TABLE IF NOT EXISTS public.user_security_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_enabled BOOLEAN NOT NULL DEFAULT false,
  require_step_up_for_critical_actions BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT 'Dispositivo confiavel',
  trusted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_last_used
  ON public.trusted_devices(user_id, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_fingerprint
  ON public.trusted_devices(user_id, device_fingerprint);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own security settings" ON public.user_security_settings;
CREATE POLICY "Users can view own security settings"
  ON public.user_security_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own security settings" ON public.user_security_settings;
CREATE POLICY "Users can insert own security settings"
  ON public.user_security_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own security settings" ON public.user_security_settings;
CREATE POLICY "Users can update own security settings"
  ON public.user_security_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can view own trusted devices"
  ON public.trusted_devices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can insert own trusted devices"
  ON public.trusted_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can update own trusted devices"
  ON public.trusted_devices FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can delete own trusted devices"
  ON public.trusted_devices FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_security_settings_updated_at ON public.user_security_settings;
CREATE TRIGGER update_user_security_settings_updated_at
BEFORE UPDATE ON public.user_security_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trusted_devices_updated_at ON public.trusted_devices;
CREATE TRIGGER update_trusted_devices_updated_at
BEFORE UPDATE ON public.trusted_devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user_security_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_security_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_security_defaults ON auth.users;
CREATE TRIGGER on_auth_user_security_defaults
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_security_defaults();

-- ===== END 20260401133000_account_security_upgrade.sql =====


-- ===== BEGIN 20260401170000_delivery_proof_hardening.sql =====

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

-- ===== END 20260401170000_delivery_proof_hardening.sql =====


-- ===== BEGIN 20260402110000_order_idempotency.sql =====

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_establishment_idempotency
  ON public.orders(establishment_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND length(trim(idempotency_key)) > 0;

CREATE OR REPLACE FUNCTION public.create_order_idempotent(
  p_idempotency_key TEXT,
  p_order JSONB,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  order_id UUID,
  created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_establishment_id UUID;
  v_existing_order_id UUID;
  v_new_order_id UUID;
  v_idempotency_key TEXT;
  v_items_count INTEGER;
  v_total NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  v_idempotency_key := lower(trim(COALESCE(p_idempotency_key, '')));

  IF v_idempotency_key = '' THEN
    RAISE EXCEPTION 'Idempotency key obrigatoria.';
  END IF;

  v_establishment_id := (p_order->>'establishment_id')::uuid;
  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Establishment_id obrigatorio.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = v_establishment_id
      AND e.is_active = true
  ) THEN
    RAISE EXCEPTION 'Loja nao encontrada ou inativa.';
  END IF;

  IF COALESCE(trim(p_order->>'customer_name'), '') = '' THEN
    RAISE EXCEPTION 'Nome do cliente obrigatorio.';
  END IF;

  IF COALESCE(trim(p_order->>'customer_phone'), '') = '' THEN
    RAISE EXCEPTION 'Telefone do cliente obrigatorio.';
  END IF;

  IF jsonb_typeof(COALESCE(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Itens do pedido invalidos.';
  END IF;

  v_items_count := jsonb_array_length(COALESCE(p_items, '[]'::jsonb));
  IF v_items_count <= 0 THEN
    RAISE EXCEPTION 'Pedido sem itens.';
  END IF;

  v_total := COALESCE((p_order->>'total')::numeric, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Total do pedido invalido.';
  END IF;

  SELECT o.id
  INTO v_existing_order_id
  FROM public.orders o
  WHERE o.establishment_id = v_establishment_id
    AND o.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_order_id, false;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.orders (
      establishment_id,
      customer_id,
      customer_name,
      customer_phone,
      status,
      order_type,
      observation,
      payment_method,
      payment_status,
      subtotal,
      discount_amount,
      delivery_fee,
      service_fee,
      coupon_id,
      coupon_code,
      total,
      delivery_street,
      delivery_number,
      delivery_neighborhood,
      delivery_city,
      delivery_state,
      delivery_zip_code,
      delivery_complement,
      delivery_reference,
      idempotency_key
    )
    VALUES (
      v_establishment_id,
      NULLIF(p_order->>'customer_id', '')::uuid,
      COALESCE(p_order->>'customer_name', ''),
      COALESCE(p_order->>'customer_phone', ''),
      COALESCE((p_order->>'status')::public.order_status, 'received'::public.order_status),
      COALESCE((p_order->>'order_type')::public.order_type, 'pickup'::public.order_type),
      NULLIF(p_order->>'observation', ''),
      COALESCE((p_order->>'payment_method')::public.order_payment_method, 'pix'::public.order_payment_method),
      COALESCE((p_order->>'payment_status')::public.order_payment_status, 'pending'::public.order_payment_status),
      COALESCE((p_order->>'subtotal')::numeric, 0),
      COALESCE((p_order->>'discount_amount')::numeric, 0),
      COALESCE((p_order->>'delivery_fee')::numeric, 0),
      COALESCE((p_order->>'service_fee')::numeric, 0),
      NULLIF(p_order->>'coupon_id', '')::uuid,
      NULLIF(p_order->>'coupon_code', ''),
      COALESCE((p_order->>'total')::numeric, 0),
      NULLIF(p_order->>'delivery_street', ''),
      NULLIF(p_order->>'delivery_number', ''),
      NULLIF(p_order->>'delivery_neighborhood', ''),
      NULLIF(p_order->>'delivery_city', ''),
      NULLIF(p_order->>'delivery_state', ''),
      NULLIF(p_order->>'delivery_zip_code', ''),
      NULLIF(p_order->>'delivery_complement', ''),
      NULLIF(p_order->>'delivery_reference', ''),
      v_idempotency_key
    )
    RETURNING id INTO v_new_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT o.id
      INTO v_existing_order_id
      FROM public.orders o
      WHERE o.establishment_id = v_establishment_id
        AND o.idempotency_key = v_idempotency_key
      LIMIT 1;

      IF v_existing_order_id IS NULL THEN
        RAISE;
      END IF;

      RETURN QUERY SELECT v_existing_order_id, false;
      RETURN;
  END;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_name,
    quantity,
    unit_price
  )
  SELECT
    v_new_order_id,
    NULLIF(item->>'product_id', '')::uuid,
    COALESCE(item->>'product_name', ''),
    GREATEST(COALESCE((item->>'quantity')::integer, 1), 1),
    COALESCE((item->>'unit_price')::numeric, 0)
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item;

  RETURN QUERY SELECT v_new_order_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_idempotent(TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_idempotent(TEXT, JSONB, JSONB) TO authenticated;

COMMIT;


-- ===== END 20260402110000_order_idempotency.sql =====


-- ===== BEGIN 20260402123000_payment_webhook_idempotency_hardening.sql =====

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_plan_payment_webhook(
  p_checkout_session_id TEXT,
  p_provider_event_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_provider_name TEXT DEFAULT 'internal_demo'
)
RETURNS TABLE (
  subscription_id UUID,
  status public.subscription_status,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub public.store_subscriptions%ROWTYPE;
  v_period_start TIMESTAMPTZ := now();
  v_period_end TIMESTAMPTZ;
  v_checkout_session_id TEXT;
  v_provider_event_id TEXT;
  v_provider_name TEXT;
  v_inserted_event_id UUID;
  v_existing_event_checkout_session_id TEXT;
BEGIN
  v_checkout_session_id := trim(COALESCE(p_checkout_session_id, ''));
  v_provider_event_id := lower(trim(COALESCE(p_provider_event_id, '')));
  v_provider_name := lower(trim(COALESCE(NULLIF(p_provider_name, ''), 'internal_demo')));

  IF v_checkout_session_id = '' THEN
    RAISE EXCEPTION 'Checkout session invalida.';
  END IF;

  IF v_provider_event_id = '' THEN
    RAISE EXCEPTION 'Provider event id obrigatorio.';
  END IF;

  SELECT *
  INTO v_sub
  FROM public.store_subscriptions s
  WHERE s.checkout_session_id = v_checkout_session_id
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura nao encontrada para a sessao informada.';
  END IF;

  IF v_user_id IS NOT NULL AND v_sub.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissao para confirmar esta assinatura.';
  END IF;

  INSERT INTO public.subscription_webhook_events (
    provider_name,
    provider_event_id,
    checkout_session_id,
    payload
  )
  VALUES (
    v_provider_name,
    v_provider_event_id,
    v_checkout_session_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (provider_name, provider_event_id) DO NOTHING
  RETURNING id INTO v_inserted_event_id;

  IF v_inserted_event_id IS NULL THEN
    SELECT e.checkout_session_id
    INTO v_existing_event_checkout_session_id
    FROM public.subscription_webhook_events e
    WHERE e.provider_name = v_provider_name
      AND e.provider_event_id = v_provider_event_id
    LIMIT 1;

    IF v_existing_event_checkout_session_id IS NOT NULL
       AND v_existing_event_checkout_session_id <> v_checkout_session_id THEN
      RAISE EXCEPTION 'Evento de pagamento ja foi utilizado em outra sessao.';
    END IF;

    RETURN QUERY
    SELECT s.id, s.status, s.current_period_end
    FROM public.store_subscriptions s
    WHERE s.id = v_sub.id;
    RETURN;
  END IF;

  IF v_sub.billing_cycle = 'monthly' THEN
    v_period_end := v_period_start + interval '1 month';
  ELSE
    v_period_end := v_period_start + interval '1 year';
  END IF;

  IF v_sub.status <> 'active' THEN
    UPDATE public.store_subscriptions
    SET
      status = 'active',
      provider_name = v_provider_name,
      provider_event_id = v_provider_event_id,
      paid_at = now(),
      current_period_start = v_period_start,
      current_period_end = v_period_end,
      metadata = COALESCE(v_sub.metadata, '{}'::jsonb) || jsonb_build_object('last_webhook_at', now())
    WHERE id = v_sub.id;
  END IF;

  RETURN QUERY
  SELECT s.id, s.status, s.current_period_end
  FROM public.store_subscriptions s
  WHERE s.id = v_sub.id;
END;
$$;

COMMIT;


-- ===== END 20260402123000_payment_webhook_idempotency_hardening.sql =====


-- ===== BEGIN 20260402132000_start_plan_checkout_rpc_repair.sql =====

BEGIN;

-- Reparo defensivo da RPC de checkout de planos.
-- Motivo: evitar falhas de "function not found in schema cache" em ambientes
-- onde a migration base nao foi aplicada corretamente ou o cache ficou desatualizado.

CREATE OR REPLACE FUNCTION public.start_plan_checkout(
  p_plan_slug TEXT,
  p_billing_cycle public.plan_billing_cycle,
  p_payment_method TEXT DEFAULT 'pix'
)
RETURNS TABLE (
  subscription_id UUID,
  checkout_session_id TEXT,
  plan_slug TEXT,
  billing_cycle public.plan_billing_cycle,
  status public.subscription_status,
  payment_method TEXT,
  amount_cents INTEGER,
  currency TEXT,
  payment_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_open_subscription public.store_subscriptions%ROWTYPE;
  v_amount_cents INTEGER;
  v_checkout_id TEXT;
  v_expires_at TIMESTAMPTZ := now() + interval '30 minutes';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF p_payment_method NOT IN ('pix', 'card') THEN
    RAISE EXCEPTION 'Forma de pagamento invalida.';
  END IF;

  v_amount_cents := public.get_plan_price_cents(p_plan_slug, p_billing_cycle);

  SELECT *
  INTO v_open_subscription
  FROM public.store_subscriptions s
  WHERE s.user_id = v_user_id
    AND s.status IN ('pending_payment', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF FOUND AND v_open_subscription.status = 'active' THEN
    RETURN QUERY
    SELECT
      v_open_subscription.id,
      COALESCE(v_open_subscription.checkout_session_id, ''),
      v_open_subscription.plan_slug,
      v_open_subscription.billing_cycle,
      v_open_subscription.status,
      v_open_subscription.payment_method,
      v_open_subscription.amount_cents,
      v_open_subscription.currency,
      v_open_subscription.payment_expires_at;
    RETURN;
  END IF;

  v_checkout_id := 'chk_' || replace(gen_random_uuid()::text, '-', '');

  IF FOUND THEN
    UPDATE public.store_subscriptions
    SET
      plan_slug = p_plan_slug,
      billing_cycle = p_billing_cycle,
      payment_method = p_payment_method,
      checkout_session_id = v_checkout_id,
      status = 'pending_payment',
      provider_name = 'internal_demo',
      provider_reference = NULL,
      provider_event_id = NULL,
      amount_cents = v_amount_cents,
      currency = 'BRL',
      payment_expires_at = v_expires_at,
      paid_at = NULL,
      current_period_start = NULL,
      current_period_end = NULL,
      canceled_at = NULL,
      metadata = jsonb_build_object('source', 'plans_checkout', 'generated_at', now())
    WHERE id = v_open_subscription.id;

    RETURN QUERY
    SELECT
      s.id,
      s.checkout_session_id,
      s.plan_slug,
      s.billing_cycle,
      s.status,
      s.payment_method,
      s.amount_cents,
      s.currency,
      s.payment_expires_at
    FROM public.store_subscriptions s
    WHERE s.id = v_open_subscription.id;

    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.store_subscriptions (
    user_id,
    plan_slug,
    billing_cycle,
    status,
    payment_method,
    checkout_session_id,
    provider_name,
    amount_cents,
    currency,
    payment_expires_at,
    metadata
  )
  VALUES (
    v_user_id,
    p_plan_slug,
    p_billing_cycle,
    'pending_payment',
    p_payment_method,
    v_checkout_id,
    'internal_demo',
    v_amount_cents,
    'BRL',
    v_expires_at,
    jsonb_build_object('source', 'plans_checkout', 'generated_at', now())
  )
  RETURNING
    id,
    checkout_session_id,
    plan_slug,
    billing_cycle,
    status,
    payment_method,
    amount_cents,
    currency,
    payment_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.start_plan_checkout(TEXT, public.plan_billing_cycle, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_plan_checkout(TEXT, public.plan_billing_cycle, TEXT) TO authenticated;

-- Forca recarga do cache de schema do PostgREST
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;


-- ===== END 20260402132000_start_plan_checkout_rpc_repair.sql =====

