---
tags: [ia, agente, compliance, whatsapp, vault]
data: 2026-06-20
---

# Agente Compliance — 4º agente de IA (norma interna / feedback no WhatsApp)

## Objetivo
Agente que responde dúvidas de **regimento interno / sindicato / acordo coletivo /
feedback** dentro de um **grupo de WhatsApp**, acionado por palavra-gatilho
(ex.: *"Helen, segundo nossa norma interna isso é permitido?"*). Também deve, no
futuro, consultar **dados vivos do sistema** (quantos colaboradores, etc.).

## Onde fica
Configurações de Rede → Inteligência Artificial → aba **🛡️ Agente Compliance**
(ao lado de Agente de Escala e Agente Recrutador).
- `AITab.jsx`: nova aba `secaoAtiva === 'agente_compliance'` → `<AgenteComplianceConfig />`.
- `AgenteComplianceConfig.jsx`: sub-abas **💬 Atendimento** (grupo + gatilho + ativo),
  **🎭 Persona** (nome/tom/modelo/persona/instruções), **🧠 Base de Conhecimento**.

## Decisões de arquitetura (WHY)
- **Config em `configurations`** (key/value, sem tabela nova): `compliance_grupo_id`,
  `compliance_grupo_nome`, `compliance_gatilho`, `compliance_ativo`,
  `compliance_nome_agente`, `compliance_persona`, `compliance_tom`,
  `compliance_modelo`, `compliance_instrucoes`. Carrega/salva via `/config/configurations`.
- **Grupos do WhatsApp** reutilizam `GET /whatsapp/fetch-groups` (mesmo das outras abas).
- **Vault próprio** `rh_compliance_memoria` (migration `1785600000000`) — MESMO schema do
  `rh_escala_memoria`, tabela separada pra não misturar com a Escala. Categorias:
  `sindicato | acordo_coletivo | regimento_interno | aprendizado_feedback | outro`.
  Endpoints `/rh/compliance/memoria` (listar/obter/criar/atualizar/deletar/upload-doc).
- **Upload de PDF guarda o TEXTO INTEGRAL** (não resume) — `RhComplianceMemoriaController.uploadDocumento`
  usa `DocumentoEscalaService.extrairTexto` e salva tudo no `conteudo`. (Usuário pediu
  "a IA leia e grave tudo que está escrito".)

## Reuso importante — vault genérico
`RhEscalaMemoria.jsx` foi **generalizado via props** (sem quebrar a Escala — defaults
preservam o comportamento):
`<RhEscalaMemoria apiBase tipos tiposUpload titulo />`.
- Escala usa os defaults; Compliance passa `apiBase="/rh/compliance/memoria"` + COMPLIANCE_TIPOS.
- ⚠️ Cuidado ao mexer: o componente referencia `tipos`/`tiposUpload` (props), e os consts
  `TIPOS`/`TIPOS_UPLOAD` ficaram só como DEFAULTS. `uploadTipo` inicial = `tiposUpload[0]`.

## Cérebro / chat (FEITO)
`RhComplianceController.chat` → `POST /rh/compliance/chat`. Fluxo:
1. RAG por palavra-chave em `rh_compliance_memoria` (docs internos).
2. **Achou interno** → responde com o modelo configurado (`compliance_modelo`), citando a fonte.
3. **Não achou** → usa modelo de **busca web da OpenAI** (`compliance_web_model`,
   default `gpt-4o-mini-search-preview`) e começa com o aviso "⚠️ Não encontrei no regimento
   interno". Se o modelo de busca falhar (conta sem acesso) → degrada pro modelo normal (fonte 'geral').
   Config `compliance_web_fallback` ('true' = busca web ligada — escolha do usuário "ao vivo").
- Retorna `{ reply, fonte: interno|web|geral, modelo, docs }`.
- Front: sub-aba **🧪 Testar** no `AgenteComplianceConfig` (chat box mostra a fonte de cada resposta).
- ⚠️ Local: a `openai_api_key` do kontrata_dev está INVÁLIDA → testar local dá "Incorrect API key".
  Em prod (clientes) a chave é válida. Pra testar local, pôr chave válida em Config → AI → Chave API.

## Falta (próximas fases)
1. **Dados vivos do banco**: tools read-only (quantos colaboradores, vagas abertas, férias...).
   Hoje o cérebro só lê docs (RAG) + web — não consulta o banco operacional ainda.
2. **Escuta no WhatsApp**: webhook de ENTRADA na Evolution (hoje só temos saída) que recebe
   msg do grupo, detecta o gatilho, chama `/rh/compliance/chat` e responde no grupo.
   ⚠️ LGPD/segurança: só **números autorizados** podem perguntar (dados de funcionário).
