CREATE OR REPLACE FUNCTION public.get_plan_price_cents(
  p_plan_slug TEXT,
  p_billing_cycle public.plan_billing_cycle
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_plan_slug = 'essencial' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 5900 ELSE 4900 END;
  ELSIF p_plan_slug = 'profissional' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 9900 ELSE 7900 END;
  ELSIF p_plan_slug = 'premium' THEN
    RETURN CASE WHEN p_billing_cycle = 'monthly' THEN 17900 ELSE 14900 END;
  END IF;

  RAISE EXCEPTION 'Plano inválido: %', p_plan_slug;
END;
$$;
