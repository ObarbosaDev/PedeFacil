Assunto sugerido:
`Confirme seu acesso no Pede Fácil`

Onde colar:
`Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup`

Variáveis usadas pela template:
- `{{ .ConfirmationURL }}`
- `{{ .Email }}`
- `{{ .Data.full_name }}`
- `{{ .Data.role_label }}`
- `{{ .Data.product_name }}`
- `{{ .Data.support_phone }}`
- `{{ .Data.confirmation_cta }}`
- `{{ .Data.email_preheader }}`

Observação:
- O app já passou a enviar esses metadados no `signUp`.
- Se quiser evitar problema de pré-leitura de link em alguns provedores de e-mail, dá para migrar esse fluxo depois para OTP com página intermediária de confirmação.

Texto curto para pré-header:
`Confirme seu acesso para liberar sua conta no Pede Fácil.`
