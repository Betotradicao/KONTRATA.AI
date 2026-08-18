import cron from 'node-cron';
import { ConfigurationService } from '../services/configuration.service';
import { BancoHorasWhatsService } from '../services/banco-horas-whats.service';

// Verifica a cada minuto; dispara o PDF do banco de horas pros grupos quando bate:
//  - modo 'semana': nos dias da semana escolhidos (getDay 0=Dom..6=Sab) no horario.
//  - modo 'mes':    no dia do mes escolhido, no horario.
// Sem modo/horario => nao roda (so o disparo manual pelo botao).
// Mesmo desenho do cron de disparo-vagas, de proposito: quem mexer num entende o outro.
export function startBancoHorasCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const modo = await ConfigurationService.get('whatsapp_banco_horas_modo', null);
      const hora = await ConfigurationService.get('whatsapp_banco_horas_horario', null);
      if (!modo || !hora) return;

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== hora) return;

      if (modo === 'semana') {
        const diasRaw = await ConfigurationService.get('whatsapp_banco_horas_dia_semana', '');
        const dias = String(diasRaw || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!dias.includes(String(now.getDay()))) return;
      } else if (modo === 'mes') {
        const diaMes = await ConfigurationService.get('whatsapp_banco_horas_dia_mes', null);
        if (!diaMes || String(now.getDate()) !== String(diaMes)) return;
      } else {
        return;
      }

      const r = await BancoHorasWhatsService.enviar(false);
      console.log(`[cron banco-horas] disparado (${modo}): ${r.enviados}/${r.total} grupo(s), ${r.pdfs} PDF(s).`);
    } catch (e: any) {
      console.error('[cron banco-horas] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Banco de Horas (WhatsApp) ativo.');
}
