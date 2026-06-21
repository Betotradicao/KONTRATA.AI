import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { CLAUSULAS_PADRAO } from '../data/contrato-clausulas-padrao';

// Cláusulas do Contrato de Trabalho, configuradas POR CARGO (função).
// Cada cargo já nasce com as 14 padrão (auto-seed / migration). O RH edita,
// exclui ou cria novas POR CARGO. Aceitam variáveis $...$.

export const BIBLIOTECA_CLAUSULAS = CLAUSULAS_PADRAO;

export class ContratoClausulasController {
  // GET /rh/contrato/clausulas/biblioteca — as 14 cláusulas padrão (pra "Acrescentar")
  static async biblioteca(_req: AuthRequest, res: Response) {
    res.json(BIBLIOTECA_CLAUSULAS.map((c, i) => ({ idx: i, ...c })));
  }

  // GET /rh/contrato/clausulas?cargoId= — cláusulas configuradas de um cargo
  static async listar(req: AuthRequest, res: Response) {
    try {
      const cargoId = req.query.cargoId ? parseInt(req.query.cargoId as string) : null;
      if (!cargoId) return res.json([]);
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_contrato_clausulas WHERE cargo_id = $1 AND ativo = true ORDER BY ordem, id`,
        [cargoId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[ContratoClausulas] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/contrato/clausulas { cargoId, titulo, conteudo }
  static async criar(req: AuthRequest, res: Response) {
    try {
      const { cargoId, titulo, conteudo } = req.body;
      if (!cargoId || !conteudo) return res.status(400).json({ error: 'cargoId e conteudo obrigatorios' });
      const [{ max }] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS max FROM rh_contrato_clausulas WHERE cargo_id = $1`,
        [cargoId]
      );
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_contrato_clausulas (cargo_id, titulo, conteudo, ordem) VALUES ($1, $2, $3, $4) RETURNING *`,
        [cargoId, titulo || '', conteudo, max + 1]
      );
      res.status(201).json(row);
    } catch (e: any) {
      console.error('[ContratoClausulas] criar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/contrato/clausulas/add-biblioteca { cargoId, idxs: number[] }
  // Acrescenta cláusulas da biblioteca ao cargo (copia o texto, fica editável).
  static async addBiblioteca(req: AuthRequest, res: Response) {
    try {
      const { cargoId, idxs } = req.body;
      if (!cargoId || !Array.isArray(idxs) || !idxs.length) return res.status(400).json({ error: 'cargoId e idxs obrigatorios' });
      const [{ max }] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS max FROM rh_contrato_clausulas WHERE cargo_id = $1`,
        [cargoId]
      );
      let ordem = max;
      const criadas: any[] = [];
      for (const idx of idxs) {
        const b = BIBLIOTECA_CLAUSULAS[idx];
        if (!b) continue;
        ordem += 1;
        const [row] = await AppDataSource.query(
          `INSERT INTO rh_contrato_clausulas (cargo_id, titulo, conteudo, ordem) VALUES ($1, $2, $3, $4) RETURNING *`,
          [cargoId, b.titulo, b.conteudo, ordem]
        );
        criadas.push(row);
      }
      res.status(201).json(criadas);
    } catch (e: any) {
      console.error('[ContratoClausulas] addBiblioteca:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/contrato/clausulas/:id { titulo, conteudo, ordem }
  static async atualizar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { titulo, conteudo, ordem } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_contrato_clausulas SET
           titulo = COALESCE($1, titulo),
           conteudo = COALESCE($2, conteudo),
           ordem = COALESCE($3, ordem),
           updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [titulo ?? null, conteudo ?? null, ordem ?? null, id]
      );
      if (!row) return res.status(404).json({ error: 'Cláusula não encontrada' });
      res.json(row);
    } catch (e: any) {
      console.error('[ContratoClausulas] atualizar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/contrato/clausulas/reordenar { ordem: [{id, ordem}] }
  static async reordenar(req: AuthRequest, res: Response) {
    try {
      const { ordem } = req.body;
      if (!Array.isArray(ordem)) return res.status(400).json({ error: 'ordem array obrigatorio' });
      for (const o of ordem) {
        await AppDataSource.query(`UPDATE rh_contrato_clausulas SET ordem = $1, updated_at = NOW() WHERE id = $2`, [o.ordem, o.id]);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('[ContratoClausulas] reordenar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // DELETE /rh/contrato/clausulas/:id — soft delete (deixa rastro pra não re-semear)
  static async deletar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.query(`UPDATE rh_contrato_clausulas SET ativo = false, updated_at = NOW() WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[ContratoClausulas] deletar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/contrato/clausulas/ensure/:cargoId
  // Garante que o cargo já tenha cláusulas: se NUNCA teve nenhuma (cargo novo),
  // semeia as 14 padrão (editáveis/excluíveis depois). Não re-semeia se o cargo
  // já foi mexido (mesmo que todas tenham sido excluídas) — respeita a escolha do RH.
  static async ensureSeed(req: AuthRequest, res: Response) {
    try {
      const cargoId = parseInt(req.params.cargoId);
      if (!cargoId) return res.status(400).json({ error: 'cargoId obrigatorio' });
      const [{ total }] = await AppDataSource.query(
        `SELECT COUNT(*)::int AS total FROM rh_contrato_clausulas WHERE cargo_id = $1`, [cargoId]
      );
      if (total === 0) {
        let ordem = 0;
        for (const b of BIBLIOTECA_CLAUSULAS) {
          ordem += 1;
          await AppDataSource.query(
            `INSERT INTO rh_contrato_clausulas (cargo_id, titulo, conteudo, ordem) VALUES ($1, $2, $3, $4)`,
            [cargoId, b.titulo, b.conteudo, ordem]
          );
        }
      }
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_contrato_clausulas WHERE cargo_id = $1 AND ativo = true ORDER BY ordem, id`, [cargoId]
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[ContratoClausulas] ensureSeed:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
