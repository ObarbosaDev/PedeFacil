# Pede Fácil

**Canal próprio de pedidos para restaurantes e operações de delivery.**

O Pede Fácil é uma plataforma para pizzarias, hamburguerias, açaíterias e restaurantes independentes venderem sem depender de marketplace. Cada loja pode publicar seu cardápio, receber pedidos, organizar a operação e manter o relacionamento direto com seus clientes.

O foco inicial são operações que recebem de 20 a 150 pedidos por dia por WhatsApp, Instagram ou marketplace.

Mantido por **Matheus Barbosa**.

> **Estado atual:** o MVP está em reconstrução. Landing, autenticação, loja, cardápio e a base de pedidos já existem, mas pagamentos e entrega ainda não estão homologados de ponta a ponta. Não use o projeto para processar dinheiro real em produção neste estágio.

## Stack

| Área | Tecnologia |
| --- | --- |
| Frontend | React 18, TypeScript, Vite e CSS |
| Backend | Java 21, Spring Boot 2.7, Spring Data JPA e Maven |
| Banco | PostgreSQL em execução e H2 nos testes |
| Migrações | Flyway |
| Autenticação | JWT, refresh token revogável e verificação de e-mail |
| Testes | Playwright, JUnit e Spring Boot Test |
| Qualidade | ESLint, TypeScript e GitHub Actions |

## Arquitetura

```text
Navegador
   │
   │ http://localhost:8080
   ▼
React + Vite
   │
   │ /api → proxy local
   ▼
Spring Boot :8081
   │
   ├── autenticação e sessões
   ├── lojas e horários
   ├── catálogo e adicionais
   ├── clientes e pedidos
   └── automações e adaptadores externos
   │
   ▼
PostgreSQL + Flyway
```

Regras de preço, autorização, criação de pedido e mudança de status ficam no backend. O frontend chama a API por caminhos relativos em `/api`, mantendo navegador e API sob a mesma origem quando a aplicação for publicada.

## Rodar localmente

### Pré-requisitos

- Node.js 22
- npm
- JDK 21
- Maven disponível no `PATH`
- PostgreSQL em execução

O projeto não possui Maven Wrapper nem Docker Compose. Crie um banco PostgreSQL vazio antes de iniciar o backend; o Flyway aplicará as migrações automaticamente.

### 1. Instale as dependências

Abra o PowerShell na pasta do projeto. Rodar os comandos em `Documents\GitHub`, fora de `PedeFacil`, faz o npm não encontrar o `package.json`.

```powershell
Set-Location "C:\Users\Matheus Barbosa\Documents\GitHub\PedeFacil"
npm install
```

Em integração contínua ou quando quiser uma instalação reproduzível a partir do lockfile, use `npm ci`.

### 2. Suba o backend

No primeiro terminal, configure apenas a sessão atual do PowerShell. Substitua os valores entre `< >` pelos dados da sua máquina:

```powershell
Set-Location "C:\Users\Matheus Barbosa\Documents\GitHub\PedeFacil"

$env:DATABASE_URL="jdbc:postgresql://localhost:5432/pedefacil"
$env:DATABASE_USERNAME="<usuario_do_banco>"
$env:DATABASE_PASSWORD="<senha_do_banco>"
$env:APP_AUTH_JWT_SECRET="<segredo_aleatorio_com_32_bytes_ou_mais>"
$env:ORDER_TRACKING_SECRET="<outro_segredo_aleatorio>"
$env:APP_BASE_URL="http://localhost:8080"

npm run backend:dev
```

O comando acima equivale a:

```powershell
mvn -f backend\pom.xml spring-boot:run
```

Para testar confirmação de e-mail e recuperação de senha sem SMTP, é possível habilitar temporariamente a exposição dos tokens no ambiente local:

```powershell
$env:APP_AUTH_DEBUG_EXPOSE_TOKENS="true"
```

Essa opção é exclusiva para desenvolvimento e **nunca deve ser habilitada em produção**.

### 3. Suba o frontend

Em outro terminal:

```powershell
Set-Location "C:\Users\Matheus Barbosa\Documents\GitHub\PedeFacil"
npm run dev
```

Acesse:

| Serviço | Endereço |
| --- | --- |
| Frontend | http://localhost:8080 |
| Cadastro | http://localhost:8080/cadastro |
| Login | http://localhost:8080/entrar |
| Backend | http://localhost:8081 |
| Healthcheck | http://localhost:8081/health |

Não existe usuário administrador padrão. Crie uma conta pela tela de cadastro.

> Se a política de execução do PowerShell bloquear `npm.ps1`, use `npm.cmd` nos mesmos comandos.

## Configuração de ambiente

O backend lê variáveis do sistema e também aceita arquivos privados `.env` na raiz ou em `backend/.env`. Esses arquivos são ignorados pelo Git e não devem ser commitados.

### Aplicação principal

| Variável | Finalidade | Padrão |
| --- | --- | --- |
| `DATABASE_URL` | URL JDBC do PostgreSQL | sem valor |
| `DATABASE_USERNAME` | Usuário do banco | sem valor |
| `DATABASE_PASSWORD` | Senha do banco | sem valor |
| `APP_AUTH_JWT_SECRET` | Assinatura dos tokens JWT | sem valor |
| `ORDER_TRACKING_SECRET` | Proteção dos links de acompanhamento | sem valor |
| `APP_BASE_URL` | URL usada nos links enviados ao usuário | `http://localhost:8080` |
| `PORT` | Porta HTTP do backend | `8081` |
| `FLYWAY_ENABLED` | Ativa as migrações do banco | `true` |

### E-mail

Cadastro, confirmação de conta e recuperação de senha usam as configurações `SPRING_MAIL_*` e `MAIL_FROM`. Sem SMTP, utilize `APP_AUTH_DEBUG_EXPOSE_TOKENS=true` somente durante o desenvolvimento local.

### Integrações opcionais

O projeto preserva configurações para automação de WhatsApp e adaptadores do Mercado Pago. Elas usam variáveis como `PEDEFACIL_RECEIVER_TOKEN`, `PEDEFACIL_SIGNATURE_SECRET`, `OUTBOUND_MODE`, `AUTOMATION_*`, `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`.

Essas integrações não são necessárias para abrir a aplicação local e ainda não tornam o checkout financeiro pronto para produção.

## Desenvolvimento

### Frontend

```powershell
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run test:e2e
```

### Backend

A partir da raiz:

```powershell
npm run backend:dev
npm run backend:test
npm run backend:build
```

Ou diretamente com Maven:

```powershell
Set-Location backend
mvn spring-boot:run
mvn test
mvn clean package
```

Os testes atuais verificam a inicialização do contexto, regras isoladas do backend e cenários de navegação da interface. Eles ainda não comprovam um fluxo financeiro completo.

## Estrutura

```text
backend/                    API Java, domínio, serviços, controllers e migrations
src/
  app/                      rotas, sessão, cliente HTTP e estilos globais
  features/
    auth/                   cadastro, login e recuperação de acesso
    landing/                apresentação pública do produto
    merchant/               painel e operação da loja
    storefront/             cardápio público e acompanhamento
public/                     arquivos estáticos
tests/                      testes E2E com Playwright
docs/                       produto, arquitetura e decisões técnicas
automation/                 exemplos e materiais de automação
```

## Módulos principais

- Landing pública, cadastro, login e recuperação de acesso.
- Loja, horários de funcionamento, zonas de entrega e publicação.
- Categorias, produtos, adicionais e disponibilidade do cardápio.
- Cardápio público com busca, filtros, carrinho persistente e cotação.
- Criação idempotente de pedidos e transição de status.
- Painel do lojista, clientes e acompanhamento por link.
- Receptor de automação para WhatsApp e adaptadores externos em revisão.

Pagamento, entrega, assinatura, conciliação, estorno e operação financeira completa continuam em construção.

## Documentação

- [Escopo do MVP](docs/product/MVP_SCOPE.md)
- [Decisões de arquitetura](docs/adr)

A arquitetura-alvo prevê frontend estático, API Spring Boot, PostgreSQL privado, proxy HTTPS, backups e monitoramento. Os arquivos de infraestrutura para esse ambiente ainda não estão completos no repositório.

## Segurança

- Nunca versione `.env`, tokens, senhas ou chaves privadas.
- Use segredos longos e diferentes para JWT e rastreamento de pedidos.
- Mantenha `APP_AUTH_DEBUG_EXPOSE_TOKENS=false` fora do ambiente local.
- Configure credenciais no ambiente de execução ou em um gerenciador de segredos.
- Não habilite pagamentos reais antes de validar webhooks, idempotência, isolamento entre lojas, estorno, backup e restauração.

## Licença e contato

Este repositório ainda não declara uma licença pública de uso. Para conversar sobre o produto, abra uma issue no repositório.
