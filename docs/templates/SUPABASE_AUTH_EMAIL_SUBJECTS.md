## Assuntos e previews

### Confirm signup
- Assunto: `Confirme seu acesso no Pede Fácil`
- Preview: `Falta só um toque para liberar sua conta e entrar no painel.`

### Reset password
- Assunto: `Troque sua senha no Pede Fácil`
- Preview: `Recebemos um pedido para redefinir sua senha. Se foi você, resolve em segundos.`

### Magic link / OTP
- Assunto: `Seu código de acesso do Pede Fácil`
- Preview: `Use o código de 6 dígitos para entrar com segurança.`

## Como usar no Supabase

`Supabase Dashboard -> Authentication -> Email Templates`

- `Confirm signup`: usar [SUPABASE_CONFIRM_SIGNUP_EMAIL.html](C:\Users\Matheus Barbosa\Documents\GitHub\pedefacilteste\docs\templates\SUPABASE_CONFIRM_SIGNUP_EMAIL.html)
- `Reset password`: usar [SUPABASE_RESET_PASSWORD_EMAIL.html](C:\Users\Matheus Barbosa\Documents\GitHub\pedefacilteste\docs\templates\SUPABASE_RESET_PASSWORD_EMAIL.html)
- `Magic link`: usar [SUPABASE_MAGIC_LINK_EMAIL.html](C:\Users\Matheus Barbosa\Documents\GitHub\pedefacilteste\docs\templates\SUPABASE_MAGIC_LINK_EMAIL.html)

## Observação importante

- Hoje seu login com OTP usa código manual no app.
- Então a template de `Magic link` foi desenhada para destacar `{{ .Token }}` primeiro.
- O botão com `{{ .ConfirmationURL }}` ficou como apoio, não como fluxo principal.

## Variáveis usadas

### Confirm signup
- `{{ .ConfirmationURL }}`
- `{{ .Email }}`
- `{{ .Data.full_name }}`
- `{{ .Data.role_label }}`
- `{{ .Data.product_name }}`
- `{{ .Data.support_phone }}`
- `{{ .Data.confirmation_cta }}`
- `{{ .Data.email_preheader }}`

### Reset password
- `{{ .ConfirmationURL }}`
- `{{ .Email }}`

### Magic link / OTP
- `{{ .Token }}`
- `{{ .ConfirmationURL }}`
