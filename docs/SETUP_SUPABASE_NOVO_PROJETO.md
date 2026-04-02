# Setup de Supabase Novo (sem depender de projeto antigo)

Este guia cria um projeto Supabase novo na sua conta e conecta o Pede Fácil.

## 1) Criar projeto novo

1. Acesse `https://app.supabase.com`
2. Clique em `New project`
3. Escolha organização, nome, região e senha do banco
4. Aguarde o projeto ficar pronto

## 2) Pegar credenciais do projeto

No painel do projeto:

- `Project URL`
- `anon public key`
- `Project ID` (o `project-ref`, parte antes de `.supabase.co`)

## 3) Atualizar `.env` da aplicação

Arquivo: `.env` na raiz do repo.

```env
VITE_SUPABASE_URL="https://SEU_PROJECT_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="SUA_ANON_KEY"
VITE_SUPABASE_PROJECT_ID="SEU_PROJECT_REF"
```

## 4) Aplicar schema no projeto novo

### Opção A (recomendada): Supabase CLI

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref SEU_PROJECT_REF
npx supabase@latest db push
```

### Opção B (fallback): SQL Editor

Se a CLI falhar, use o SQL Editor no painel e rode o arquivo:

- `supabase/bootstrap_full.sql`

Ele contém todas as migrations do projeto em sequência.

## 5) Validar RPC crítica de planos

No SQL Editor, rode:

```sql
select proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and proname='start_plan_checkout';
```

Tem que aparecer a função:

- `start_plan_checkout(text, public.plan_billing_cycle, text)`

## 6) Rodar o app local

```powershell
npm run backend:dev
npm run dev
```

