# Playbook Go-live PedeFacil

## Objetivo
Garantir que o sistema esta pronto para uso real com cliente, com risco operacional baixo e rastreabilidade completa.

## Pre-requisitos
1. Migration mais recente aplicada no Supabase.
2. Bucket `delivery-proofs` criado e acessivel.
3. Usuario lojista com acesso ao `/admin/go-live`.

## Fluxo de validacao (PASS/FAIL)
1. Rodar diagnostico tecnico na Central de Go-live.
2. Validar checklist operacional.
3. Executar matriz de aceitacao completa.
4. Verificar auditoria de entregas com taxa de conformidade >= 90%.
5. Conferir gates de liberacao.

## Cenarios obrigatorios
1. Cliente finaliza pedido com cupom e sem cupom.
2. Pedido aparece no Kanban e muda de status sem atraso de tela.
3. Despacho automatico/manual de entregador.
4. Entrega concluida com PIN + foto + recebedor + GPS valido.
5. Entrega concluida com bypass de GPS + justificativa.
6. Rastreio do cliente atualiza em tempo real.
7. Exportacao CSV da auditoria concluida sem erro.

## Regras de liberacao
1. Score de prontidao >= 90%.
2. Todos os checks tecnicos em OK.
3. Checklist operacional 100%.
4. Matriz de aceitacao 100%.
5. Taxa de conformidade de entrega >= 90%.

## Evidencias recomendadas
1. Relatorio JSON exportado da Central de Go-live.
2. CSV da auditoria de entregas.
3. Capturas de tela do rastreio e Kanban.
4. Registro de data/hora da homologacao.

## Plano de rollback
1. Bloquear novos pedidos em caso de falha critica.
2. Reverter ultima feature flag de fluxo afetado.
3. Reexecutar diagnostico tecnico.
4. Liberar novamente somente apos todos os gates passarem.
