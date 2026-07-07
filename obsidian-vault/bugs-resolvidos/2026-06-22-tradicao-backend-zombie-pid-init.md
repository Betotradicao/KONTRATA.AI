---
data: 2026-06-22
cliente: Tradição (prevencao-no-radar)
projeto: prevencao-radar (VPS 46, /root/clientes/tradicao)
tags: [docker, zombie, pid1, init, healthcheck, spinner, setup-check, infra]
---

# Tradição "Verificando configuração do sistema..." trava — backend zombie + Node como PID 1 sem init

## Sintoma
`tradicao.prevencaonoradar.com.br/login` fica eternamente em **"Verificando configuração do sistema..."** (spinner laranja). Recorrente ("vira e mexe para de funcionar"). Mesmo sintoma visual da nota [[2026-06-17-supervital-backend-unhealthy-autoheal|SuperVital]], mas **causa diferente** (Tradição é Oracle LOCAL na LAN, sem Mikrotik).

## Diagnóstico (22/06/2026)
- `docker ps` → `prevencao-tradicao-backend` **Up 4 days (unhealthy)**. Postgres/minio healthy.
- Health log: `FailingStreak: 3074`, todos `Health check exceeded timeout (10s)`.
- `docker logs --since 60m` → **VAZIO**. Backend 100% pendurado, event loop morto, nem loga.
- `docker restart` **FALHOU**:
  ```
  Cannot restart container ...: PID 8055 is zombie and can not be killed.
  Use the --init option ... to run an init inside the container that
  forwards signals and reaps processes
  ```

## Causa-raiz
**Node roda como PID 1 dentro do container e não faz "reap" de processos filhos zumbis.**
O backend spawna processos filhos (ffmpeg do DVR H265→H264, IMAP, etc). Quando um filho morre vira **zumbi** porque o PID 1 (Node) não os colhe (só init/systemd faz isso). Ao longo de **dias** os zumbis acumulam → eventualmente travam o processo inteiro → healthcheck estoura → `unhealthy`. Pior: o zumbi **impede até o `docker restart`** (não dá pra matar o PID).

Isso explica o padrão "vira e mexe" e o "Up 4 days" — degrada com o tempo de uptime, não por evento pontual.

## Fix imediato (reerguer)
`docker restart` não funciona com zumbi. Usar **force-recreate** (manda SIGKILL no cgroup inteiro):
```bash
cd /root/clientes/tradicao && docker compose up -d --no-deps --force-recreate backend
```

## Fix DEFINITIVO (2 camadas, ZERO custo de CPU)
⚠️ **Autoheal está FORA** — foi desinstalado porque estourou a CPU da VPS (modo agressivo). NÃO reinstalar sem escopo travado.

> ⚠️ **REVERTIDO em 23/06/2026** — o usuário mandou remover o `init: true` do compose do Tradição (`/root/clientes/tradicao/docker-compose.yml`, linha 59, backup `.bak-init-*`). Motivo: foi a Camada 1 que CUROU o backend → ele retomou o ffmpeg/DVR a todo vapor → estourou a CPU da VPS46 (meltdown 23/06, ver [[2026-06-23-vps46-cpu-throttle-meltdown-prevencao]]). Mesmo padrão do autoheal no SuperVital ([[2026-06-17-supervital-backend-unhealthy-autoheal]]) — reviver o backend pesado numa VPS de 2 núcleos = meltdown. **Decisão:** sem init por ora; pro problema da página caindo usar a **Camada 2 (timeout no SetupCheck, frontend, NÃO revive o backend)**. Se um dia religar com init, TEM que ser junto com **teto de CPU** (`limits.cpus`).

### Camada 1 — INFRA: `init: true` no compose (resolve a raiz) [REVERTIDA 23/06]
Adicionar no serviço `backend` (idealmente todos) do `/root/clientes/tradicao/docker-compose.yml`:
```yaml
  backend:
    init: true   # tini como PID 1 → colhe zumbis + encaminha sinais
```
Recriar: `docker compose up -d --no-deps --force-recreate backend`.
Isso faz o Docker rodar **tini** como PID 1, que colhe zumbis e encaminha sinais.
Mata a raiz: backend não pendura mais por acúmulo de zumbis E volta a ser reiniciável.
Custo de CPU: **zero** (tini é minúsculo, ao contrário do autoheal).

### Camada 2 — FRONTEND: timeout no SetupCheck (mata o spinner eterno)
`packages/frontend/src/components/SetupCheck.jsx` chama
`api.get('/api/setup/status')` **SEM timeout**. Se o backend aceita a conexão TCP
mas nunca responde (pendurado), o axios espera pra sempre → `isChecking` nunca vira
false → spinner infinito. O `catch` já degrada com elegância (assume "não precisa
setup" → renderiza login), mas **só dispara se houver erro**. Backend pendurado ≠ erro.

Fix: `api.get('/api/setup/status', { timeout: 8000 })` (e/ou timeout default no
`api.js`). Assim, mesmo com backend morto, o usuário cai na tela de login em 8s
em vez de spinner eterno. Converte "site totalmente morto" → "site degradado mas usável".

## Lição reutilizável
1. **Container Node SEM `init: true` acumula zumbis** quando spawna filhos (ffmpeg/IMAP/shell). Sintomas: `unhealthy` crescente por uptime + `docker restart` falha com "PID is zombie". Solução padrão e barata: `init: true`.
2. **Spinner de bootstrap SEMPRE precisa de timeout.** Sem timeout, backend pendurado (não caído) = tela branca eterna, pior que um 500.
3. Autoheal foi tentado (SuperVital) mas estourou CPU → não é a solução universal. `init:true` é melhor porque previne em vez de remediar.

## Relacionados
- [[../clientes/tradicao|Tradição]]
- [[2026-06-17-supervital-backend-unhealthy-autoheal|SuperVital unhealthy/autoheal]]
- [[2026-06-08-tradicao-cron-pg-timeout|Cron pg timeout]]
