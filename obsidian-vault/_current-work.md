# 🚧 Trabalho em Andamento

## Tarefa atual — Aniversariantes do Mês (Config RH)
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
- ✅ TS compila; front consumindo a API OK (log: GET /rh/aniversariantes 304, user ROBERTO).
- ⏳ **Aguardando usuário testar/validar** (Config RH → 🎂 Aniversariantes do Mês). Depois: commit/push + deploy.

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
