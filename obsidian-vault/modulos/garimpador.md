# Garimpador

Ferramentas de inteligência competitiva — pesquisa de preços, ranking de concorrentes, projeções.

## 📂 Arquivos
- `GarimpaFornecedores.jsx` — garimpa condições com fornecedores
- `GarimpadorEcommerce.jsx` — pesquisa e-commerce
- `GarimpadorForaMix.jsx` — produtos fora do mix
- `GarimpadorProdutosPesquisar.jsx` — busca de produtos
- `GarimpadorProjecao.jsx` — projeção de vendas/compras
- `GarimpadorRanking.jsx` — ranking
- `GarimpadorRankingConcorrentes.jsx` — ranking entre concorrentes
- `CompetitividadeConcorrencia.jsx`
- `CotacaoPublica.jsx` — cotação pública

## 🔑 Chave OpenAI (IA do garimpador)
- A chave fica no **banco** (`configurations.openai_api_key`, **criptografada**), NÃO no `.env`. Editável no painel **Configurações → ChatGPT/OpenAI** (aba Oferta no Radar / Radar IA).
- **Usada por TODOS os módulos de IA** (garimpador embeddings + leitura de imagem `gpt-4o-mini` + ai-consultant). Chave morta = garimpador inteiro para.
- Modelo configurável: `openai_garimpador_model` (default `gpt-4o-mini`).
- Código: `garimpador-vectorstore.service.ts` (embeddings via `https://api.openai.com/v1/embeddings`), `garimpador-processador.service.ts`, `ai-consultant.service.ts`. Pega a chave com `ConfigurationService.get('openai_api_key')`.

## 🐛 Troubleshooting — "garimpador parou de funcionar"
1. **`Incorrect API key provided` (erro no painel)** → chave **inválida/revogada**, NÃO é billing. Mesmo com saldo OpenAI, a chave precisa ser válida. Fix: gerar nova em https://platform.openai.com/api-keys (mesma conta do saldo) e colar no painel. Volta na hora, sem deploy. **(Caso real: Tradição prevenção, 25/06/2026 — chave terminando em ...YUMA revogada.)**
2. `429 insufficient_quota` → aí sim é saldo zerado (auto-recharge off). Adicionar crédito.
3. Backend `healthy` + sem erro de quota nos logs + erro no painel = é a chave (caso 1).
4. **"Parou de RECEBER mensagens numa data específica" (não é IA, é entrada)** → o **webhook da Evolution foi sobrescrito**. A Evolution só permite **1 webhook por instância**; se configurarem o **Agente de WhatsApp** (`/api/whatsapp-agente/webhook`) na MESMA instância, ele rouba o webhook do garimpador (`/api/garimpador/webhook`). **(Caso real Tradição 25/06: webhook trocado em 01/06 pro agente → garimpador mudo 24 dias, msgs paradas em 01/06.)**
   - **Diagnóstico:** `GET {evolution_url}/webhook/find/{instance}` (apikey = `evolution_api_token` **descriptografado** AES-256-CBC com `CONFIG_ENCRYPTION_KEY`). Olhar o campo `url` e o `updatedAt` (= data que parou).
   - **Fix (instantâneo, sem deploy):** `POST {url}/webhook/set/{instance}` com `{"webhook":{"enabled":true,"url":".../api/garimpador/webhook","events":["MESSAGES_UPSERT"]}}`.
   - **Trade-off:** 1 webhook/instância → garimpador OU agente, não os dois. Pra ter ambos = webhook unificado (dispatcher no backend) = código+deploy.
   - **Testar pipeline sem WhatsApp:** `POST .../api/garimpador/webhook` com payload `{"event":"messages.upsert","data":{"key":{"remoteJid":"NUM@s.whatsapp.net","fromMe":false,"id":"X"},"pushName":"T","messageTimestamp":N,"messageType":"conversation","message":{"conversation":"..."}}}` → salva em `garimpador_mensagens`. handler NÃO filtra por grupo, ignora `fromMe`.

## 🏷️ Tags
#modulo #oferta #garimpador #competitividade #openai
