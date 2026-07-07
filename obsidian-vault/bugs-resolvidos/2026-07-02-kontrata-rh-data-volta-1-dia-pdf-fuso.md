---
tags: [bug-resolvido, kontrata, rh, frontend, fuso-horario]
cliente: tradicao (kontrata)
data: 2026-07-02
---

# Datas voltando 1 dia no PDF/e-mail da Ficha de Admissão (fuso UTC)

## Sintoma
No RH do Kontrata (tradicao.kontrataai), a Ficha de Admissão mostrava as datas
**corretas no formulário** (ex: Nascimento 10/06/1996), mas ao **Imprimir/PDF ou
Enviar por e-mail** todas as datas voltavam **1 dia** (09/06/1996, casamento
14/07→13/07, título 11/12→10/12, etc). Afetava TODOS os campos de data.

## Causa-raiz
`new Date("1996-06-10")` é interpretado como **meia-noite UTC**. Ao formatar com
`toLocaleDateString('pt-BR')` no fuso do Brasil (UTC-3), volta 3h → cai no **dia
anterior às 21h**. A função `fmtDate` de `buildFichaHtml` usava esse padrão, e
como todos os campos de data passam por ela, todos voltavam 1 dia.

## Fix
`packages/frontend/src/pages/rh/FichasAdmissaoSection.jsx` — helper `fmtDateBR`
que extrai `YYYY-MM-DD` direto da string via regex e monta `DD/MM/YYYY`
literalmente, **sem passar pelo Date/fuso**. Fallback pro Date só em formatos
não-ISO. Aplicado em 2 lugares: ficha impressa/PDF/e-mail e card da lista.

```js
function fmtDateBR(d) {
  if (!d) return '____';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
}
```

## Lição (reutilizável)
Para campos **data-only** (nascimento, emissão, etc — sem hora relevante) NUNCA
usar `new Date(str).toLocaleDateString()`. Extrair os componentes da string ISO,
ou construir com `new Date(y, m-1, d)` (construtor local). Vale para qualquer
lugar do sistema que renderize datas vindas do banco como `YYYY-MM-DD`.
