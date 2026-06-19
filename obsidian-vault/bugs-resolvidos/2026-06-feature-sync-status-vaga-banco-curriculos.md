---
tags: [rh, vagas, banco-curriculos, status, arquitetura]
data: 2026-06-19
---

# Sincronia de status: Vaga ↔ Banco de Currículos (carimbo no fechamento)

## Contexto / problema
Existem **DOIS status** de candidato, de propósito:

| Onde | O quê | Onde fica salvo |
|---|---|---|
| **Dentro da Vaga** | status **LOCAL** daquela vaga (Novo/Selecionado/Recusado/Contratado) | JSONB da vaga: `selecionados` / `recusados` / `vagas_futuras` |
| **Banco de Currículos** | status **GLOBAL** do candidato | coluna `curriculos.status` |

Eram **100% desacoplados** → triar dentro da vaga não refletia no Banco. O usuário queria sincronizar, MAS:
> Um candidato pode estar em **várias vagas com status diferentes** (Recusado na A, Selecionado na B). O Banco só tem **um** status → sincronizar em tempo real é ambíguo.

⚠️ Já tivemos o bug (`tinhaContratadoAntes`) de **status vazando entre processos diferentes** — mexer numa vaga NÃO pode mexer no status local de outra vaga.

## Decisão (WHY) — fluxo MANUAL
Workflow do usuário: muda a vaga pro status **Contratado(a)** e depois vai
**candidato por candidato** migrando cada um pra posição desejada. Cada triagem
manual numa vaga **finalizada** reflete no Banco.

Regra final (escreve **só** em `curriculos.status`, NUNCA no JSONB de outra vaga):
- Vaga **ABERTA** (Aberta/Em Selecao) → status 100% **LOCAL** por vaga (não toca no Banco).
- Vaga **FINALIZADA** (Contratado(a)/Fechada) → **cada triagem manual** do candidato
  carimba o global (`setCandidatoStatusVaga` → `carimbarCandidatoGlobal`). Mapa
  posição→global: `contratado→contratado | selecionado→aprovado | recusado→recusado
  | em_analise→em_analise | novo→novo`. (Ex.: Alexandre fica "Selecionado" no Banco
  e só muda se você mudar a posição dele na vaga.)
- **Finalizar pela modal** (`atualizarVaga`) → carimba **SÓ** quem já está
  `contratado=true` (`incluirRecusados:false`). Os demais **não** são tocados —
  o RH tria cada um na mão depois. ("lá não era pra ter mudado nada" no fechamento.)
- **Excluir** vaga (`deletarVaga`) → carimba completo (contratado + recusado), tratamento "A".
- **Reabrir** vaga finalizada → reverte o contratado dela p/ `'novo'` (exceto se contratado em outra vaga).
- **Trava global:** nunca rebaixa quem está `contratado=true` em **outra** vaga (só contratado vence).

## Detalhe crítico de valor
Banco de Currículos usa **`recusado`** (não `reprovado` — esse é só **alias antigo**, `STATUS_LABEL.reprovado = STATUS_LABEL.recusado`). Valores globais: `novo | em_analise | aprovado(Selecionado) | recusado | contratado`. Carimbar com `recusado`, não `reprovado`.

## Implementação
`packages/backend/src/controllers/rh.controller.ts`:
- `RhController.carimbarStatusGlobalVaga(vaga)` — helper do carimbo (com trava "ativo em outra vaga aberta" via `jsonb_array_elements`).
- `RhController.reverterContratadoGlobalVaga(selecionadosAntes, vagaId)` — reverte na reabertura.
- Chamado em: `setCandidatoStatusVaga` (contrata→carimba / des-contrata→reverte), `atualizarVaga` (finaliza→carimba / reabre→reverte), `deletarVaga` (carimba ANTES do DELETE pra trava enxergar a vaga via `id <> $1`).

## Lição reutilizável
Quando há status **local-por-item** + status **global único**, NÃO sincronize em tempo real (ambíguo p/ item em N processos). Sincronize no **evento terminal** (fechar/excluir), e proteja o global contra rebaixar quem ainda está ativo em outro processo aberto.
