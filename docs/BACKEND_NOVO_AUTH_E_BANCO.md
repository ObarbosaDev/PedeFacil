# Backend novo: banco real + auth próprio

## O que entrou

O backend agora tem a fundação inicial para sair do Supabase:

- Postgres gerenciado
- Flyway
- JPA
- módulo de auth próprio
- tokens de verificação de e-mail
- tokens de reset de senha
- refresh token
- JWT de acesso

## Variáveis novas

Arquivo base:

- [backend/.env.example](C:\Users\Matheus Barbosa\Documents\GitHub\pedefacilteste\backend\.env.example)

Obrigatórias para ligar essa fundação:

- `DATABASE_URL`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `APP_AUTH_JWT_SECRET`
- `APP_BASE_URL`

## Endpoint base do novo auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/confirm-email?token=...`
- `POST /api/auth/password/reset-request`
- `POST /api/auth/password/reset-confirm`
- `POST /api/auth/refresh`

## Migration nova do backend

- [V20260420_01__platform_auth_foundation.sql](C:\Users\Matheus Barbosa\Documents\GitHub\pedefacilteste\backend\src\main\resources\db\migration\V20260420_01__platform_auth_foundation.sql)

## Observação importante

Esse bloco é a **fundação do corte**, não a migração completa.

Ainda falta:

1. mover as telas do frontend para esse auth novo
2. portar as regras hoje presas em RPC/RLS do Supabase
3. trocar storage
4. cortar realtime Supabase

## Próximo bloco correto

1. criar usuário no banco novo
2. subir backend apontando para o Postgres novo
3. validar `/api/auth/register` e `/api/auth/login`
4. começar a reescrever o frontend de auth para API própria
