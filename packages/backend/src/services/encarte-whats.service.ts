import axios from 'axios';
import { ConfigurationService } from './configuration.service';

/**
 * ENVIO DO ENCARTE PRO WHATSAPP
 * -----------------------------
 * Manda a(s) arte(s) geradas no Padrao de Encarte pros grupos escolhidos em
 * Configuracoes de Rede -> Grupos WhatsApp -> Encartes de Vaga.
 *
 * Mesmo motor do disparo-vagas (Evolution API + intervalo anti-ban entre grupos),
 * mas com config PROPRIA: o disparo de vagas e agendado e periodico; o encarte e
 * manual e pontual, e o RH pode querer mandar pra grupos diferentes.
 */

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

export type GrupoWhats = { id: string; nome?: string };

export class EncarteWhatsService {
  static async getConfig() {
    const [rawGrupos, rawIntervalo, legendaPadrao] = await Promise.all([
      ConfigurationService.get('whatsapp_encarte_grupos', '[]'),
      ConfigurationService.get('whatsapp_encarte_intervalo', '5'),
      ConfigurationService.get('whatsapp_encarte_legenda', ''),
    ]);

    let grupos: GrupoWhats[] = [];
    try {
      const p = JSON.parse(rawGrupos || '[]');
      if (Array.isArray(p)) grupos = p.filter((g) => g && g.id);
    } catch { grupos = []; }

    const intervalo = Math.max(1, parseInt(String(rawIntervalo || '5'), 10) || 5);
    return { grupos, intervalo, legendaPadrao };
  }

  /**
   * Envia as imagens pros grupos configurados.
   *
   * ⚠️ A legenda vai SO na primeira imagem. Repetir o mesmo texto em cada arte
   * polui o grupo e aumenta a chance de o WhatsApp tratar como spam.
   */
  static async enviar(urls: string[], legenda?: string, apenasPrimeiroGrupo = false) {
    const imagens = (urls || []).filter((u) => typeof u === 'string' && u.trim());
    if (!imagens.length) throw new Error('Nenhuma imagem para enviar.');

    const { grupos, intervalo, legendaPadrao } = await this.getConfig();
    if (!grupos.length) {
      throw new Error('Nenhum grupo configurado. Vá em Configurações de Rede → Grupos WhatsApp → Encartes de Vaga.');
    }

    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) {
      throw new Error('Evolution API não configurada (URL, Token e Instância).');
    }

    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    const texto = (legenda ?? legendaPadrao ?? '').toString();
    const alvos = apenasPrimeiroGrupo ? grupos.slice(0, 1) : grupos;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const enviarImagem = (numero: string, media: string, caption: string, nome: string) =>
      axios.post(
        `${base}/message/sendMedia/${encodeURIComponent(instance)}`,
        { number: numero, mediatype: 'image', mimetype: 'image/png', media, fileName: nome, caption },
        { headers, timeout: 60000 }
      );

    let enviados = 0;
    const falhas: string[] = [];

    for (let i = 0; i < alvos.length; i++) {
      const g = alvos[i];
      try {
        for (let k = 0; k < imagens.length; k++) {
          await enviarImagem(g.id, imagens[k], k === 0 ? texto : '', `encarte-${k + 1}.png`);
          // respiro curto entre as artes do MESMO grupo
          if (k < imagens.length - 1) await sleep(1200);
        }
        enviados++;
      } catch (e: any) {
        const motivo = e.response?.data?.message || e.message;
        console.error(`[encarte-whats] falha no grupo ${g.id}:`, motivo);
        falhas.push(`${g.nome || g.id}: ${motivo}`);
      }
      // intervalo anti-ban entre um grupo e outro (nao espera depois do ultimo)
      if (i < alvos.length - 1) await sleep(intervalo * 1000);
    }

    return { enviados, total: alvos.length, imagens: imagens.length, falhas };
  }
}
