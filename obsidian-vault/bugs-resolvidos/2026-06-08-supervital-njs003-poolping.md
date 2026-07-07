---
data: 2026-06-08
cliente: SuperVital
projeto: prevencao-radar (branch TESTE)
arquivo: packages/backend/src/services/oracle.service.ts
tags: [oracle, conexao, mikrotik, supervital, nat, pool]
---

# SuperVital — "OK → pesquisa → cai → volta": adição de `poolPingInterval: 60`

## Sintoma
"Conecta, depois cai. A gente testa, diz que tá OK, faz uma pesquisa, cai." Loop reportado pelo user. Logs do backend mostravam `NJS-003: invalid or closed connection` quando o backend tentava usar uma conexão do pool.

## Causa-raiz
**Mikrotik da loja com NAT agressivo descartando conexões TCP idle.** O pool oracledb mantinha conexões "vivas" do ponto de vista do app, mas o NAT da loja já havia esquecido o estado da conexão. Próxima query → NJS-003.

Por que SuperVital sim e Tradição não:
- **Tradição** → kontrata.ai roda LOCAL na loja (10.6.1.171), Oracle também na LAN (10.6.1.100). Conexão **não atravessa NAT**, Mikrotik nem entra no caminho.
- **SuperVital** → backend roda na VPS Hostinger pública, conexão atravessa internet → Mikrotik da loja → LAN. NAT do Mikrotik no meio.

## Fix
Adicionado `poolPingInterval: 60` no `oracledb.createPool()`. Antes de devolver uma conexão que ficou idle mais que 60s, o driver dispara um `SELECT 1 FROM DUAL`. Se voltar, conexão está viva. Se NJS-003 no ping, descarta e cria nova **antes** de entregar pro consumer.

Custo: 10ms uma vez por conexão idle por minuto. Em loja LAN sem NAT (Tradição) é gratis.

## Rollback
1. Editar `packages/backend/src/services/oracle.service.ts`
2. Remover a linha `poolPingInterval: 60,` no `createPool()`
3. Rebuild + redeploy (`docker compose build --no-cache backend && docker compose up -d --no-deps backend`)

Commit a reverter: ver `git log packages/backend/src/services/oracle.service.ts` — commit com mensagem `fix(oracle): poolPingInterval 60s`.

## O que NÃO resolve
- Queda total de internet da loja → cai pra todo mundo igual
- Erros `ORA-00904` (colunas inválidas) → outro problema, mapeamento incompatível em algumas queries
