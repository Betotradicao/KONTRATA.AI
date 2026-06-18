---
data: 2026-06-18
projeto: infra (VPS 46 Hostinger)
tags: [infra, vps, cpu, docker, build, deploy, boot-storm, multi-tenant]
---

# VPS 46 travou (CPU 100% / load 167) — boot storm + builds em massa

## Sintoma
Hostinger ativou "Limitação de CPU". Gráfico: CPU de ~37% saltou pra ~100% **sustentado**. VPS chegou a **reiniciar em loop**; clientes pararam de abrir. `load average` chegou a **167** numa máquina de **2 vCPUs**.

## Causa-raiz
1. **8 `docker compose build --no-cache` em sequência** (deploy de todos os clientes) — compilar imagem (npm + Vite + tsc) é o que mais consome CPU.
2. **Boot storm**: a VPS reiniciou e **~65–74 containers subiram todos juntos** (15 stacks × backend/frontend/postgres/minio/cron + Radar + Evolution) em 2 vCPUs → load explodiu.
- **NÃO foi memória** (3GB livres, swap 0). **NÃO foi o autoheal** (RestartCount do backend = 0; foi removido mesmo assim).

## Estabilização (o que funcionou)
- `docker rm -f autoheal`.
- Parar e **travar** os crons: `docker ps -a --filter name=cron -q | xargs -r docker update --restart=no` + `docker stop`. (São os `prevencao-*-cron` do Radar — DVR/verificação diária; web dos clientes não usa.)
- Esperar o boot storm assentar (load 167 → ~3 em poucos minutos).

## Regras pra não repetir
- **NUNCA** rodar `--no-cache` em vários clientes em sequência. Sem mudança de dependência, **build COM cache** (rápido/leve) ou **espaçar** os builds. `--no-cache` só quando realmente necessário.
- 65 containers / 2 vCPUs aguenta em regime (=~37%), mas o **pico de boot/build** estoura. Se crescer mais cliente: **subir pra 4 vCPUs** ou distribuir.
- Diagnóstico rápido: `uptime` (load vs nproc), `free -m` (descartar OOM), `docker ps -q | wc -l`, `docker stats --no-stream`.

## Pendente
- Crons do Radar ficaram **pausados** (restart=no). Religar de forma **espaçada** quando a CPU estiver normal: `docker start <cron>` + `docker update --restart=unless-stopped`.
