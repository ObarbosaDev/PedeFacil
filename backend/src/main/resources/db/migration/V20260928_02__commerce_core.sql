CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES app_users(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('pizzaria', 'hamburgueria', 'acaiteria', 'restaurante')),
  phone TEXT,
  description TEXT,
  logo_path TEXT,
  cover_path TEXT,
  street TEXT,
  number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  operation_status TEXT NOT NULL DEFAULT 'closed' CHECK (operation_status IN ('open', 'closed', 'preorder')),
  accepts_preorders BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE store_members (
  store_id UUID NOT NULL REFERENCES stores(id),
  user_id UUID NOT NULL REFERENCES app_users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, user_id)
);

CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  UNIQUE (store_id, weekday, opens_at)
);

CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  zip_prefix TEXT NOT NULL CHECK (zip_prefix ~ '^[0-9]{3,8}$'),
  fee_cents BIGINT NOT NULL CHECK (fee_cents >= 0),
  minimum_order_cents BIGINT NOT NULL DEFAULT 0 CHECK (minimum_order_cents >= 0),
  free_over_cents BIGINT CHECK (free_over_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (store_id, zip_prefix)
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  UNIQUE (store_id, id)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  category_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  image_path TEXT,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, category_id) REFERENCES categories(store_id, id)
);

CREATE TABLE product_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  name TEXT NOT NULL,
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INTEGER NOT NULL DEFAULT 1 CHECK (max_select >= min_select),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id)
);

CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  group_id UUID NOT NULL,
  name TEXT NOT NULL,
  price_delta_cents BIGINT NOT NULL DEFAULT 0 CHECK (price_delta_cents >= 0),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, group_id) REFERENCES product_option_groups(store_id, id)
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, phone),
  UNIQUE (store_id, id)
);

CREATE TABLE customer_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  granted BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  FOREIGN KEY (store_id, customer_id) REFERENCES customers(store_id, id)
);

CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value BIGINT NOT NULL CHECK (discount_value > 0),
  minimum_order_cents BIGINT NOT NULL DEFAULT 0,
  maximum_discount_cents BIGINT,
  usage_limit INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE (store_id, code),
  UNIQUE (store_id, id)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  customer_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  tracking_token_hash TEXT NOT NULL UNIQUE,
  order_number BIGINT GENERATED ALWAYS AS IDENTITY,
  status TEXT NOT NULL CHECK (status IN (
    'pending_payment', 'received', 'confirmed', 'in_preparation', 'ready',
    'out_for_delivery', 'delivered', 'payment_failed', 'cancelled_by_store',
    'cancelled_by_customer', 'delivery_failed', 'refunded')),
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('delivery', 'pickup')),
  scheduled_for TIMESTAMPTZ,
  address_snapshot JSONB,
  customer_name_snapshot TEXT NOT NULL,
  customer_phone_snapshot TEXT NOT NULL,
  subtotal_cents BIGINT NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents BIGINT NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  delivery_fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  estimated_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, id),
  UNIQUE (store_id, idempotency_key),
  FOREIGN KEY (store_id, customer_id) REFERENCES customers(store_id, id),
  CHECK (total_cents = subtotal_cents - discount_cents + delivery_fee_cents)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  product_id UUID,
  name_snapshot TEXT NOT NULL,
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id),
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id),
  UNIQUE (store_id, id)
);

CREATE TABLE order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  option_id UUID,
  name_snapshot TEXT NOT NULL,
  price_delta_cents BIGINT NOT NULL CHECK (price_delta_cents >= 0),
  FOREIGN KEY (store_id, order_item_id) REFERENCES order_items(store_id, id),
  FOREIGN KEY (store_id, option_id) REFERENCES product_options(store_id, id)
);

CREATE TABLE order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor_user_id UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id)
);

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  coupon_id UUID NOT NULL,
  order_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (store_id, coupon_id) REFERENCES coupons(store_id, id),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id),
  UNIQUE (store_id, order_id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT UNIQUE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id)
);

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_event_id)
);

CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  user_id UUID NOT NULL REFERENCES app_users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (store_id, user_id),
  UNIQUE (store_id, id)
);

CREATE TABLE delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  order_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'picked_up', 'delivered', 'failed')),
  delivery_pin_hash TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id),
  FOREIGN KEY (store_id, driver_id) REFERENCES drivers(store_id, id)
);

CREATE TABLE delivery_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  assignment_id UUID NOT NULL REFERENCES delivery_assignments(id),
  previous_status TEXT,
  next_status TEXT NOT NULL,
  occurrence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  order_id UUID REFERENCES orders(id),
  channel TEXT NOT NULL,
  event_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id),
  plan_slug TEXT NOT NULL CHECK (plan_slug IN ('direto', 'crescimento')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'pending_payment', 'expired', 'cancelled')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  actor_user_id UUID REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_store_status_created ON orders (store_id, status, created_at DESC);
CREATE INDEX idx_orders_store_customer_created ON orders (store_id, customer_id, created_at DESC);
CREATE INDEX idx_order_events_store_order_created ON order_status_events (store_id, order_id, created_at);
CREATE INDEX idx_products_store_category_sort ON products (store_id, category_id, sort_order);
CREATE INDEX idx_customers_store_updated ON customers (store_id, updated_at DESC);
CREATE INDEX idx_payment_events_store_created ON payment_events (store_id, created_at DESC);
