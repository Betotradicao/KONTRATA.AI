import cron from 'node-cron';
import { ConfigurationService } from '../services/configuration.service';
import { AniversarioWhatsService } from '../services/aniversario-whats.service';

// Verifica a cada minuto; quando bater o horario configurado, parabeniza no grupo
// quem faz aniversario hoje (1 mensagem por loja). So roda quando configurado.
export function startAniversarioCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const grupo = await ConfigurationService.get('whatsapp_group_aniversario', null);
      const hora = await ConfigurationService.get('whatsapp_aniversario_schedule_time', null);
      if (!grupo || !hora) return;

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== hora) return;

      const r = await AniversarioWhatsService.enviar(false);
      if (r.enviado) console.log(`[cron aniversario] parabéns enviados: ${r.total} colaborador(es) em ${r.lojas} loja(s).`);
    } catch (e: any) {
      console.error('[cron aniversario] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Aniversariantes (WhatsApp) ativo.');
}
