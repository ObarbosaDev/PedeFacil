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

