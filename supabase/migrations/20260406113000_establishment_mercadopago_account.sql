BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS mercadopago_access_token TEXT,
  ADD COLUMN IF NOT EXISTS mercadopago_public_key TEXT,
  ADD COLUMN IF NOT EXISTS mercadopago_user_id TEXT;

COMMENT ON COLUMN public.establishments.mercadopago_access_token
  IS 'Token de acesso da conta Mercado Pago da loja. Usado no checkout dos pedidos da propria loja.';
COMMENT ON COLUMN public.establishments.mercadopago_public_key
  IS 'Public key da conta Mercado Pago da loja (opcional nesta fase).';
COMMENT ON COLUMN public.establishments.mercadopago_user_id
  IS 'Identificador da conta Mercado Pago da loja (opcional).';

COMMIT;
