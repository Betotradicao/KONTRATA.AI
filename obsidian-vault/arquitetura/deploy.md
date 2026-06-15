# Deploy Multi-Tenant

Procedimento padrão para atualizar clientes na VPS 46.

## 🎯 Princípios
- **NUNCA** rodar `docker compose down -v` (destrói banco)
- **SEMPRE** usar `--no-deps frontend backend` (não reinicia postgres/minio)
- **SSH no Windows:** usar wrapper PowerShell (ver [[../padroes/regras-ssh-windows|Regras SSH Windows]])

## 🚀 Comando Padrão (Frontend + Backend)

```bash
powershell -Command "& { ssh vps2-hostinger 'cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/<CLIENTE> && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f 2>&1' | Out-String }"
```

Substituir `<CLIENTE>` por: `tradicao`, `supervital`, `maxvalle`, etc.

## 📋 Ordem dos Passos
1. **git pull** no repo compartilhado `/root/prevencao-radar-repo`
2. **Build sem cache** só do frontend+backend do cliente
3. **Up com --no-deps** pra não tocar em postgres/minio
4. **Limpar cache Docker** (libera disco da VPS)
5. **Verificar logs** pra confirmar que subiu

## 🔍 Verificação Pós-Deploy

```bash
powershell -Command "& { ssh vps2-hostinger 'docker ps --filter name=prevencao-<CLIENTE> 2>&1' | Out-String }"
```

Esperar `healthy` no backend. Frontend fica "health: starting" por ~30s antes de ficar healthy — normal.

### ⚠️ "A mudança não apareceu!" → quase sempre é CACHE DO NAVEGADOR, não o deploy
Depois de buildar o frontend, o navegador continua servindo o bundle antigo. ANTES de achar que o build falhou:
1. **Prova que o servidor está certo** — baixa o JS público e procura a mudança:
   `curl -s https://<cliente>.kontrataai.com.br/ | grep -oE 'assets/index-[^"]+\.js'` (pega o hash) e
   `curl -s https://<cliente>.kontrataai.com.br/assets/index-XXXX.js | grep "texto novo"`.
   Se o texto está lá → deploy OK, é cache do cliente.
2. **Fix no navegador:** Ctrl+Shift+R (hard refresh) ou aba anônima (Ctrl+Shift+N).
- Build com `--no-cache` gera hash novo no nome do JS; se o index.html já aponta pro hash novo, o servidor está correto.

## 📦 Deploy em MÚLTIPLOS clientes
Rodar sequencialmente (não paralelo, pra não estourar CPU da VPS):
1. [[../clientes/tradicao|Tradição]]
2. [[../clientes/maxvalle|MaxValle]]
3. [[../clientes/supervital|SuperVital]]

## ❌ O que NUNCA fazer
- `docker compose down -v` → destrói volume do postgres (PERDE DADOS)
- `docker compose up -d --build` sem especificar serviço → recria TUDO incluindo postgres
- Esquecer de fazer `git pull` antes do build

## 🏷️ Tags
#arquitetura #deploy #devops
