import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Ficha de Admissão — RH preenche dados de contratação na 1ª fase, gera link
 * público pro candidato completar dados pessoais (FASE B), e depois converte
 * em colaborador.
 */
export class RhFichasAdmissaoController {
  // GET /rh/fichas-admissao
  static async listar(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT f.*,
                COALESCE(e.apelido, e.nome_fantasia, e.razao_social) AS empresa_nome,
                c.nome AS cargo_nome,
                s.nome AS departamento_nome
         FROM rh_fichas_admissao f
         LEFT JOIN rh_empresas e ON e.id = f.company_id
         LEFT JOIN rh_cargos c ON c.id = f.cargo_id
         LEFT JOIN rh_departamentos s ON s.id = f.departamento_id
         ORDER BY f.created_at DESC`
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[FichasAdmissao] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // GET /rh/fichas-admissao/:id
  static async obter(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [row] = await AppDataSource.query(
        `SELECT * FROM rh_fichas_admissao WHERE id = $1`,
        [id]
      );
      if (!row) return res.status(404).json({ error: 'Ficha não encontrada' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/fichas-admissao
  static async criar(req: AuthRequest, res: Response) {
    try {
      const b = req.body || {};
      if (!b.candidato_nome || !String(b.candidato_nome).trim()) {
        return res.status(400).json({ error: 'Nome do candidato é obrigatório' });
      }
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_fichas_admissao (
           company_id, candidato_nome, candidato_email, candidato_celular,
           data_admissao, cargo_id, departamento_id, jornada_id, escala_id, escala_domingo_id,
           regime_trabalho_id, prazo_experiencia_id, forma_pagamento_id, salario,
           horario_entrada, horario_intervalo, horario_saida,
           primeiro_emprego, contribuicao_sindical, vale_transporte
         ) VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14,
           $15, $16, $17,
           $18, $19, $20
         ) RETURNING *`,
        [
          b.company_id || null, b.candidato_nome, b.candidato_email || null, b.candidato_celular || null,
          b.data_admissao || null, b.cargo_id || null, b.departamento_id || null, b.jornada_id || null, b.escala_id || null, b.escala_domingo_id || null,
          b.regime_trabalho_id || null, b.prazo_experiencia_id || null, b.forma_pagamento_id || null, b.salario || null,
          b.horario_entrada || null, b.horario_intervalo || null, b.horario_saida || null,
          !!b.primeiro_emprego, !!b.contribuicao_sindical, !!b.vale_transporte
        ]
      );
      res.status(201).json(row);
    } catch (e: any) {
      console.error('[FichasAdmissao] criar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/fichas-admissao/:id
  static async atualizar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const [row] = await AppDataSource.query(
        `UPDATE rh_fichas_admissao SET
           company_id            = COALESCE($1, company_id),
           candidato_nome        = COALESCE($2, candidato_nome),
           candidato_email       = COALESCE($3, candidato_email),
           candidato_celular     = COALESCE($4, candidato_celular),
           data_admissao         = COALESCE($5, data_admissao),
           cargo_id              = COALESCE($6, cargo_id),
           departamento_id             = COALESCE($7, departamento_id),
           jornada_id            = COALESCE($8, jornada_id),
           escala_id             = COALESCE($9, escala_id),
           escala_domingo_id     = COALESCE($10, escala_domingo_id),
           regime_trabalho_id    = COALESCE($11, regime_trabalho_id),
           prazo_experiencia_id  = COALESCE($12, prazo_experiencia_id),
           forma_pagamento_id    = COALESCE($13, forma_pagamento_id),
           salario               = COALESCE($14, salario),
           horario_entrada       = COALESCE($15, horario_entrada),
           horario_intervalo     = COALESCE($16, horario_intervalo),
           horario_saida         = COALESCE($17, horario_saida),
           primeiro_emprego      = COALESCE($18, primeiro_emprego),
           contribuicao_sindical = COALESCE($19, contribuicao_sindical),
           vale_transporte       = COALESCE($20, vale_transporte),
           status                = COALESCE($21, status),
           updated_at            = NOW()
         WHERE id = $22 RETURNING *`,
        [
          b.company_id ?? null, b.candidato_nome ?? null, b.candidato_email ?? null, b.candidato_celular ?? null,
          b.data_admissao ?? null, b.cargo_id ?? null, b.departamento_id ?? null, b.jornada_id ?? null, b.escala_id ?? null, b.escala_domingo_id ?? null,
          b.regime_trabalho_id ?? null, b.prazo_experiencia_id ?? null, b.forma_pagamento_id ?? null, b.salario ?? null,
          b.horario_entrada ?? null, b.horario_intervalo ?? null, b.horario_saida ?? null,
          typeof b.primeiro_emprego === 'boolean' ? b.primeiro_emprego : null,
          typeof b.contribuicao_sindical === 'boolean' ? b.contribuicao_sindical : null,
          typeof b.vale_transporte === 'boolean' ? b.vale_transporte : null,
          b.status ?? null,
          id
        ]
      );
      if (!row) return res.status(404).json({ error: 'Ficha não encontrada' });
      res.json(row);
    } catch (e: any) {
      console.error('[FichasAdmissao] atualizar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // DELETE /rh/fichas-admissao/:id
  static async deletar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.query(`DELETE FROM rh_fichas_admissao WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/fichas-admissao/:id/gerar-link — marca status=aguardando_candidato e retorna o token.
  // Faz UPDATE + SELECT separados: UPDATE...RETURNING via AppDataSource.query() retorna [rows, count]
  // no TypeORM 0.3+, o que quebra o destructure `[row] = ...` (vinha array em vez do row).
  static async gerarLink(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [exists] = await AppDataSource.query(
        `SELECT id FROM rh_fichas_admissao WHERE id = $1`, [id]
      );
      if (!exists) return res.status(404).json({ error: 'Ficha não encontrada' });

      await AppDataSource.query(
        `UPDATE rh_fichas_admissao
            SET status = CASE WHEN status = 'rascunho' THEN 'aguardando_candidato' ELSE status END,
                sent_to_candidate_at = COALESCE(sent_to_candidate_at, NOW()),
                updated_at = NOW()
          WHERE id = $1`,
        [id]
      );

      const [row] = await AppDataSource.query(
        `SELECT id, public_token, status FROM rh_fichas_admissao WHERE id = $1`,
        [id]
      );
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}
