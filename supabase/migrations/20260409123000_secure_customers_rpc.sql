BEGIN;

DROP POLICY IF EXISTS "Authenticated can view customers" ON public.customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON public.customers;

CREATE OR REPLACE FUNCTION public.upsert_customer_contact(
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := trim(COALESCE(p_name, ''));
  v_phone TEXT := trim(COALESCE(p_phone, ''));
  v_email TEXT := NULLIF(trim(COALESCE(p_email, '')), '');
  v_customer_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'Nome do cliente obrigatorio.';
  END IF;

  IF v_phone = '' THEN
    RAISE EXCEPTION 'Telefone do cliente obrigatorio.';
  END IF;

  SELECT c.id
  INTO v_customer_id
  FROM public.customers c
  WHERE c.phone = v_phone
    AND c.name = v_name
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET email = COALESCE(v_email, email),
        updated_at = now()
    WHERE id = v_customer_id;

    RETURN v_customer_id;
  END IF;

  INSERT INTO public.customers (name, phone, email)
  VALUES (v_name, v_phone, v_email)
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_customer_contact(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_contact(TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
