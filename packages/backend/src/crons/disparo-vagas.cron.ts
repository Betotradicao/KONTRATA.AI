import cron from 'node-cron';
import { ConfigurationService } from '../services/configuration.service';
import { DisparoVagasWhatsService } from '../services/disparo-vagas-whats.service';

// Verifica a cada minuto; dispara o recrutamento pros grupos quando bate a regra:
//  - modo 'semana': nos dias da semana escolhidos (getDay 0=Dom..6=Sab) no horario.
//  - modo 'mes':    no dia do mes escolhido, no horario.
// Vazio/sem horario => nao roda (so disparo manual pelo botao).
export function startDisparoVagasCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const modo = await ConfigurationService.get('whatsapp_disparo_vagas_modo', null);
      const hora = await ConfigurationService.get('whatsapp_disparo_vagas_horario', null);
      if (!modo || !hora) return;

      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== hora) return;

      if (modo === 'semana') {
        const diasRaw = await ConfigurationService.get('whatsapp_disparo_vagas_dia_semana', '');
        const dias = String(diasRaw || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!dias.includes(String(now.getDay()))) return;
      } else if (modo === 'mes') {
        const diaMes = await ConfigurationService.get('whatsapp_disparo_vagas_dia_mes', null);
        if (!diaMes || String(now.getDate()) !== String(diaMes)) return;
      } else {
        return;
      }

      const r = await DisparoVagasWhatsService.enviar(false);
      console.log(`[cron disparo-vagas] disparado (${modo}): ${r.enviados}/${r.total} grupo(s).`);
    } catch (e: any) {
      console.error('[cron disparo-vagas] erro:', e?.message || e);
    }
  });
  console.log('⏰ Cron de Disparo de Vagas (WhatsApp) ativo.');
}
