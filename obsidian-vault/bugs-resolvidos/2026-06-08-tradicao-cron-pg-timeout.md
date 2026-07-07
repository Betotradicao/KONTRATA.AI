---
data: 2026-06-08
cliente: Tradição (prevencao-no-radar)
projeto: prevencao-radar (branch TESTE)
arquivo: packages/backend/src/config/database.ts
commit: 1160aa0
tags: [postgres, pool, cron, timeout, conexao]
---

# Tradição — Crons (Top Quedas, Vendas Mensais, etc) não disparavam por timeout do pool pg

## Sintoma
User reportou várias semanas: "Top Quedas Semanal" configurado pra Segunda 08:00, mas **não envia**. Mesma coisa em outros crons agendados.

## Causa-raiz
`connectionTimeoutMillis: 3000` (3 segundos) no pool pg/TypeORM. Combinação ruim com `idleTimeoutMillis: 30000`:

1. Pool fecha conexões idle a cada 30s
2. Cron desperta uma vez por minuto, chama `ConfigurationService.get(...)` que precisa de conexão pg
3. Se TODAS as conexões idle foram fechadas (silêncio prolongado), pool tenta abrir nova
4. Tinha só 3s pra estabelecer — qualquer mini-lag (deploy, GC, IO lento, fork) estourava
5. `Connection terminated due to connection timeout` → catch do cron → return → **nunca dispara o envio**

Erros apareciam em TODOS os crons que liam config: Top Quedas, Vendas Mensais, Bips, Losses, Abastecimento, Cortes, Atrasos, Fornecedores.

## Fix
[database.ts:36-48](packages/backend/src/config/database.ts#L36-L48) e [database.ts:57-65](packages/backend/src/config/database.ts#L57-L65):
- `connectionTimeoutMillis: 3000` → `30000` (30s)
- `idleTimeoutMillis: 30000` → `60000` (60s — menos churn)

Em duas configs: o `extra` do TypeORM `AppDataSource` E o `Pool` pg direto (linha 57). Tem que mexer nos dois porque o backend usa ambos em lugares diferentes.

## Validação
User mudou horário do Top Quedas pra +5min, salvou, e o envio disparou normal.

## Lição reutilizável
**`connectionTimeoutMillis` baixo (≤3s) é trap pra crons.** Em horário de pico ou após período idle, qualquer hiccup quebra o cron silenciosamente — o catch absorve e a falha vira "nada acontece". 30s é o padrão recomendado pro pg-pool em produção.

Quando um cron "não dispara mas deveria":
1. Confirmar que o cron job foi REGISTRADO no startup do backend (busca por "cron job started" no log)
2. Buscar `cron error` nos últimos dias — se aparecer `Connection terminated` o problema é o pool pg
3. NÃO confiar que silêncio = funcionando — crons que dão throw + catch silencioso parecem mortos

## Rollback
Reverter [database.ts](packages/backend/src/config/database.ts) ao commit anterior (`40ae247`). Não recomendado — o fix é defensivo e quase grátis.

## O que NÃO resolve
Crons que não estão registrados de fato no `index.ts` (cron.schedule). Esse fix só corrige crons que existem mas falham por timeout pg.
