BEGIN;

-- Garante total coerente com desconto + taxas no momento do insert.
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
  NEW.delivery_fee := COALESCE(NEW.delivery_fee, 0);
  NEW.service_fee := COALESCE(NEW.service_fee, 0);

  IF NEW.subtotal < 0 THEN
    RAISE EXCEPTION 'Subtotal invalido.';
  END IF;
  IF NEW.delivery_fee < 0 THEN
    RAISE EXCEPTION 'Taxa de entrega invalida.';
  END IF;
  IF NEW.service_fee < 0 THEN
    RAISE EXCEPTION 'Taxa de servico invalida.';
  END IF;

  IF NEW.coupon_id IS NULL THEN
    NEW.discount_amount := 0;
    NEW.coupon_code := NULL;
    NEW.total := round((NEW.subtotal + NEW.delivery_fee + NEW.service_fee)::numeric, 2);
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
  NEW.total := round((NEW.subtotal - calculated_discount + NEW.delivery_fee + NEW.service_fee)::numeric, 2);
  NEW.coupon_code := selected_coupon.code;

  UPDATE public.coupons
  SET usage_count = usage_count + 1
  WHERE id = selected_coupon.id;

  RETURN NEW;
END;
$$;

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
  v_subtotal NUMERIC;
  v_discount_amount NUMERIC;
  v_delivery_fee_payload NUMERIC;
  v_service_fee NUMERIC;
  v_expected_delivery_fee NUMERIC;
  v_expected_total NUMERIC;
  v_order_type public.order_type;
  v_delivery_zip_code TEXT;
  v_zone public.establishment_delivery_zones%ROWTYPE;
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

  v_subtotal := COALESCE((p_order->>'subtotal')::numeric, 0);
  v_discount_amount := COALESCE((p_order->>'discount_amount')::numeric, 0);
  v_delivery_fee_payload := COALESCE((p_order->>'delivery_fee')::numeric, 0);
  v_service_fee := COALESCE((p_order->>'service_fee')::numeric, 0);
  v_total := COALESCE((p_order->>'total')::numeric, 0);
  v_order_type := COALESCE((p_order->>'order_type')::public.order_type, 'pickup'::public.order_type);

  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Subtotal do pedido invalido.';
  END IF;
  IF v_discount_amount < 0 OR v_discount_amount > v_subtotal THEN
    RAISE EXCEPTION 'Desconto do pedido invalido.';
  END IF;
  IF v_delivery_fee_payload < 0 THEN
    RAISE EXCEPTION 'Taxa de entrega invalida.';
  END IF;
  IF v_service_fee < 0 THEN
    RAISE EXCEPTION 'Taxa de servico invalida.';
  END IF;

  IF v_order_type = 'delivery' THEN
    v_delivery_zip_code := regexp_replace(COALESCE(p_order->>'delivery_zip_code', ''), '\D', '', 'g');
    IF length(v_delivery_zip_code) < 5 THEN
      RAISE EXCEPTION 'CEP de entrega obrigatorio.';
    END IF;

    SELECT z.*
    INTO v_zone
    FROM public.establishment_delivery_zones z
    WHERE z.establishment_id = v_establishment_id
      AND z.is_active = true
      AND v_delivery_zip_code LIKE regexp_replace(z.zip_prefix, '\D', '', 'g') || '%'
    ORDER BY length(regexp_replace(z.zip_prefix, '\D', '', 'g')) DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Loja nao entrega neste CEP.';
    END IF;

    IF v_subtotal < COALESCE(v_zone.min_order_value, 0) THEN
      RAISE EXCEPTION 'Pedido minimo para %: R$ %.', v_zone.name, COALESCE(v_zone.min_order_value, 0);
    END IF;

    IF v_zone.free_over_value IS NOT NULL AND v_subtotal >= v_zone.free_over_value THEN
      v_expected_delivery_fee := 0;
    ELSE
      v_expected_delivery_fee := COALESCE(v_zone.fee, 0);
    END IF;
  ELSE
    v_expected_delivery_fee := 0;
  END IF;

  IF abs(v_delivery_fee_payload - v_expected_delivery_fee) > 0.009 THEN
    RAISE EXCEPTION 'Taxa de entrega divergente. Esperado: %.', round(v_expected_delivery_fee::numeric, 2);
  END IF;

  v_expected_total := round((v_subtotal - v_discount_amount + v_expected_delivery_fee + v_service_fee)::numeric, 2);
  IF abs(v_total - v_expected_total) > 0.009 THEN
    RAISE EXCEPTION 'Total do pedido divergente.';
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
      v_order_type,
      NULLIF(p_order->>'observation', ''),
      COALESCE((p_order->>'payment_method')::public.order_payment_method, 'pix'::public.order_payment_method),
      COALESCE((p_order->>'payment_status')::public.order_payment_status, 'pending'::public.order_payment_status),
      v_subtotal,
      v_discount_amount,
      v_expected_delivery_fee,
      v_service_fee,
      NULLIF(p_order->>'coupon_id', '')::uuid,
      NULLIF(p_order->>'coupon_code', ''),
      v_expected_total,
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

-- Corrige pedidos antigos para total = subtotal - desconto + taxas.
UPDATE public.orders
SET total = round((COALESCE(subtotal, 0) - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0) + COALESCE(service_fee, 0))::numeric, 2)
WHERE total IS DISTINCT FROM round((COALESCE(subtotal, 0) - COALESCE(discount_amount, 0) + COALESCE(delivery_fee, 0) + COALESCE(service_fee, 0))::numeric, 2);

COMMIT;
