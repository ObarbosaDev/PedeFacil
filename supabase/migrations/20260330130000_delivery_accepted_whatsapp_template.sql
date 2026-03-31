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
