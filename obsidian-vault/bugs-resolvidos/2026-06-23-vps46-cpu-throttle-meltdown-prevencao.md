---
data: 2026-06-23
cliente: TODOS (VPS 46)
projeto: infra (kontrata.ai + prevencao-radar coexistindo)
tags: [vps, cpu, throttle, hostinger, docker, ffmpeg, dvr, meltdown, infra, rede-docker]
---

# VPS 46 — Meltdown de CPU (throttle Hostinger) por sobrecarga do prevenção; kontrata caiu junto

## Sintoma
Todos os sites **502 Bad Gateway** (kontrata) / fora do ar. Hostinger: **"Limitação de CPU ativada"** + **"Limite máximo de reinicializações da CPU atingido"**. `uptime` load average **237**, `vmstat` steal **~90%**. SSH/docker mal respondiam (comandos travavam). Gráfico de CPU: 100% sustentado do meio-dia às 3h, depois "10%" (na verdade era o throttle capando em ~10% de uso real).

## Causa-raiz
A VPS46 é **KVM 2 núcleos** rodando ~64 containers (kontrata + prevencao-radar, 2 produtos × 8 clientes × 4). O **prevenção roda DVR com ffmpeg (transcode H265→H264) contínuo + crons** → carga sustentada → estourou a cota → **Hostinger aplicou throttle (steal 90%)**. Com a CPU capada, tudo empilha (load 237) e vira **deadlock**: a VPS está afogada demais pra aceitar os comandos que resolveriam.
- **NÃO era ataque** (`who`=0, 0 mineradores, só SSH do próprio IP). "159 users" no uptime era utmp velho, falso.
- O `init:true` de ontem NÃO causou — só trouxe o backend prevencao-tradicao de volta à atividade. O vilão é o **conjunto prevenção (ffmpeg/DVR + crons)** numa VPS subdimensionada.

## Por que reboot sozinho NÃO resolve
No boot, os ~64 containers (incl. prevenção pesado) **sobem todos juntos** com `restart: unless-stopped` → re-saturam **antes** do sshd estabilizar → não dá tempo de cortar. Rebootar repetido só repete o ciclo.

## Fix que FUNCIONOU (sequência)
1. **Parar o docker inteiro** (libera CPU instantânea; `systemctl` lands mais fácil que comando docker). Loop insistindo até `systemctl is-active docker` = inactive. Também `pkill -9 ffmpeg`.
2. **Desativar o prevenção na RAIZ (no disco)** — com docker parado, editar a RestartPolicy nos config dos containers do prevenção pra `no`, assim ele **nunca mais sobe sozinho** (nem em reboot):
   ```bash
   cd /var/lib/docker/containers
   for f in */config.v2.json; do
     grep -q '"Name":"/prevencao' "$f" && sed -i 's/"Name":"unless-stopped"/"Name":"no"/g; s/"Name":"always"/"Name":"no"/g' "$f"
   done
   ```
3. **Subir o docker** → só o kontrata restaura (prevenção fica fora). `systemctl reset-failed docker` se ficar em estado failed.
4. ⚠️ **`docker start` NÃO basta** — depois do restart bruto do daemon, as **redes Docker são recriadas** e os containers reaparecem SEM conseguir resolver DNS dos vizinhos (`getaddrinfo EAI_AGAIN kontrata-<cli>-postgres` → "Driver not Connected" → UI carrega mas backend cai). **Tem que `docker compose up -d` por cliente** (reconcilia a rede). Fazer **escalonado, 1 cliente por vez** (~20s entre), pra não re-surtar a CPU.

## Lições reutilizáveis
1. **VPS46 está SUBDIMENSIONADA pra 2 produtos.** Decisão pendente: manter prevenção desligado (migrar de vez pro kontrata) OU upgrade de plano (mais núcleos). Rodar os dois juntos = risco de meltdown recorrente.
2. **⚠️ CORRIGIDO — o throttle NÃO sai rápido sozinho quando os créditos de burst acabam.** A mensagem **"Limite máximo de reinicializações da CPU atingido / Todas as reinicializações de CPU disponíveis já foram usadas"** = o **crédito de burst da Hostinger ESGOTOU**. A partir daí a VPS fica **grudada no teto baixo (~10% de CPU = steal 90%)** e os containers passam fome (kontrata fica lerdo/caindo mesmo com uso interno baixo). O gráfico "Uso da CPU" mostrando **10% reto** NÃO é "tá tudo bem" — é o **teto imposto**. Confirmar sempre via SSH: `vmstat` com **steal ~90% + run queue alto + us/sy ~10%** = está CAPADO (não é uso real baixo). Ficou ~9h+ grudado sem levantar (23/06).
3. **Reboot NÃO resolve o throttle de crédito esgotado** — reboot não devolve crédito de CPU (é contabilizado do lado da Hostinger); o box volta e gruda nos 10% de novo, e o boot-storm de 32 containers sob teto de 10% só piora. Saídas reais: **upgrade do plano** (devolve cota na hora — recomendado) OU esperar o ciclo de crédito resetar (horas a ~1 dia, incerto).
4. **Flapper de frontend prevenção = churn que segura o throttle.** `prevencao-novacentral-frontend` com **187 restarts** em loop: nginx morria com **`host not found in upstream "backend"`** (o backend dele estava `exited`, então nginx [emerg] e reinicia infinito). Cada restart cospe `runc`/`init` → fila de processos cheia → steal alto. **Fix:** `docker update --restart=no <c> && docker stop <c>`. Parar o flapper derrubou run queue 42→0 e steal 90→24 na hora (mas o teto da Hostinger voltou a clampar depois — crédito esgotado).
5. **Em deadlock de CPU**, `systemctl stop docker` é o lever mais confiável (mais leve que comandos docker). Depois edita restart-policy no disco pra controlar o que volta.
6. **Após restart bruto do docker, use `docker compose up -d` (não `docker start`)** pra reconectar a rede, senão dá `EAI_AGAIN` no DNS dos containers.
7. **ffmpeg/DVR contínuo é o maior queimador de CPU** do prevenção. Confirmado pelo Kodee ("media/video job").
8. **Reconciliação "sempre rodou junto" vs "o conserto derrubou":** ambos certos. O backend prevencao-tradicao estava DEGRADADO (zumbis, `unhealthy` 4 dias) = gastava POUCA CPU. O `init:true` de 22/06 CUROU o backend → ele retomou ffmpeg/DVR a 100% → numa VPS de 2 núcleos no limite → estourou o burst → throttle. Não foi carga nova, foi a carga real **destravada**.

## Estado final
prevenção: **restart=no** (desligado de vez). kontrata: religado via `docker compose up -d` por cliente. Load voltou de 237 → ~9.

## Relacionados
- [[../arquitetura/estrutura-vps|Estrutura VPS 46]]
- [[2026-06-22-tradicao-backend-zombie-pid-init|init:true prevencao-tradicao]]
- [[../arquitetura/kontrata-vs-radar|kontrata vs radar na VPS46]]
