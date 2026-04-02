BEGIN;

-- Recria a view sem SECURITY DEFINER para respeitar RLS do usuário logado.
DROP VIEW IF EXISTS public.driver_reputation_metrics;

CREATE VIEW public.driver_reputation_metrics
WITH (security_invoker = true) AS
SELECT
  d.id AS driver_id,
  d.establishment_id,
  d.full_name,
  COUNT(od.id)::INTEGER AS deliveries_total,
  COUNT(*) FILTER (WHERE od.status = 'delivered')::INTEGER AS deliveries_completed,
  AVG(f.rating)::NUMERIC(10,2) AS avg_rating,
  COUNT(f.id)::INTEGER AS ratings_total,
  COUNT(*) FILTER (
    WHERE od.status = 'delivered'
      AND od.accepted_deadline_at IS NOT NULL
      AND od.accepted_at IS NOT NULL
      AND od.accepted_at > od.accepted_deadline_at
  )::INTEGER AS late_acceptances
FROM public.delivery_drivers d
LEFT JOIN public.order_deliveries od ON od.driver_id = d.id
LEFT JOIN public.driver_delivery_feedback f ON f.delivery_id = od.id
GROUP BY d.id, d.establishment_id, d.full_name;

GRANT SELECT ON public.driver_reputation_metrics TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
