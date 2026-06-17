---
tags: [arquitetura, instalador, deploy, multi-tenant]
---

# Auto-Instalador Kontrata.ai (novo cliente na VPS)

⚠️ **NÃO confundir com o instalador do Radar.** São dois, separados:
- **Kontrata.ai** → `install-kontrata.sh` (repo **KONTRATA.AI**, branch **KONTRATAAI**) — ESTE.
- **Prevenção no Radar** → `install-multitenant.sh` (repo TESTES-, branch TESTE) — outro produto.

## 🔗 Comando (na VPS Hostinger, como root)
```bash
sudo bash <(curl -fsSL https://raw.githubusercontent.com/Betotradicao/KONTRATA.AI/KONTRATAAI/InstaladorVPS/install-kontrata.sh)
```
Repo é público → a URL raw responde 200, roda via `curl | bash` (o script é envolto em `main()` pra ler tudo antes de executar).

## O que ele faz (interativo)
1. Pergunta **domínio** (1: subdomínio Kontrata · 2: subdomínio do seu domínio · 3: domínio completo) e **nome do cliente** (vira o slug).
2. Calcula portas automaticamente conforme clientes existentes.
3. Clona/atualiza `/root/kontrata-repo`.
4. Cria `/root/clientes-kontrata/<cliente>/` com docker-compose + .env.
5. Sobe containers **kontrata-<cliente>-** (postgres, minio, backend, frontend, cron).
6. Nginx reverse proxy + SSL (Certbot).
7. Registra em `/root/clientes-kontrata/kontrata-clientes.json`.

## Isolamento (coexiste com o Radar na mesma VPS)
- Pasta: `/root/clientes-kontrata/` (Radar: `/root/clientes/`)
- Containers: `kontrata-<cliente>-*` (Radar: `prevencao-<cliente>-*`)
- Repo: `/root/kontrata-repo` (Radar: `/root/prevencao-radar-repo`)

## Relacionados
- [[deploy|Deploy (atualizar cliente existente)]]
- Arquivo: `InstaladorVPS/install-kontrata.sh`
