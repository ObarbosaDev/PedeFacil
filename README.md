# Pede Fácil

**Seu canal próprio de pedidos. Uma operação clara. Clientes que voltam.**

O Pede Fácil está sendo reconstruído para ajudar restaurantes independentes a vender diretamente pelo próprio link, receber pedidos organizados e manter o relacionamento com cada cliente. O foco inicial são pizzarias, hamburguerias, açaíterias e restaurantes com delivery que já vendem por WhatsApp, Instagram ou marketplace e processam de 20 a 150 pedidos por dia.

> **Estado do projeto:** reconstrução do MVP. Este repositório ainda contém código legado do protótipo. Não há dados reais a migrar. Recursos descritos como objetivo abaixo não devem ser interpretados como prontos para operar com pagamentos reais.

## O produto em uma venda

1. O lojista publica a loja e compartilha seu link ou QR Code.
2. O cliente abre o cardápio, monta o carrinho e compra sem criar senha.
3. O pedido chega à loja, o pagamento é confirmado e a equipe prepara.
4. A loja entrega ou libera a retirada; o cliente acompanha e pode pedir novamente.

O Pede Fácil vende quatro resultados: **canal próprio de pedidos**, **operação organizada**, **relacionamento direto com o cliente** e **recorrência de vendas**. A experiência começa no link da loja; não é um catálogo público de restaurantes.

### Para o lojista

- Publicar loja, horários, áreas de entrega, categorias, produtos e adicionais.
- Receber pedidos, confirmar, informar previsão e acompanhar a preparação.
- Organizar retirada e entregas com entregadores próprios ou convidados.
- Consultar clientes, histórico, cupons e indicadores essenciais.

### Para o cliente

- Abrir o cardápio sem login e comprar por Pix ou cartão sem criar senha.
- Escolher entrega ou retirada, acompanhar o pedido por link e repetir uma compra.
- Criar uma conta opcional após o pedido.

### Para a entrega

- Aceitar uma corrida atribuída pela loja, navegar até os endereços e atualizar o status.
- Confirmar a entrega por PIN e registrar uma ocorrência simples.

## Limites do MVP

O produto inicial atende **uma loja por operação**, com frota própria ou convidada. Marketplace de restaurantes, distribuição pública de corridas, carteira de entregadores, cashback, ranking, múltiplos gateways e aplicativo nativo estão fora do MVP. O código legado dessas áreas será retirado da experiência ativa durante a reconstrução.

## Arquitetura alvo

| Camada | Escolha | Responsabilidade |
| --- | --- | --- |
| Web | React, TypeScript e Vite | Landing, cardápio, checkout e painéis. |
| API | Monólito modular em Spring Boot | Autorização, preço, cupom, pedido, pagamento e entrega. |
| Dados | PostgreSQL com Flyway | Dados por loja, valores em centavos e histórico de eventos. |
| Infraestrutura | VM da DigitalOcean | Aplicação, proxy, banco privado, backups e observabilidade. |
| Integrações | Um provedor de pagamento e mensageria assíncrona | Confirmar pagamentos e comunicar estados sem bloquear pedidos. |

A decisão está em [docs/adr/0004-digitalocean-modular-monolith.md](docs/adr/0004-digitalocean-modular-monolith.md). O frontend e as rotinas antigas ainda têm referências ao Supabase; a remoção total faz parte do corte em andamento.

## Organização do código

| Diretório | Responsabilidade |
| --- | --- |
| `src/` | Aplicação web, componentes e telas; parte ainda é legada. |
| `backend/src/main/java/.../platform/auth` | Autenticação e sessões da API própria. |
| `backend/src/main/java/.../platform/stores` | Cadastro, publicação e operação da loja. |
| `backend/src/main/resources/db/migration` | Esquema PostgreSQL versionado. |
| `backend/src/main/java/.../payment` | Integração de pagamento existente, em revisão. |
| `docs/adr` | Decisões técnicas e seus motivos. |
| `supabase/` | Migrações históricas do protótipo; serão removidas após o corte. |

A estrutura será organizada por domínio: `auth`, `stores`, `catalog`, `customers`, `orders`, `payments`, `delivery`, `messaging`, `subscriptions` e `reporting`. Cada domínio expõe suas rotas e mantém suas regras no backend.

## Contrato de rotas do MVP

| Público | Lojista autenticado | Entregador autenticado |
| --- | --- | --- |
| `GET /api/public/stores/{slug}` | `GET /api/merchant/store` | `GET /api/drivers/deliveries` |
| `GET /api/public/stores/{slug}/menu` | `GET /api/merchant/orders` | `PATCH /api/drivers/deliveries/{id}/status` |
| `POST /api/public/stores/{slug}/quote` | `PATCH /api/merchant/orders/{id}/status` | |
| `POST /api/public/stores/{slug}/orders` | `GET /api/merchant/products` | |

Esta tabela é um **contrato alvo**, não uma afirmação de que todas as rotas já estão disponíveis.

## Desenvolvimento local

Pré-requisitos: Node.js 18+, npm, Java 11+ e Maven 3.9+. A API própria precisa de PostgreSQL para executar as migrações; a suíte Java usa H2 em testes de contexto. A configuração de produção na DigitalOcean ainda está sendo preparada.

1. Execute `npm install`.
2. Copie `backend/.env.example` para `backend/.env` e configure o PostgreSQL local.
3. Inicie a API com `npm run backend:dev`.
4. Em outro terminal, inicie a web com `npm run dev`.

O projeto legado ainda possui variáveis e telas que dependem do Supabase. O modo local ficará plenamente utilizável quando o frontend estiver conectado apenas à nova API. Nenhum segredo deve ser versionado.

Para verificar o código, execute `npm run lint`, `npm run test`, `npm run build` e `npm run backend:test`.

## Critério de pronto

O MVP estará pronto quando **uma loja real conseguir publicar o cardápio, divulgar seu link, receber um pedido sem cadastro obrigatório, receber o pagamento, preparar, entregar e comunicar o cliente**, com isolamento entre lojas e recuperação segura de falhas. Uma landing publicada ou uma API que compila não substitui esse fluxo completo.

Antes de aceitar dinheiro real, ainda são necessários testes de pagamento e webhook, idempotência, autorização por loja, backup e restauração, observabilidade, política de dados e validação com lojas piloto. O projeto não deve ser apresentado como disponível comercialmente antes dessa verificação.

## Próximos marcos

1. Retirar o Supabase da aplicação ativa e consolidar o banco próprio.
2. Fechar o fluxo de loja, catálogo, checkout sem conta e pedido com preço calculado no servidor.
3. Integrar Pix, cartão e webhook assinado com um único provedor.
4. Concluir painel operacional, entrega, comunicação e recompra.
5. Publicar a nova identidade visual e iniciar cinco lojas piloto.

## Licença e contato

O repositório ainda não declara uma licença de uso público. Para discutir o produto ou colaborar, abra uma issue neste repositório.
