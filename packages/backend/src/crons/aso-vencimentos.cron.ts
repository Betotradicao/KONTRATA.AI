import cron from 'node-cron';
import { ConfigurationService } from '../services/configuration.service';
import { AsoWhatsService } from '../services/aso-whats.service';

// Verifica a cada minuto; quando bater o dia da semana + horario configurados,
// envia os ASOs (vencidos + a vencer) pro grupo. Dia: 0=Dom ... 6=Sab (JS getDay).
export function startAsoVencimentosCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const grupo = await ConfigurationService.get('whatsapp_group_aso', null);
      const dia = await ConfigurationService.get('whatsapp_aso_dia_semana', null);
      const hora = await ConfigurationService.get('whatsapp_aso_schedule_time', null);
      if (!grupo || dia == null || !hora) return; // so envia quando configurado

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (String(now.getDay()) === String(dia) && hhmm === hora) {
        console.log('[cron aso] disparando envio semanal...');
        const r = await AsoWhatsService.enviar();
        console.log(`[cron aso] enviado: ${r.vencidos} vencidos, ${r.aVencer} a vencer.`);
      }
    } catch (e: any) {
      console.error('[cron aso] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Saúde Ocupacional / ASO (WhatsApp) ativo.');
}
