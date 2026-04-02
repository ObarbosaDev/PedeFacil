-- Account security upgrade: optional OTP, trusted devices and step-up controls
CREATE TABLE IF NOT EXISTS public.user_security_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  otp_enabled BOOLEAN NOT NULL DEFAULT false,
  require_step_up_for_critical_actions BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT 'Dispositivo confiavel',
  trusted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_last_used
  ON public.trusted_devices(user_id, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_fingerprint
  ON public.trusted_devices(user_id, device_fingerprint);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own security settings" ON public.user_security_settings;
CREATE POLICY "Users can view own security settings"
  ON public.user_security_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own security settings" ON public.user_security_settings;
CREATE POLICY "Users can insert own security settings"
  ON public.user_security_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own security settings" ON public.user_security_settings;
CREATE POLICY "Users can update own security settings"
  ON public.user_security_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can view own trusted devices"
  ON public.trusted_devices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can insert own trusted devices"
  ON public.trusted_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can update own trusted devices"
  ON public.trusted_devices FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can delete own trusted devices"
  ON public.trusted_devices FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_security_settings_updated_at ON public.user_security_settings;
CREATE TRIGGER update_user_security_settings_updated_at
BEFORE UPDATE ON public.user_security_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trusted_devices_updated_at ON public.trusted_devices;
CREATE TRIGGER update_trusted_devices_updated_at
BEFORE UPDATE ON public.trusted_devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user_security_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_security_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_security_defaults ON auth.users;
CREATE TRIGGER on_auth_user_security_defaults
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_security_defaults();
