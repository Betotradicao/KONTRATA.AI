# 🚧 Trabalho em Andamento

## Tarefa atual — Melhorias em Vagas (Contratados + Dias até contratação)
Tudo em RhVagas.jsx + rh.controller (SEM migration). Validado local.
- Card/filtro **Contratados** inclui vagas com status finalizado (Contratado(a)/Fechada), não só candidato marcado (`vagaTemCandidatoStatus` + contagem `nContratados`).
- Vaga contratada sem candidato marcado: ao expandir, mostra TODOS os candidatos (visiveis fallback).
- Coluna **Dias em Aberto**: finalizada mostra dias até `data_fechamento` (badge roxo "X dias ✓").
- **data_fechamento** gravado ao finalizar nos 3 caminhos: atualizarVaga (autoritativo: body>existente>now), setCandidatoStatusVaga (COALESCE(data_fechamento,now); limpa ao reabrir). Campo "Data de Fechamento" editável no modal (aparece quando finalizada).
- ⏳ NÃO commitado. Validado pelo usuário ("agora foi"). Commit + deploy quando ele pedir.

## Tarefa anterior — Cadastro colaborador: obrigatórios + ordenação colunas
(frontend only, em cima do commit de uniforme 7c62eb4 ainda NÃO deployado)
- **Obrigatórios no cadastro** (RhCadastroGeral `camposObrigatorios` + `*` nos labels): Escolaridade (pessoais), CEP (endereco), Escala/Escala Especial Domingo/Regime de Trabalho/Setor/Salário (profissionais).
- **Ordenação A-Z das colunas**: bug era SETOR (ordenava por `setor_nome` nulo; célula mostra `setor_departamento_nome`). Comparador agora usa o mesmo fallback + vazios por último. Demais colunas já ordenavam.
- ✅ Commits `7c62eb4` (uniforme) + `820a6bb` (obrigatórios+sort). **DEPLOY Tradição feito (13/06)**: build --no-cache + up --no-deps. Backend healthy, migration uniforme aplicada em prod (colunas confirmadas), bundle com os campos. Só Tradição (demais não subiram).

## Tarefa anterior — Campos Uniforme no cadastro do colaborador
2 campos novos em RhCadastroGeral (Dados Pessoais › Características pessoais): **Tamanho de Uniforme** (PP/P/M/G/GG/XG/XXG) e **Tipo Uniforme** (NORMAL/BABY LOOK).
- Backend: migration `1785420000000-AddUniformeColaborador` (colunas `tamanho_uniforme`, `tipo_uniforme` em rh_colaboradores); add na whitelist `CAMPOS_EXTRAS_COLAB` (rh.controller) → salva via `gravarCamposExtrasColab` no create+update; GET já traz via `SELECT c.*`.
- Frontend: `pages/RhCadastroGeral.jsx` — 2 selects + state inicial + populate ao editar (save manda formData inteiro).
- ✅ TS compila, migration aplicada local. ⏳ Testar local. Depois commit/push + deploy (TEM migration — roda sozinha no boot).

## Tarefa anterior — Parabéns de Aniversário no WhatsApp (+ alertas DP)
Sub-aba 🎉 **Aniversariantes** em Grupos WhatsApp: cron diário no horário X vê quem faz aniversário HOJE e manda parabéns no grupo, **1 msg por loja** ("Equipe {loja}"), tom festivo/editável (placeholders `{nomes}`/`{loja}`).
- Backend: `services/aniversario-whats.service.ts` (NOVO), `crons/aniversario.cron.ts` (NOVO, registrado index), endpoints `POST/GET /whatsapp/aniversario/{enviar,preview}`. Config: `whatsapp_group_aniversario(_name)`, `whatsapp_aniversario_schedule_time`, `whatsapp_aniversario_mensagem`.
- Frontend: `AniversarioWhatsTab.jsx` (NOVO) + sub-aba no wrapper.
- ✅ Commit `0605b75` (push). **DEPLOY Tradição feito (13/06)**: build --no-cache + up --no-deps. Backend healthy, ambos crons ativos (DP docs + Aniversariantes), endpoints 401. SEM migration. Só Tradição (demais clientes não subiram).
- ⚠️ RH precisa configurar os grupos nas abas 📁 Departamento Pessoal e 🎉 Aniversariantes (+ Ctrl+Shift+R).

## Tarefa anterior — Alertas WhatsApp dos Documentos de DP
Sub-aba 📁 **Departamento Pessoal** em Grupos WhatsApp. 2 alertas SEPARADOS:
1. **Vencimento** (diário, dispara 1x quando `dp_documentos.data_alerta = hoje`).
2. **Obrigatórios sem documento** (dia X do mês): `dp_subpastas.obrigatorio=true` sem `dp_documentos`.
Modelo: dp_pastas→dp_subpastas→dp_documentos; loja via `dp_pastas.company_id = rh_empresas.id`.
- Backend: `services/dp-docs-whats.service.ts` (NOVO), `crons/dp-docs.cron.ts` (NOVO, diário, registrado no index), endpoints `POST/GET /whatsapp/dp-docs/{enviar,preview}` + rotas. Config: `whatsapp_group_dp_docs(_name)`, `whatsapp_dp_docs_schedule_time`, `whatsapp_dp_docs_dia_mes`.
- Frontend: `DepartamentoPessoalWhatsTab.jsx` (NOVO) + sub-aba no `GruposWhatsappTab.jsx`.
- ✅ TS compila; backend de pé com cron ativo; rotas 401. SEM migration. Local zerado de dados DP (testar envio mostra "nenhum"); prod (Tradição) tem dados.
- ⏳ Usuário vai testar local. Depois commit/push + deploy.

## Tarefa anterior — Notificação WhatsApp de nova Denúncia (NR-1)
Toda denúncia nova no Canal de Denúncia dispara msg "ATENÇÃO RH... Nº protocolo..." + PDF num grupo de WhatsApp.
- Backend: `services/denuncia-whats.service.ts` (NOVO: buildMensagem, buildPdf, notificar(id), enviarTeste). Hook em `denuncias.controller.criarPublica` (fire-and-forget após INSERT — não derruba a denúncia se WhatsApp falhar). Endpoints `POST/GET /whatsapp/denuncia-nr1/{enviar,preview}` + rotas. Config: `whatsapp_group_denuncia_nr1(_name)`.
- Frontend: `DenunciaNr1WhatsTab.jsx` (NOVO, sem agendamento — é por evento) + sub-aba no `GruposWhatsappTab.jsx`.
- ✅ Validado + commit `f57969c` (push KONTRATAAI). Inclui tbm o fix do QR do cartaz.
- ✅ **DEPLOY feito (13/06)** em Tradição, Guibox, Novacentral, Puma, DAmata — todos backend healthy. build --no-cache + up --no-deps, SEM migration. Faltam: fratelli, mameva.
- ⚠️ Em cada cliente, o RH precisa **configurar o grupo** na aba 🚨 Denúncia NR1 (Carregar Grupos + Salvar) — senão não dispara.

## Pendente junto (não commitado) — Ajuste QR do cartaz NR-1 (canal denúncia)
`pages/rh/CartazDenuncia.jsx`: QR encavalava no texto "APONTE A CÂMERA...". Reduzido/baixado o `QR_BOX` (top 64%, width 26%, height 15%, centro 75%) pra cobrir só o placeholder branco; QR agora quadrado (height 88% + width auto, antes esticava). Calibração visual — pode precisar de fino ajuste de %. Testar local em /rh/pesquisa-clima/nr1 → Gerar Cartaz Completo. Depois deploy só Tradição.

---

## Tarefa anterior — Aniversariantes do Mês (Config RH)
Nova aba 🎂 **Aniversariantes do Mês** em Configurações de RH. Modelo imprimível idêntico ao cartaz do cliente (sem "Jornal da Firma"): cabeçalho com a marca, título "ANIVERSARIANTES DO MÊS DE <MÊS>", tabela laranja (COLABORADOR | DATA DE ANIVERSÁRIO), texto editável de parabéns (default = frases do cartaz), rodapé editável, e logo do tenant. Filtro por mês (default mês atual).

### Arquivos
- Backend: `rh.controller.ts` → `listarAniversariantes` (GET /rh/aniversariantes?mes=N, ativos por mês de nascimento); `rh.routes.ts` rota.
- Frontend: `components/configuracoes/AniversariantesMesTab.jsx` (NOVO); `pages/RhConfiguracoes.jsx` (import + TAB + render).
- Logo/marca vêm de `client_logo_url` / `client_brand_name` (Personalização) — ver `padroes/branding-logo-nome-empresa.md`.
- Textos salvos em config `rh_aniversariantes_mensagem` / `rh_aniversariantes_rodape`.

### Recursos (todos implementados)
- Modelo retrato (A4 portrait) idêntico ao cartaz, sem "Jornal da Firma".
- Filtro por **mês** (default atual) e por **loja** (`/rh/empresas/stores/list`; filtro `c.empresa_id = cod_loja`). "Todas as lojas" = sem filtro.
- Painel de edição à esquerda: **Cabeçalho, Mensagem, Rodapé** editáveis (default = frases do cartaz) + **tamanho de fonte por campo** (px). Cartão à direita = preview ao vivo.
- **Espaço em branco** flexível entre mensagem e rodapé pros parabéns à mão.
- Botão Imprimir (window.print, só o cartão) + Salvar textos.
- Configs salvas: rh_aniversariantes_{cabecalho,mensagem,rodape,fonte_cabecalho,fonte_mensagem,fonte_rodape}.

### Status
- ✅ Validado, commit `c1bd8a9` (push KONTRATAAI).
- ✅ **DEPLOY feito (13/06)** em Tradição, Guibox, Novacentral, Puma, DAmata — todos backend healthy. Ciclo build --no-cache + up --no-deps, SEM migration/backfill (só código). Faltam: fratelli, mameva.

---

## Tarefa anterior — Coluna "KM Residência" em Vagas (distância candidato→loja)
Coluna 📍 **KM Residência** na lista de candidatos da vaga (RhVagas), entre Nome e WhatsApp. Distância **em linha reta** (haversine) da casa do candidato até a loja da vaga. Geocoding CEP→coords via **AwesomeAPI** (grátis). Ver nota `bugs-resolvidos/2026-06-12-feature-km-residencia-geocoding.md`.

### Status
- ✅ Implementado: migration (colunas geo), `geocode.service.ts`, `listarVagas` (join loja + distância + warm bg), entities, `RhVagas.jsx` (coluna+célula, colSpan 16→17). TS compila, migration aplicada.
- ✅ **Geocoding corrigido**: AwesomeAPI errava CEP isolado (Ana Paula 12248-628 caía 12km errado). Trocado pra **Photon/OSM por RUA** (primário) + AwesomeAPI fallback. Re-backfill: 48/49 via Photon. Ana Paula 12km→1,3km, Andreia 417m, Roberto 15km. Validado.
- ✅ Validado + commit `03de07e` (push KONTRATAAI).
- ✅ **DEPLOY Tradição feito** (13/06): pull + build --no-cache + up --no-deps. Migration geo aplicada. Backend healthy. Backfill forçado rodado dentro do container (script base64→docker cp→node -w /app): 100/102 curriculos + 2/2 lojas via Photon. Validado em prod: Ana Paula 1.310m, Andreia 417m, Roberto 15km.
- ⚠️ Frontend `unhealthy` (mesmo bug pré-existente do healthcheck wget BusyBox; serve normal).

### Próximo passo
KM Residência concluída e no ar. **Lote (ASO + Vagas em Aberto + KM Residência) deployado em (13/06):** Tradição, Guibox, Novacentral, Puma, DAmata — todos backend healthy + backfill geo OK. **Faltam: fratelli, mameva.**

---

## Tarefa anterior (concluída) — Saúde Ocupacional (ASO) no WhatsApp
Clone do "Vagas em Aberto", na mesma aba *Grupos WhatsApp* (sub-abas: 💼 Vagas em Aberto | 🩺 Saúde Ocupacional).

Envio semanal (dia + horário) de **mensagem + PDF** com:
- 🔴 **VENCIDOS** (ASO vigente já vencido)
- 🟡 **A VENCER em até X dias** (campo configurável "avisar a partir de X dias", default 45)

Cada item: loja, colaborador (matrícula), cargo, data de vencimento, situação (vencido há Xd / faltam Nd). Números espelham o Controle de ASO (vigente = último periódico, senão admissional; ignora dispensados/inativos).

### Arquivos tocados
Backend:
- `services/aso-whats.service.ts` (NOVO) — getRelatorio(antecedencia), buildMensagem, buildPdf (paisagem, 2 seções), enviar
- `crons/aso-vencimentos.cron.ts` (NOVO) — cron semanal (configs whatsapp_aso_*)
- `controllers/whatsapp.controller.ts` — enviarAso, previewAso
- `routes/whatsapp.routes.ts` — POST /aso/enviar, GET /aso/preview
- `index.ts` — startAsoVencimentosCron()

Frontend:
- `components/configuracoes/SaudeOcupacionalWhatsTab.jsx` (NOVO)
- `components/configuracoes/GruposWhatsappTab.jsx` (NOVO) — wrapper com sub-abas
- `pages/ConfiguracoesRede.jsx` — renderiza GruposWhatsappTab

Config keys: whatsapp_group_aso, whatsapp_group_aso_name, whatsapp_aso_dia_semana, whatsapp_aso_schedule_time, whatsapp_aso_dias_antecedencia.

### Status
- ✅ Testado local: msg + PDF chegam no grupo do WhatsApp.
- ✅ MENSAGEM: cada colaborador em bloco de 3 linhas (nome+mat / cargo / 📅 vencimento) com linha em branco entre eles.
- ✅ PDF: removidos emojis dos títulos (Helvetica não renderiza → virava "Ø=Ý").
- ✅ BUG "Sem loja": join estava em `companies/company_id` (tenant, campos nulos). Corrigido p/ `rh_empresas e ON e.cod_loja = c.empresa_id`. Ver nota `bugs-resolvidos/2026-06-12-colaborador-loja-empresa-id-cod-loja.md`.
- ✅ PDF agrupado por loja (faixa roxa por loja + cabeçalho de colunas por grupo); coluna "Loja" removida (virou faixa). TS compila.
- ✅ Validado local + commit `768c6ec` (push na KONTRATAAI).
- ✅ **DEPLOY Tradição feito** (12/06): git pull + build --no-cache + up --no-deps frontend backend. Backend healthy, cron ASO ativo ("⏰ Cron de Saúde Ocupacional / ASO (WhatsApp) ativo."), server 3010. Postgres/minio intactos.
- ⚠️ Frontend marca `unhealthy` (PRÉ-EXISTENTE, cosmético): healthcheck usa `wget --quiet --tries=1` (GNU) mas o probe roda o BusyBox wget → não aceita as flags → exit 1. Nginx serve 200 normal em produção. NÃO bloqueia. Pendente decidir se corrige o healthcheck (afeta TODOS os clientes — é template compartilhado).

### Próximo passo
Tarefa ASO concluída e no ar no Tradição. Pendências: (a) deploy nos outros 5 clientes; (b) opcional: corrigir healthcheck do frontend (-q em vez de --quiet/--tries).

## Pendência antiga
Deploy do lote anterior (whatsapp fixes + Vagas em Aberto, até 23f5225) nos 6 outros clientes — Tradição já tem. Aguardando "ok" por cliente.
