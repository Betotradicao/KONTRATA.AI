# Trabalho atual

_Nada em andamento._ Sessão de 21-23/08/2026 concluída e commitada.

## 🚨 PENDÊNCIA CRÍTICA — vazamento de credenciais dos clientes

`https://<cliente>.kontrataai.com.br/api/config/configurations` responde
**HTTP 200 sem autenticação** e devolve 78–200 chaves de configuração COM os
valores, nos 9 clientes.

Expostos em todos: `postgres_password`, `minio_access_key`, `minio_secret_key`,
`email_pass`, `evolution_api_token`, `api_token`.
No Tradição soma-se: `oracle_password`, `intersolid_password`,
`santander_client_secret`, `santander_pfx_password`, `openai_api_key`,
`dvr_senha`, `rhid_senha`.

**Achado em 23/08/2026** enquanto eu procurava de onde puxar o logo dos clientes.
Avisei o usuário 3 vezes; ele não autorizou a correção até agora.

Plano combinado (aguardando OK):
1. Exigir autenticação na rota (é uma linha em `config.routes.ts` + rebuild)
2. Ver logs do nginx pra estimar se alguém acessou
3. Trocar TODAS as credenciais vazadas — enquanto não trocar, quem já copiou
   continua com acesso

## Concluído nesta sessão
- Guia de Exame Ocupacional (.docx) —
  [[bugs-resolvidos/2026-08-21-guia-exame-ocupacional-docx]]
- Site comercial em kontrataai.com.br —
  [[bugs-resolvidos/2026-08-23-site-kontrata-base44]]
- Painel interno em /admin —
  [[bugs-resolvidos/2026-08-23-painel-interno-kontrata]]

## Outras pendências (menores)
1. **Google Analytics sem ID** — `VITE_GA_ID` vazio, nada é medido.
   Falta o usuário passar o `G-XXXXXXXXXX`.
2. **Tabela comparativa do site vazia** — era assim no Base44. Preencher
   `CRITERIOS` em `site/src/sections/SectionComparativo.jsx`.
3. **Integração Asaas** — financeiro é manual até lá. Chave em Integrações.
4. **Mameva sem logo** — o sistema dele está zerado (0 empresas, 0
   colaboradores). Verificar se a instância está em uso.
5. `trust proxy` no backend dos clientes (rate limit conta todos como 1 IP)
6. Geocode do KM Residência (cota da API estourada) — usuário optou por deixar
7. Healthcheck dos frontends kontrata marcando unhealthy (falso positivo)
