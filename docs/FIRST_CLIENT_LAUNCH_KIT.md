# Pede Fácil - Kit de Lançamento (Primeiros Clientes)

Guia prático para colocar lojistas reais usando o sistema e converter os primeiros pagantes.

## 1) Plano de 7 dias (ação real)

### Dia 1 - Definir alvo e oferta
- Escolher 1 nicho (ex.: hamburgueria de bairro).
- Escolher 1 micro-região.
- Definir oferta simples:
  - 30 dias de piloto.
  - Setup feito por você em 1 hora.
  - Suporte direto no WhatsApp.

Entregável:
- Lista com 20 lojas alvo (nome, contato e endereço).

### Dia 2 - Preparar material de venda
- Separar link da demo.
- Montar argumento curto (30 segundos):
  - Organiza pedidos.
  - Reduz erros.
  - Melhora operação de entrega.
- Preparar mensagem de WhatsApp pronta.

Entregável:
- Texto de abordagem + link pronto para envio.

### Dia 3 - Prospecção ativa
- Meta: 20 contatos (10 presencial + 10 WhatsApp).
- Objetivo: agendar 3 demonstrações de 15 minutos.

Entregável:
- Pipeline preenchido no `docs/templates/METRICS_TRACKER.csv`.

### Dia 4 - Fechar 1 lojista piloto
- Cadastrar cardápio essencial (10 a 20 produtos).
- Configurar dados da loja (horário, taxa e entrega).
- Fazer 2 pedidos de teste com o dono.

Entregável:
- Loja em produção com link público ativo.

### Dia 5 - Operar dia real assistido
- Acompanhar pico junto do lojista.
- Responder suporte em tempo real.
- Registrar fricções (o que travou).

Entregável:
- Lista com os 5 maiores problemas.

### Dia 6 - Corrigir as 5 maiores fricções
- Corrigir só o que afeta venda e operação:
  - Checkout.
  - Atualização de status.
  - Erros de mensagem.
  - Atraso de entrega.

Entregável:
- Nova versão aplicada no mesmo dia.

### Dia 7 - Reunião de fechamento e proposta
- Mostrar resultado da semana:
  - Pedidos recebidos.
  - Tempo de atendimento.
  - Falhas resolvidas.
- Fazer proposta comercial simples (mensalidade fixa).

Entregável:
- 1 cliente pagante ou piloto renovado com prazo.

## 2) Como conseguir os primeiros lojistas

### Abordagem presencial (20 segundos)
"Oi, tudo bem? Eu sou fundador do Pede Fácil.  
Organizo pedido online e entrega para lojas de bairro, sem complicação.  
Se você me der 15 minutos, te mostro no celular como isso já funciona hoje."

### Mensagem de WhatsApp pronta
- Usar `docs/templates/WHATSAPP_OUTREACH.txt`.

### Objeções comuns e resposta curta
- "Já uso WhatsApp."
  - "Perfeito, o Pede Fácil entra para organizar e reduzir erro operacional."
- "Estou sem tempo."
  - "Eu configuro tudo e você só valida. Em 1 hora fica no ar."
- "Não sei se vale."
  - "Vamos em piloto curto com resultado medido. Se não ajudar, você sai."

## 3) Operação manual (modo MVP)

Se algo falhar, não pare a operação. Ative fallback manual.

### Falha no checkout
- Receber pedido manual no WhatsApp.
- Registrar no painel (ou planilha de contingência).
- Confirmar com o cliente por mensagem padrão.

### Falha na entrega
- Ligar para entregador.
- Atualizar status manualmente.
- Avisar cliente com novo ETA.

### Falha na automação WhatsApp
- Pedido segue válido no sistema.
- Você dispara a mensagem manualmente para loja/cliente.
- Registrar incidente para corrigir após o pico.

Checklist operacional:
- `docs/templates/OPERACAO_MVP_CHECKLIST.md`

## 4) Métricas mínimas (sem ferramenta complexa)

Acompanhar diariamente:
- Contatos feitos.
- Demos feitas.
- Pilotos iniciados.
- Pilotos convertidos.
- Pedidos por loja.
- Pedidos entregues vs cancelados.
- Falhas críticas (checkout, duplicidade, entrega e notificação).

Template:
- `docs/templates/METRICS_TRACKER.csv`

Regra:
- Preencher 1 vez por dia (10 minutos).

## 5) Erros que matam agora

- Esperar produto perfeito para vender.
- Ficar só no código e não falar com lojista.
- Atacar vários nichos ao mesmo tempo.
- Não ter plano manual quando algo falha.
- Não medir conversão comercial.
- Criar feature nova antes de resolver dor real da operação.

## 6) Ajustes simples com alto impacto

- Botão "Teste de pedido" no painel do lojista.
- Destaque visual para pedido atrasado no Kanban.
- Erro sempre com ação clara: "Tentar novamente".
- Checkout com campos mínimos e validação em tempo real.
- WhatsApp da loja visível nos pontos-chave.
- "Pedir de novo" no histórico do cliente.

## Regras de execução para dev solo

- Priorizar só o que aumenta pedido ou reduz falha.
- Ciclo diário: vender -> operar -> corrigir -> repetir.
- Toda semana precisa ter:
  - Novas lojas abordadas.
  - Pelo menos 1 piloto ativo.
  - Melhoria aplicada com base em uso real.
