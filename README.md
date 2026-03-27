# PedeFacil

Plataforma SaaS para pequenos negocios venderem online com cardapio digital, checkout simplificado e pedidos via WhatsApp.

## 1. Product Overview

O PedeFacil conecta tres experiencias em um unico fluxo:

- Cliente: escolhe loja, monta carrinho e finaliza pedido.
- Lojista: recebe e gerencia pedidos em Kanban, controla catalogo e loja.
- Operacao: dados salvos em Supabase com regras de seguranca (RLS).

Objetivo do produto:

- reduzir friccao para vender online
- acelerar atendimento no WhatsApp
- dar controle de operacao para o lojista

## 2. Main Features

### 2.1 Cliente

- Painel de lojas ativas em `/cliente`
- Cardapio publico por slug em `/loja/:slug`
- Carrinho com controle de quantidade
- Checkout com dados do cliente e tipo de pedido
- Geracao de mensagem para WhatsApp

### 2.2 Lojista

- Login e registro
- Dashboard com visao geral
- CRUD de categorias
- CRUD de produtos (com disponibilidade)
- Pedidos em Kanban com avancar status e cancelamento
- Configuracoes da loja
- Fidelidade por pontos
- Cupons de desconto
- Automacao de WhatsApp (webhook + templates + fila de eventos)

### 2.3 Plataforma

- Auth via Supabase
- Banco Postgres com relacionamentos
- RLS para isolamento por estabelecimento
- Frontend responsivo com React + Tailwind + shadcn/ui

## 3. Status Flow de Pedidos

Fluxo principal:

`received -> confirmed -> in_preparation -> ready -> delivered`

Fluxo alternativo:

`any_non_final -> cancelled`

## 4. Tech Stack

- Frontend: React 18, TypeScript, Vite
- UI: TailwindCSS, shadcn/ui, Lucide
- Data fetching/cache: TanStack Query
- Forms/validation: React Hook Form + Zod
- Backend BaaS: Supabase (Auth, Postgres, Storage)
- Tests: Vitest (+ setup para testes de frontend)

## 5. Requirements

- Node.js 18+
- npm 9+
- Java 11
- Maven 3.9+

## 6. Quick Start

### 6.1 Frontend

```bash
npm install
npm run dev
```

Aplicacao local padrao:

- http://localhost:5173

### 6.2 Backend Java 11 (sem Docker)

```bash
npm run backend:dev
```

Backend local padrao:

- http://localhost:8080

## 7. Environment Variables

Crie `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="SUA_ANON_KEY"
VITE_SUPABASE_PROJECT_ID="SEU_PROJECT_ID"
```

Observacoes:

- `VITE_*` fica exposto no bundle frontend. Nao coloque secrets sensiveis.
- Use apenas chave anon/publicavel no frontend.

## 8. Scripts

- `npm run dev`: sobe ambiente local (Vite)
- `npm run backend:dev`: sobe o receiver Java 11 (Spring Boot)
- `npm run backend:build`: gera o jar do backend Java
- `npm run backend:test`: roda os testes do backend Java
- `npm run build`: build de producao
- `npm run build:dev`: build com modo development
- `npm run preview`: preview local do build
- `npm run lint`: lint do projeto
- `npm run test`: executa testes
- `npm run test:watch`: testes em watch mode

## 9. Database and Supabase

### 9.1 Migrations

- Local: `supabase/migrations/`

### 9.2 Core Entities

- `profiles`
- `user_roles`
- `establishments`
- `categories`
- `products`
- `customers`
- `orders`
- `order_items`
- `loyalty_accounts`
- `coupons`
- `whatsapp_automation_settings`
- `whatsapp_message_templates`
- `whatsapp_automation_events`

### 9.3 Security (RLS)

- Lojista acessa apenas dados vinculados ao seu estabelecimento
- Cliente/anonimo pode criar pedidos e itens de pedido
- Leitura publica para cardapio conforme politicas

## 10. Routes Map

### 10.1 Public

- `/` landing page
- `/cliente` painel do cliente
- `/loja/:slug` cardapio publico
- `/loja/:slug/checkout` checkout

### 10.2 Auth

- `/login`
- `/registro`

### 10.3 Admin

- `/admin`
- `/admin/pedidos`
- `/admin/produtos`
- `/admin/categorias`
- `/admin/cupons`
- `/admin/automacoes`
- `/admin/loja`
- `/admin/fidelidade`

## 11. Automacao WhatsApp

### 11.1 O que foi implementado

- Configuracao por loja (`whatsapp_automation_settings`)
- Templates por evento (`whatsapp_message_templates`)
- Fila de eventos (`whatsapp_automation_events`)
- Trigger no banco para enfileirar evento em:
  - novo pedido
  - mudanca de status do pedido
- Worker via Edge Function:
  - `supabase/functions/whatsapp-automation-worker/index.ts`
  - processa pendentes/failed
  - monta mensagem via template
  - dispara para webhook
  - atualiza status para `sent` ou `failed`

### 11.2 Como ativar

1. Aplicar migrations no Supabase (inclui `20260327160000_whatsapp_automation_base.sql`).
2. Publicar Edge Function:

```bash
supabase functions deploy whatsapp-automation-worker
```

3. Configurar secret opcional para proteger execucao manual/cron:

```bash
supabase secrets set AUTOMATION_RUNNER_TOKEN="seu_token_forte"
```

4. No painel do lojista (`/admin/automacoes`):
  - habilitar automacao
  - informar `webhook_url`
  - ajustar templates

### 11.3 Execucao manual (teste)

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/whatsapp-automation-worker" \
  -H "Content-Type: application/json" \
  -H "x-automation-runner-token: <AUTOMATION_RUNNER_TOKEN>" \
  -d '{"limit":20}'
```

### 11.4 Sugestao de cron

- Rodar a cada 1 minuto (GitHub Actions, cron externo, n8n ou scheduler do seu backend)
- Chamar a Edge Function com token
- Limite recomendado por ciclo: `20` a `50` eventos

### 11.5 Receiver Java 11 pronto (webhook/provedor)

Arquivos:

- `backend/pom.xml`
- `backend/src/main/java/com/pedefacil/automation/AutomationReceiverApplication.java`
- `backend/src/main/resources/application.yml`
- `backend/.env.example`

Executar:

```bash
npm run backend:dev
```

Endpoints:

- `POST /webhook/pedefacil`
- `GET /health`

Como configurar (sem Docker):

1. Ajuste as variaveis de ambiente com base em `backend/.env.example` (arquivo de referencia).
2. Rode o backend com Java 11 e Maven.
3. Em `/admin/automacoes`, configure:
   - `Webhook URL`: `https://seu-dominio.com/webhook/pedefacil`
   - `Webhook secret`: mesmo valor de `PEDEFACIL_SIGNATURE_SECRET`
4. Ative a automacao.

Exemplo no PowerShell:

```bash
$env:OUTBOUND_MODE="log"
$env:PEDEFACIL_SIGNATURE_SECRET="sua_chave_forte"
npm run backend:dev
```

Modos suportados no receiver Java:

- `OUTBOUND_MODE=webhook` (encaminha para endpoint proprio)
- `OUTBOUND_MODE=evolution` (envia para Evolution API)
- `OUTBOUND_MODE=zapi` (envia para Z-API)
- `OUTBOUND_MODE=log` (somente log local para testes)

### 11.6 Receiver Node (legado)

Arquivo:

- `automation/whatsapp-receiver.mjs`

Template de env:

- `automation/.env.example`

Executar:

```bash
npm run automation:receiver
```

Endpoint do receiver:

- `POST /webhook/pedefacil`
- `GET /health`

Como plugar com o painel (`/admin/automacoes`):

1. Em `Webhook URL`, coloque a URL publica do receiver + rota:
   - `https://seu-dominio.com/webhook/pedefacil`
2. Em `Webhook secret`, use o mesmo valor de `PEDEFACIL_SIGNATURE_SECRET`.
3. Salve as configuracoes e ative a automacao.

Modos suportados no receiver:

- `OUTBOUND_MODE=webhook` (encaminha para um endpoint seu)
- `OUTBOUND_MODE=evolution` (envia para Evolution API)
- `OUTBOUND_MODE=zapi` (envia para Z-API)
- `OUTBOUND_MODE=log` (somente loga no console para teste)
## 12. Project Structure

```text
src/
|-- components/
|   |-- dashboard/
|   |-- layout/
|   |-- store/
|   `-- ui/
|-- hooks/
|-- integrations/
|   `-- supabase/
|-- lib/
|-- pages/
|   |-- admin/
|   |-- auth/
|   |-- client/
|   `-- public/
`-- test/
```

## 13. Deploy (Lovable + GitHub)

Fluxo recomendado:

1. Commit e push para `main`.
2. No projeto Lovable, execute Sync/Pull do GitHub.
3. Publique (Publish/Deploy) se nao estiver automatico.

Comandos:

```bash
git add .
git commit -m "feat: update"
git push origin main
```

## 14. Production Checklist

Antes de publicar:

- Rodar `npm run lint`
- Rodar `npm run test`
- Rodar `npm run build`
- Conferir variaveis de ambiente no deploy
- Validar fluxo cliente completo (menu -> checkout -> pedido)
- Validar fluxo lojista (kanban e atualizacao de status)

## 15. Troubleshooting

### `npm` bloqueado no PowerShell (ExecutionPolicy)

Use:

```bash
npm.cmd run dev
npm.cmd run build
```

### Erro de build por dependencia faltando

```bash
npm install
```

### App abre sem dados

- Confira `.env`
- Verifique politicas RLS e tabelas no Supabase
- Garanta que existam estabelecimentos ativos (`is_active = true`)

## 16. Future Improvements

- Drag-and-drop real no Kanban
- Endereco de entrega estruturado no checkout
- Pagamento online (gateway)
- Notificacoes em tempo real para pedidos
- Telemetria e metricas de conversao

## 17. License

Uso interno/proprietario (ajuste esta secao para sua licenca oficial quando necessario).
