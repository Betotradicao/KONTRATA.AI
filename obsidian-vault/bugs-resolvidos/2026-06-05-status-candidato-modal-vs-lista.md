# 2026-06-05 — Status do candidato divergente: modal (global) vs lista (local)

## Sintoma
Dentro da vaga, lista mostrava "Novo" / "Interessado" pros candidatos, mas ao abrir o currículo o modal mostrava o status correto (Vagas Futuras, Recusado etc). User: *"dentro do currículo fica triado certo, porém ai fora muda"*. Pior: *"no outro dia volta a ficar tudo como interessados"*.

## Causa-raiz — DUAS coisas somadas
1. **Modal usava `cv.status` global do currículo**, lista usava o status LOCAL calculado dos 3 arrays JSONB da vaga (`selecionados`, `recusados`, `vagas_futuras`). Fonte dupla = divergência.
2. **Migração pra "status 100% LOCAL por vaga" (commit `27be7f6`) não migrou os dados antigos**. Triagens feitas ANTES dela ficaram só no `c.status` global e os arrays locais nasceram vazios. Por isso a lista (que lê dos arrays locais) mostrava tudo como "novo" — mesmo com o user tendo triado a semana inteira.

## Correção

### Código (commit em KONTRATAAI)
- [RhVagas.jsx](../../packages/frontend/src/pages/RhVagas.jsx): adicionada `calcStatusLocalNaVaga(vagaId, curriculoId)` que reproduz a mesma lógica do backend `listarVagas`. Chamada ao abrir o modal — injeta `_statusLocalNaVaga` no objeto `cv`.
- [BancoCurriculos.jsx](../../packages/frontend/src/pages/rh/BancoCurriculos.jsx) (componente `DetalheCV`): usa `statusEfetivo = cv._statusLocalNaVaga ?? cv.status`. Badge do header + botões do rodapé usam essa variável. Quando aberto pelo Banco (sem vaga), continua usando `cv.status` global como antes.

### Dados (script SQL idempotente)
- [migrar-triagens-vaga.sql](../../packages/backend/scripts/migrar-triagens-vaga.sql) — pra cada interessado da vaga `:vaga_id`, copia status global pro array local correspondente, ignorando quem já está em algum array (`NOT EXISTS`). Roda com `psql -v vaga_id=N -f`.

Aplicado em Tradição vaga 13 (CONFERENTE): 27 candidatos sincronizados.

## Lição reutilizável
**Sempre que mudar de "fonte global" pra "fonte local por contexto", planejar a migração one-shot dos dados antigos no MESMO PR.** Senão o sintoma é "tudo zerado / volta a ficar interessado no outro dia" — confunde porque o código tá certo, os dados é que não foram migrados.

Vagas fechadas da Tradição (10 BALCONISTA, 11 MENOR APRENDIZ) ainda têm 29 + 6 pendentes — sem urgência, pode rodar se quiser histórico completo.

## Tags
#bug-resolvido #recrutamento #rh #migracao-dados #fonte-unica-verdade
