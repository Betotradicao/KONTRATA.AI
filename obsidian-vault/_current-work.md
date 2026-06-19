# 🚧 Trabalho em Andamento

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

## Próximo passo
Usuário testa o sync local. Se aprovar → commit do batch + deploy Tradição (`--no-deps --no-cache frontend backend`, validar com docker ps + logs).

## Pendência separada
Reativar (escalonado) os 8 crons radar pausados no meltdown de CPU.
