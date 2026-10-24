import { Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from '../services/configuration.service';
import { AuthRequest } from '../middleware/auth';
import { HoleriteImportacaoService } from '../services/holerite-importacao.service';
import { PortalColaboradorService } from '../services/portal-colaborador.service';
import { anexarComprovante } from '../services/comprovante-ciencia.service';
import { gerarDossie } from '../services/dossie-holerites.service';
import { LembretesHoleriteService, TEXTO_PADRAO } from '../services/lembretes-holerite.service';

/**
 * RH → Holerites: importar PDF da contabilidade, classificar, publicar no Portal do
 * Colaborador e acompanhar ciência. Rotas em /api/rh/holerites/*.
 */

// Link que vai no WhatsApp. FRONTEND_URL é gravado pelo instalador (https://<cliente>);
// fallback pro host da requisição (dev: localhost:3010 → front em 3004).
export function baseUrlPortal(req: Request): string {
  const env = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const host = req.get('host') || 'localhost:3004';
  return `${req.protocol}://${host.replace(':3010', ':3004')}`;
}

const quemPublicou = (req: AuthRequest) => req.user?.username || req.user?.email || null;

export class RhHoleritesController {
  // ---- Lotes ----
  static async importar(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'Envie o PDF no campo "arquivo"' });
      if (!/pdf$/i.test(file.mimetype || '') && !/\.pdf$/i.test(file.originalname || '')) return res.status(400).json({ error: 'Só PDF' });
      const companyId = req.body?.company_id ? String(req.body.company_id) : null;
      // multer entrega o nome em latin1 ("TradiÃ§Ã£o") — volta pra UTF-8
      let nomeArquivo = file.originalname || 'holerites.pdf';
      try { nomeArquivo = Buffer.from(nomeArquivo, 'latin1').toString('utf8'); } catch { /* mantém */ }
      const lote = await HoleriteImportacaoService.importar(file.buffer, nomeArquivo, quemPublicou(req), companyId);
      return res.status(201).json(lote);
    } catch (e: any) {
      console.error('[Holerites] importar:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  static async listarLotes(_req: AuthRequest, res: Response) {
    try { res.json(await HoleriteImportacaoService.listarLotes((_req.query.company_id as string) || null)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async obterLote(req: AuthRequest, res: Response) {
    try {
      const lote = await HoleriteImportacaoService.obterLote(Number(req.params.id));
      if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
      res.json(lote);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async atualizarLote(req: AuthRequest, res: Response) {
    try {
      const row = await HoleriteImportacaoService.atualizarLote(Number(req.params.id), req.body || {});
      if (!row) return res.status(400).json({ error: 'Nada pra atualizar' });
      res.json(await HoleriteImportacaoService.obterLote(Number(req.params.id)));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async excluirLote(req: AuthRequest, res: Response) {
    try { await HoleriteImportacaoService.excluirLote(Number(req.params.id)); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async atualizarItem(req: AuthRequest, res: Response) {
    try {
      const row = await HoleriteImportacaoService.atualizarItem(Number(req.params.itemId), req.body || {});
      if (!row) return res.status(400).json({ error: 'Nada pra atualizar ou item já publicado' });
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** Preview do PDF fatiado (proxy do MinIO pra não expor a URL do bucket). */
  static async itemPdf(req: AuthRequest, res: Response) {
    try {
      const [it] = await AppDataSource.query(`SELECT arquivo_url, ordem FROM rh_holerite_lote_itens WHERE id = $1`, [Number(req.params.itemId)]);
      if (!it) return res.status(404).json({ error: 'Item não encontrado' });
      const r = await axios.get(it.arquivo_url, { responseType: 'arraybuffer', timeout: 30000 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="item_${it.ordem}.pdf"`);
      res.send(Buffer.from(r.data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async publicarLote(req: AuthRequest, res: Response) {
    try {
      const { item_ids, enviar_whats } = req.body || {};
      const ids = Array.isArray(item_ids) && item_ids.length ? item_ids.map(Number) : null;
      const out = await HoleriteImportacaoService.publicar(Number(req.params.id), ids, baseUrlPortal(req), quemPublicou(req), enviar_whats !== false);
      res.json({ resultados: out, lote: await HoleriteImportacaoService.obterLote(Number(req.params.id)) });
    } catch (e: any) {
      console.error('[Holerites] publicar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ---- Publicações / ciência ----
  static async listarPublicacoes(req: AuthRequest, res: Response) {
    try {
      const competencia = (req.query.competencia as string) || undefined;
      const colaboradorId = req.query.colaborador_id ? Number(req.query.colaborador_id) : undefined;
      const companyId = (req.query.company_id as string) || undefined;
      res.json(await PortalColaboradorService.listarPublicacoes(competencia, colaboradorId, companyId, req.query.excluidos === '1'));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  // ---- Lembretes pros pendentes ----
  static async lembretesConfig(_req: AuthRequest, res: Response) {
    try { res.json({ ...(await LembretesHoleriteService.getConfig()), texto_padrao: TEXTO_PADRAO }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async salvarLembretesConfig(req: AuthRequest, res: Response) {
    try { res.json({ ...(await LembretesHoleriteService.salvarConfig(req.body || {})), texto_padrao: TEXTO_PADRAO }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** Lembrete manual em lote (ids das publicações pendentes que estão na tela). */
  static async enviarLembretes(req: AuthRequest, res: Response) {
    try {
      const ids = Array.isArray(req.body?.aceite_ids) ? req.body.aceite_ids.map(Number).filter(Boolean) : [];
      if (!ids.length) return res.status(400).json({ error: 'Nenhum pendente selecionado' });
      res.json(await LembretesHoleriteService.enviarLote(ids, baseUrlPortal(req)));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** Exclui o envio (fica registrado em "Excluídos" com quem/quando/motivo). */
  static async excluir(req: AuthRequest, res: Response) {
    try {
      const motivo = String(req.body?.motivo || '').trim();
      if (motivo.length < 3) return res.status(400).json({ error: 'Informe o motivo da exclusão' });
      res.json(await PortalColaboradorService.excluirPublicacao(Number(req.params.id), quemPublicou(req), motivo));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async reenviar(req: AuthRequest, res: Response) {
    try { res.json(await PortalColaboradorService.reenviar(Number(req.params.id), baseUrlPortal(req))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** PDF do holerite + página do comprovante de ciência (pra imprimir/juntar em processo). */
  static async comprovante(req: AuthRequest, res: Response) {
    try {
      const [a] = await AppDataSource.query(
        `SELECT a.id, a.status, d.arquivo_url, d.nome FROM rh_documento_aceites a LEFT JOIN rh_documentos d ON d.id = a.documento_id WHERE a.id = $1`,
        [Number(req.params.id)]
      );
      if (!a?.arquivo_url) return res.status(404).json({ error: 'Documento não encontrado' });
      const r = await axios.get(a.arquivo_url, { responseType: 'arraybuffer', timeout: 30000 });
      const pdf = await anexarComprovante(a.id, Buffer.from(r.data));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="comprovante_${a.nome || 'holerite.pdf'}"`);
      res.send(pdf);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** ZIP "dossiê pra processo" de um colaborador (originais, assinados, trilha, termo, acessos). */
  static async dossie(req: AuthRequest, res: Response) {
    try {
      const { stream, fileName } = await gerarDossie(Number(req.params.colaboradorId), quemPublicou(req));
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      stream.pipe(res);
    } catch (e: any) {
      console.error('[Holerites] dossie:', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  }

  static async eventos(req: AuthRequest, res: Response) {
    try { res.json(await PortalColaboradorService.eventos(Number(req.params.id))); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** Holerite gerado pela Folha do sistema (alternativa à importação). */
  static async publicarGerado(req: AuthRequest, res: Response) {
    try {
      const { competencia, colaborador_ids, enviar_whats } = req.body || {};
      if (!/^\d{4}-\d{2}$/.test(competencia || '')) return res.status(400).json({ error: 'competencia YYYY-MM obrigatória' });
      if (!Array.isArray(colaborador_ids) || !colaborador_ids.length) return res.status(400).json({ error: 'colaborador_ids obrigatório' });
      res.json(await PortalColaboradorService.publicarGerado(competencia, colaborador_ids.map(Number), baseUrlPortal(req), quemPublicou(req), enviar_whats !== false));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  // ---- Acesso do colaborador (lado RH) ----
  /** Gera/renova o link de primeiro acesso (RH copia e manda por onde quiser). */
  static async linkAcesso(req: AuthRequest, res: Response) {
    try {
      const forcar = req.body?.resetar === true;
      res.json(await PortalColaboradorService.garantirAcesso(Number(req.params.colaboradorId), baseUrlPortal(req), forcar));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** Manda o link de acesso (sem holerite) no WhatsApp do colaborador. */
  static async enviarLinkAcesso(req: AuthRequest, res: Response) {
    try {
      const forcar = req.body?.resetar === true;
      res.json(await PortalColaboradorService.enviarLinkAcesso(Number(req.params.colaboradorId), baseUrlPortal(req), forcar));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** Bloqueia/libera manualmente o acesso ao portal (vale por cima da regra de desligamento). */
  static async bloquearAcesso(req: AuthRequest, res: Response) {
    try {
      const ativo = req.body?.bloquear !== true;
      await AppDataSource.query(
        `INSERT INTO rh_colaborador_acessos (colaborador_id, ativo) VALUES ($1, $2)
         ON CONFLICT (colaborador_id) DO UPDATE SET ativo = EXCLUDED.ativo, updated_at = NOW()`,
        [Number(req.params.colaboradorId), ativo]
      );
      res.json({ ok: true, ativo });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async acessos(req: AuthRequest, res: Response) {
    try {
      const dias = Math.max(0, parseInt(String(await ConfigurationService.get('portal_dias_acesso_desligado', '150')), 10) || 0);
      res.json(await AppDataSource.query(
        `SELECT c.id AS colaborador_id, c.nome, c.matricula, c.celular, c.status, c.data_desligamento,
                COALESCE(NULLIF(ac.foto_url, ''), NULLIF(c.foto_url, '')) AS foto_url,
                (c.data_desligamento + ($1::int * interval '1 day'))::date AS acesso_ate,
                (ac.senha_hash IS NOT NULL) AS tem_senha, ac.ultimo_login, ac.bloqueado_ate, ac.ativo,
                (ac.setup_token IS NOT NULL AND ac.setup_usado_em IS NULL AND ac.setup_expira_em > NOW()) AS setup_pendente
         FROM rh_colaboradores c LEFT JOIN rh_colaborador_acessos ac ON ac.colaborador_id = c.id
         WHERE (
                 ($3 = 'ativos'   AND c.status = 'ativo')
              OR ($3 = 'inativos' AND c.status <> 'ativo')
              OR ($3 = 'todos')
           )
           AND ($2::uuid IS NULL OR c.company_id = $2::uuid)
         ORDER BY (c.status = 'ativo') DESC, c.nome`,
        [dias, (req.query.company_id as string) || null,
         ['ativos', 'inativos', 'todos'].includes(String(req.query.situacao)) ? String(req.query.situacao) : 'ativos']
      ));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
}
