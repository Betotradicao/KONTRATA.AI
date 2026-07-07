---
tags: [bug-resolvido, frontend, publico, seguranca, i18n, multi-cliente]
data: 2026-07-07
modulo: Frontend / Páginas públicas (vagas)
---

# Tradutor do navegador corrompeu texto crítico da página pública (candidatar → machucar)

## Sintoma
Na página pública de vagas da **Puma Zeladoria** (empresa de **segurança**), um candidato
viu o botão **"Quero me candidatar"** aparecer como **"Quero me machucar"**. Gravíssimo
pelo contexto (serviço de risco).

## Causa-raiz
O `packages/frontend/index.html` declarava **`<html lang="en">`** com conteúdo em **português**.
Isso engana o navegador: ele detecta divergência idioma-declarado × conteúdo e
**aciona o Google Tradutor / extensões de tradução no aparelho do candidato**, que reescrevem
os textos — às vezes com aberrações (`candidatar` → `machucar`).

⚠️ O texto no NOSSO código sempre foi "Quero me candidatar". Quem alterou foi o
tradutor **no dispositivo do usuário**, não o servidor.

## Correção (no index.html — compartilhado por TODOS os clientes)
```html
<html lang="pt-BR" translate="no">
  <meta name="google" content="notranslate" />
```
- `lang="pt-BR"` — idioma real → navegador não tenta traduzir.
- `translate="no"` no `<html>` — bloqueia tradução da página inteira (herdado por todos os elementos; não precisa marcar botão por botão).
- `<meta name="google" content="notranslate">` — reforço pro Google Tradutor.

Commit `c7ec67b`. Deploy só frontend (`build --no-cache frontend` + `up -d --no-deps frontend`).

## 🎯 Lição reutilizável
Página em PT **tem que** declarar `lang="pt-BR"`. `lang="en"` num site PT = tradutor
automático liga sozinho e pode corromper texto. Pra sites com texto sensível, adicionar
`translate="no"` + `<meta name="google" content="notranslate">`.

## Alcance
- ✅ Deployado em **TODOS os clientes kontrata** (07/07): tradicao, puma, guibox,
  mameva, novacentral, cidade, damata, fratelli. Cada um verificado (HTML servido
  com `lang="pt-BR" translate="no"` + notranslate meta). Sem mudança visual.
- Deploy foi **um cliente por vez** (só frontend: `build --no-cache frontend` + `up -d --no-deps frontend`) — ver [[feedback_deploy_um_cliente_por_vez]].

## Limite honesto
Trava Chrome/Google Tradutor/Edge/Samsung/extensões que respeitam o padrão (quase todas).
Uma extensão maliciosa fora do padrão no aparelho do candidato nenhum site impede 100%.
