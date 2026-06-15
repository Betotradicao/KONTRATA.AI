import { Request, Response } from 'express';
import axios from 'axios';
import { ConfigurationService } from '../services/configuration.service';
import { VagasAbertasWhatsService } from '../services/vagas-abertas-whats.service';
import { AsoWhatsService } from '../services/aso-whats.service';
import { DenunciaWhatsService } from '../services/denuncia-whats.service';

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

  // GET /api/whatsapp/fetch-groups — lista os grupos da instancia (Carregar Grupos)
  static async fetchGroups(_req: Request, res: Response) {
    try {
      const { apiUrl, apiToken, instance } = await getEvoConfig();
      if (!apiUrl || !apiToken || !instance) {
        return res.json({ success: false, error: 'Configuracoes da Evolution API nao encontradas' });
      }
      const base = String(apiUrl).replace(/\/+$/, '');
      const url = `${base}/group/fetchAllGroups/${encodeURIComponent(instance)}?getParticipants=false`;
      const resp = await axios.get(url, { headers: { apikey: apiToken }, timeout: 20000 });
      return res.json({ success: true, data: resp.data });
    } catch (error: any) {
      const detail = error.response?.data?.message || error.message || 'erro ao buscar grupos';
      console.error('[whatsapp] fetch-groups:', detail);
      return res.json({ success: false, error: detail });
    }
  }

  // POST /api/whatsapp/test-group — envia mensagem de teste pra um grupo/numero
  static async testGroup(req: Request, res: Response) {
    try {
      const { groupId, message } = req.body || {};
      if (!groupId || !message) {
        return res.status(400).json({ success: false, error: 'groupId e message sao obrigatorios' });
      }
      const { apiUrl, apiToken, instance } = await getEvoConfig();
      if (!apiUrl || !apiToken || !instance) {
        return res.json({ success: false, error: 'Configuracoes da Evolution API nao encontradas' });
      }
      const base = String(apiUrl).replace(/\/+$/, '');
      const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;
      await axios.post(url, { number: groupId, text: message },
        { headers: { 'Content-Type': 'application/json', apikey: apiToken }, timeout: 20000 });
      return res.json({ success: true, message: 'Mensagem enviada' });
    } catch (error: any) {
      const detail = error.response?.data?.message || error.message || 'erro ao enviar mensagem';
      console.error('[whatsapp] test-group:', detail);
      return res.json({ success: false, error: detail });
    }
  }

  // POST /api/whatsapp/vagas-abertas/enviar — monta msg + PDF das vagas abertas e envia
  // pro grupo configurado (usado pelo botao "Testar Envio" e pelo cron semanal).
  static async enviarVagasAbertas(_req: Request, res: Response) {
    try {
      const r = await VagasAbertasWhatsService.enviar();
      return res.json({ success: true, message: `Enviado! ${r.total} vagas em aberto.`, total: r.total });
    } catch (error: any) {
      console.error('[whatsapp] vagas-abertas:', error.message);
      return res.json({ success: false, error: error.response?.data?.message || error.message || 'erro ao enviar' });
    }
  }

  // GET /api/whatsapp/vagas-abertas/preview — devolve o texto da msg (pra preview na tela)
  static async previewVagasAbertas(_req: Request, res: Response) {
    try {
      const resumo = await VagasAbertasWhatsService.getResumo();
      return res.json({ success: true, total: resumo.total, mensagem: VagasAbertasWhatsService.buildMensagem(resumo) });
    } catch (error: any) {
      return res.json({ success: false, error: error.message });
    }
  }

  // POST /api/whatsapp/aso/enviar — monta msg + PDF de ASO (vencidos + a vencer) e envia.
  static async enviarAso(_req: Request, res: Response) {
    try {
      const r = await AsoWhatsService.enviar();
      return res.json({ success: true, message: `Enviado! ${r.vencidos} vencido(s) e ${r.aVencer} a vencer.`, ...r });
    } catch (error: any) {
      console.error('[whatsapp] aso:', error.message);
      return res.json({ success: false, error: error.response?.data?.message || error.message || 'erro ao enviar' });
    }
  }

  // GET /api/whatsapp/aso/preview?antecedencia=45 — texto da msg pra preview na tela.
  static async previewAso(req: Request, res: Response) {
    try {
      const ant = req.query.antecedencia ? parseInt(req.query.antecedencia as string) : undefined;
      const rel = await AsoWhatsService.getRelatorio(ant);
      return res.json({
        success: true,
        vencidos: rel.vencidos.length,
        aVencer: rel.aVencer.length,
        mensagem: AsoWhatsService.buildMensagem(rel),
      });
    } catch (error: any) {
      return res.json({ success: false, error: error.message });
    }
  }

  // POST /api/whatsapp/denuncia-nr1/enviar — dispara uma denuncia de TESTE pro grupo.
  static async enviarDenunciaNr1(_req: Request, res: Response) {
    try {
      await DenunciaWhatsService.enviarTeste();
      return res.json({ success: true, message: 'Denúncia de teste enviada pro grupo (mensagem + PDF).' });
    } catch (error: any) {
      console.error('[whatsapp] denuncia-nr1:', error.message);
      return res.json({ success: false, error: error.response?.data?.message || error.message || 'erro ao enviar' });
    }
  }

  // GET /api/whatsapp/denuncia-nr1/preview — texto da msg pra preview na tela.
  static async previewDenunciaNr1(_req: Request, res: Response) {
    try {
      const empresa_nome = await ConfigurationService.get('client_brand_name', '');
      const mensagem = DenunciaWhatsService.buildMensagem({
        protocolo: 'DEN-20260601-AB12', tipo: 'assedio_moral', empresa_nome: empresa_nome || null,
      });
      return res.json({ success: true, mensagem });
    } catch (error: any) {
      return res.json({ success: false, error: error.message });
    }
  }
}
