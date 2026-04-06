BEGIN;

CREATE TABLE IF NOT EXISTS public.establishment_payment_accounts (
  establishment_id UUID PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  mercadopago_access_token TEXT NOT NULL,
  mercadopago_public_key TEXT,
  mercadopago_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_establishment_payment_accounts_updated_at ON public.establishment_payment_accounts;
CREATE TRIGGER update_establishment_payment_accounts_updated_at
BEFORE UPDATE ON public.establishment_payment_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.establishment_payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage own payment accounts" ON public.establishment_payment_accounts;
CREATE POLICY "Owners can manage own payment accounts"
  ON public.establishment_payment_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = establishment_payment_accounts.establishment_id
        AND e.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = establishment_payment_accounts.establishment_id
        AND e.owner_id = auth.uid()
    )
  );

-- Migra dados antigos (se existirem colunas sensiveis em establishments)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'establishments'
      AND column_name = 'mercadopago_access_token'
  ) THEN
    INSERT INTO public.establishment_payment_accounts (
      establishment_id,
      mercadopago_access_token,
      mercadopago_public_key,
      mercadopago_user_id
    )
    SELECT
      e.id,
      e.mercadopago_access_token,
      e.mercadopago_public_key,
      e.mercadopago_user_id
    FROM public.establishments e
    WHERE COALESCE(trim(e.mercadopago_access_token), '') <> ''
    ON CONFLICT (establishment_id) DO UPDATE
    SET
      mercadopago_access_token = EXCLUDED.mercadopago_access_token,
      mercadopago_public_key = EXCLUDED.mercadopago_public_key,
      mercadopago_user_id = EXCLUDED.mercadopago_user_id,
      updated_at = now();
  END IF;
END $$;

ALTER TABLE public.establishments
  DROP COLUMN IF EXISTS mercadopago_access_token,
  DROP COLUMN IF EXISTS mercadopago_public_key,
  DROP COLUMN IF EXISTS mercadopago_user_id;

COMMIT;
