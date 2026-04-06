-- Pede Facil - SQL de validacao pre-lancamento
-- Rode no Supabase SQL Editor apos as migrations.

-- 1) Duplicacao de idempotency_key (nao pode ter)
select establishment_id, idempotency_key, count(*) as total
from public.orders
where idempotency_key is not null
group by establishment_id, idempotency_key
having count(*) > 1;

-- 2) Duplicacao de eventos de pagamento (nao pode ter)
select provider_event_id, count(*) as total
from public.payments_ledger
group by provider_event_id
having count(*) > 1;

-- 3) Lojas sem PIX manual configurado (risco para fallback)
select id, name, pix_key, accepts_marketplace_payments
from public.establishments
where coalesce(trim(pix_key), '') = '';

-- 4) Contas de recebimento MP por loja (visao operacional)
select
  e.id as establishment_id,
  e.name as establishment_name,
  e.accepts_marketplace_payments,
  case when a.establishment_id is null then 'nao' else 'sim' end as has_payment_account,
  case when coalesce(trim(a.mercadopago_access_token), '') = '' then 'nao' else 'sim' end as has_mp_token
from public.establishments e
left join public.establishment_payment_accounts a
  on a.establishment_id = e.id
order by e.created_at desc;

-- 5) Sessoes de pagamento pendentes antigas (avaliar expiracao)
select id, order_id, checkout_session_id, status, created_at, payment_expires_at
from public.order_payment_sessions
where status = 'pending_payment'
order by created_at asc;

-- 6) Pedidos com pagamento pendente e status avancado (inconsistencia)
select id, establishment_id, customer_name, status, payment_status, payment_method, created_at
from public.orders
where payment_status <> 'paid'
  and status in ('in_preparation', 'ready', 'delivered')
order by created_at desc;
