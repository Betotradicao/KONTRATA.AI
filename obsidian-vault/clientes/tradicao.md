# Tradição

Cliente de supermercado **loja única**, hospedado na VPS 46. É o cliente de **referência/desenvolvimento** — funcionalidades novas costumam ser testadas aqui primeiro.

## 📊 Dados Básicos
- **VPS:** `46.202.150.64` (alias SSH: `vps2-hostinger`)
- **Diretório kontrata.ai:** `/root/clientes-kontrata/tradicao` ✅ (este é o ativo, `tradicao.kontrataai.com.br`)
- **Containers kontrata.ai:** `kontrata-tradicao-frontend`, `kontrata-tradicao-backend`, `kontrata-tradicao-postgres`, `kontrata-tradicao-minio`
- **Repo de build kontrata.ai:** `/root/kontrata-repo` (branch `KONTRATAAI`, origin `Betotradicao/kontrata.ai`)
- **Portas:** Frontend 3903, Backend 4903, Postgres 6303, MinIO 9903/10003
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

## 🏷️ Tags
#cliente #oracle #loja-unica #vps46 #rede-local
