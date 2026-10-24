import cron from 'node-cron';
import { LembretesHoleriteService } from '../services/lembretes-holerite.service';

// Verifica a cada minuto; o service só dispara 1x/dia no horário configurado (seg a sáb,
// hora de São Paulo) e só se o lembrete automático estiver ligado.
export function startLembretesHoleriteCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
      if (!base) return; // sem URL pública não dá pra montar o link do portal
      const r = await LembretesHoleriteService.rodarAutomatico(base);
      if (r) console.log(`[cron lembretes-holerite] ${r.enviados}/${r.total} lembrete(s) enviado(s).`);
    } catch (e: any) {
      console.error('[cron lembretes-holerite] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Lembretes de Holerite (WhatsApp) ativo.');
}
