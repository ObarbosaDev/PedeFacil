# Pede Fácil

**Venda direto. Faça o cliente voltar.**

O Pede Fácil está sendo construído para pizzarias, hamburguerias, açaíterias e restaurantes independentes com delivery. Cada loja terá seu próprio link para receber pedidos, organizar a operação e manter o relacionamento com os clientes. O recorte inicial são operações de 20 a 150 pedidos por dia que hoje vendem por WhatsApp, Instagram ou marketplace.

> **Estado atual:** reconstrução do MVP. A interface e a API ainda não processam pagamentos reais. Não use este repositório para operar uma loja em produção antes de concluir os fluxos financeiros e os testes de ponta a ponta.

## O produto em uma venda

```text
Loja publica cardápio → divulga seu link → cliente compra sem conta
→ pagamento é confirmado → equipe prepara → entrega ou libera retirada
→ cliente acompanha e pode comprar novamente
```

Os quatro resultados buscados são **canal próprio**, **operação organizada**, **relacionamento direto** e **recorrência de vendas**. O Pede Fácil não é um marketplace para descobrir restaurantes.

## O que já existe

| Área | Estado |
| --- | --- |
| Landing e identidade visual | Implementadas, com demonstração ilustrativa identificada e convite para o piloto. |
| Cadastro, login e recuperação | API própria com sessão revogável, verificação de e-mail e tokens protegidos; requer SMTP configurado. |
| Loja e cardápio | Cadastro da loja, horários, zonas de entrega, categorias, produtos, adicionais, disponibilidade e publicação. |
| Cardápio público | Página por loja, busca, filtro, opções, carrinho persistente e cotação calculada pela API. |
| Pedidos | Criação idempotente e máquina de estados na API; painel e acompanhamento por link. |
| Pagamento e entrega | Ainda não integrados ao fluxo de venda; compra no cardápio permanece bloqueada. |

O objetivo do MVP inclui Pix e cartão, cupons, frota própria ou convidada, comunicação, recompra e assinatura da plataforma. A lista completa e as exclusões estão em [docs/product/MVP_SCOPE.md](docs/product/MVP_SCOPE.md).

## Arquitetura

```text
src/
  app/                 rotas, sessão, cliente HTTP e estilos globais
  features/
    auth/              entrada e recuperação de acesso
    landing/           apresentação comercial
    merchant/          operação da loja
    storefront/        cardápio e acompanhamento
backend/src/main/
  java/.../platform/
    auth/              identidade e sessões
    stores/            loja, horário, entrega e publicação
    catalog/           categorias, produtos e adicionais
    orders/            cotação, criação e estados
  resources/db/migration/   esquema PostgreSQL com Flyway
```

A web usa React, TypeScript e Vite. A API é um monólito modular em Spring Boot com PostgreSQL. Cálculo de preço, autorização, pedido e mudanças de estado pertencem ao servidor. A implantação planejada é em uma VM da DigitalOcean, com banco privado, proxy HTTPS, backups e monitoramento. Não há Supabase na aplicação ativa nem dados reais para migrar.

As decisões estão em [docs/adr](docs/adr). O código preserva alguns adaptadores de integração para revisão antes da ativação; eles não tornam o pagamento operacional.

## Rodar localmente

Pré-requisitos: **Node.js 22**, **npm**, **Java 17**, **Maven** e **PostgreSQL**. O backend usa a porta 8081; o Vite usa a 5173 e encaminha `/api` para a API.

1. Crie um banco PostgreSQL local e configure `DATABASE_URL` no formato JDBC, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `APP_AUTH_JWT_SECRET` e `ORDER_TRACKING_SECRET` apenas no ambiente da sua máquina.
2. Para testar cadastro e recuperação de acesso, configure SMTP via propriedades `SPRING_MAIL_*` e `MAIL_FROM`. A URL usada nos e-mails vem de `APP_BASE_URL`.
3. Rode `npm ci`, `npm run backend:dev` e, em outro terminal, `npm run dev`.
4. Abra `http://localhost:5173`.

O carregador local aceita `backend/.env` ou `.env`, mas esses arquivos são ignorados pelo Git. Nunca os adicione ao repositório, mesmo como modelo. Em ambiente implantado, configure segredos diretamente na VM ou no gerenciador de segredos escolhido. O Flyway aplica as migrações ao iniciar a API.

### Verificações

```bash
npm run lint
npm run typecheck
npm run build
npm run backend:test
```

Os testes Java atuais verificam inicialização e assinatura de webhook. `npm run test:e2e` cobre apresentação e navegação mobile da landing. Eles **não** comprovam o fluxo completo de compra; essa suíte será ampliada com checkout e integração financeira.

## Critério de lançamento

Uma loja real precisa conseguir publicar o cardápio, receber e confirmar um pedido pago, preparar, entregar ou liberar retirada e comunicar o cliente. Antes de aceitar dinheiro real, precisamos validar isolamento entre lojas, webhook idempotente, estorno, backup e restauração, monitoramento e os cenários de checkout em navegador e celular.

## Escopo que fica fora

Marketplace de restaurantes, entregador aceitando corridas de qualquer loja, carteira financeira do motoboy, cashback, ranking, vários gateways simultâneos e aplicativo nativo não fazem parte deste MVP.

## Licença e contato

Este repositório ainda não declara licença de uso público. Para conversar sobre o produto, abra uma issue.
