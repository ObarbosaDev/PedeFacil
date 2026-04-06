# Checklist Final de Produção

Use este checklist antes de abrir para usuários reais.

## Banco e migrations

- [ ] Todas as migrations aplicadas sem erro.
- [ ] RPCs críticas existentes e funcionando (`create_order_idempotent`, `start_plan_checkout_v2`, confirmação de pagamento).
- [ ] Índices de idempotência e performance ativos.

## Segurança

- [ ] RLS ativa nas tabelas de cliente, lojista e entregador.
- [ ] Service role key só no backend.
- [ ] `.env` fora do Git.
- [ ] Mensagens de erro sem stacktrace para usuário final.

## Checkout e pedidos

- [ ] Clique duplo não duplica pedido.
- [ ] Retry de rede retorna pedido existente.
- [ ] Pedido só é criado uma vez por `idempotency_key`.
- [ ] Cupom inválido mostra mensagem clara.

## Pagamento de plano

- [ ] `start_plan_checkout_v2` gera sessão sem erro.
- [ ] Redirecionamento para Mercado Pago funcionando.
- [ ] Webhook confirma assinatura sem duplicar evento.
- [ ] Reprocessamento idempotente validado no `payments_ledger`.

## Entregas

- [ ] Entregador aceita/recusa corrida.
- [ ] Entrega só finaliza com PIN válido.
- [ ] Ocorrência de entrega é registrada.
- [ ] Rastreio do cliente atualiza status corretamente.

## Operação e monitoramento

- [ ] Healthcheck do backend respondendo.
- [ ] Logs de ações críticas ativos.
- [ ] Plano de contingência manual validado.
- [ ] Contato de suporte configurado: `+55 (61) 9 8462-9093`.

## UX e confiança do usuário

- [ ] Sem texto quebrado ou sem acentuação nas telas principais.
- [ ] Sem botão morto nas jornadas críticas.
- [ ] Botões de voltar e sair funcionando.
- [ ] Tela de erro com ação "Tentar novamente".

## Critério de go-live

Pode lançar quando todos os itens acima estiverem marcados e você tiver feito pelo menos 1 dia de operação assistida com lojista real.
