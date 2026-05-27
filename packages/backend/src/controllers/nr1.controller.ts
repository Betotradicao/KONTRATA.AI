import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { gerarMaterialPdf } from '../services/nr1-materiais.service';

const TIPOS_MATERIAL = ['canal-denuncia', 'saude-mental', 'a-quem-recorrer', 'direitos-nr1'] as const;

export class Nr1Controller {
  /** Gera e devolve um PDF de material de conscientizacao personalizado. */
  static async gerarMaterial(req: AuthRequest, res: Response) {
    try {
      const tipo = req.params.tipo as typeof TIPOS_MATERIAL[number];
      if (!TIPOS_MATERIAL.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo invalido' });
      }
      const pdf = await gerarMaterialPdf(tipo);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="nr1-${tipo}.pdf"`);
      res.send(pdf);
    } catch (e: any) {
      console.error('[NR-1] gerarMaterial:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===== SUGESTOES (catalogo) =====

  /** Cria nova sugestao customizada (pelo cliente) */
  static async criarSugestao(req: AuthRequest, res: Response) {
    try {
      const { dimensao_nr1, titulo, descricao, categoria, prazo_sugerido_dias } = req.body;
      if (!dimensao_nr1 || !titulo || !descricao) {
        return res.status(400).json({ error: 'dimensao_nr1, titulo e descricao sao obrigatorios' });
      }
      // proxima ordem da dimensao
      const [{ max }] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS max FROM rh_nr1_sugestoes_acao WHERE dimensao_nr1 = $1::text`,
        [dimensao_nr1]
      );
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_nr1_sugestoes_acao (dimensao_nr1, titulo, descricao, categoria, prazo_sugerido_dias, ordem, ativa)
         VALUES ($1::text, $2::text, $3::text, $4::text, $5::int, $6::int, true)
         RETURNING *`,
        [dimensao_nr1, titulo, descricao, categoria || 'programa', prazo_sugerido_dias || null, max + 1]
      );
      res.status(201).json(row);
    } catch (e: any) {
      console.error('[NR-1] criarSugestao:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /** Lista todas sugestoes ativas, opcionalmente filtra por dimensao */
  static async listarSugestoes(req: AuthRequest, res: Response) {
    try {
      const dimensao = req.query.dimensao as string | undefined;
      const params: any[] = [];
      let where = 'WHERE ativa = true';
      if (dimensao) {
        params.push(dimensao);
        where += ` AND dimensao_nr1 = $${params.length}::text`;
      }
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_nr1_sugestoes_acao ${where} ORDER BY dimensao_nr1, ordem ASC`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[NR-1] listarSugestoes:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===== PLANOS DE ACAO =====

  /** Lista planos com filtros opcionais */
  static async listarPlanos(req: AuthRequest, res: Response) {
    try {
      const { status, dimensao } = req.query;
      const params: any[] = [];
      const wheres: string[] = [];
      if (status) {
        params.push(status);
        wheres.push(`p.status = $${params.length}::text`);
      }
      if (dimensao) {
        params.push(dimensao);
        wheres.push(`p.dimensao_nr1 = $${params.length}::text`);
      }
      const where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';
      const rows = await AppDataSource.query(
        `SELECT p.*, s.titulo AS sugestao_titulo, r.nome AS rodada_nome
         FROM rh_nr1_planos_acao p
         LEFT JOIN rh_nr1_sugestoes_acao s ON s.id = p.sugestao_id
         LEFT JOIN pesquisa_rodadas r ON r.id = p.rodada_id
         ${where}
         ORDER BY
           CASE p.status WHEN 'pendente' THEN 0 WHEN 'em_andamento' THEN 1 WHEN 'concluido' THEN 2 ELSE 3 END,
           p.prazo_data NULLS LAST,
           p.created_at DESC`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[NR-1] listarPlanos:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /** Cria plano de acao (a partir de sugestao ou do zero) */
  static async criarPlano(req: AuthRequest, res: Response) {
    try {
      const {
        sugestao_id, dimensao_nr1, titulo, descricao,
        setor_alvo, rodada_id, responsavel, prazo_data,
        status, observacoes,
      } = req.body;

      if (!dimensao_nr1 || !titulo) {
        return res.status(400).json({ error: 'dimensao_nr1 e titulo sao obrigatorios' });
      }

      const userId = (req as any).user?.id || (req as any).user?.username || null;

      const [row] = await AppDataSource.query(
        `INSERT INTO rh_nr1_planos_acao
           (sugestao_id, dimensao_nr1, titulo, descricao, setor_alvo, rodada_id, responsavel, prazo_data, status, observacoes, created_by)
         VALUES ($1::int, $2::text, $3::text, $4::text, $5::text, $6::int, $7::text, $8::date, $9::text, $10::text, $11::text)
         RETURNING *`,
        [
          sugestao_id || null,
          dimensao_nr1,
          titulo,
          descricao || null,
          setor_alvo || null,
          rodada_id || null,
          responsavel || null,
          prazo_data || null,
          status || 'pendente',
          observacoes || null,
          userId ? String(userId) : null,
        ]
      );
      res.status(201).json(row);
    } catch (e: any) {
      console.error('[NR-1] criarPlano:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /** Atualiza plano (qualquer campo) */
  static async atualizarPlano(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const {
        titulo, descricao, setor_alvo, responsavel,
        prazo_data, status, observacoes, evidencia_url,
      } = req.body;

      const concluiu = status === 'concluido';
      const [row] = await AppDataSource.query(
        `UPDATE rh_nr1_planos_acao SET
           titulo        = COALESCE($1::text, titulo),
           descricao     = COALESCE($2::text, descricao),
           setor_alvo    = COALESCE($3::text, setor_alvo),
           responsavel   = COALESCE($4::text, responsavel),
           prazo_data    = COALESCE($5::date, prazo_data),
           status        = COALESCE($6::text, status),
           observacoes   = COALESCE($7::text, observacoes),
           evidencia_url = COALESCE($8::text, evidencia_url),
           concluido_em  = CASE WHEN $9::boolean THEN NOW() ELSE concluido_em END,
           updated_at    = NOW()
         WHERE id = $10::int
         RETURNING *`,
        [
          titulo || null,
          descricao || null,
          setor_alvo || null,
          responsavel || null,
          prazo_data || null,
          status || null,
          observacoes || null,
          evidencia_url || null,
          concluiu,
          id,
        ]
      );
      if (!row) return res.status(404).json({ error: 'Plano nao encontrado' });
      res.json(row);
    } catch (e: any) {
      console.error('[NR-1] atualizarPlano:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /** Deleta plano */
  static async deletarPlano(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(
        `DELETE FROM rh_nr1_planos_acao WHERE id = $1::int RETURNING id`,
        [id]
      );
      if (!r[0]) return res.status(404).json({ error: 'Plano nao encontrado' });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[NR-1] deletarPlano:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
