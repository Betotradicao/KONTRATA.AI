import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

// CRUD do TEMPLATE centralizado de pastas/subpastas de documentacao.
// Configurado em "Configuracoes RH -> Documentacao Padronizada" e replicado
// pra todo colaborador novo automaticamente (ver criarColaborador).
export class RhDocTemplateController {
  // GET /rh/doc-template/pastas — lista pastas template ordenadas + qtd de subpastas
  static async listarPastas(_req: Request, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT p.id, p.nome, p.ordem, p.obrigatoria, p.protegida,
               (SELECT COUNT(*)::int FROM rh_documento_subpastas_template s WHERE s.pasta_template_id = p.id) AS qtd_subpastas
          FROM rh_documento_pastas_template p
         ORDER BY p.ordem, p.nome
      `);
      res.json(rows);
    } catch (e: any) {
      console.error('[DocTemplate] listarPastas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // GET /rh/doc-template/pastas/:id/subpastas
  static async listarSubpastas(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const rows = await AppDataSource.query(
        `SELECT id, nome, ordem, obrigatoria FROM rh_documento_subpastas_template
          WHERE pasta_template_id = $1 ORDER BY ordem, nome`,
        [id]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[DocTemplate] listarSubpastas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/doc-template/pastas { nome, obrigatoria, replicar }
  // Se replicar=true, cria a pasta em TODOS colaboradores ativos.
  static async criarPasta(req: Request, res: Response) {
    try {
      const nome = String(req.body?.nome || '').trim().toUpperCase();
      if (!nome) return res.status(400).json({ error: 'Nome obrigatorio' });
      const obrigatoria = req.body?.obrigatoria !== false;
      const replicar = !!req.body?.replicar;
      // Pega proxima ordem (max + 1, garantindo nao colidir com protegidas 1-9)
      const [maxOrdem] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS m FROM rh_documento_pastas_template`
      );
      const ordem = (maxOrdem?.m || 0) + 1;
      const [pasta] = await AppDataSource.query(
        `INSERT INTO rh_documento_pastas_template (nome, ordem, obrigatoria, protegida)
         VALUES ($1, $2, $3, false)
         RETURNING *`,
        [nome, ordem, obrigatoria]
      );
      let replicadas = 0;
      if (replicar) {
        const r = await AppDataSource.query(
          `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
           SELECT c.id, $1::text, $2::int, false
             FROM rh_colaboradores c
            WHERE c.status = 'ativo'
           ON CONFLICT (colaborador_id, nome) DO NOTHING
           RETURNING id`,
          [nome, ordem]
        );
        replicadas = r?.length ?? 0;
      }
      res.status(201).json({ pasta, replicadas });
    } catch (e: any) {
      console.error('[DocTemplate] criarPasta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/doc-template/pastas/:id { nome?, obrigatoria?, ordem? }
  static async atualizarPasta(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [atual] = await AppDataSource.query(`SELECT * FROM rh_documento_pastas_template WHERE id = $1`, [id]);
      if (!atual) return res.status(404).json({ error: 'Pasta nao encontrada' });
      const novoNome = req.body?.nome ? String(req.body.nome).trim().toUpperCase() : atual.nome;
      const novaObr = req.body?.obrigatoria != null ? !!req.body.obrigatoria : atual.obrigatoria;
      const novaOrdem = req.body?.ordem != null ? Number(req.body.ordem) : atual.ordem;
      const [row] = await AppDataSource.query(
        `UPDATE rh_documento_pastas_template
            SET nome = $1, obrigatoria = $2, ordem = $3, updated_at = NOW()
          WHERE id = $4 RETURNING *`,
        [novoNome, novaObr, novaOrdem, id]
      );
      res.json(row);
    } catch (e: any) {
      console.error('[DocTemplate] atualizarPasta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // DELETE /rh/doc-template/pastas/:id
  static async deletarPasta(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [atual] = await AppDataSource.query(`SELECT protegida FROM rh_documento_pastas_template WHERE id = $1`, [id]);
      if (!atual) return res.status(404).json({ error: 'Pasta nao encontrada' });
      if (atual.protegida) return res.status(400).json({ error: 'Pasta protegida (obrigatoria do sistema). Nao pode ser excluida.' });
      await AppDataSource.query(`DELETE FROM rh_documento_pastas_template WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[DocTemplate] deletarPasta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/doc-template/pastas/:id/subpastas { nome, obrigatoria, replicar }
  static async criarSubpasta(req: Request, res: Response) {
    try {
      const pastaId = parseInt(req.params.id);
      const nome = String(req.body?.nome || '').trim().toUpperCase();
      if (!nome) return res.status(400).json({ error: 'Nome obrigatorio' });
      const obrigatoria = req.body?.obrigatoria !== false;
      const replicar = !!req.body?.replicar;
      const [pastaTpl] = await AppDataSource.query(`SELECT id, nome FROM rh_documento_pastas_template WHERE id = $1`, [pastaId]);
      if (!pastaTpl) return res.status(404).json({ error: 'Pasta template nao encontrada' });
      const [maxOrdem] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS m FROM rh_documento_subpastas_template WHERE pasta_template_id = $1`,
        [pastaId]
      );
      const ordem = (maxOrdem?.m || 0) + 1;
      const [sub] = await AppDataSource.query(
        `INSERT INTO rh_documento_subpastas_template (pasta_template_id, nome, ordem, obrigatoria)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [pastaId, nome, ordem, obrigatoria]
      );
      let replicadas = 0;
      if (replicar) {
        // Pra cada colaborador ativo, garante a pasta pai existe e cria a subpasta.
        const colabs = await AppDataSource.query(`
          SELECT dp.id AS pasta_id
            FROM rh_colaboradores c
            JOIN rh_documento_pastas dp ON dp.colaborador_id = c.id AND dp.nome = $1
           WHERE c.status = 'ativo'
        `, [pastaTpl.nome]);
        for (const cp of colabs) {
          const r = await AppDataSource.query(
            `INSERT INTO rh_documento_subpastas (pasta_id, nome, ordem, obrigatorio)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (pasta_id, nome) DO NOTHING
             RETURNING id`,
            [cp.pasta_id, nome, ordem, obrigatoria]
          );
          if (r?.length) replicadas++;
        }
      }
      res.status(201).json({ subpasta: sub, replicadas });
    } catch (e: any) {
      console.error('[DocTemplate] criarSubpasta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/doc-template/subpastas/:id
  static async atualizarSubpasta(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [atual] = await AppDataSource.query(`SELECT * FROM rh_documento_subpastas_template WHERE id = $1`, [id]);
      if (!atual) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      const novoNome = req.body?.nome ? String(req.body.nome).trim().toUpperCase() : atual.nome;
      const novaObr = req.body?.obrigatoria != null ? !!req.body.obrigatoria : atual.obrigatoria;
      const novaOrdem = req.body?.ordem != null ? Number(req.body.ordem) : atual.ordem;
      const [row] = await AppDataSource.query(
        `UPDATE rh_documento_subpastas_template
            SET nome = $1, obrigatoria = $2, ordem = $3, updated_at = NOW()
          WHERE id = $4 RETURNING *`,
        [novoNome, novaObr, novaOrdem, id]
      );
      res.json(row);
    } catch (e: any) {
      console.error('[DocTemplate] atualizarSubpasta:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/doc-template/sincronizar
  // Replica TODO o template nos colaboradores ativos: cria as pastas que
  // estao faltando + cria as subpastas obrigatorias que estao faltando.
  // Idempotente: nao duplica nada que ja existe.
  static async sincronizarTudo(_req: Request, res: Response) {
    try {
      // 1) Cria pastas template que faltam nos colaboradores ativos
      const pastasTpl = await AppDataSource.query(
        `SELECT id, nome, ordem, protegida FROM rh_documento_pastas_template
          WHERE obrigatoria = true ORDER BY ordem`
      );
      let pastasCriadas = 0;
      let subsCriadas = 0;
      for (const pt of pastasTpl) {
        const r = await AppDataSource.query(
          `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
           SELECT c.id, $1::text, $2::int, $3::boolean
             FROM rh_colaboradores c
            WHERE c.status = 'ativo'
              AND NOT EXISTS (SELECT 1 FROM rh_documento_pastas p
                              WHERE p.colaborador_id = c.id AND UPPER(p.nome) = UPPER($1::text))
           RETURNING id`,
          [pt.nome, pt.ordem, pt.protegida]
        );
        pastasCriadas += r?.length || 0;

        // 2) Pra cada subpasta obrigatoria do template, replica nos colabs
        const subsTpl = await AppDataSource.query(
          `SELECT nome, ordem, obrigatoria FROM rh_documento_subpastas_template
            WHERE pasta_template_id = $1 AND obrigatoria = true
            ORDER BY ordem`,
          [pt.id]
        );
        for (const sub of subsTpl) {
          const r2 = await AppDataSource.query(
            `INSERT INTO rh_documento_subpastas (pasta_id, nome, ordem, obrigatorio)
             SELECT dp.id, $1::text, $2::int, $3::boolean
               FROM rh_documento_pastas dp
               JOIN rh_colaboradores c ON c.id = dp.colaborador_id
              WHERE c.status = 'ativo'
                AND UPPER(dp.nome) = UPPER($4::text)
                AND NOT EXISTS (SELECT 1 FROM rh_documento_subpastas s
                                WHERE s.pasta_id = dp.id AND UPPER(s.nome) = UPPER($1::text))
             RETURNING id`,
            [sub.nome, sub.ordem, sub.obrigatoria, pt.nome]
          );
          subsCriadas += r2?.length || 0;
        }
      }
      res.json({ success: true, pastasCriadas, subsCriadas });
    } catch (e: any) {
      console.error('[DocTemplate] sincronizarTudo:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // DELETE /rh/doc-template/subpastas/:id
  static async deletarSubpasta(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM rh_documento_subpastas_template WHERE id = $1 RETURNING id`, [id]);
      if (!r.length) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[DocTemplate] deletarSubpasta:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
