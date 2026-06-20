# 🚧 Trabalho em Andamento

## Tarefa atual — Agente Compliance (4º agente de IA)
Agente de norma interna/feedback que vai responder num grupo de WhatsApp por gatilho ("Helen, isso é permitido?").
- ✅ Aba 🛡️ Agente Compliance criada (AITab) + `AgenteComplianceConfig.jsx` com sub-abas Atendimento/Persona/Base de Conhecimento.
- ✅ Config em `configurations` (grupo via /whatsapp/fetch-groups + gatilho + persona/tom/modelo).
- ✅ Vault próprio `rh_compliance_memoria` (migration 1785600000000) + endpoints `/rh/compliance/memoria` (CRUD + upload-doc que guarda texto integral do PDF). Categorias: sindicato/acordo_coletivo/regimento_interno/aprendizado_feedback/outro.
- ✅ `RhEscalaMemoria.jsx` generalizado via props (apiBase/tipos/tiposUpload/titulo) — reusado pro compliance sem quebrar a Escala.
- ✅ Local: backend healthy (migration aplicada, tabela criada), front compila. UNCOMMITADO.
- ⏳ FALTA: (1) cérebro/chat (RAG no vault + dados vivos do banco); (2) escuta real no WhatsApp (webhook entrada Evolution + trava de números autorizados).
- Detalhes: `bugs-resolvidos/2026-06-feature-agente-compliance.md`.

---


## Tarefa atual — Sync de status Vaga ↔ Banco de Currículos (carimbo no fechamento)
Candidato triado dentro da vaga não refletia no Banco de Currículos (status local-por-vaga vs global desacoplados). Decisão: **carimbar `curriculos.status` SÓ no fechamento/exclusão da vaga** (não em tempo real → evita ambiguidade de candidato em N processos e o bug de status vazando entre vagas). Detalhes/regra completa em `bugs-resolvidos/2026-06-feature-sync-status-vaga-banco-curriculos.md`.

- Backend `rh.controller.ts`: helpers `carimbarStatusGlobalVaga` + `reverterContratadoGlobalVaga`, ligados em `setCandidatoStatusVaga`, `atualizarVaga`, `deletarVaga`. Carimba só `curriculos.status` (NUNCA JSONB de outra vaga). Trava: só rebaixa p/ `recusado` se não estiver ativo em outra vaga aberta. Valor é `recusado` (não `reprovado` — alias antigo).
- ✅ Typecheck OK; backend recarregado e de pé (3010), front (3004). SEM migration.
- ⏳ Aguardando teste do usuário no Tradição local.

## Batch UNCOMMITADO acumulado (commitar junto quando aprovar)
1. Sidebar colapsável (hambúrguer |||) — `Sidebar.jsx`
2. `data_nascimento` obrigatória front+back — `CurriculoPublico.jsx` + `curriculos.controller.ts`
3. Termo LGPD atualizado (geolocalização, nascimento obrigatório, dados sensíveis na admissão, data 18/06/2026) — `CurriculoPublico.jsx`
4. Fonte do badge de setor em Férias maior — `RhFerias.jsx`
5. **Sync status vaga↔banco** (este) — `rh.controller.ts`

## Status deploy
- ✅ Commits `a695f3f` + `ad4929b` na KONTRATAAI.
- ✅ **DEPLOY feito em TODOS os 8 clientes** (tradicao, guibox, cidade, damata,
  fratelli, mameva, novacentral, puma) — build --no-cache + up --force-recreate,
  backend healthy, postgres/minio intactos, SEM migration. Um de cada vez (não estourou CPU, load 2.66).
- ⚠️ Uptime mostrou valores enganosos (salto NTP da VPS Jun19→Jun20). Deploy VERIFICADO
  pelo bundle servido (`curl localhost:<porta>/assets/index-*.js | grep triar` = 1).
  Ver `bugs-resolvidos/2026-06-20-deploy-uptime-enganoso-force-recreate.md`.

## Próximo passo
Nada pendente. Tudo no ar e verificado. Aguardando feedback de produção.

## Pendência separada
Reativar (escalonado) os 8 crons radar pausados no meltdown de CPU.
