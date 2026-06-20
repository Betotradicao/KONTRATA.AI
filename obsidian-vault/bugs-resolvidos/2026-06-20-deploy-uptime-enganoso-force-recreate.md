---
tags: [deploy, docker, vps, devops]
data: 2026-06-20
---

# Deploy: uptime enganoso (salto de relógio) + `up` que não recria

## Sintomas
Ao deployar vários clientes Kontrata em sequência, `docker ps` mostrou containers
recém-recriados como **"Up 19-20 hours"** — com os MESMOS container IDs que segundos
antes apareciam como "Up X seconds". Fisicamente impossível.

## Causa-raiz
**O relógio da VPS saltou** ~22h (NTP corrigiu de Jun 19 p/ Jun 20 no meio dos deploys).
Docker calcula uptime = `now - startedAt`; com `now` saltando pra frente, containers
criados ANTES do salto mostram uptime inflado. Os criados DEPOIS mostram valor correto.
→ **Uptime NÃO é prova confiável de deploy quando o relógio se move.**

## Lição 1 — verificar deploy pelo BUNDLE servido, não pelo uptime
A prova real de que o código novo está no ar é o JS servido conter o texto novo:
```bash
# pega o asset (porta do frontend do cliente, ex cidade=7846):
ssh vps2-hostinger 'curl -s http://localhost:7846/ | grep module'
#   -> /assets/index-XXXX-<ts>.js
ssh vps2-hostinger 'curl -s http://localhost:7846/assets/index-XXXX-<ts>.js | grep -c <texto_novo>'
```
`grep -c` retorna 1 = código novo no ar. (Não usar `[^"]` no pattern via SSH+PowerShell —
"Invalid range end"/EOF de aspas; usar `grep module` e ler o nome do asset.)

## Lição 2 — `up -d --no-deps` às vezes NÃO recria após `build --no-cache`
Em alguns clientes o `docker compose up -d --no-deps frontend backend` deixou o
container ANTIGO rodando mesmo com imagem nova buildada. Fix: **`--force-recreate`**.
Padrão confiável (build e recreate separados):
```bash
cd /root/kontrata-repo && git pull origin KONTRATAAI && cd /root/clientes-kontrata/<cli> && docker compose build --no-cache frontend backend
# depois, isolado:
cd /root/clientes-kontrata/<cli> && docker compose up -d --no-deps --force-recreate frontend backend && docker builder prune -f && docker image prune -f
```

## Lição 3 — `docker compose exec` p/ inspecionar fs do container foi não-confiável
`docker compose exec -T frontend sh -c "ls /usr/share/nginx/html/assets/"` deu saída
enganosa (listou `/`). Preferir o curl do bundle servido (Lição 1) — testa o que o
usuário realmente recebe, não o fs interno.

## Tags
#deploy #docker #vps #devops
