import { Request, Response } from 'express';
import axios from 'axios';
import { ConfigurationService } from '../services/configuration.service';

// Le a config da Evolution API salva nas configurations. O token e guardado
// CRIPTOGRAFADO; ConfigurationService.get() ja devolve descriptografado.
async function getEvoConfig() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

export class WhatsappController {
  // GET /api/whatsapp/connection-status — testa a conexao com a Evolution API
  static async connectionStatus(_req: Request, res: Response) {
    try {
      const { apiUrl, apiToken, instance } = await getEvoConfig();
      if (!apiUrl || !apiToken || !instance) {
        return res.json({
          success: false,
          connected: false,
          error: 'Configuracoes da Evolution API nao encontradas (preencha URL, Token e Instancia e Salve antes de testar)'
        });
      }
      const base = String(apiUrl).replace(/\/+$/, '');
      const url = `${base}/instance/connectionState/${encodeURIComponent(instance)}`;
      const resp = await axios.get(url, { headers: { apikey: apiToken }, timeout: 10000 });
      const state = resp.data?.instance?.state || 'unknown';
      return res.json({ success: true, connected: state === 'open', state, data: resp.data });
    } catch (error: any) {
      const status = error.response?.status;
      const detail = status === 404
        ? 'Instancia nao encontrada na Evolution API (confira o nome da Instancia)'
        : (error.response?.data?.message || error.message || 'erro desconhecido');
      console.error('[whatsapp] connection-status:', detail);
      return res.json({ success: false, connected: false, error: detail });
    }
  }
}
