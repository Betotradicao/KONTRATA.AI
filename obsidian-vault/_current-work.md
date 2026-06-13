# 🚧 Trabalho em Andamento

## Tarefa atual — Coluna "KM Residência" em Vagas (distância candidato→loja)
Coluna 📍 **KM Residência** na lista de candidatos da vaga (RhVagas), entre Nome e WhatsApp. Distância **em linha reta** (haversine) da casa do candidato até a loja da vaga. Geocoding CEP→coords via **AwesomeAPI** (grátis). Ver nota `bugs-resolvidos/2026-06-12-feature-km-residencia-geocoding.md`.

### Status
- ✅ Implementado: migration (colunas geo), `geocode.service.ts`, `listarVagas` (join loja + distância + warm bg), entities, `RhVagas.jsx` (coluna+célula, colSpan 16→17). TS compila, migration aplicada.
- ✅ **Geocoding corrigido**: AwesomeAPI errava CEP isolado (Ana Paula 12248-628 caía 12km errado). Trocado pra **Photon/OSM por RUA** (primário) + AwesomeAPI fallback. Re-backfill: 48/49 via Photon. Ana Paula 12km→1,3km, Andreia 417m, Roberto 15km. Validado.
- ⏳ **Aguardando usuário re-testar local** (Vagas → expandir vaga → ver coluna KM Residência, conferir Ana Paula ~1,3km).
- Depois: commit/push (após validar) + deploy. **Deploy: rodar backfill geocoding FORÇADO no cliente** (street-first) pra recalcular tudo — registros antigos não re-geocodam sozinhos.

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
