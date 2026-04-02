# Pede Fácil - Kit de Lançamento (Primeiros Clientes)

Guia direto para colocar lojistas reais usando o sistema e converter os primeiros pagantes.

## 1) Plano de 7 dias (ação real)

### Dia 1 - Definir alvo e oferta
- Escolher 1 nicho: ex. hamburgueria local.
- Escolher 1 micro-região (bairro).
- Definir oferta simples:
  - 30 dias de piloto
  - setup feito por você em 1 hora
  - suporte via WhatsApp

Entregável do dia:
- lista com 20 lojas alvo (nome + contato + endereço).

### Dia 2 - Preparar material de venda
- Separar link da demo.
- Montar argumento curto (30 segundos):
  - organiza pedidos
  - reduz erro
  - melhora operação de entrega
- Preparar mensagem de WhatsApp pronta (template no final).

Entregável do dia:
- texto de abordagem + link pronto para envio.

### Dia 3 - Prospecção ativa
- Meta: 20 contatos (10 presencial + 10 WhatsApp).
- Objetivo: agendar 3 demonstrações curtas (15 minutos).

Entregável do dia:
- pipeline preenchido (ver `docs/templates/METRICS_TRACKER.csv`).

### Dia 4 - Fechar 1 lojista piloto
- Cadastrar cardápio essencial (10-20 produtos).
- Configurar dados da loja (horário, taxa, entrega).
- Fazer 2 pedidos de teste com o dono.

Entregável do dia:
- loja em produção com link público ativo.

### Dia 5 - Operar dia real assistido
- Acompanhar horário de pico junto do lojista.
- Responder suporte em tempo real.
- Registrar fricções (o que travou).

Entregável do dia:
- lista com top 5 problemas de impacto.

### Dia 6 - Corrigir top 5 fricções
- Corrigir só o que mexe com venda e operação:
  - checkout
  - atualização de status
  - erros de mensagem
  - atraso de entrega

Entregável do dia:
- nova versão aplicada no mesmo dia.

### Dia 7 - Reunião de fechamento e proposta
- Mostrar resultado da semana:
  - pedidos recebidos
  - tempo de atendimento
  - falhas resolvidas
- Fazer proposta comercial simples (mensalidade fixa).

Entregável do dia:
- 1 cliente pagante ou piloto renovado com prazo.

---

## 2) Como conseguir os primeiros lojistas

### Abordagem presencial (roteiro de 20 segundos)
"Oi, tudo bem? Eu sou fundador do Pede Fácil.  
Eu organizo pedido online e entrega para loja de bairro sem complicação.  
Se você me der 15 minutos, eu te mostro no celular como já rodaria hoje."

### Mensagem de WhatsApp pronta
Use o arquivo:
- `docs/templates/WHATSAPP_OUTREACH.txt`

### Objeções comuns e resposta curta
- "Já uso WhatsApp."
  - "Perfeito. O Pede Fácil entra para organizar e reduzir erro operacional."
- "Tô sem tempo."
  - "Eu configuro tudo e você só valida. Em 1 hora fica no ar."
- "Não sei se vale."
  - "Vamos em piloto curto com resultado medido. Se não ajudar, você sai."

---

## 3) Operação manual (modo MVP)

Se algo falhar, nunca pare a operação. Faça fallback manual.

### Falha no checkout
- Receber pedido manual no WhatsApp.
- Registrar no painel/admin (ou planilha contingência).
- Confirmar cliente com mensagem padrão.

### Falha de entrega
- Ligar para entregador.
- Atualizar status manualmente.
- Avisar cliente com ETA novo.

### Falha de automação WhatsApp
- Pedido continua válido no sistema.
- Você dispara mensagem manual para loja/cliente.
- Registrar incidente para corrigir depois do pico.

Checklist operacional pronto:
- `docs/templates/OPERACAO_MVP_CHECKLIST.md`

---

## 4) Métricas mínimas (sem ferramenta complexa)

Acompanhe todo dia:
- contatos feitos
- demos feitas
- pilotos iniciados
- pilotos convertidos
- pedidos por loja
- pedidos entregues vs cancelados
- falhas críticas (checkout, duplicidade, entrega, notificação)

Template pronto:
- `docs/templates/METRICS_TRACKER.csv`

Regra:
- preencher 1 vez no fim do dia (10 minutos).

---

## 5) Erros que matam agora

- Esperar produto perfeito para vender.
- Ficar só no código e não falar com lojista.
- Abrir muitos nichos ao mesmo tempo.
- Não ter plano manual quando algo falha.
- Não medir conversão comercial.
- Fazer feature nova antes de corrigir dor real de operação.

---

## 6) Ajustes simples com alto impacto

- Botão "Teste de pedido" no painel do lojista.
- Destaque visual para pedido atrasado no Kanban.
- Mensagem de erro sempre com ação: "Tentar novamente".
- Checkout com campos mínimos e validação em tempo real.
- WhatsApp da loja visível em pontos-chave.
- Acesso rápido a "repetir pedido" no cliente.

---

## Regras de execução (para dev solo)

- Só priorizar o que aumenta pedido ou reduz falha.
- Ciclo diário: vender -> operar -> corrigir -> repetir.
- Toda semana precisa ter:
  - novas lojas abordadas
  - pelo menos 1 piloto ativo
  - melhoria aplicada com base em uso real
