---
tags: [bug-resolvido, backend, rh, curriculo, paginacao]
data: 2026-08-04
modulo: RH / Banco de Currículos (curriculos.controller.ts)
---

# Card "Total" do Banco de Currículos travava em 500 mesmo com mais registros

## Sintoma
Cliente **Novacentral** já tinha currículo de número **#663** na tabela, mas o card
"TOTAL" no topo da tela Banco de Currículos mostrava **500** — preso, não subia.

## Causa-raiz
`curriculos.controller.ts` → `listarCurriculos`:
```ts
const qb = AppDataSource.getRepository(Curriculo).createQueryBuilder('c')
  .orderBy('c.created_at', 'DESC').take(500);
```
A query já vinha com `.take(500)` — cortava a **lista inteira** em 500 linhas antes
de qualquer filtro de UI. E o pior: o objeto `resumo` (cards Total/Novo/Vagas
Futuras/Selecionado/Contratado) era calculado **em cima dessa mesma lista já
cortada** (`total: lista.length`, `novo: lista.filter(...).length`, etc) — não
existia uma contagem real (`COUNT(*)`) por trás. Ou seja, o card nunca refletia o
banco, sempre refletia o corte.

## Correção
Removido o `.take(500)`. A tela hoje não tem paginação server-side nem
client-side (a tabela já carrega e renderiza tudo de uma vez, scroll normal) —
então bastou tirar o limite pra lista E os cards baterem com o banco real.

## 🎯 Lição reutilizável
Se algum dia for necessário limitar a query por performance (ex: `LIMIT`/`take`
de novo, paginação de verdade), **o resumo/contadores dos cards não podem vir do
`.length` da lista paginada** — precisa de uma query de `COUNT(*)` separada (com
os mesmos filtros, sem o limite), senão o card volta a mentir o total assim que
o cliente passar do teto.

## Alcance
Afeta **qualquer cliente kontrata com mais de 500 currículos no banco**, não só
Novacentral — só ela bateu o teto primeiro. Deploy: só backend (`build --no-cache
backend` + `up -d --no-deps backend`).
