# Estrutura da VPS 3 (Produção — TradicaoSJC)

**IP:** `31.97.82.235`
**Alias SSH:** `vps-prevencao`
**Hostname:** `TradicaoSJC`
**Acesso:** ✅ por **chave** (`~/.ssh/id_rsa_vps_producao`) desde 25/06/2026 — antes era só senha.

> ⚠️ Descoberta em 25/06/2026: essa VPS existia mas **não estava documentada** (ponto cego). A **Evolution API** (WhatsApp de todos) roda AQUI, não na VPS 46.

## 🔑 Como acessei (bootstrap 25/06)
Estava configurada como **só senha** (`PubkeyAuthentication no`). Instalei minha pubkey via **plink** (PuTTY, em `C:\PROGRAM FILES\PUTTY\plink`) usando a senha uma vez, confirmei `sshd pubkeyauthentication yes`, e troquei o `~/.ssh/config` pra usar `IdentityFile ~/.ssh/id_rsa_vps_producao` + `PreferredAuthentications publickey`. Senha original exposta no chat → **usuário deve trocar** (chave segue funcionando).

## 🐳 O que roda (Docker Swarm — serviços com nome `.1.<hash>`)
- **evolution_evolution_api** — ⭐ Evolution API (WhatsApp) em `:8090`. Instância `DVR FACIAL` (garimpador Tradição, agente, etc.). + `evolution_postgres`, `evolution_redis`.
- **n8n** — automações (editor/worker/webhook)
- **chatwoot** — atendimento omnichannel (app/sidekiq/redis)
- **traefik** — reverse proxy (roteia os serviços)
- **portainer** (+agent) — gestão Docker
- **pgvector**, **postgres**, **redis** — stores compartilhados
- **prevencao-nunes-*** — cliente [[../clientes/nunes|Nunes]] (frontend/backend/postgres/minio)
- **prevencao-*-prod** — stack prevenção "prod" (frontend/backend/cron/minio/postgres)

## 🕰️ Legado desatualizado na VPS 31 (descoberto 25/06)
Essa VPS foi provável **servidor de produção ORIGINAL** do prevenção (antes do multi-tenant na VPS 46). O prevenção aqui está **parado no tempo (março/2026)**:
- **`prevencao-*-prod`** — stack original criada **04/01/2026** (porta host 3000). 5 meses sem tocar.
- **`prevencao-nunes-*`** — Nunes **duplicado/abandonado** (o ativo é o da VPS 46). 5 meses.
- **`/root/prevencao-radar-repo`** — último commit **13/03/2026**, instalador **v5.0** (atual é v5.5). **~3,5 meses stale.**
- **`/root/clientes`** — só pastas `nunes`+`supervital` soltas, **SEM `clientes.json`** (não é o registro multi-tenant atual).
- ⚠️ **Antes de instalar/testar cliente aqui:** `git pull origin TESTE` no repo (ou re-clonar) — senão pega código velho. Portas podem colidir com o `-prod` (3000).
- ✅ O que está **ativo/novo** = camada Evolution/n8n/chatwoot (swarm). O prevenção legado pode ser candidato a limpeza (confirmar antes).

## 🆚 Não confundir com a VPS 46
| | VPS 3 (esta) | VPS 46 |
|---|---|---|
| IP | `31.97.82.235` | `46.202.150.64` |
| Alias | `vps-prevencao` | `vps2-hostinger` |
| Chave | `id_rsa_vps_producao` | `hostinger_vps2` |
| Papel | Evolution/n8n/chatwoot + nunes/prod | 8 kontrata + 4 prevenção (tradicao/nunes/supervital/maxvale) |

⚠️ **Nunes aparece nas DUAS** — validar em qual está o Nunes ativo antes de mexer.

## 🔗 Relacionados
- [[estrutura-vps|Estrutura VPS 46]]
- [[../modulos/garimpador|Garimpador — webhook Evolution]]
- [[../padroes/regras-ssh-windows|SSH no Windows]]

## 🏷️ Tags
#arquitetura #vps #infraestrutura #evolution #producao
