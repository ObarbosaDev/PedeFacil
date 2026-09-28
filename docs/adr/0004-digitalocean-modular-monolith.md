# ADR 0004: monolito proprio na DigitalOcean

- Data: 2026-09-28
- Status: aceito

## Decisao

O Pede Facil roda em uma VM da DigitalOcean com frontend estatico, API Spring Boot e PostgreSQL privado. O navegador conversa somente com `/api`. O backend possui autenticacao, autorizacao por loja, catalogo, orcamento, pedido, pagamento, entrega e auditoria. Flyway controla o schema.

## Limites dos modulos

```text
backend/src/main/java/com/pedefacil/automation/platform/
  auth/          usuarios, sessoes e tokens
  stores/        loja, membros, horarios e zonas
  catalog/       categorias, produtos e adicionais
  customers/     contatos, enderecos e consentimentos
  orders/        orcamento, criacao, status e acompanhamento
  payments/      provedor, webhooks, conciliacao e estorno
  delivery/      frota convidada e comprovacao
  messaging/     eventos operacionais
  subscriptions/ assinatura da loja
  reporting/     indicadores essenciais
```

No frontend, `src/app` contem providers e rotas; `src/features` contem telas, componentes, API e regras de apresentacao por dominio; `src/shared` contem componentes e utilitarios reutilizaveis. Nenhuma tela importa cliente de banco.

## Contratos

- Toda consulta comercial e filtrada por `store_id` no backend.
- Precos sao calculados no servidor em centavos; itens e adicionais preservam um snapshot.
- Um pedido e criado com chave de idempotencia e transicoes registradas em eventos.
- O consumidor compra sem conta e acompanha por token opaco; somente o hash fica no banco.
- O frontend nao recebe credenciais do provedor ou do banco.
- PostgreSQL, API e armazenamento de arquivos devem ter backups com restauracao testada.

## Corte

Nao ha dados reais no Supabase. Os modulos novos sao criados em um banco limpo. O codigo antigo fica isolado ate as rotas equivalentes passarem nos testes; depois sao removidos SDK, migrations, RLS, RPC, Storage e Realtime do Supabase. Nao e necessario migrar historico de pedidos.

O deploy so ocorre quando pedido, pagamento, entrega, autenticacao, backup e restauracao forem homologados juntos.
