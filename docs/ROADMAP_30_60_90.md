# Roadmap 30/60/90 - Pede Fácil

Plano prático para deixar o sistema pronto para operação comercial com previsibilidade, segurança e escala.

## Objetivo

- Aumentar conversão de ponta a ponta (home -> plano -> checkout -> pagamento -> ativação).
- Reduzir risco operacional (falhas de pedido, entrega e cobrança).
- Dar governança para crescimento (métricas, qualidade e segurança).

## KPIs Principais

- Conversão `plan_selected -> checkout_started`.
- Conversão `checkout_started -> payment_confirmed`.
- Tempo médio de confirmação de pedido.
- Taxa de cancelamento de pedido.
- SLA de entrega.
- Disponibilidade do sistema.
- Erros críticos por 1.000 sessões.

---

## Fase 1 (0-30 dias): Base de produção forte

### Prioridade P0

1. Pagamento e assinatura real (produção)
- Integrar gateway com webhook assinado.
- Garantir idempotência na confirmação de pagamento.
- Atualizar status de assinatura automaticamente (`pending`, `active`, `past_due`, `canceled`).
- Critério de pronto: pagamento confirmado libera acesso sem intervenção manual.

2. Controle de acesso por plano
- Matrix de permissões por plano (Essencial/Profissional/Premium).
- Bloqueio e desbloqueio de recursos no frontend e backend.
- Critério de pronto: cada recurso respeita plano ativo.

3. Segurança crítica
- Rate limit em login, reset, checkout e cupom.
- Revisão de RLS em tabelas sensíveis.
- Remoção total de mensagens técnicas para usuário final.
- Critério de pronto: pentest funcional básico sem bypass de acesso.

4. Observabilidade mínima de produção
- Error tracking central (frontend/backend).
- Alertas para erro de pagamento, falha de webhook e queda de conversão.
- Critério de pronto: incidentes críticos chegam em canal de alerta.

### Prioridade P1

1. Qualidade de release
- Pipeline CI com lint, typecheck e testes obrigatórios.
- Smoke E2E dos fluxos críticos: compra, aceite de pedido, entrega com PIN, pagamento do plano.
- Critério de pronto: deploy bloqueia com teste crítico falhando.

2. UX de recuperação
- Estados de erro e re-tentativa em checkout, pagamento e login.
- Mensagens despojadas, claras e com ação.
- Critério de pronto: nenhum fluxo termina em "beco sem saída".

---

## Fase 2 (31-60 dias): Performance comercial e operação

### Prioridade P0

1. Funil comercial avançado
- Dashboard com segmentação por origem, papel e período (já iniciado).
- Cohort de conversão por canal.
- Critério de pronto: decisões semanais baseadas em dados reais.

2. Motor de promoção inteligente
- Cupom por horário, ticket mínimo, primeira compra, recorrência.
- Limite por cliente e anti-abuso.
- Critério de pronto: campanhas com ROI mensurável.

3. Entrega profissional
- Regras de despacho por raio/tempo/lotação.
- SLA por etapa (aceite, preparo, saída, entrega).
- Critério de pronto: queda consistente de atraso e cancelamento.

### Prioridade P1

1. Recompra e retenção
- Repetir pedido em 1 clique.
- Favoritos e recomendações por histórico.
- Critério de pronto: aumento de recompra em clientes recorrentes.

2. Automação WhatsApp robusta
- Retry com backoff.
- Fila com dead-letter para falhas persistentes.
- Painel de saúde da automação.
- Critério de pronto: envio confiável com rastreabilidade.

---

## Fase 3 (61-90 dias): Escala e governança de empresa

### Prioridade P0

1. Governança técnica de longo prazo
- Feature flags por loja.
- Versão de eventos com schema versionado.
- Contratos de API com validação.
- Critério de pronto: evolução sem quebra de compatibilidade.

2. SLO/SLA oficiais
- Definir e monitorar metas de disponibilidade e performance.
- Relatório mensal de cumprimento.
- Critério de pronto: operação orientada a meta e não percepção.

3. Financeiro e compliance operacional
- Conciliação de cobrança automatizada.
- Trilha de auditoria para ações críticas (quem/quando/o quê).
- Critério de pronto: histórico auditável para suporte e clientes.

### Prioridade P1

1. Experiência enterprise
- Onboarding guiado por checklist para loja.
- Templates de operação por segmento (hambúrguer, pizzaria, conveniência, etc.).
- Critério de pronto: nova loja ativa em menos tempo, com menos suporte.

2. Escala de performance
- Cache estratégico de cardápio e dados públicos.
- Jobs assíncronos para tarefas pesadas.
- Critério de pronto: estabilidade com aumento de carga.

---

## Backlog Priorizado (Impacto x Esforço)

### Alto impacto / Baixo esforço

- Mensagens de erro padronizadas e orientadas à ação.
- Validações de plano em rotas críticas.
- Alertas de queda de conversão.
- Rastreio de erro com contexto de usuário/loja.

### Alto impacto / Médio esforço

- Gateway real com webhook e idempotência.
- Motor de promoção com regras.
- Dashboard de funil por origem/papel.
- E2E de fluxos críticos.

### Alto impacto / Alto esforço

- Despacho inteligente com regras de SLA.
- Arquitetura de fila resiliente (DLQ e retries avançados).
- Conciliação financeira completa.

---

## Cadência de Execução

- Planejamento semanal com backlog fechado.
- Review quinzenal de KPIs.
- Release semanal com changelog.
- Retro mensal com ajuste de prioridade por dados.

## Definition of Done (DoD)

Um item só entra como concluído quando:

1. regra de negócio implementada no frontend e backend (quando aplicável),
2. cobertura de teste mínima para caminho feliz e erro,
3. observabilidade adicionada (evento/log/alerta),
4. documentação atualizada,
5. validado em ambiente de homologação.
