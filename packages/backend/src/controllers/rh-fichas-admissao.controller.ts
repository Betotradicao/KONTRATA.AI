import { Request, Response } from 'express';
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

  // GET /rh/fichas-admissao/public/:token — ROTA PÚBLICA (sem auth)
  // Candidato abre o link e vê os dados que o RH pré-preencheu (read-only)
  // + estado atual dos dados pessoais (pra retomar preenchimento se quiser).
  static async obterPorToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const [row] = await AppDataSource.query(
        `SELECT f.id, f.candidato_nome, f.candidato_email, f.candidato_celular,
                f.data_admissao, f.salario, f.horario_entrada, f.horario_intervalo, f.horario_saida,
                f.primeiro_emprego, f.contribuicao_sindical, f.vale_transporte,
                f.status, f.candidato_dados,
                COALESCE(e.apelido, e.nome_fantasia, e.razao_social) AS empresa_nome,
                e.cnpj AS empresa_cnpj,
                c.nome AS cargo_nome,
                d.nome AS departamento_nome
         FROM rh_fichas_admissao f
         LEFT JOIN rh_empresas e ON e.id = f.company_id
         LEFT JOIN rh_cargos c ON c.id = f.cargo_id
         LEFT JOIN rh_departamentos d ON d.id = f.departamento_id
         WHERE f.public_token = $1`,
        [token]
      );
      if (!row) return res.status(404).json({ error: 'Ficha não encontrada' });
      if (row.status === 'cancelada') return res.status(410).json({ error: 'Esta ficha foi cancelada' });
      if (row.status === 'colaborador_criado') return res.status(410).json({ error: 'Esta ficha já foi processada' });
      res.json(row);
    } catch (e: any) {
      console.error('[FichasAdmissao] obterPorToken:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/fichas-admissao/public/:token — ROTA PÚBLICA (sem auth)
  // Candidato salva seus dados pessoais. Aceita JSON com qualquer estrutura
  // (guardamos como candidato_dados JSONB) + marca status=preenchida quando
  // o flag `finalizar` é true.
  static async salvarPorToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { dados, finalizar } = req.body || {};
      if (!dados || typeof dados !== 'object') {
        return res.status(400).json({ error: 'dados (objeto) é obrigatório' });
      }
      const [exists] = await AppDataSource.query(
        `SELECT id, status FROM rh_fichas_admissao WHERE public_token = $1`,
        [token]
      );
      if (!exists) return res.status(404).json({ error: 'Ficha não encontrada' });
      if (exists.status === 'cancelada' || exists.status === 'colaborador_criado') {
        return res.status(410).json({ error: 'Esta ficha não está aceitando edições' });
      }

      const novoStatus = finalizar ? 'preenchida' : exists.status;
      const filledAt = finalizar ? 'NOW()' : 'filled_by_candidate_at';

      await AppDataSource.query(
        `UPDATE rh_fichas_admissao
            SET candidato_dados = $1::jsonb,
                status = $2,
                filled_by_candidate_at = ${filledAt},
                updated_at = NOW()
          WHERE public_token = $3`,
        [JSON.stringify(dados), novoStatus, token]
      );

      const [row] = await AppDataSource.query(
        `SELECT status, filled_by_candidate_at FROM rh_fichas_admissao WHERE public_token = $1`,
        [token]
      );
      res.json(row);
    } catch (e: any) {
      console.error('[FichasAdmissao] salvarPorToken:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/fichas-admissao/:id/criar-colaborador — RH cria o rh_colaborador
  // a partir dos dados da ficha + candidato_dados. Marca a ficha como
  // 'colaborador_criado' e vincula via colaborador_id.
  static async criarColaborador(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [f] = await AppDataSource.query(
        `SELECT * FROM rh_fichas_admissao WHERE id = $1`, [id]
      );
      if (!f) return res.status(404).json({ error: 'Ficha não encontrada' });
      if (f.colaborador_id) return res.status(409).json({ error: 'Esta ficha já virou colaborador' });

      const dados = f.candidato_dados || {};
      const pess = dados.dados_pessoais || {};
      const end  = dados.endereco || {};
      const cont = dados.contato || {};
      const doc  = dados.documentos || {};
      const bnc  = dados.banco || {};

      // Insere colaborador com os campos coletados (ficha + candidato_dados).
      // Matrícula = id da ficha (fallback temporário; o RH pode trocar depois).
      const [novo] = await AppDataSource.query(
        `INSERT INTO rh_colaboradores (
           nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
           telefone, celular, email,
           cep, endereco, numero, complemento, bairro, cidade, estado,
           matricula, cargo_id, empresa_id, company_id, jornada_id, escolaridade_id,
           data_admissao, salario, status,
           vale_transporte,
           banco, agencia, conta, tipo_conta, pix,
           ctps, serie_ctps, pis_pasep, titulo_eleitor,
           nome_pai, nome_mae
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14, $15, $16, $17, $18,
           $19, $20, NULL, $21, $22, NULL,
           $23, $24, 'ativo',
           $25,
           $26, $27, $28, $29, $30,
           $31, $32, $33, $34,
           $35, $36
         ) RETURNING id`,
        [
          pess.nome || f.candidato_nome, pess.cpf || null, pess.rg || null,
          pess.data_nascimento || null, pess.sexo || null, pess.estado_civil || null,
          pess.nacionalidade || null, pess.naturalidade || null,
          cont.telefone || null, cont.celular || f.candidato_celular || null, cont.email || f.candidato_email || null,
          end.cep || null, end.rua || null, end.numero || null, end.complemento || null,
          end.bairro || null, end.cidade || null, end.estado || null,
          `FICHA-${id}`, f.cargo_id || null, f.company_id || null, f.jornada_id || null,
          f.data_admissao || null, f.salario || null,
          f.vale_transporte,
          bnc.banco || null, bnc.agencia || null, bnc.conta || null, bnc.tipo_conta || null, bnc.pix || null,
          doc.ctps || null, doc.serie_ctps || null, doc.pis_pasep || null, doc.titulo_eleitor || null,
          pess.nome_pai || null, pess.nome_mae || null
        ]
      );

      await AppDataSource.query(
        `UPDATE rh_fichas_admissao SET colaborador_id = $1, status = 'colaborador_criado', updated_at = NOW() WHERE id = $2`,
        [novo.id, id]
      );

      res.status(201).json({ colaborador_id: novo.id });
    } catch (e: any) {
      console.error('[FichasAdmissao] criarColaborador:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
