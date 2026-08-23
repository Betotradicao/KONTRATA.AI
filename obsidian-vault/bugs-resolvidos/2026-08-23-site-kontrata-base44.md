# Site comercial do Kontrata — trazendo do Base44 pra VPS

**Data:** 2026-08-23
**Origem:** https://kontrataai.base44.app
**Material extraído:** `packages/site/referencia-base44/`

## Por que este levantamento vale ouro
O app do Base44 é um SPA: a página serve 4,7 KB de casca e o resto é bundle JS.
**Não dá pra ver nada pelo HTML.** Todo o conteúdo abaixo foi extraído
desminificando os chunks — custou tempo. Se precisar de novo, está tudo salvo em
`packages/site/referencia-base44/` (seções, CSS original, bundle e imagens).

## ⚠️ O que o app do Base44 REALMENTE é
**Só landing page.** O usuário descreveu como se tivesse gestão de clientes,
pagamentos e boletos — **não tem**. Busca no bundle:

| Termo | Ocorrências |
|---|---|
| Pagamento / Boleto / Assinatura / Fatura / Cobrança / Mensalidade | **0** |
| entidades de dados | só `entities/User` (login do próprio Base44) |

O painel de gestão é ideia, não algo pronto pra copiar.

## Estrutura da landing page
Seções (chunks lazy-loaded, todos salvos em `referencia-base44/secoes/`):
`SectionDor` · `SectionOrigem` · `SectionSolucao` · `SectionComoFunciona` ·
`SectionComparativo` · `Pricing` · `FAQ` · `CTABlock` · `Footer`

Mais a rota **`/treinamento`** — área de clientes protegida por senha, com
vídeos do YouTube: visão geral, criar/publicar vagas, filtragem de candidatos,
documentos dos colaboradores.

## Sistema de design (valores exatos, lidos do CSS)
```
--font-display: "Plus Jakarta Sans"   (títulos)
--font-body:    "Inter"               (texto)
--hero-bg:      271 82% 28%           (roxo escuro do hero)
--accent:       45 97% 56%            (amarelo de destaque)
text-text-dark: rgb(31 27 46)
text-text-gray: rgb(107 114 128)
bg-purple-800:  rgb(91 33 182)
bg-purple-50:   rgb(250 245 255)
sombra dos cards: 0 4px 20px rgba(91,33,182,0.08)
```

## 🪤 O "ScrollReveal" é OCO — não tente replicar animação que não existe
`ScrollReveal-D_4fvhty.js` recebe `delay` e **ignora**, devolvendo uma `div`
pura. As seções passam `delay: index*0.08` que não faz nada.

As animações REAIS do site são só três, todas CSS padrão:
1. `accordion-down`/`accordion-up` (0.2s ease-out) — sanfona do FAQ
2. `transition-*` — hover de botões e cards
3. `animate-pulse` (2s)

## 💳 Eles JÁ usam Asaas
Link de pagamento achado no Pricing: `https://www.asaas.com/c/s9y29kncpe5up79j`

**Consequência pro futuro painel:** não precisa escolher provedor de boleto nem
abrir conta. O Asaas tem API de cliente/cobrança/boleto/assinatura e a conta já
existe. Começar por aí.

## Imagens (só 3 no site inteiro)
Baixadas do CDN do Base44 pra `referencia-base44/imagens/`:
- `680f5509d_LogoKontrataai.png` (998 KB — ⚠️ pesado demais, otimizar)
- `3205fe8b5_generated_34ed48bc.png` (1,1 MB — ⚠️ idem)
- `6d8f8f8a6_mamevarg.png` (166 KB)

## Decisões ainda em aberto com o usuário
1. **Domínio** onde publicar (raiz `kontrataai.com.br` vs subdomínio)
2. **Painel de gestão** — construir do zero (não existe no Base44)
3. **Google Analytics** — pedido dele, medir acessos

## Tags
#site #marketing #base44 #kontrata #asaas

---

## ✅ Reconstruído e publicado (23/08/2026)

**No ar:** https://kontrataai.com.br (e www), SSL via Certbot, HTTP→HTTPS 301.
**Código:** `packages/site/` — Vite + React + Tailwind.

### Onde mora na VPS (não é container!)
Site estático servido **direto pelo nginx** — não tem backend, então container
seria peso morto numa VPS que já roda 20+.
- Arquivos: `/var/www/kontrata-site`
- Vhost: `/etc/nginx/sites-available/kontrata-site`
- Deploy: `npx vite build` → `tar` do `dist/` → extrair em `/var/www/kontrata-site`

### 🪤 Duas regras do vhost que não podem sumir
```nginx
location / { try_files $uri $uri/ /index.html; }   # SPA: sem isso F5 em /treinamento = 404
location = /index.html { add_header Cache-Control "no-cache..."; }  # senão serve bundle velho
```
`/assets/` pode ter cache de 1 ano porque os nomes têm hash.

### Paleta: NÃO é o purple padrão do Tailwind
Mistura purple com violet. Definida em `tailwind.config.js` com os valores
lidos do CSS original. Usar o padrão deixa a marca com a cor errada.

### As 3 animações do hero ("o sol abrindo e fechando", nas palavras do usuário)
| Animação | O que faz |
|---|---|
| `marquee` 28s | faixa de recursos deslizando; lista duplicada pra emenda não "pular" |
| `shimmer` 2s | degradê dourado correndo na palavra "supermercado" |
| `meshMove` 10s | gradiente de 5 roxos a 400% deslizando — parece respirar |

### Imagens: original carregava 2,4 MB de peso morto
`scripts/otimizar-imagens.js` (sharp) redimensiona pro tamanho de exibição:
| Imagem | Antes | Depois |
|---|---|---|
| foto do CTA | 1080 KB | 89 KB (-92%) |
| logo/favicon | 997 KB | 12 KB (-99%) |
| print do hero | 166 KB | 40 KB (-76%) |

Originais preservados em `referencia-base44/imagens/` — nunca editar.

### ⚠️ Pendências conhecidas
1. **Google Analytics sem ID.** `VITE_GA_ID` vazio = não carrega nada.
   Criar `.env.production` com `VITE_GA_ID=G-XXXXXXXXXX` e rebuildar.
2. **Tabela comparativa vazia** — era assim no original (`const r=[]`).
   Preencher `CRITERIOS` em `src/sections/SectionComparativo.jsx`.
3. **Senha do treinamento é client-side** (`kontrataai2024`, agora em
   `VITE_TREINAMENTO_SENHA`). Qualquer visitante lê no código da página.
   Herdado do original. Se o conteúdo virar sensível, precisa ir pro servidor.
4. **Painel de gestão** — não existe, construir do zero. Usar API do Asaas.
