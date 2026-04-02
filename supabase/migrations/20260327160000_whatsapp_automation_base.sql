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
    ('status_confirmed', 'Seu pedido #{order_id} foi confirmado e já entrou na fila.'),
    ('status_in_preparation', 'Seu pedido #{order_id} está em preparo. Já já sai daí.'),
    ('status_ready', 'Seu pedido #{order_id} está pronto! Pode passar para retirar.'),
    ('status_delivered', 'Pedido #{order_id} finalizado. Valeu por comprar com a gente!'),
    ('status_cancelled', 'Pedido #{order_id} foi cancelado. Se precisar, chama a loja aqui.'),
    ('out_of_hours', 'Estamos fora do horário agora. Assim que abrir, te respondemos por aqui.')
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
    (NEW.id, 'status_confirmed', 'Seu pedido #{order_id} foi confirmado e já entrou na fila.', true),
    (NEW.id, 'status_in_preparation', 'Seu pedido #{order_id} está em preparo. Já já sai daí.', true),
    (NEW.id, 'status_ready', 'Seu pedido #{order_id} está pronto! Pode passar para retirar.', true),
    (NEW.id, 'status_delivered', 'Pedido #{order_id} finalizado. Valeu por comprar com a gente!', true),
    (NEW.id, 'status_cancelled', 'Pedido #{order_id} foi cancelado. Se precisar, chama a loja aqui.', true),
    (NEW.id, 'out_of_hours', 'Estamos fora do horário agora. Assim que abrir, te respondemos por aqui.', true)
  ON CONFLICT (establishment_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_establishment_created_whatsapp_defaults ON public.establishments;
CREATE TRIGGER on_establishment_created_whatsapp_defaults
AFTER INSERT ON public.establishments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_establishment_whatsapp_defaults();

