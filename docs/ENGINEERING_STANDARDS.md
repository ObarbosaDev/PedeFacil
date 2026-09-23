# Padrao de engenharia do Pede Facil

Ultima revisao: 2026-09-23
Responsavel: Engenharia Pede Facil

## Registro obrigatorio

Todo modulo novo deve registrar:

- data da criacao ou decisao relevante;
- equipe responsavel;
- tela ou fluxo atendido;
- finalidade para o usuario;
- motivo tecnico ou de produto;
- destino esperado do modulo.

Arquivos de codigo novos usam um cabecalho curto:

```ts
/**
 * Modulo: nome funcional.
 * Data: AAAA-MM-DD.
 * Responsavel: Engenharia Pede Facil.
 * Tela/fluxo: local em que o codigo atua.
 * Finalidade: resultado entregue ao usuario.
 * Motivo: decisao que justifica a existencia do arquivo.
 * Evolucao: proximo destino conhecido do modulo.
 */
```

## Comentarios no codigo

Nao comentar cada linha. Comentarios linha a linha duplicam a implementacao,
aumentam o custo de revisao e frequentemente ficam incorretos depois de uma
refatoracao.

Comentarios locais sao obrigatorios quando houver:

- regra de negocio que nao seja evidente;
- restricao de seguranca;
- compatibilidade temporaria;
- calculo financeiro;
- idempotencia;
- decisao de desempenho contraintuitiva;
- integracao externa com comportamento relevante.

## Commits

- usar commits pequenos e revisaveis;
- seguir Conventional Commits;
- escrever mensagem curta e profissional em portugues;
- nao misturar formatacao, refatoracao e funcionalidade sem necessidade;
- nao mencionar ferramenta de geracao ou assistencia;
- exemplos: `feat: cria hero comercial`, `fix: impede pedido duplicado`,
  `chore: atualiza dependencias visuais`, `docs: registra fluxo de pagamento`.

## Criterio de qualidade

Um modulo so esta concluido quando possui comportamento verificavel, estados de
erro, acessibilidade basica, teste proporcional ao risco e documentacao da decisao.
