
# PedeFácil — Plataforma de Cardápio Digital e Pedidos via WhatsApp

## Visão Geral
Sistema SaaS onde donos de pequenos negócios criam sua loja, cadastram produtos, disponibilizam cardápio digital público e recebem pedidos via WhatsApp. Backend com Supabase (auth, banco, RLS), frontend React com shadcn/ui.

---

## 1. Backend (Supabase)

### Tabelas
- **profiles** — nome, telefone, avatar (linked to auth.users)
- **user_roles** — papel do usuário (SUPER_ADMIN, STORE_OWNER, ATTENDANT)
- **establishments** — nome, slug, descrição, logo, endereço, whatsapp, horário
- **categories** — nome, ordem, establishment_id
- **products** — nome, preço, descrição, imagem, disponível, category_id, establishment_id
- **customers** — nome, telefone, email
- **orders** — customer_id, establishment_id, status (RECEIVED → CONFIRMED → IN_PREPARATION → READY → DELIVERED / CANCELLED), tipo (retirada/entrega), observação, total
- **order_items** — order_id, product_id, quantidade, preço unitário
- **loyalty_accounts** — customer_id, establishment_id, pontos

### Auth
- Email/senha via Supabase Auth
- RLS em todas as tabelas (donos acessam só seus dados)
- Função `has_role()` para controle de acesso

### Edge Functions
- Geração de mensagem WhatsApp formatada a partir do pedido

---

## 2. Frontend

### Área Pública (sem login)
- **Cardápio Digital** (`/loja/:slug`) — página pública com logo, categorias, produtos com fotos e preços, visual atraente tipo iFood/Rappi
- **Carrinho** — drawer lateral, adicionar/remover itens, subtotal
- **Checkout** — formulário (nome, telefone, observação, retirada/entrega) → gera link WhatsApp com pedido formatado

### Área do Lojista (com login)
- **Login/Registro** — tela moderna com formulário de auth
- **Dashboard** — cards com total de pedidos, pedidos do dia, receita do dia, gráfico simples
- **Minha Loja** — editar dados do estabelecimento, logo, WhatsApp
- **Categorias** — CRUD com drag para reordenar
- **Produtos** — CRUD completo com upload de imagem, preço, disponibilidade
- **Pedidos** — lista com filtros por status, cards com detalhes, botões para avançar status (kanban simplificado)
- **Fidelidade** — visualizar clientes e pontos acumulados

### Design
- Paleta de cores vibrante (laranja/vermelho como cor primária, remetendo a food delivery)
- Cards com sombras suaves e bordas arredondadas
- Ícones Lucide React
- Animações sutis com transições CSS
- Layout responsivo (mobile-first para o cardápio público)
- Tipografia moderna e espaçamento generoso

---

## 3. Fluxos Principais

### Fluxo do Cliente
1. Acessa `/loja/nome-da-loja`
2. Navega categorias e produtos
3. Adiciona ao carrinho
4. Preenche checkout
5. Clica "Enviar Pedido" → abre WhatsApp com mensagem formatada
6. Pedido é salvo no banco

### Fluxo do Lojista
1. Registra conta → cria estabelecimento
2. Cadastra categorias e produtos
3. Compartilha link do cardápio
4. Recebe pedidos no dashboard
5. Atualiza status dos pedidos

---

## 4. Estrutura de Pastas (Frontend)
```
src/
├── components/
│   ├── layout/         (Navbar, Sidebar, Footer)
│   ├── store/          (ProductCard, CategoryList, Cart)
│   ├── dashboard/      (StatsCard, OrderCard, StatusBadge)
│   └── ui/             (shadcn)
├── pages/
│   ├── public/         (Menu, Checkout)
│   ├── auth/           (Login, Register)
│   └── admin/          (Dashboard, Products, Categories, Orders, Store, Loyalty)
├── hooks/              (useAuth, useCart, useOrders)
├── lib/                (utils, whatsapp, formatters)
└── integrations/       (supabase client, types)
```

---

## 5. Seed de Dados
- Estabelecimento de exemplo: "Hamburgueria do João"
- 3 categorias: Hambúrgueres, Bebidas, Sobremesas
- 6-8 produtos com preços
- Alguns pedidos de exemplo
