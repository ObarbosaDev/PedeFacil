# Pede Fácil - Runbook Final de Go-live

Objetivo: publicar com segurança, validar rápido e abrir para usuário real sem improviso.

## 0) Regra de execução

- Janela recomendada: fora de pico (ex.: manhã, entre 09:00 e 11:00).
- Congelamento de código: não subir feature nova no dia do go-live.
- Dono do go-live: uma pessoa responsável por aprovar cada etapa.

## 1) Pré-deploy (T-1 dia)

- [ ] `npm.cmd exec tsc -- --noEmit -p tsconfig.app.json` sem erro.
- [ ] `npm.cmd run build` sem erro no ambiente de release.
- [ ] Backend subindo com variáveis de produção.
- [ ] Supabase com migrations 100% aplicadas.
- [ ] `start_plan_checkout_v2` funcionando no SQL Editor.
- [ ] Chaves sensíveis fora do Git (`.env` local e variáveis no provedor).
- [ ] Webhook Mercado Pago apontando para endpoint correto.
- [ ] Contato de suporte validado: `+55 (61) 9 8462-9093`.

## 2) Deploy (Dia D - início)

### Ordem obrigatória

1. Subir backend de pagamentos/automação.
2. Validar healthcheck backend.
3. Subir frontend.
4. Confirmar variáveis públicas do frontend (`VITE_*`).
5. Abrir home e validar navegação principal.

### Comandos locais (referência)

```bash
npm.cmd run backend:dev
npm.cmd run dev
```

Em produção, seguir o processo do provedor mantendo a mesma ordem.

## 3) Homologação guiada (Dia D - após deploy)

### Bloco A - Acesso e segurança

- [ ] Login lojista funciona.
- [ ] Login cliente funciona.
- [ ] Login entregador funciona.
- [ ] Esqueci senha envia e-mail.
- [ ] Redefinir senha altera acesso.

### Bloco B - Assinatura e pagamento

- [ ] Escolher plano abre checkout.
- [ ] Pagamento no Mercado Pago abre sem erro.
- [ ] Retorno de pagamento atualiza status da assinatura.
- [ ] Revalidar pagamento funciona quando necessário.
- [ ] Sem duplicar evento no `payments_ledger`.

### Bloco C - Pedido ponta a ponta

- [ ] Cliente cria pedido sem duplicar com clique duplo.
- [ ] Cupom válido aplica corretamente.
- [ ] Pedido aparece no Kanban do lojista.
- [ ] Lojista atualiza status sem travar tela.
- [ ] Entregador aceita corrida e conclui com PIN.
- [ ] Cliente vê status final correto.

## 4) Query de validação no banco (após homologação)

### Idempotência de pedido

```sql
select establishment_id, idempotency_key, count(*) as total
from public.orders
where idempotency_key is not null
group by establishment_id, idempotency_key
having count(*) > 1;
```

Esperado: `0` linhas.

### Deduplicação de eventos de pagamento

```sql
select provider_event_id, count(*) as total
from public.payments_ledger
group by provider_event_id
having count(*) > 1;
```

Esperado: `0` linhas.

## 5) Critério de liberação para cliente real

Pode liberar quando:

- [ ] Blocos A, B e C estão 100% verdes.
- [ ] Queries de validação retornam zero duplicidade.
- [ ] Sem erro crítico no fluxo por pelo menos 30 minutos de uso.
- [ ] Suporte está com canal ativo para responder incidentes.

## 6) Plano de contingência (se algo quebrar)

### Falha no pagamento de plano

1. Não liberar acesso manual sem evidência.
2. Usar revalidação de pagamento.
3. Acionar suporte e registrar `checkout_session_id`.

### Falha no checkout de pedido

1. Coletar horário + usuário + loja.
2. Validar no banco se pedido foi criado.
3. Se não criou, orientar retry.
4. Se criou, não pedir novo envio.

### Falha de entrega

1. Manter pedido rastreável.
2. Acionar lojista e entregador no WhatsApp.
3. Registrar incidente com causa e ação tomada.

## 7) Monitoramento das primeiras 24h

- Janela 0-2h:
  - acompanhar logs em tempo real.
  - foco em login, checkout e pagamento.
- Janela 2-8h:
  - revisar falhas por endpoint.
  - checar tempos de resposta.
- Janela 8-24h:
  - consolidar incidentes.
  - priorizar correções de maior impacto.

## 8) Pós-go-live imediato (D+1)

- [ ] Revisão de incidentes e causas raiz.
- [ ] Ajustes rápidos de UX que reduziram fricção.
- [ ] Atualizar checklist para próximo cliente.
- [ ] Fechar relatório simples: o que funcionou / o que ajustar.
