# ADR 0001: Limite do produto MVP

- Data: 2026-09-23
- Status: aceito
- Decisores: produto e engenharia

## Contexto

O repositorio acumulou tres propostas diferentes: SaaS para lojista, marketplace
de consumidores e marketplace logistico. Essa combinacao aumenta o custo de
produto, suporte, seguranca e aquisicao antes da validacao comercial.

## Decisao

O Pede Facil sera tratado como SaaS B2B de canal proprio, operacao de pedidos e
recompra para restaurantes independentes.

O consumidor usa o canal de uma loja especifica. O entregador participa como
frota propria ou convidada. Marketplace publico e frota compartilhada ficam fora
do MVP.

## Consequencias

- a navegacao do lojista sera reduzida;
- a landing deixara de vender um ecossistema de tres lados;
- o checkout deixara de exigir conta antes da compra;
- rotas legadas serao inicialmente protegidas por feature flags;
- codigo e dados legados serao removidos apenas depois da migracao e validacao;
- cada novo modulo devera possuir fronteira, contrato e testes proprios.

## Alternativas rejeitadas

### Continuar como superapp

Rejeitada por exigir densidade simultanea de lojas, consumidores e entregadores.

### Reescrever tudo antes do piloto

Rejeitada por adiar aprendizado comercial e introduzir risco sem receita.
