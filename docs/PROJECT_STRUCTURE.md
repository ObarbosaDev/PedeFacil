# Estrutura de Projeto (Segura e Organizada)

## Objetivo
Padronizar a estrutura para escalar com segurança, clareza de responsabilidades e menor risco operacional.

## Árvore principal

- `src/pages`: telas e rotas (admin, cliente, entregador, auth, público).
- `src/components`: UI reutilizável e layouts.
- `src/hooks`: hooks de estado e autenticação.
- `src/lib`: regras de negócio, utilitários e integrações de domínio.
- `src/integrations`: clientes externos (ex.: Supabase).
- `src/test`: setup e testes.
- `supabase/migrations`: schema versionado do banco.
- `backend`: serviços Java (automação/receptor).
- `docs`: documentação de operação, go-live e arquitetura.
- `.github/workflows`: automações de CI e segurança.
- `.githooks`: hooks locais versionados.

## Regras de segurança de estrutura

1. Segredos nunca entram no Git:
- arquivos `.env`, chaves privadas, certificados e tokens reais.

2. Apenas variáveis públicas no frontend:
- `VITE_*` pode existir no cliente.
- chaves administrativas (service role etc.) ficam só no backend/provedor.

3. Banco sempre por migration:
- qualquer ajuste em schema precisa entrar em `supabase/migrations`.

4. Fluxos críticos auditáveis:
- ações de entrega, autenticação e cobrança devem registrar trilha.

5. Guardrails obrigatórios:
- `npm run check:repo` para bloquear arquivos sensíveis rastreados.
- CI com `repo-health` + `secret-scan`.

## Convenções de expansão

Quando um domínio crescer, preferir:
- `src/lib/<dominio>/...` para regras de negócio.
- `src/components/<dominio>/...` para componentes visuais.
- `src/pages/<dominio>/...` para telas finais.

Evitar:
- lógica de negócio pesada dentro de componentes de UI.
- chamadas diretas de integração espalhadas em múltiplas páginas sem camada de utilitário.
