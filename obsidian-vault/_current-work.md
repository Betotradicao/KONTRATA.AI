# 🚧 Trabalho em Andamento

## Sessão 2026-05-28 — CONCLUÍDA ✅

### Ficha de Admissão (fluxo completo validado em prod)
- Bug crítico do `criarColaborador` corrigido (commit `b302fab`) — agora copia escala, regime, departamento, escolaridade da ficha. Validado com Roberto (colab id=100 no Tradição).
- Conta Salário não some mais após cadastrar colaborador (commit `5668f48`).

### Doc Advertência (DOCS ADVERTÊNCIA, fase 4)
- Seed do doc padronizado "Advertência" (commit `fc00866`)
- Painel CRUD inline dos Motivos abaixo do editor (commit `43ed4f2` + ajustes `25cc5ba`/`51f1fad`/`754215c`)
- Doc imprime em 1 folha A4 (commit `2e5d7d7`) — layout compacto detectado pelo título (`/advert/i`), só afeta Advertência. Filtro de parágrafos vazios em `buildConteudoHtml` beneficia todos.

### Pesquisa de Clima — bug encontrado e corrigido
- `rating_5_matriz` (matriz de critérios) deixava enviar com critérios em branco — objeto com 1 chave passava como "respondido". Fix em [PesquisaPublica.jsx:39](packages/frontend/src/pages/PesquisaPublica.jsx#L39) valida que todos os `cfg.criterios` têm valor. Commit `c29430f`.

### Deploy
- Advertência subiu em: **Tradição, Guibox, NovaCentral, Fratelli** (todos com migration rodada + seed confirmado no DB)
- Re-deploy Tradição rodando em background pra pegar fix da pesquisa (`c29430f`)
- **Nunes não tem Kontrata.ai** (só Prevenção no Radar) — fora do escopo

### Estado do git
- Branch `KONTRATAAI` em sync com remote
- Último commit: `c29430f` (fix pesquisa matriz)
