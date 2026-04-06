alter table public.establishments
  add column if not exists accepting_orders_now boolean not null default true,
  add column if not exists closed_message text;

update public.establishments
set
  accepting_orders_now = coalesce(accepting_orders_now, true),
  closed_message = coalesce(closed_message, 'Loja fechada no momento. Se quiser, já deixa agendado para amanhã.')
where true;
