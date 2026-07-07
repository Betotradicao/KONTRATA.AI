# 🧠 Segundo Cérebro — Radar 360

Índice principal do conhecimento sobre o projeto **Prevenção no Radar / Radar 360**.

## 🗺️ Como ver o Grafo Visual
Atalho: **Ctrl + G** ou clica no ícone de 3 bolinhas ligadas na barra lateral esquerda.

## 📁 Clientes
- [[clientes/supervital|SuperVital]] — Multi-loja, Oracle Intersolid
- [[clientes/tradicao|Tradição]] — Loja única, rede local, Oracle Intersolid
- [[clientes/maxvalle|MaxValle]] — Oracle Intersolid
- [[clientes/nunes|Nunes]] — ⚠️ ERP diferente (RP INFO PostgreSQL)

## ⚖️ Legalidade Jurídica
- [[LEGALIDADE JURIDICA/00-INDICE|Legalidade Jurídica — Índice]] — assinatura eletrônica, eSocial, fundamentos legais

## 🏗️ Arquitetura
- [[arquitetura/deploy|Deploy Multi-Tenant]]
- [[arquitetura/oracle-intersolid|Oracle Intersolid]]
- [[arquitetura/mapeamento-tabelas|Mapeamento de Tabelas (v1/v2)]]
- [[arquitetura/estrutura-vps|Estrutura da VPS 46]] (kontrata + prevenção)
- [[arquitetura/estrutura-vps3-producao|Estrutura da VPS 3 — 31.97.82.235 / TradicaoSJC]] (Evolution/n8n/chatwoot + nunes/prod)
- [[arquitetura/whitelabel|Whitelabel — Estado Atual + Plano de Mudança]] ← antes de mexer, ler

## ⚙️ Módulos do Sistema

### Prevenção no Radar
- [[modulos/bipagens|Bipagens]]
- [[modulos/vision-palavra-chave|Vision Palavra-Chave]]
- [[modulos/vision-facial|Vision Facial / Reconhecimento Facial]]
- [[modulos/vision-antifurto|🔮 Vision Antifurto — POC IA (planejamento)]]
- [[modulos/dvr-cameras|DVR e Câmeras]]
- [[modulos/rupturas|Rupturas]]
- [[modulos/etiquetas|Etiquetas]]
- [[modulos/perdas-quebras|Perdas e Quebras]]
- [[modulos/hortfruti|HortFruti]]
- [[modulos/producao|Produção / Açougue]]
- [[modulos/frente-caixa|Frente de Caixa]]
- [[modulos/prevencao-tributaria|Prevenção Tributária]]
- [[modulos/prevencao-caixa|Prevenção de Caixa]]

### Gestão no Radar
- [[modulos/gestao-inteligente|Gestão Inteligente]]
- [[modulos/compra-venda|Compra x Venda]]
- [[modulos/analise-preco|Análise de Preço / Margem / Estoque]]
- [[modulos/financeiro|Financeiro]]

### Marketing no Radar
- [[modulos/marketing-whatsapp|Marketing WhatsApp]]

### Oferta no Radar (Garimpador 360)
- [[modulos/garimpador|Garimpador]]

### IA no Radar
- [[modulos/rota-crescimento|Rota de Crescimento]]

### RH no Radar
- [[modulos/rh|RH (Recursos Humanos) — reformulado abril/2026]]
- [[modulos/lgpd-compliance|⚖️ LGPD Compliance — plano pendente]]
- [[modulos/rh-escala-planejamento|📅 Escala de Trabalho — especificação pronta pra codar]]
- [[modulos/rh-ia-recrutadora|🤖 IA Recrutadora — entrevistas por vídeo automatizadas (ideia validada)]]

### Outros
- [[modulos/metas-rankings|Metas e Rankings]]

## 🐛 Bugs Resolvidos / Features Recentes

### Abril 2026
- [[bugs-resolvidos/2026-04-15-tiposSaida-gestao|NF Transferência contaminando Gestão Inteligente]]
- [[bugs-resolvidos/2026-04-15-dif-anual-itens|Dif Anual em branco nos itens Compra x Venda]]
- [[bugs-resolvidos/2026-04-bifurcacao-postgresql-nunes|🌟 Bifurcação PostgreSQL para Nunes (feature grande)]]
- [[bugs-resolvidos/2026-04-cupom-cancelados-desconto|Itens cancelados/desconto no rodapé cupom]]
- [[bugs-resolvidos/2026-04-dvr-h265-h264|DVR H.265 → H.264 para browser]]
- [[bugs-resolvidos/2026-04-auto-reconnect-oracle|Auto-reconnect Oracle]]

### Março 2026
- [[bugs-resolvidos/2026-03-marketing-whatsapp-completo|Marketing WhatsApp (módulo completo)]]
- [[bugs-resolvidos/2026-03-vision-palavra-chave-v2|Vision Palavra-Chave v2]]
- [[bugs-resolvidos/2026-03-vision-pdv-dvr|Vision PDV + integração DVR CFTV]]
- [[bugs-resolvidos/2026-03-rh-radar-completo|RH no Radar (módulo completo + Método DISC)]]
- [[bugs-resolvidos/2026-03-garimpador-analytics|Garimpador Analytics (IA + PGVector)]]
- [[bugs-resolvidos/2026-03-gestao-inteligente-evolucoes|Gestão Inteligente — evoluções]]
- [[bugs-resolvidos/2026-03-seguranca-cors-helmet|Segurança: CORS, Helmet, Rate Limiting]]
- [[bugs-resolvidos/2026-03-white-label|White-Label (logo/empresa)]]
- [[bugs-resolvidos/2026-03-instalador-v5|Auto-Instalador v5.0 / v5.1]]
- [[bugs-resolvidos/2026-03-multi-loja-expansion|Expansão Multi-Loja (dezenas de telas)]]
- [[bugs-resolvidos/2026-03-venda-dia-a-dia-drill|Venda Dia a Dia (drill-down)]]
- [[bugs-resolvidos/2026-03-prevencao-acougue|Prevenção Açougue (Desmembramento + Rendimento)]]
- [[bugs-resolvidos/2026-03-metas-no-radar|Metas no Radar (desativado)]]
- [[bugs-resolvidos/2026-03-saude-estoque-queda-vendas|Saúde do Estoque — Queda de Vendas]]
- [[bugs-resolvidos/2026-03-cron-monitor-scanner|Cron Monitor / Scanner Service]]
- [[bugs-resolvidos/2026-03-bipagens-offline-salvar|Bipagens salvas mesmo com Oracle offline]]

## 🎨 Padrões / Convenções
- [[padroes/estilo-criacao|Estilo de Criação de Telas (Radar 360)]]
- [[padroes/regras-ssh-windows|SSH no Windows (PowerShell wrapper)]]

## 🚧 Sessão Atual
- [[_current-work|Trabalho em Andamento (SESSÃO ATUAL)]]

---

## 🎯 Como usar este cérebro

Quando abrir um chat novo com o Claude:
1. Diga: *"Claude, vamos trabalhar no cliente X"* ou *"Vamos mexer no módulo Y"*
2. Ele lê a nota específica + relacionadas automaticamente
3. Sem precisar re-explicar contexto

## 📝 Convenções
- `[[Nota]]` = link pra outra nota
- `#tag` = etiqueta pra filtrar
- Pastas organizam por tema, não por data

## 🤖 Skills Obsidian Instaladas
Skills oficiais do **Kepano (CEO do Obsidian)** em `.claude/skills/`:
- **obsidian-markdown** — criação padronizada de notas
- **obsidian-cli** — manipular vault via CLI
- **obsidian-bases** — Bases (tabelas filtráveis)
- **defuddle** — extrair web limpo
- **json-canvas** — canvas visuais
