BEGIN;

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS pix_instructions TEXT;

COMMENT ON COLUMN public.establishments.pix_key
  IS 'Chave PIX da loja para fallback manual quando checkout automatico nao estiver ativo.';
COMMENT ON COLUMN public.establishments.pix_recipient_name
  IS 'Nome exibido para o cliente conferir o recebedor do PIX da loja.';
COMMENT ON COLUMN public.establishments.pix_instructions
  IS 'Instrucoes adicionais de pagamento manual PIX para o cliente.';

COMMIT;
