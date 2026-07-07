# SuperVital

**Cliente de supermercado multi-loja**, hospedado na VPS 46.

## 📊 Dados Básicos
- **VPS:** `46.202.150.64` (alias SSH: `vps2-hostinger`)
- **Diretório:** `/root/clientes/supervital`
- **Containers:** `prevencao-supervital-frontend`, `prevencao-supervital-backend`, `prevencao-supervital-postgres`, `prevencao-supervital-minio`, `prevencao-supervital-cron`
- **Portas:** Frontend 3377, Backend 4377, Postgres 5777, MinIO 9377/9477
- **URL:** `supervital.prevencaonoradar.com.br`

## 🔌 ERP
- Usa [[../arquitetura/oracle-intersolid|Oracle Intersolid]]
- Schema: `INTERSOLID`

## ⭐ Particularidades
- **Multi-loja** (diferente de [[tradicao|Tradição]] que é loja única)
- Quando busca dados, o filtro `codLoja` precisa sempre ser respeitado
- Interface tem seletor de loja no canto superior esquerdo
- **PLU de balança = 6 dígitos** (ver seção EAN abaixo)
- ⚠️ **Rede do cliente é instável** — Mikrotik/internet cai com frequência. Quando der ORA-12170 em SuperVital, **default é assumir queda na ponta deles** (não investigar nosso lado primeiro). Monitor automático não vale a pena por causa do ruído. DDNS está configurado (`smvital.o3utm.com.br` → Route 53 TTL 1s) mas só protege contra troca de IP, não contra link/Mikrotik offline.

## 🔢 EAN de balança — usa **6 dígitos** de PLU
Formato do EAN-13 que a balança gera:
```
2 + PLU(6) + valor(5) + DV(1) = 13 dígitos
```
Cada cliente é configurado diferente: Tradição usa 5, SuperVital e Nunes usam 6.

## 🐛 Bugs já resolvidos neste cliente
- [[../bugs-resolvidos/2026-04-15-tiposSaida-gestao|NF Transferência contaminando valor na Gestão Inteligente]]
- [[../bugs-resolvidos/2026-04-15-dif-anual-itens|Dif Anual em branco nos itens da Compra x Venda]]
- [[../bugs-resolvidos/2026-06-17-supervital-backend-unhealthy-autoheal|Backend trava (unhealthy) → "Verificando configuração" infinito + autoheal]]

## 🛡️ Auto-recuperação / blindagem do backend

### ✅ ESTADO ATUAL (25/06/2026) — `init: true` + teto de CPU/RAM no compose
O `docker-compose.yml` do backend agora tem (persistido, sobrevive a recreate):
```yaml
  backend:
    init: true        # tini como PID 1 → colhe zumbis (acabou o acúmulo de 1311 zumbis)
    cpus: 1.0         # teto: nunca passa de 1 núcleo (não melta a VPS)
    mem_limit: 1500m  # teto de RAM
```
- **Por quê:** em 25/06 o backend ficou 25h `unhealthy` e tinha gerado **1311 zumbis** na VPS inteira (Node PID 1 sem init não colhe filhos). `docker restart` falhou ("PID is zombie"), só `force-recreate` reergueu. `init: true` mata a raiz disso de vez (mesmo padrão da nota do Tradição). O teto de CPU é o seguro contra o meltdown (ver [[../bugs-resolvidos/2026-06-23-vps46-cpu-throttle-meltdown-prevencao|meltdown 23/06]]).
- ⚠️ O `docker update --cpus` que usávamos **NÃO persistia** (some no recreate). Por isso foi pro compose.
- **autoheal SUMIU** da VPS (desinstalado no episódio de CPU, não voltou). Não é mais a estratégia — `init: true` previne em vez de remediar e tem custo zero de CPU. Label `autoheal=true` segue no compose mas é inócuo sem o container.

### ✅ Resiliência Oracle JÁ estava deployada (descoberto 25/06)
O `dist/` do backend em execução **já tinha** `poolPingInterval:60`, `callTimeout` (30000 e 300000) e `expireTime:30` (TCP keepalive). Ou seja: o travamento de 25h aconteceu **apesar** do callTimeout — prova de que a raiz era o **event loop morto + zumbis**, não query em voo. Por isso o **`init: true` é a cura real** (não precisou rebuild de backend). `callTimeout` só não cobre quando o processo inteiro morre.
- ⚠️ Linha 259 do `oracle.service.ts` tem `callTimeout = 300000` (5 min — longo p/ relatórios grandes maxRows 50000). Linha 306 = 30000 (30s). Não mexido (mudar arrisca quebrar relatório legítimo).

### ✅ SetupCheck timeout DEPLOYADO (25/06, commit `283c06b`)
`SetupCheck.jsx` agora tem `api.get('/api/setup/status', { timeout: 8000 })`. Se o backend pendurar, site cai no login em 8s em vez de spinner eterno. Build cacheado + `nice` no SuperVital (frontend), bundle verificado. ⏳ Falta deployar nos outros clientes (push já está na TESTE).

### ⚠️ Frontend reporta `unhealthy` à toa
O healthcheck do frontend usa flags do `wget` GNU mas o probe roda `wget` do BusyBox → **sempre** mostra `unhealthy` mesmo servindo 200. Ignorar — verificar pelo bundle/HTTP, não pelo health. O monitor `/root/monitor-saude.sh` filtra `-frontend` por isso.

Histórico do autoheal: [[../bugs-resolvidos/2026-06-17-supervital-backend-unhealthy-autoheal|nota do incidente 17/06]].

## 🚀 Deploy

Ver procedimento padrão em [[../arquitetura/deploy|Deploy Multi-Tenant]].

Comando rápido (frontend + backend):
```bash
powershell -Command "& { ssh vps2-hostinger 'cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/supervital && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f 2>&1' | Out-String }"
```

## 🏷️ Tags
#cliente #oracle #multi-loja #vps46
