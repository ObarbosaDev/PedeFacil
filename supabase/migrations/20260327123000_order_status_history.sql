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
