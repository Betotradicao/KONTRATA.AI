---
data: 2026-06-17
cliente: SuperVital
projeto: prevencao-radar (VPS 46)
tags: [supervital, oracle, mikrotik, docker, healthcheck, autoheal, infra]
---

# SuperVital "Verificando configuração do sistema..." trava — backend unhealthy + autoheal

## Sintoma
Site `supervital.prevencaonoradar.com.br` fica eternamente em **"Verificando configuração do sistema..."** (spinner). Recorrente ("vira e mexe cai do nada"). **Só o SuperVital** dá isso.

## Diagnóstico
`docker ps` → `prevencao-supervital-backend` **Up 7 dias (unhealthy)**. Postgres/minio healthy. O check de boot do frontend bate no backend, que está travado → spinner infinito. **Restart do backend resolve na hora** (`docker restart prevencao-supervital-backend`), volta healthy e Oracle reachable.

## Causa-raiz (por que SÓ o SuperVital)
Arquitetura de rede: backend roda na **VPS pública** e o Oracle fica **na loja** → toda conexão atravessa **internet → Mikrotik/NAT da loja → LAN**. A rede da loja é instável e o NAT derruba conexões idle (ver [[2026-06-08-supervital-njs003-poolping|NJS-003 / poolPingInterval]]). Com o tempo o backend **trava inteiro** (query pendurada em conexão morta) → healthcheck falha → fica `unhealthy`.
- **Tradição e outros que rodam LOCAL** não passam por isso: conexão Oracle fica na LAN, sem NAT.
- `restart: unless-stopped` do compose **NÃO reinicia em `unhealthy`** (só se o container sair). Por isso ficava parado até alguém reiniciar.

## Fix aplicado (17/06/2026): autoheal
Container `willfarrell/autoheal` na VPS, modo **por label** (reinicia só containers com `autoheal=true`):
```bash
docker run -d --name autoheal --restart=always \
  -e AUTOHEAL_INTERVAL=30 -e AUTOHEAL_START_PERIOD=120 \
  -v /var/run/docker.sock:/var/run/docker.sock willfarrell/autoheal
```
E label `autoheal=true` adicionado **só** no serviço `backend` do `/root/clientes/supervital/docker-compose.yml` (recriado com `docker compose up -d --no-deps --force-recreate backend`).

⚠️ **Modo label de propósito** (não `AUTOHEAL_CONTAINER_LABEL=all`): os **frontends Kontrata reportam `unhealthy` à toa** (healthcheck usa `wget --quiet/--tries` GNU mas o probe roda o wget do BusyBox) — em modo `all` o autoheal entraria em loop reiniciando eles.

## Pendente (blindar a causa, não só reerguer)
- Timeout nas queries Oracle (query travada morre rápido em vez de pendurar o backend).
- Boot do app não depender de o Oracle estar 100% no ar.

## Relacionados
- [[../clientes/supervital|SuperVital]]
- [[2026-06-08-supervital-njs003-poolping|NJS-003 poolPing]]
