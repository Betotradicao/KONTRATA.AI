import cron from 'node-cron';
import { ConfigurationService } from '../services/configuration.service';
import { DpDocsWhatsService } from '../services/dp-docs-whats.service';

// Verifica a cada minuto; quando bater o horario configurado:
//  - SEMPRE: alerta de vencimento (so dispara se houver doc com data_alerta = hoje);
//  - se for o DIA DO MES configurado: relatorio de obrigatorios sem documento.
export function startDpDocsCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const grupo = await ConfigurationService.get('whatsapp_group_dp_docs', null);
      const hora = await ConfigurationService.get('whatsapp_dp_docs_schedule_time', null);
      if (!grupo || !hora) return; // so roda quando configurado

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== hora) return;

      // 1) Vencimento (1x na data do alerta de cada doc)
      try {
        const v = await DpDocsWhatsService.enviarVencimentos(false);
        if (v.enviado) console.log(`[cron dp-docs] vencimento enviado: ${v.total} doc(s).`);
      } catch (e: any) { console.error('[cron dp-docs] vencimento erro:', e?.message || e); }

      // 2) Obrigatorios faltando — so no dia do mes configurado
      const diaMes = await ConfigurationService.get('whatsapp_dp_docs_dia_mes', null);
      if (diaMes && String(now.getDate()) === String(diaMes)) {
        try {
          const o = await DpDocsWhatsService.enviarObrigatorios(false);
          if (o.enviado) console.log(`[cron dp-docs] obrigatorios enviado: ${o.total} pendente(s).`);
        } catch (e: any) { console.error('[cron dp-docs] obrigatorios erro:', e?.message || e); }
      }
    } catch (e: any) {
      console.error('[cron dp-docs] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Documentos / Departamento Pessoal (WhatsApp) ativo.');
}
