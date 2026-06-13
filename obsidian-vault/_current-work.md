# 🚧 Trabalho em Andamento

## Tarefa atual — Saúde Ocupacional (ASO) no WhatsApp
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
- ⏳ **Aguardando reteste local** (Testar Envio) do novo layout msg + PDF.

### Próximo passo
Reteste. Depois: commit/push (só após validar) e deploy.

## Pendência antiga
Deploy do lote anterior (whatsapp fixes + Vagas em Aberto, até 23f5225) nos 6 outros clientes — Tradição já tem. Aguardando "ok" por cliente.
