BEGIN;

DROP FUNCTION IF EXISTS public.get_available_driver_offers();
CREATE OR REPLACE FUNCTION public.get_available_driver_offers()
RETURNS TABLE (
  order_id UUID,
  establishment_id UUID,
  establishment_name TEXT,
  delivery_operation_mode TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  order_total NUMERIC,
  order_status public.order_status,
  payout_amount NUMERIC,
  eta_minutes INTEGER,
  created_at TIMESTAMPTZ,
  delivery_street TEXT,
  delivery_number TEXT,
  delivery_neighborhood TEXT,
  delivery_city TEXT,
  delivery_state TEXT,
  delivery_zip_code TEXT,
  delivery_reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver public.delivery_drivers%ROWTYPE;
  v_active_count INTEGER := 0;
BEGIN
  SELECT *
  INTO v_driver
  FROM public.delivery_drivers
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  IF v_driver.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.order_deliveries od
  WHERE od.driver_id = v_driver.id
    AND od.status IN ('assigned', 'accepted', 'picked_up');

  IF v_active_count >= COALESCE(v_driver.max_active_deliveries, 1) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    e.id,
    e.name,
    COALESCE(e.delivery_operation_mode, 'own_fleet'),
    o.customer_name,
    o.customer_phone,
    o.total,
    o.status,
    GREATEST(COALESCE(v_driver.payout_per_delivery, 0), COALESCE(e.default_driver_payout, 0)) AS payout_amount,
    COALESCE(o.eta_minutes, 35) AS eta_minutes,
    o.created_at,
    o.delivery_street,
    o.delivery_number,
    o.delivery_neighborhood,
    o.delivery_city,
    o.delivery_state,
    o.delivery_zip_code,
    o.delivery_reference
  FROM public.orders o
  JOIN public.establishments e ON e.id = o.establishment_id
  WHERE o.order_type = 'delivery'
    AND o.status IN ('confirmed', 'in_preparation', 'ready')
    AND (
      (v_driver.establishment_id IS NOT NULL AND e.id = v_driver.establishment_id)
      OR COALESCE(e.delivery_operation_mode, 'own_fleet') IN ('shared_fleet', 'hybrid')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.order_deliveries od
      WHERE od.order_id = o.id
        AND od.status IN ('assigned', 'accepted', 'picked_up', 'delivered')
    )
  ORDER BY
    CASE WHEN o.status = 'ready' THEN 0 WHEN o.status = 'in_preparation' THEN 1 ELSE 2 END,
    o.created_at ASC
  LIMIT 12;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_driver_offers() TO authenticated;

DROP FUNCTION IF EXISTS public.accept_driver_offer(UUID);
CREATE OR REPLACE FUNCTION public.accept_driver_offer(p_order_id UUID)
RETURNS TABLE (
  delivery_id UUID,
  order_id UUID,
  driver_id UUID,
  delivery_status public.delivery_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver public.delivery_drivers%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_establishment public.establishments%ROWTYPE;
  v_existing public.order_deliveries%ROWTYPE;
  v_active_count INTEGER := 0;
  v_tracking_token TEXT;
  v_confirmation_code TEXT;
BEGIN
  SELECT *
  INTO v_driver
  FROM public.delivery_drivers
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de entregador não encontrado.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND order_type = 'delivery'
    AND status IN ('confirmed', 'in_preparation', 'ready')
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Essa corrida não está mais disponível.';
  END IF;

  SELECT *
  INTO v_establishment
  FROM public.establishments
  WHERE id = v_order.establishment_id
  LIMIT 1;

  IF v_driver.establishment_id IS NOT NULL AND v_driver.establishment_id <> v_order.establishment_id
     AND COALESCE(v_establishment.delivery_operation_mode, 'own_fleet') NOT IN ('shared_fleet', 'hybrid') THEN
    RAISE EXCEPTION 'Essa corrida não está liberada para sua base.';
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.order_deliveries od
  WHERE od.driver_id = v_driver.id
    AND od.status IN ('assigned', 'accepted', 'picked_up');

  IF v_active_count >= COALESCE(v_driver.max_active_deliveries, 1) THEN
    RAISE EXCEPTION 'Você já está no limite de corridas simultâneas.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.order_deliveries od
  WHERE od.order_id = p_order_id
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.status IN ('assigned', 'accepted', 'picked_up', 'delivered') THEN
    RAISE EXCEPTION 'Outro entregador já puxou essa corrida.';
  END IF;

  v_tracking_token := COALESCE(v_existing.tracking_token, replace(gen_random_uuid()::text, '-', ''));
  v_confirmation_code := COALESCE(v_existing.confirmation_code, lpad((floor(random() * 10000))::int::text, 4, '0'));

  INSERT INTO public.order_deliveries (
    order_id,
    establishment_id,
    driver_id,
    status,
    assigned_at,
    accepted_at,
    accepted_deadline_at,
    tracking_token,
    confirmation_code,
    payout_amount,
    eta_minutes,
    cancelled_at,
    delivered_at,
    picked_up_at,
    issue_reason,
    notes
  )
  VALUES (
    v_order.id,
    v_order.establishment_id,
    v_driver.id,
    'accepted',
    now(),
    now(),
    now(),
    v_tracking_token,
    v_confirmation_code,
    GREATEST(COALESCE(v_driver.payout_per_delivery, 0), COALESCE(v_establishment.default_driver_payout, 0)),
    COALESCE(v_order.eta_minutes, 35),
    NULL,
    NULL,
    NULL,
    NULL,
    'Aceita direto pelo painel do entregador'
  )
  ON CONFLICT (order_id) DO UPDATE
  SET
    driver_id = EXCLUDED.driver_id,
    status = 'accepted',
    assigned_at = now(),
    accepted_at = now(),
    accepted_deadline_at = now(),
    tracking_token = EXCLUDED.tracking_token,
    confirmation_code = EXCLUDED.confirmation_code,
    payout_amount = EXCLUDED.payout_amount,
    eta_minutes = EXCLUDED.eta_minutes,
    cancelled_at = NULL,
    delivered_at = NULL,
    picked_up_at = NULL,
    issue_reason = NULL,
    notes = EXCLUDED.notes
  WHERE public.order_deliveries.status = 'cancelled';

  UPDATE public.delivery_drivers
  SET
    is_available = false,
    availability_mode = 'busy'
  WHERE id = v_driver.id;

  RETURN QUERY
  SELECT od.id, od.order_id, od.driver_id, od.status
  FROM public.order_deliveries od
  WHERE od.order_id = v_order.id
    AND od.driver_id = v_driver.id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_driver_offer(UUID) TO authenticated;

COMMIT;
