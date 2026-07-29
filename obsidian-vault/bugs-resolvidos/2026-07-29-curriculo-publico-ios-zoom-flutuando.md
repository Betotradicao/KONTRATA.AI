---
tags: [bug-resolvido, frontend, publico, mobile, rh, curriculo]
data: 2026-07-29
modulo: RH / Currículo público (CurriculoPublico.jsx)
---

# Tela do currículo público "flutuava" no celular ao clicar em qualquer campo

## Sintoma
Candidato reportou (com print, acessando via navegador do WhatsApp Business em
`puma.kontrataai.com.br`): a tela de preenchimento do currículo fica **fixa e normal**
até ele tocar em um campo (ex: Nome completo) — aí a tela **expande/dá zoom** e o
layout parece "flutuar", desalinhado, com a barra de navegação do teclado (◄ ► ✓)
aparecendo por baixo.

## Causa-raiz
Todos os inputs/textarea da tela usavam Tailwind `text-sm` (**14px**). O **Safari/WebView
do iOS dá zoom automático** ao focar um campo de formulário sempre que a fonte do
campo é **menor que 16px** — é um comportamento do próprio SO, não bug do nosso CSS.
O "flutuar" é esse zoom automático deslocando o viewport.

## Correção
`CurriculoPublico.jsx` — `useEffect` que injeta (e remove no unmount) um `<style>` global:
```js
useEffect(() => {
  const style = document.createElement('style');
  style.textContent = '@media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }';
  document.head.appendChild(style);
  return () => style.remove();
}, []);
```
Só em mobile (`max-width: 767px`) pra não alterar o visual no desktop. Não precisou
tocar em cada `<Field>`/`<FieldReq>` individualmente.

## 🎯 Lição reutilizável
**Qualquer página pública mobile-first** (currículo, DISC, pré-entrevista, pesquisa de
clima) que use `text-sm` (14px) ou menor em `input`/`select`/`textarea` está sujeita
a esse zoom-e-flutua no iOS. Regra: campo de formulário em página pública para
celular = **fonte ≥ 16px**, sempre. Vale conferir os outros formulários públicos
(`DiscPublico.jsx`, pré-entrevista) se reclamação parecida aparecer.

## Alcance
Commit local `CurriculoPublico.jsx`, branch KONTRATAAI. Deploy: só frontend
(`build --no-cache frontend` + `up -d --no-deps frontend`). ⏳ Deployado só no
**Tradição** por ora — falta propagar pros outros 8 clientes kontrata (ver
[[feedback_deploy_um_cliente_por_vez]]).
