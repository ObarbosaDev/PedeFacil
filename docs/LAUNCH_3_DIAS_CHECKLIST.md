# Pede Fácil - Checklist de Lançamento em 3 Dias

Objetivo: abrir para cliente real em 72h com segurança suficiente, sem overengineering.

## Dia 1 - Base técnica e configuração

- [ ] Rodar migrations no Supabase:
  - `20260406113000_establishment_mercadopago_account.sql`
  - `20260406122000_establishment_manual_pix_fallback.sql`
  - `20260406122500_establishment_payment_accounts_private.sql`
  - `20260406130000_scale_phase2_indexes.sql`
- [ ] Confirmar backend de pagamentos no ar (`npm run backend:dev`).
- [ ] Validar variáveis do backend:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `PAYMENTS_API_PUBLIC_BASE_URL` (HTTPS público)
  - `MERCADOPAGO_ACCESS_TOKEN` (plano da plataforma)
- [ ] Validar variáveis do frontend:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - `VITE_PAYMENTS_API_BASE_URL`
- [ ] Rodar `npm run check:launch-3d`.
- [ ] Corrigir todos os itens `FAIL` e `WARN` críticos.

## Dia 2 - Homologação ponta a ponta

- [ ] Loja A (com MP conectado): pedido com PIX e cartão no app.
- [ ] Loja B (sem MP): pedido com PIX manual da loja.
- [ ] Cliente finaliza pedido sem duplicar com clique duplo.
- [ ] Lojista confirma pagamento manual no painel.
- [ ] Entregador aceita corrida e conclui com PIN.
- [ ] Loja fechada/lotada bloqueia pedido imediato e permite agendamento.
- [ ] Teste de rede ruim: retry de checkout sem pedido duplicado.
- [ ] Sem tela branca em login, checkout e pagamento.

## Dia 3 - Go-live controlado

- [ ] Congelar código 2h antes da abertura.
- [ ] Rodar `npm run check:launch-3d`.
- [ ] Rodar `npm run build`.
- [ ] Abrir suporte em tempo real no WhatsApp: `+55 (61) 9 8462-9093`.
- [ ] Liberar primeiro lojista piloto.
- [ ] Monitorar primeiras 2h:
  - pedidos criados
  - pagamentos pendentes
  - entregas travadas
  - erros no backend

## Critério de liberação

Pode lançar se:

- [ ] Não há duplicação de pedido.
- [ ] Pagamento automático funciona para loja com gateway.
- [ ] Fallback PIX manual funciona para loja sem gateway.
- [ ] Lojista consegue confirmar pagamento pendente no painel.
- [ ] Entrega com PIN fecha sem inconsistência.
- [ ] Não há vazamento entre lojas (RLS ok).

## Comandos rápidos

```bash
npm run check:launch-3d
npm run build
npm run backend:dev
npm run dev
```

## Se der ruim no dia do lançamento

- [ ] Não desligar o sistema inteiro.
- [ ] Ativar plano B por loja: PIX manual + confirmação no painel.
- [ ] Registrar incidente com: loja, pedido, horário, erro.
- [ ] Corrigir e validar com 1 pedido de teste antes de retomar.
