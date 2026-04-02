# Load Smoke (rápido)

Teste simples para validar fôlego inicial do banco/API antes de abrir mais lojas.

## Pré-requisitos

- Projeto Supabase com migrations aplicadas.
- `.env` apontando para o projeto certo.
- Pelo menos 1 loja criada (precisa do `establishment_id`).

## 1) Rodar smoke de eventos

```bash
npm run load:smoke -- --establishment SEU_ESTABLISHMENT_ID --requests 3000 --concurrency 60
```

## 2) Validar se gravou

No SQL Editor:

```sql
select count(*) as total
from public.checkout_events
where establishment_id = 'SEU_ESTABLISHMENT_ID'
  and created_at >= now() - interval '30 minutes';
```

## 3) Critério mínimo de aprovação

- Falhas no script: `0`
- Sem erro 5xx na API
- Dashboard e pedidos continuam abrindo sem travar
- Tempo de resposta ainda aceitável para operação manual

## 4) Se falhar

- Reduzir `concurrency` e repetir.
- Conferir índices aplicados (migration `20260402143000_scale_hardening.sql`).
- Revisar queries com `limit` alto no dashboard.

