# Plano de corte do Supabase

## Checklist técnico

### Banco
- [ ] criar Postgres gerenciado novo
- [ ] criar usuário app
- [ ] criar usuário migração
- [ ] ativar SSL obrigatório
- [ ] validar backup / restore

### Schema
- [ ] portar todas as migrations válidas
- [ ] remover dependências de `auth.users`
- [ ] remover dependências de `auth.uid()`
- [ ] remover dependências de `storage.*`

### Auth
- [ ] tabela `app_users`
- [ ] tabela `app_sessions`
- [ ] tabela `app_refresh_tokens`
- [ ] tabela `email_verification_tokens`
- [ ] tabela `password_reset_tokens`
- [ ] tabela `otp_codes`

### API
- [ ] cadastro via backend
- [ ] login via backend
- [ ] reset via backend
- [ ] confirmação via backend
- [ ] guardas por role via backend

### Frontend
- [ ] remover `supabase.auth`
- [ ] remover `supabase.from(...)` das áreas críticas
- [ ] remover `supabase.rpc(...)`
- [ ] remover `supabase.storage`
- [ ] remover `supabase.channel`

### Storage
- [ ] criar bucket equivalente
- [ ] migrar imagens
- [ ] migrar provas de entrega
- [ ] trocar URLs públicas

### Dados
- [ ] exportar produção
- [ ] importar no banco novo
- [ ] reconciliar contagens por tabela
- [ ] validar ids e foreign keys

### Corte
- [ ] ambiente paralelo pronto
- [ ] smoke test completo
- [ ] freeze curto de escrita
- [ ] sync final
- [ ] troca de env
- [ ] monitoramento pós-corte

## Ordem recomendada

1. banco
2. auth
3. APIs críticas
4. storage
5. realtime
6. corte final
