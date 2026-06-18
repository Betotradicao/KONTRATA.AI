import axios from 'axios';
import { ConfigurationService } from './configuration.service';

// Disparo de Vagas: envia uma mensagem de recrutamento (com link do curriculo e
// uma arte em PDF anexa) pra VARIOS grupos de WhatsApp do cliente, com um
// intervalo configuravel entre cada grupo (anti-ban). Sem limite de grupos.

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

export const MENSAGEM_DISPARO_VAGAS_PADRAO =
`🚀 *VEM PRO NOSSO TIME!* 🚀

Estamos com vagas abertas e queremos você com a gente! 💼

📝 Cadastre seu currículo aqui:
{link}

É rápido e fácil. Esperamos por você! 🧡`;

interface GrupoDisparo { id: string; nome?: string; }

export class DisparoVagasWhatsService {
  static async getGrupos(): Promise<GrupoDisparo[]> {
    const raw = await ConfigurationService.get('whatsapp_disparo_vagas_grupos', '[]');
    try {
      const arr = JSON.parse(raw || '[]');
      return Array.isArray(arr) ? arr.filter((g: any) => g && g.id) : [];
    } catch { return []; }
  }

  static async getConfig() {
    const [grupos, intervaloRaw, mensagem, link, arteUrl, arteNome, arteMime] = await Promise.all([
      this.getGrupos(),
      ConfigurationService.get('whatsapp_disparo_vagas_intervalo', '5'),
      ConfigurationService.get('whatsapp_disparo_vagas_mensagem', ''),
      ConfigurationService.get('whatsapp_disparo_vagas_link', ''),
      ConfigurationService.get('whatsapp_disparo_vagas_arte_url', ''),
      ConfigurationService.get('whatsapp_disparo_vagas_arte_nome', ''),
      ConfigurationService.get('whatsapp_disparo_vagas_arte_mime', ''),
    ]);
    const intervalo = Math.max(1, parseInt(String(intervaloRaw || '5'), 10) || 5);
    return {
      grupos,
      intervalo,
      mensagem: (mensagem && mensagem.trim()) ? mensagem : MENSAGEM_DISPARO_VAGAS_PADRAO,
      link: link || '',
      arteUrl: arteUrl || '',
      arteNome: arteNome || 'vagas',
      arteMime: arteMime || '',
    };
  }

  static buildTexto(mensagem: string, link: string): string {
    return (mensagem || '').replace(/\{link\}/gi, link || '');
  }

  // teste=true → manda so pro 1o grupo. force pra ignorar config vazia.
  static async enviar(teste = false): Promise<{ enviados: number; total: number }> {
    const { grupos, intervalo, mensagem, link, arteUrl, arteNome, arteMime } = await this.getConfig();
    if (!grupos.length) throw new Error('Nenhum grupo configurado pro disparo.');
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API não configurada (URL, Token e Instância).');

    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    const texto = this.buildTexto(mensagem, link);
    const alvos = teste ? grupos.slice(0, 1) : grupos;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // imagem (png/jpg/...) vai ABERTA com a mensagem de LEGENDA (texto abaixo, 1 msg).
    // PDF/outros vão como documento, com o texto numa mensagem separada antes.
    const ehImagem = (arteMime || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(arteNome);

    const sendText = (num: string) => axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`,
      { number: num, text: texto }, { headers, timeout: 20000 });
    const sendImagem = (num: string) => axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
      { number: num, mediatype: 'image', mimetype: arteMime || 'image/png', media: arteUrl, fileName: arteNome, caption: texto },
      { headers, timeout: 60000 });
    const sendDoc = (num: string) => axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
      { number: num, mediatype: 'document', mimetype: arteMime || 'application/pdf', media: arteUrl, fileName: arteNome, caption: '' },
      { headers, timeout: 60000 });

    let enviados = 0;
    for (let i = 0; i < alvos.length; i++) {
      const g = alvos[i];
      try {
        if (arteUrl && ehImagem) {
          await sendImagem(g.id);            // imagem aberta + legenda (texto abaixo)
        } else {
          await sendText(g.id);
          if (arteUrl) await sendDoc(g.id);  // PDF como documento
        }
        enviados++;
      } catch (e: any) {
        console.error(`[disparo-vagas] falha no grupo ${g.id}:`, e.response?.data?.message || e.message);
      }
      // intervalo anti-ban entre um grupo e outro (nao espera depois do ultimo)
      if (i < alvos.length - 1) await sleep(intervalo * 1000);
    }
    return { enviados, total: alvos.length };
  }
}
