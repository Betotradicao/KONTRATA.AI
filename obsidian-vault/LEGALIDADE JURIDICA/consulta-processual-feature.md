---
tags: [legalidade, juridico, consulta-processual, feature, lgpd, produto]
data: 2026-07-08
status: 💡 ideia de feature — análise legal feita
---

# 💼 Consulta Processual como feature paga na Kontrata — análise legal

> Ideia: revender consulta processual por CPF/CNPJ/nome dentro do Kontrata (modelo do
> **processoweb.com.br** / Uply). Cliente paga ~R$40, custo do provedor ~R$20, mostra
> relatório com blur+desbloquear. Análise dos ToS+Política do processoweb como referência.
> **Síntese qualificada, NÃO parecer. Validar com advogado antes de produção.**

## Como o dado FLUI (fontes)
- **Atacadistas (API paga, revenda):** Escavador, Judit.io, Digesto, Codilo, Jusbrasil.
- **DataJud (CNJ):** oficial, GRÁTIS (API key), mas só por número de processo/tribunal — NÃO faz "por CPF".
- ⚠️ Tribunais (ESAJ/PJe) **não deixam buscar por CPF** de propósito. O "por CPF" é o de-para nome↔processo que o provedor faz — é o produto pago.

## Arquitetura legal do processoweb (o que sustenta o "por CPF")
`dado público + princípio da publicidade (CF art. 5º LX + Lei 11.419/2006 art. 8º) + "somos mero agregador" + OPT-OUT`
- A Política deles **NÃO declara base legal pro dado da pessoa PESQUISADA** (Seção 03 só cobre pagador/navegação/cookies). O terceiro fica em **legítimo interesse tácito**.
- **O contrapeso é o "Bloqueio de CPF"** (opt-out gratuito/imediato) = direito de oposição (LGPD art. 18). **É isso que segura a legalidade.** Não é opcional.
- Controlador = Uply Soluções em Tecnologia LTDA, CNPJ 63.483.221/0001-88. Gateway = Pagar.me (Stone), só PIX. GA com SCCs.

## O que a Kontrata PRECISA a mais que o modelo B2C deles
1. **Tela de Bloqueio de CPF (opt-out)** — obrigatória, sustenta o tratamento do terceiro.
2. **Declaração de finalidade ANTES da consulta** — público Kontrata é RH/empregador →
   bloquear "triagem de candidato/empregado" (Lei 9.029/95 + LGPD). ⚠️ Plataforma que SABE
   que o público é empregador pode ser **corresponsabilizada** — cláusula "é proibido" não basta.
   Ver [[disc-em-candidatos]] (mesmo risco, uso em candidato).
3. **Contrato de revenda/white-label com o provedor** — todos proíbem revenda por padrão (Cl. 9).
   Sem plano de revenda explícito, não pode faturar em cima.

## Reusar do ToS/Política deles (esqueleto)
- ToS: Descrição ("informativo, não é advocacia") · Origem (CF/Lei 11.419) · **Limitação de
  responsabilidade** ("não é prova, não é base exclusiva de decisão") · **Uso proibido**
  (stalking/discriminatório/revenda/scraping) · IP · Foro.
- Política: Controlador · Dados · Bases legais · Compartilhamento · Retenção (5 anos fiscal /
  6 meses logs Marco Civil) · Cookies · Menores (18+) · Direitos art. 18 · DPO (art. 41).
- ⚠️ **Reembolso:** ser menos agressivo que eles (art. 49 CDC "sem arrependimento" é contestável).

## 🔑 Arquitetura do OPT-OUT (Bloqueio de CPF) — DECISÃO (08/07)
Problema: a pessoa cujo CPF aparece NÃO é cliente e nunca loga. Então o opt-out não pode ficar
na área logada. Solução:
- **Página PÚBLICA** (sem login), dentro da própria Kontrata — mesmo padrão de `/disc`,
  `/curriculo`, `/denuncia` (rotas públicas que já existem). NÃO é site externo de terceiro.
- **CENTRAL e única** (não por cliente): Kontrata é multi-tenant (`tradicao.kontrataai.com.br`...),
  e a pessoa não sabe qual cliente pesquisou. Então:
  ```
  Página única: protecao.kontrataai.com.br (ou /bloqueio-cpf)
     → grava numa BLOCKLIST CENTRAL (1 banco compartilhado)
  Toda consulta (qualquer cliente) checa a blocklist ANTES de chamar o provedor:
     CPF bloqueado? → recusa, não gasta crédito.
  ```
- Por que central: pessoa bloqueia 1x e vale pra todos (oposição efetiva, LGPD); deixa claro
  que **quem opera a consulta é a Kontrata = controladora** (mais defensável na ANPD).
- Como a pessoa acha: rodapé do relatório + Política + e-mail. Encaixa na decisão "serviço
  central vs por cliente" (ver [[../arquitetura/kontrata_vs_radar]] / arquitetura das VPS).

## Modelo de cobrança
Carteira de créditos por cliente (compra saldo → debita por consulta) via Pagar.me / Mercado
Pago / Asaas. Cache do resultado (não pagar 2x o provedor). Trilha de quem consultou o quê + finalidade.

## Próximo passo técnico
Protótipo com **DataJud** (grátis, por número de processo, SEM CPF de ninguém) pra provar a
mecânica ponta-a-ponta; depois trocar a fonte pelo provedor pago quando fechar contrato.
