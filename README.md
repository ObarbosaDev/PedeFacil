# Pede Fácil

Plataforma de pedidos para negócios locais venderem online com experiência premium para **cliente**, **lojista** e **entregador**, com operação centralizada, segurança reforçada e automações via WhatsApp.

## Visão do Produto

O Pede Fácil foi desenhado para profissionalizar a operação de delivery e retirada de pequenos e médios comércios sem complicar o dia a dia.

O sistema conecta três jornadas principais:

- Cliente: descobre lojas, monta pedido, aplica cupom, finaliza com conta segura e acompanha a entrega.
- Lojista: gerencia cardápio, pedidos em Kanban, entregadores, cupons, automações e configurações de operação.
- Entregador: recebe corridas, atualiza status, reporta ocorrências e confirma entrega com PIN.

## Proposta de Valor

- Aumentar conversão com cardápio e checkout modernos.
- Reduzir atrito operacional com painel único de gestão.
- Dar previsibilidade logística com fluxo de entregas e acompanhamento em tempo real.
- Elevar segurança de acesso com múltiplas camadas de proteção.

## Perfis e Módulos

### Cliente

- Conta obrigatória para compra (mais segurança para o comércio).
- Login/cadastro com recuperação de senha.
- Painel com lojas, favoritos, histórico, endereços e recompra.
- Checkout com validações para entrega e retirada.
- Aplicação de cupons.

### Lojista

- Dashboard operacional.
- Pedidos em fluxo Kanban.
- Produtos, categorias e configurações da loja.
- Gestão de cupons e fidelidade.
- Gestão de entregadores e despacho.
- Configuração de automações WhatsApp.

### Entregador

- Login e painel de corridas.
- Atualização de status da entrega.
- Acesso rápido a rota e contato.
- Registro de ocorrências.
- Confirmação de entrega com código/PIN.

## Segurança

Camadas atuais implementadas:

- Proteção contra tentativas excessivas de login.
- Recuperação de senha por e-mail.
- OTP por e-mail como camada opcional.
- Dispositivos confiáveis no perfil.
- Step-up auth para ações críticas no painel do lojista.
- RLS no Supabase para isolamento de dados entre contas/lojas.

## Planos e Modelo Comercial

- Cliente final usa gratuitamente para comprar.
- A assinatura é para lojistas (acesso ao painel e recursos por plano).
- Checkout de plano com fluxo dedicado no produto.

## Automação WhatsApp

Suporte a:

- Templates por evento.
- Fila de eventos.
- Worker para disparo.
- Receiver backend para integração com provedores.

Eventos comuns:

- Novo pedido.
- Mudança de status.
- Aceite de entrega.
- Pedido saiu para entrega.

## Stack Tecnológica

- Frontend: React 18, TypeScript, Vite.
- UI: Tailwind CSS, shadcn/ui, Lucide.
- Estado e dados: TanStack Query.
- Formulários e validação: React Hook Form + Zod.
- Backend de dados/autenticação: Supabase (Auth, Postgres, Storage, RLS).
- Backend de automação: Spring Boot (Java 11).

## Arquitetura Resumida

- `src/pages`: telas por domínio (`admin`, `client`, `driver`, `public`, `auth`).
- `src/components`: componentes visuais e layouts.
- `src/hooks`: hooks de autenticação e estado.
- `src/lib`: regras de negócio, segurança e utilitários.
- `supabase/migrations`: evolução do schema.
- `backend/`: receiver e integrações de automação.

Referência completa de organização e governança:

- `docs/PROJECT_STRUCTURE.md`

## Como Rodar Local

Pré-requisitos:

- Node.js 18+
- npm 9+
- Java 11
- Maven 3.9+

### 1) Instalar dependências

```bash
npm install
```

### 2) Configurar `.env`

Copie o template versionado e preencha com seus valores:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Depois ajuste o arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="SUA_ANON_KEY"
VITE_SUPABASE_PROJECT_ID="SEU_PROJECT_ID"
```

Importante: o arquivo `.env` **nao deve** ser versionado no Git.

### 3) Subir backend (terminal 1)

```bash
npm run backend:dev
```

Padrão: `http://localhost:8080`

Se a porta estiver ocupada (PowerShell):

```powershell
$env:SERVER_PORT=8082; npm run backend:dev
```

### 4) Subir frontend (terminal 2)

```bash
npm run dev
```

Use a URL exibida no terminal (normalmente `http://localhost:8081` ou `http://localhost:5173`).

## Bootstrap Rápido

Comandos mínimos para preparar ambiente local com segurança:

```bash
npm install
npm run setup:hooks
```

Depois:

```bash
npm run backend:dev
npm run dev
```

## Migrations Obrigatórias

Antes de homologar ou publicar, aplique todas as migrations do projeto no Supabase, com atenção especial para:

- `20260401120000_store_subscription_billing.sql`
- `20260401133000_account_security_upgrade.sql`
- `20260401170000_delivery_proof_hardening.sql`

Sem essas migrations, partes de assinatura, segurança de conta e comprovação de entrega podem falhar.

## Go-live em 5 Minutos

Fluxo rápido para validar prontidão:

1. Abra `/admin/go-live`.
2. Clique em `Rodar diagnostico`.
3. Marque o checklist operacional.
4. Execute a matriz PASS/FAIL completa.
5. Verifique se os gates de liberação estão em `PASS`.
6. Exporte `relatorio JSON` e `auditoria CSV`.
7. Abra `/admin/go-live/apresentacao` para reunião com cliente.

Critério de liberação recomendado:

- Score >= 90%
- Gates 100% em `PASS`
- Conformidade de entrega >= 90%

## Scripts Úteis

- `npm run dev`: ambiente local frontend.
- `npm run backend:dev`: backend Java local.
- `npm run backend:build`: build do backend.
- `npm run backend:test`: testes do backend.
- `npm run check:repo`: bloqueia arquivos sensíveis rastreados no Git.
- `npm run check:security`: alias para checks de segurança de repositório.
- `npm run build`: build de produção frontend.
- `npm run preview`: preview do build frontend.
- `npm run lint`: análise estática.
- `npm run test`: testes.

## Rotas Principais

- `/`: landing institucional.
- `/planos`: visão de planos.
- `/planos/checkout`: checkout de assinatura.
- `/login`, `/registro`: acesso lojista.
- `/cliente/login`, `/cliente/registro`, `/cliente/conta`: jornada cliente.
- `/entregador/login`, `/entregador/registro`, `/entregador`: jornada entregador.
- `/loja/:slug`: cardápio público.
- `/loja/:slug/checkout`: checkout da loja.
- `/admin/*`: painel do lojista.

## Qualidade e Produção

Checklist recomendado antes de publicar:

- Rodar `npm run lint`.
- Rodar `npm run test`.
- Rodar `npm run build`.
- Validar fluxo completo de cliente, lojista e entregador.
- Revisar variáveis de ambiente no provedor.
- Confirmar políticas RLS e permissões no Supabase.

## Homologação PASS/FAIL

Use a matriz da Central de Go-live e valide os 7 casos:

1. Cliente finaliza pedido com sucesso.
2. Pedido aparece e atualiza no Kanban.
3. Despacho de entrega funciona.
4. Entrega com PIN + foto + recebedor + GPS válido.
5. Entrega com bypass de GPS + justificativa.
6. Rastreio em tempo real no cliente.
7. Exportação de auditoria CSV sem erro.

Documente resultado e só libere após 100% PASS.

## Segurança de Segredos

- Nunca versionar segredos reais (`.env`, chaves privadas, tokens, credenciais SMTP/DB).
- `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_URL` podem ficar no frontend (sao publicos por design).
- Nunca expor `service_role` no frontend nem no Git.

Se `.env` ou qualquer segredo já foi commitado no passado:

1. Remover do versionamento (`git rm --cached .env`).
2. Rotacionar imediatamente todas as credenciais afetadas.
3. Revisar logs e acessos suspeitos.
4. Revalidar CI com `secret-scan`.

### Scan local (pre-commit)

Ative os hooks versionados:

```bash
npm run setup:hooks
```

Com isso, todo commit roda scan de segredos com `gitleaks`.

### Scan no CI

Existe workflow em `.github/workflows/secret-scan.yml` para varredura automatica em `push` e `pull_request`.

## Troubleshooting

### PowerShell bloqueando `npm`

Use `npm.cmd`:

```bash
npm.cmd run dev
npm.cmd run build
```

### Porta 8080 ocupada

- Encerrar processo que usa a porta.
- Ou subir backend com outra porta (`SERVER_PORT`).

### Aplicação sem dados

- Verificar `.env`.
- Conferir projeto/chaves Supabase.
- Conferir migrations aplicadas.
- Validar tabelas e políticas RLS.

### Erro de schema no login/segurança

Exemplo comum:

- `Could not find the table 'public.user_security_settings'`

Ação:

- aplicar migration `20260401133000_account_security_upgrade.sql`
- reiniciar frontend após a migration

### Prova de entrega não salva

Cheque:

- bucket `delivery-proofs` existe
- policies do bucket foram criadas
- migration `20260401170000_delivery_proof_hardening.sql` aplicada
- usuário entregador autenticado

### Realtime não atualiza no rastreio

Cheque:

- diagnóstico `Realtime` em `/admin/go-live`
- políticas RLS da tabela `order_deliveries`
- bloqueios de rede/proxy no ambiente

## Roadmap Sugerido

- Plano executivo 30/60/90:
  - `docs/ROADMAP_30_60_90.md`
- Evolução contínua:
  - Métricas avançadas de funil e retenção.
  - Gestão financeira por loja.
  - Regras de entrega por raio e horário.
  - Notificações em tempo real mais robustas.
  - Evolução de assinaturas e cobrança automática.

## Licença

Uso proprietário/interno. Ajuste esta seção quando definir a licença oficial do produto.
