# Banco definitivo: caminho sério para sair do Supabase

Data: 2026-04-20

## Resumo direto

Hoje o projeto **não depende só de Postgres**.

Ele depende de Supabase em quatro camadas:

1. Banco Postgres + migrations SQL
2. Auth (`supabase.auth`, `auth.users`, `auth.uid()`)
3. Storage (`storage.objects`, buckets e upload direto no frontend)
4. RPC / RLS / Realtime (`rpc`, `channel`, policies com `auth.uid()`)

Trocar apenas a connection string **não resolve**.

## Inventário rápido do acoplamento atual

- ocorrências de dependência Supabase/Auth/Storage/RPC/Realtime: `196`
- chamadas `rpc(...)` no frontend: `12`
- usos diretos de auth/storage/realtime no frontend: `28`

Leitura prática:

- sair do Supabase de forma definitiva exige **novo backend dono da regra**
- o banco novo precisa receber schema + dados
- auth, storage e realtime precisam de substitutos

## Recomendação objetiva

### Escolha de banco

Para o seu caso, o melhor equilíbrio entre custo, robustez e operação é:

1. `Render Postgres` se a prioridade for operação mais simples com o backend já hospedado lá
2. `Railway Postgres` se a prioridade for custo de entrada menor e elasticidade de uso

Motivo:

- `Render Postgres` oferece Postgres gerenciado, backups, PITR e HA em planos pagos:
  - https://render.com/docs/postgresql
  - https://render.com/docs/postgresql-refresh
- `Railway` tem entrada financeira baixa e cobrança por uso:
  - https://docs.railway.com/pricing
  - https://docs.railway.com/reference/pricing/plans

## Minha recomendação final

### Banco

`Render Postgres`

### Arquitetura definitiva

1. `Render Postgres` como banco central
2. backend Spring como **camada obrigatória** de negócio
3. frontend deixando de falar direto com Supabase
4. auth próprio no backend
5. storage fora do Supabase

## O que precisa ser substituído

### 1. Banco

Migrar:

- todas as migrations de `supabase/migrations`
- todos os dados de produção

### 2. Auth

Hoje o sistema depende de:

- `auth.users`
- `auth.uid()`
- `supabase.auth.signUp`
- `supabase.auth.signInWithPassword`
- `supabase.auth.signInWithOtp`
- `supabase.auth.verifyOtp`
- `supabase.auth.resetPasswordForEmail`

No modelo definitivo, isso precisa virar:

- tabela própria de usuários
- hash de senha
- refresh token
- sessão JWT própria
- confirmação de e-mail própria
- reset de senha próprio
- OTP opcional próprio

### 3. Storage

Hoje existem buckets e uploads diretos:

- `product-images`
- `driver-images`
- `delivery-proofs`

No definitivo:

- usar `Cloudflare R2` ou `S3-compatible`
- upload via backend assinado ou proxy do backend

### 4. RLS e RPC

Hoje existe regra crítica no banco via:

- policies com `auth.uid()`
- funções RPC
- triggers ligadas a `auth.users`

No definitivo:

- segurança sobe para o backend
- banco fica com integridade, índices, constraints e procedures úteis
- autorização fica em API/service layer

### 5. Realtime

Hoje existe uso de:

- `channel(...)`
- invalidação por mudança em `orders`
- tracking em tempo real

No definitivo:

- curto prazo: polling controlado
- médio prazo: WebSocket/SSE no backend

## Fases corretas

### Fase 1: banco novo no ar

Objetivo:

- criar novo Postgres
- aplicar schema adaptado
- subir ambiente paralelo

Entrega:

- banco novo acessível
- extensão e índices definidos
- migrations portadas

### Fase 2: compatibilidade de schema

Objetivo:

- remover dependência de schemas exclusivos do Supabase

Itens:

- substituir `auth.users` por tabela própria
- remover dependência de `storage.*`
- revisar views e policies ligadas ao Supabase Auth

### Fase 3: auth próprio

Objetivo:

- criar módulo de autenticação no backend

Itens:

- cadastro
- login
- confirmação por e-mail
- reset de senha
- OTP opcional
- refresh token
- roles

### Fase 4: API própria para tudo crítico

Objetivo:

- parar de fazer query direta no frontend

Prioridade:

1. auth
2. checkout
3. pedidos
4. entregador
5. financeiro
6. conta do cliente

### Fase 5: storage próprio

Objetivo:

- trocar upload direto para storage S3-compatible

### Fase 6: corte final do Supabase

Objetivo:

- desligar Supabase da aplicação

Condição mínima:

- frontend sem `supabase.auth`
- frontend sem `.from(...)` direto
- frontend sem `.rpc(...)`
- frontend sem `storage.from(...)`
- frontend sem `channel(...)`

## O que NÃO fazer

1. criar banco novo e apontar o frontend atual direto para ele
2. tentar adaptar `auth.uid()` na gambiarra
3. copiar só tabelas e ignorar triggers/RPC
4. fazer o corte em produção sem ambiente paralelo

## Caminho mais seguro de execução

1. criar novo Postgres gerenciado
2. montar schema compatível
3. importar dados
4. criar auth próprio no backend
5. migrar frontend tela por tela para API própria
6. trocar storage
7. cortar realtime Supabase
8. desligar dependência restante

## Veredito honesto

Sim, dá para fazer o definitivo.

Mas o trabalho real não é “trocar de banco”.

É:

- trocar de banco
- trocar de auth
- trocar de storage
- trocar de autorização
- tirar query direta do frontend

Isso é a migração certa.
