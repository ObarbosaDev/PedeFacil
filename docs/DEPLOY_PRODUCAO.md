# Deploy de Producao

Guia curto para publicar o Pede Facil sem Docker.

## Arquitetura recomendada

- Frontend: Vercel
- Backend Java: Render
- Banco, auth e storage: Supabase

## 1) Frontend na Vercel

Configuracao:

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Variaveis de ambiente:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_ID
VITE_PAYMENTS_API_BASE_URL=https://api.seudominio.com
```

## 2) Backend no Render

Configuracao:

- Runtime: `Java`
- Build command: `mvn -f backend/pom.xml clean package`
- Start command: `java -jar backend/target/whatsapp-automation-receiver-0.1.0.jar`

Variaveis de ambiente:

```env
PORT=8081
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
PAYMENTS_API_PUBLIC_BASE_URL=https://api.seudominio.com
PAYMENTS_ALLOWED_ORIGINS=https://app.seudominio.com,https://seudominio.com
MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxx
MERCADOPAGO_WEBHOOK_TOKEN=token_webhook_forte
MERCADOPAGO_API_BASE_URL=https://api.mercadopago.com
MERCADOPAGO_RETRY_MAX_ATTEMPTS=3
MERCADOPAGO_RETRY_BASE_DELAY_MS=250
OUTBOUND_MODE=log
```

Se voce usar automacao WhatsApp real, preencha tambem as variaveis do provider.

## 3) Dominio

Sugestao simples:

- Front: `app.seudominio.com`
- Back: `api.seudominio.com`

## 4) CORS

No backend, `PAYMENTS_ALLOWED_ORIGINS` deve conter exatamente os dominios do front em producao.

Exemplo:

```env
PAYMENTS_ALLOWED_ORIGINS=https://app.pedefacil.com,https://pedefacil.com
```

## 5) Checklist antes de publicar

- `npm run build`
- `npm run backend:test`
- Todas as migrations aplicadas no Supabase
- Webhook do Mercado Pago apontando para o backend publicado
- Fluxo de pedido testado com PIX e cartao
- Fluxo de plano testado
- Login, reset de senha e painel do entregador testados

## 6) Webhook do Mercado Pago

A URL publica precisa apontar para o backend publicado, nao para localhost.

Exemplo:

```txt
https://api.seudominio.com/api/payments/webhooks/mercadopago
```

## 7) Observacao importante

O frontend agora exige `VITE_PAYMENTS_API_BASE_URL` real. Sem isso, pagamento de plano e pedido nao funciona em producao.
