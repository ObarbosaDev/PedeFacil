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

## 6. Quick Start

```bash
npm install
npm run dev
```

Aplicacao local padrao:

- http://localhost:5173

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
- `/admin/loja`
- `/admin/fidelidade`

## 11. Project Structure

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

## 12. Deploy (Lovable + GitHub)

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

## 13. Production Checklist

Antes de publicar:

- Rodar `npm run lint`
- Rodar `npm run test`
- Rodar `npm run build`
- Conferir variaveis de ambiente no deploy
- Validar fluxo cliente completo (menu -> checkout -> pedido)
- Validar fluxo lojista (kanban e atualizacao de status)

## 14. Troubleshooting

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

## 15. Future Improvements

- Drag-and-drop real no Kanban
- Endereco de entrega estruturado no checkout
- Pagamento online (gateway)
- Notificacoes em tempo real para pedidos
- Telemetria e metricas de conversao

## 16. License

Uso interno/proprietario (ajuste esta secao para sua licenca oficial quando necessario).
