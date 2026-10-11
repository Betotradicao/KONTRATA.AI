# Tradição

Cliente de supermercado **loja única**, hospedado na VPS 46. É o cliente de **referência/desenvolvimento** — funcionalidades novas costumam ser testadas aqui primeiro.

## 📊 Dados Básicos
- **VPS:** `46.202.150.64` (alias SSH: `vps2-hostinger`)
- **Diretório kontrata.ai:** `/root/clientes-kontrata/tradicao` ✅ (este é o ativo, `tradicao.kontrataai.com.br`)
- **Containers kontrata.ai:** `kontrata-tradicao-frontend`, `kontrata-tradicao-backend`, `kontrata-tradicao-postgres`, `kontrata-tradicao-minio`
- **Repo de build kontrata.ai:** `/root/kontrata-repo` (branch `KONTRATAAI`, origin `Betotradicao/kontrata.ai`)
- **Portas (REAIS na VPS, conferidas 22/06/2026):** Frontend **7903**, Backend **8903**, Postgres **7303**, MinIO **9303/9603**
- **Link:** https://tradicao.kontrataai.com.br · acesso direto/rede: `http://46.202.150.64:7903`
- ⚠️ **NÃO CONFUNDIR** com o cliente Tradição do projeto antigo prevencao-radar (`/root/clientes/tradicao` + `prevencao-tradicao-*` + repo `/root/prevencao-radar-repo` branch TESTE — origin `Betotradicao/TESTES-`). Esses são outro produto.

## 🔌 ERP
- Usa [[../arquitetura/oracle-intersolid|Oracle Intersolid]]
- Schema: `INTERSOLID`

## ⭐ Particularidades
- **Loja única** (diferente de [[supervital|SuperVital]] que é multi-loja)
- É a "rede local" do usuário — mais fácil de testar na hora
- Primeiro cliente a receber novos deploys geralmente
- **PLU de balança = 5 dígitos** (ver seção EAN abaixo)

## 🔢 EAN de balança — usa **5 dígitos** de PLU
Formato do EAN-13 que a balança gera:
```
2 + PLU(5) + valor(6) + DV(1) = 13 dígitos
```
Cada cliente é configurado diferente: Tradição usa 5, SuperVital e Nunes usam 6.

## 🚀 Deploy (kontrata.ai)
```bash
powershell -Command "& { ssh vps2-hostinger 'cd /root/kontrata-repo && git pull origin KONTRATAAI && cd /root/clientes-kontrata/tradicao && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f 2>&1' | Out-String }"
```
Verificar: `docker ps --filter name=kontrata-tradicao` — esperar `healthy` no backend.

## ⚠️ "Verificando configuração do sistema..." trava (recorrente)
Backend `prevencao-tradicao-backend` vira-mexe fica **Up X days (unhealthy)** e o site fica em spinner eterno. Causa: **Node como PID 1 sem `init` acumula processos zumbis** (ffmpeg/IMAP) ao longo de dias até travar — `docker restart` chega a falhar com "PID is zombie".
- **Reerguer:** `cd /root/clientes/tradicao && docker compose up -d --no-deps --force-recreate backend`
- **Fix definitivo:** `init: true` no compose + timeout no SetupCheck do front. Ver [[../bugs-resolvidos/2026-06-22-tradicao-backend-zombie-pid-init|nota completa]].
- ⚠️ **Autoheal NÃO** — foi desinstalado por estourar a CPU da VPS.

## 🏷️ Tags
#cliente #oracle #loja-unica #vps46 #rede-local

## WhatsApp / Evolution (evolution.kontrataai.com.br, VPS 46)

Instâncias que existem nesse servidor e quem usa cada uma (levantado em 09/09/2026):

| Instância | Número | Usada por |
|---|---|---|
| `KONTRATAAI` | 5512996896418 | Tradição (`evolution_instance`, notificações/disparos) **e** o painel interno kontrataai.com.br |
| `TRADICAO`, `RADAR360`, `NUNES`, `GARIMPAFACIL` | 5512988474416 | 4 aparelhos vinculados do mesmo número (legado Radar) |
| `MARKETING` | 5512988996258 | chatbot de marketing |

⚠️ **`atendente_evolution_instance = TESTE`** — essa instância **não existe mais** no servidor
(foi criada em 08/2026 pra testar e apagada). O Atendente Virtual está `ativo = true` apontando
pro nada. Precisa de instância própria (nunca a dos disparos — ver
[[2026-08-25-atendente-virtual-whatsapp]]).

### 🪤 Diagnóstico de "instância não conectada (estado: close)"
- `GET /instance/connectionState/<nome>` com a chave da instância → `close`.
- `GET /instance/connect/<nome>` devolvendo um `code` de QR = **sessão perdida, precisa
  escanear de novo no celular do número**. Reiniciar a instância NÃO resolve nesse caso.
- Log típico da queda: `Error: Connection Closed` + `statusCode 428` em `ChannelStartupService`.
- Chave global da Evolution: `docker exec evolution-api printenv AUTHENTICATION_API_KEY`
  — só com ela o `fetchInstances` lista TODAS; com a chave da instância só aparece ela mesma.
- Conferir SEMPRE se o token salvo no cliente ainda vale: em 09/09 o `evolution_api_token`
  da Tradição dava **401** (token antigo `5c941c8d…`); o da instância é `C508ABA4…`.
  A tela mostrava o certo porque tinha sido digitado e não salvo.
