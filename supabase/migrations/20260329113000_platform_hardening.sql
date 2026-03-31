-- Platform hardening: audit trail and customer order history
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON public.audit_logs(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity_type, entity_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_user_id OR actor_user_id IS NULL);

DROP POLICY IF EXISTS "Store owners can view own establishment audit logs" ON public.audit_logs;
CREATE POLICY "Store owners can view own establishment audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.owner_id = auth.uid()
        AND audit_logs.entity_type = 'establishment'
        AND audit_logs.entity_id = e.id::text
    )
    OR actor_user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_action TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    entity_type,
    entity_id,
    action,
    metadata,
    ip_address,
    user_agent
  )
  VALUES (
    p_actor_user_id,
    p_actor_role,
    p_entity_type,
    p_entity_id,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.customer_order_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_order_links_user_created
  ON public.customer_order_links(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_order_links_establishment
  ON public.customer_order_links(establishment_id, created_at DESC);

ALTER TABLE public.customer_order_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own order links" ON public.customer_order_links;
CREATE POLICY "Customers can view own order links"
  ON public.customer_order_links FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers can insert own order links" ON public.customer_order_links;
CREATE POLICY "Customers can insert own order links"
  ON public.customer_order_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Store owners can view order links from their establishment" ON public.customer_order_links;
CREATE POLICY "Store owners can view order links from their establishment"
  ON public.customer_order_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = customer_order_links.establishment_id
        AND e.owner_id = auth.uid()
    )
  );
