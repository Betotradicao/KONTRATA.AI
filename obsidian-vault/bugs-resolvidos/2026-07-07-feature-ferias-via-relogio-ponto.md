---
tags: [feature, rh, ferias, rhid, ponto, tradicao]
data: 2026-07-07
modulo: RH / Férias
---

# Férias: modo "Via Relógio de Ponto" (detecta gozo pela apuração RHiD)

A tela **Controle de Férias** (`RhFerias.jsx`) passou a ter **2 modos**:
- **✋ Manual** — o que já existia (RH registra gozo na mão).
- **🕐 Via Relógio de Ponto** — varre a apuração RHiD e **sugere** os períodos de férias que achou.

## Como funciona a detecção
- Endpoint `GET /rh/ferias/deteccao-ponto?colaborador_id=&refresh=1` (em [[rh-ponto-controller]], método `deteccaoFeriasPonto`).
- Varre a apuração de cada colaborador **da admissão até hoje** (blocos de **2 meses** = limite da API RHiD, `_mapPool` concorrência 6).
- `_classificaDia` já marca `status='ferias'` (justificativa "férias" na batida). Coleta os `ymd` de férias e **agrupa os consecutivos** (tolera gap ≤4 dias = fim de semana/feriado) em períodos `{inicio, fim, dias, dias_marcados}`.
- **Cache 6h** por colaborador (`_detFeriasCache`) — o scan é caro (funcionário de 6 anos = ~36 chamadas). Meses passados nunca mudam.
- **Só exibe (sugestão)** — nada grava sozinho. Botão **Confirmar** → `POST /rh/ferias` cria registro `status='gozada'` (o cálculo aquisitivo/concessivo continua vindo da admissão, igual ao Manual).

## Comparação relógio × sistema (embutida)
O mesmo endpoint traz os gozos **manuais** (`rh_ferias status='gozada'`) e marca cada período:
- **✓ bate** (ponto = sistema, sobreposição de datas)
- **🕐 só no ponto** (RH esqueceu de lançar) → botão Confirmar
- **⚠️ só no sistema** (`manual_sem_ponto`) → lançado manual mas o ponto não achou (investigar)

## Limites (honestos)
- Depende do RH ter **marcado as férias no relógio** (senão não detecta).
- Só acha gozo **dentro da janela varrida** (desde a admissão) **e** que exista na RHiD (se começaram a usar RHiD há 1 ano, férias mais antigas não estão lá).
- Matching colaborador↔RHiD por **CPF OU PIS** (ver [[2026-07-07-tradicao-espelho-match-so-pis]]).

## O que o ponto dá × não dá
| Ponto dá | Não dá (continua da admissão) |
|---|---|
| Quando o gozo aconteceu (datas) | Período aquisitivo (12m da admissão) |
| Quantos dias | Concessivo / limite sem dobro |

## Também nesta sessão (07/07)
- Cards KPI do topo do Férias: trocados de gradiente forte pro estilo **"cor só na ponta"** (branco + ícone tonalizado + faixa lateral), igual aos cards do Cadastro Geral.
- Commit `cfe1db9`, deployado no Tradição.

## Não-bug confirmado (mesma sessão)
No ranking de Ponto e Ausências, o total "Falt" **soma todos os meses fechados** (Jan–Jun). Parecia divergir (Juliano: 3 visíveis × 5 no total) mas era **cache de bundle** — após refresh, Janeiro apareceu com as 2 faltas (Jan 2 + Fev 2 + Mar 1 = 5). `_classificaDia` tira `ymd` e `mes` do MESMO campo `dateTimeStr`, então grade mensal e total sempre batem.
