import { Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database';

// Le a config da Evolution API salva na tabela configurations
async function getEvoConfig() {
  const rows = await AppDataSource.query(
    `SELECT key, value FROM configurations WHERE key IN ('evolution_api_url','evolution_api_token','evolution_instance')`
  );
  const m: Record<string, string> = {};
  (rows || []).forEach((r: any) => { m[r.key] = r.value; });
  return { apiUrl: m.evolution_api_url, apiToken: m.evolution_api_token, instance: m.evolution_instance };
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
