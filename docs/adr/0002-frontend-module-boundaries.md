# ADR 0002: Organizacao modular do frontend

- Data: 2026-09-23
- Status: aceito

## Contexto

As regras atuais estao espalhadas entre `pages`, `lib`, hooks e acesso direto ao
banco. Algumas telas concentram mais de mil linhas e misturam consulta, regra de
negocio, estado e apresentacao.

## Decisao

Novos trabalhos serao organizados por funcionalidade:

```text
src/
  app/              composicao, rotas e providers
  features/
    marketing/
    onboarding/
    catalog/
    orders/
    checkout/
    customers/
    delivery/
    billing/
  shared/
    api/
    components/
    config/
    hooks/
    lib/
    types/
```

Cada funcionalidade pode conter `api`, `components`, `domain`, `pages` e `tests`.
Os arquivos antigos continuarao funcionando por fachadas enquanto forem migrados.

## Regras

- pagina compoe componentes; nao implementa regra critica;
- acesso externo fica em `api`;
- tipos e regras de negocio ficam em `domain`;
- componentes genericos ficam em `shared`;
- um modulo nao importa detalhes internos de outro;
- comentarios explicam decisoes e invariantes, nunca repetem o codigo;
- toda mudanca critica inclui teste e atualizacao do diario de execucao.

## Consequencias

A migracao sera incremental. Duplicacao temporaria e aceita apenas quando houver
uma fachada clara e uma tarefa registrada para remove-la.
