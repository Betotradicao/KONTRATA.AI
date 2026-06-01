# 🚧 Trabalho em Andamento

## Sessão 30-31/05/2026 — Agente IA de Escala (Etapas 1 e 2 concluídas)

### ✅ Entregue (commit `e7d410a` pushado pro origin/KONTRATAAI)
- **Agente conversacional** no chat da Escala com persona/regras/saudação configuráveis em `Configurações de REDE → IA → Agente de Escala`
- **Vault de Memória** (`rh_escala_memoria`): notas markdown estilo Obsidian, auto-save pelo agente, tags, backlinks `[[ref]]`
- **Function calling via bloco ```executar`**: 4 ações ativas — `pre_preencher_mes`, `mudar_tipo_escala`, `lancar_turno_em_dia`, `limpar_dia`
- **Validação por senha bcrypt** do usuário logado + cache 5min (banner verde 🔓 / amarelo 🔐)
- **Auditoria** `rh_escala_agente_acoes` com ANTES/DEPOIS pra rollback futuro
- **GPT-5/5-mini/5.2** suportados (usa `max_completion_tokens` em vez de `max_tokens`)
- **Importar arquivo** no chat: PDF/Excel/imagem via Vision pro agente analisar escalas antigas
- **Agente Recrutador embedded** na mesma aba de Configurações (remove header roxo quando embedded)
- **Vault de Dados acessíveis**: tela transparência LGPD listando tabelas/campos que o agente vê

### 🔜 Próxima sessão — Etapa 3
- [ ] Adicionar ações: `programar_ferias(colab, inicio, fim)`, `lancar_atestado(colab, dias, motivo)`, `criar_excecao(colab, data, tipo)`
- [ ] Botão **"Desfazer última ação"** no chat — usa snapshot ANTES gravado em `rh_escala_agente_acoes`
- [ ] Tela de **histórico de ações do agente** — quem pediu, o quê, quando, status, undo
- [ ] (Futuro) Operations Research solver Python + OR-Tools pra geração automática completa

### 🧠 Decisões da sessão
- Persona vai pro system prompt (**afeta como pensa**), saudação é separada (**só recepção no chat**)
- Agente salva memórias **sozinho** via bloco ` ```save-memoria` (não via botão)
- Senha exigida **sempre** pra ações destrutivas, cache 5min depois
- "GRID MENSAL" renomeado pra "ESCALA MENSAL"; itens removidos da sidebar: Memória do Agente, Recrutador IA, Férias/Licenças
- Agente NÃO aprende sozinho — memória é simulada via Vault (mesmo princípio do ChatGPT Memory / Claude Projects)

### 📂 Arquivos-chave criados
- Backend: `rh-escala.controller.ts` (chatAgenteEscala, executarAcaoAgente, validarSenhaAgente, analisarArquivoAgente), `rh-escala-memoria.controller.ts`
- Frontend: `AgenteEscalaConfig.jsx`, `AgenteEscalaDados.jsx`, `AgenteRecrutadorConfig.jsx`, `RhEscalaMemoria.jsx`, `RhEntrevistasIA.jsx`, `RhEscalaRegrasSetor.jsx`
- Migrations: 1785180000000 (memoria), 1785190000000 (agente_config), 1785200000000 (saudacao), 1785210000000 (acoes)
