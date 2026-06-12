import cron from 'node-cron';
import { ConfigurationService } from '../services/configuration.service';
import { VagasAbertasWhatsService } from '../services/vagas-abertas-whats.service';

// Verifica a cada minuto; quando bater o dia da semana + horario configurados,
// envia as Vagas em Aberto pro grupo. Dia: 0=Dom ... 6=Sab (JS getDay).
export function startVagasAbertasCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const grupo = await ConfigurationService.get('whatsapp_group_vagas_abertas', null);
      const dia = await ConfigurationService.get('whatsapp_vagas_abertas_dia_semana', null);
      const hora = await ConfigurationService.get('whatsapp_vagas_abertas_schedule_time', null);
      if (!grupo || dia == null || !hora) return; // so envia quando configurado

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (String(now.getDay()) === String(dia) && hhmm === hora) {
        console.log('[cron vagas-abertas] disparando envio semanal...');
        const r = await VagasAbertasWhatsService.enviar();
        console.log(`[cron vagas-abertas] enviado: ${r.total} vagas.`);
      }
    } catch (e: any) {
      console.error('[cron vagas-abertas] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Vagas em Aberto (WhatsApp) ativo.');
}
