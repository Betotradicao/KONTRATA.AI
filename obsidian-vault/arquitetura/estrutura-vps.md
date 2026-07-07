# Estrutura da VPS 46

**IP:** `46.202.150.64`
**Alias SSH:** `vps2-hostinger`
**Branch:** `TESTE`

## 📁 Layout de Diretórios

```
/root/
├── prevencao-radar-repo/          # Repositório Git COMPARTILHADO (fonte do código)
├── clientes/
│   ├── clientes.json              # Registro de todos os clientes
│   ├── tradicao/
│   │   ├── docker-compose.yml
│   │   ├── .env
│   │   └── ssh_keys/              # SSH isolado do cliente
│   ├── supervital/
│   ├── maxvalle/
│   └── ...
└── .ssh/
    └── authorized_keys            # Authorized_keys do HOST (sshd lê daqui)
```

## 🏷️ Padrão de Nomes

| Componente | Padrão | Exemplo |
|---|---|---|
| Container | `prevencao-<cliente>-<servico>` | `prevencao-tradicao-backend` |
| Banco Docker | `postgres_<cliente>` | `postgres_tradicao` |
| Network Docker | `<cliente>_network` | `tradicao_network` |

## 🔐 SSH por Cliente
Cada cliente tem ssh_keys isoladas:
- Frontend do cliente X só vê túneis do cliente X
- Host (`/root/.ssh/authorized_keys`) tem TODOS os túneis
- Quando backend cria túnel, escreve nos DOIS

## 🛠️ Comandos Úteis

```bash
# Ver containers de um cliente
docker ps --filter name=prevencao-<CLIENTE>

# Logs backend
docker logs prevencao-<CLIENTE>-backend --tail 50

# Ver todos os clientes instalados
cat /root/clientes/clientes.json | python3 -m json.tool
```

## 🩺 Monitoramento de saúde (cron) — desde 25/06/2026
Script `/root/monitor-saude.sh` roda **a cada 15min** (cron do root) e anexa em **`/root/saude.log`**. Vigia os 3 sinais que derrubaram o SuperVital:
1. **zumbis** acumulando (`ps -eo stat | grep -c Z`) — alerta se >80 + aponta o container culpado
2. **backend unhealthy** (frontends ignorados = falso-positivo do `wget` BusyBox)
3. **steal** alto (re-throttle Hostinger) — alerta se ≥65%

**Só DETECTA e registra — NÃO remedia sozinho** (lição do autoheal/meltdown: auto-restart pode causar a própria sobrecarga). Pra revisar: `tail -50 /root/saude.log` ou `grep ALERTA /root/saude.log`.

Antigo `/root/watchdog.sh` = one-shot (vigia steal por ~1h, não está no cron).

## 🔗 Relacionados
- [[deploy|Procedimento de Deploy]]
- [[../padroes/regras-ssh-windows|SSH no Windows]]
- [[../clientes/supervital|SuperVital — init+teto no compose]]

## 🏷️ Tags
#arquitetura #vps #infraestrutura
