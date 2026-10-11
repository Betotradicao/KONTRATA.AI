import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AtendenteVirtualService } from '../services/atendente-virtual.service';

export class AtendenteVirtualController {
  /**
   * POST /api/atendente-virtual/webhook  — PÚBLICO
   * A Evolution chama aqui a cada mensagem recebida.
   *
   * Responde 200 IMEDIATAMENTE e processa depois: a Evolution reenvia o webhook
   * se demorar, e o cliente receberia a mesma resposta duas vezes.
   */
  static async webhook(req: Request, res: Response) {
    res.json({ ok: true });
    try {
      await AtendenteVirtualService.processar(req.body);
    } catch (e: any) {
      console.error('[atendente] webhook:', e.message);
    }
  }

  /**
   * POST /api/atendente-virtual/configurar-webhook
   * Registra na Evolution o endereço que ela deve chamar a cada mensagem.
   * A URL pública sai do próprio pedido — cada cliente tem seu subdomínio.
   */
  static async configurarWebhook(req: Request, res: Response) {
    try {
      const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const base = req.body?.urlPublica || `${proto}://${host}`;
      const r = await AtendenteVirtualService.configurarWebhook(base);
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ ok: false, erro: e.message });
    }
  }

  // GET /api/atendente-virtual/config
  static async obter(_req: Request, res: Response) {
    try {
      const cfg = await AtendenteVirtualService.obterConfig();
      res.json(cfg || {});
    } catch (e: any) {
      console.error('[atendente] obter:', e.message);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /api/atendente-virtual/config
  static async salvar(req: Request, res: Response) {
    const b = req.body || {};
    try {
      // Normaliza as opções: número e rótulo obrigatórios, passos sempre lista.
      const opcoes = Array.isArray(b.opcoes) ? b.opcoes : [];
      const limpas = opcoes
        .filter((o: any) => String(o?.numero || '').trim() && String(o?.label || '').trim())
        .map((o: any) => ({
          numero: String(o.numero).trim(),
          label: String(o.label).trim(),
          passos: (Array.isArray(o.passos) ? o.passos : [])
            .filter((p: any) => p && String(p.texto || '').trim())
            .map((p: any) => ({
              tipo: ['texto', 'pergunta', 'atendente', 'encerrar'].includes(p.tipo) ? p.tipo : 'texto',
              texto: String(p.texto),
              palavra_chave: p.tipo === 'pergunta' ? String(p.palavra_chave || '').trim() : undefined,
            })),
        }));

      // Número repetido faria a segunda opção nunca ser alcançada.
      const numeros = limpas.map((o: any) => o.numero);
      const repetido = numeros.find((n: string, i: number) => numeros.indexOf(n) !== i);
      if (repetido) {
        return res.status(400).json({ error: `A opção "${repetido}" está repetida. Cada número só pode aparecer uma vez.` });
      }

      const [row] = await AppDataSource.query(
        `UPDATE atendente_config SET
           ativo = COALESCE($1, ativo),
           mensagem_primeira_vez = $2,
           mensagem_recorrente = $3,
           texto_menu = $4,
           mensagem_nao_entendi = $5,
           intervalo_menu_horas = COALESCE($6, intervalo_menu_horas),
           simular_digitando = COALESCE($8, simular_digitando),
           segundos_espera = COALESCE($9, segundos_espera),
           opcoes = $7::jsonb,
           updated_at = now()
         WHERE id = (SELECT id FROM atendente_config ORDER BY id LIMIT 1)
         RETURNING *`,
        [
          typeof b.ativo === 'boolean' ? b.ativo : null,
          b.mensagem_primeira_vez ?? null,
          b.mensagem_recorrente ?? null,
          b.texto_menu ?? null,
          b.mensagem_nao_entendi ?? null,
          b.intervalo_menu_horas ?? null,
          JSON.stringify(limpas),
          typeof b.simular_digitando === 'boolean' ? b.simular_digitando : null,
          b.segundos_espera ?? null,
        ]
      );
      res.json(row);
    } catch (e: any) {
      console.error('[atendente] salvar:', e.message);
      res.status(500).json({ error: e.message });
    }
  }

  /**
   * GET /api/atendente-virtual/sessoes
   * Quem está conversando e quem está esperando atendimento humano.
   */
  static async sessoes(_req: Request, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT telefone, nome, com_atendente, ja_conversou, ultima_mensagem_em, ultimo_menu_em
         FROM atendente_sessoes
         ORDER BY ultima_mensagem_em DESC NULLS LAST
         LIMIT 100`
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** POST /api/atendente-virtual/sessoes/:telefone/devolver-ao-bot */
  static async devolverAoBot(req: Request, res: Response) {
    try {
      await AppDataSource.query(
        `UPDATE atendente_sessoes
            SET com_atendente = false, opcao_numero = NULL, passo_indice = 0,
                aguardando_palavra = NULL, ultimo_menu_em = NULL
          WHERE telefone = $1`,
        [req.params.telefone]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}
