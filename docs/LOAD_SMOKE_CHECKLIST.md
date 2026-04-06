# Load Smoke

Teste simples para validar o folego inicial do banco e da API antes de abrir para mais lojas.

## Pre-requisitos

- Projeto Supabase com migrations aplicadas.
- `.env` apontando para o projeto certo.
- Pelo menos 1 loja criada com `establishment_id` valido.

## 1) Rodar smoke de eventos

No PowerShell, dentro da pasta do projeto:

```powershell
$env:VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxx"
npm run load:smoke -- --establishment UUID_REAL_DA_LOJA --requests 3000 --concurrency 60
```

## 2) Validar se gravou

No SQL Editor:

```sql
select count(*) as total
from public.checkout_events
where establishment_id = 'UUID_REAL_DA_LOJA'
  and created_at >= now() - interval '30 minutes';
```

## 3) Criterio minimo de aprovacao

- Falhas no script: `0`.
- Sem erro 5xx na API.
- Dashboard e pedidos continuam abrindo sem travar.
- Tempo de resposta ainda aceitavel para operacao manual.

## 3.1) Teste de carga do painel de pedidos

Esse teste simula muitos paineis consultando pedidos da mesma loja.

No PowerShell, dentro da pasta do projeto:

```powershell
$env:SUPABASE_URL="https://seu-projeto.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxx"
npm run load:orders-panel -- --establishment UUID_REAL_DA_LOJA --requests 3000 --concurrency 120 --page-size 50
```

Criterio inicial recomendado:

- Falhas: `0`
- p95 < `700ms`
- p99 < `1200ms`
- RPS estavel sem crescer erro ao longo do teste

## 4) Se falhar

- Reduzir `concurrency` e repetir.
- Conferir indices aplicados, incluindo [20260406130000_scale_phase2_indexes.sql](/C:/Users/Matheus%20Barbosa/Documents/GitHub/pedefacilteste/supabase/migrations/20260406130000_scale_phase2_indexes.sql).
- Revisar consultas pesadas do dashboard.
