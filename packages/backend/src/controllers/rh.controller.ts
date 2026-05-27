import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';

export class RhController {
  static async listColaboradores(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const company_id = (req.query.company_id || req.query.empresa_id) as string | undefined;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (c.nome ILIKE $${paramIndex} OR c.cpf ILIKE $${paramIndex} OR c.matricula ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (company_id) {
        whereClause += ` AND c.company_id = $${paramIndex}::uuid`;
        params.push(company_id);
        paramIndex++;
      }

      const countResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores c ${whereClause}`,
        params
      );
      const total = parseInt(countResult[0].total);

      const dataParams = [...params, limit, offset];
      const colaboradores = await AppDataSource.query(
        `SELECT c.*,
                ca.nome AS cargo_nome,
                COALESCE(comp.apelido, comp.nome_fantasia) AS empresa_nome,
                comp.cod_loja AS empresa_cod_loja,
                j.nome AS jornada_nome,
                es.nome AS escolaridade_nome,
                esc.nome AS escala_nome,
                rt.nome AS regime_trabalho_nome,
                dep.nome AS setor_departamento_nome,
                s.name AS setor_nome
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_empresas comp ON comp.id = c.company_id
         LEFT JOIN rh_jornadas j ON j.id = c.jornada_id
         LEFT JOIN rh_escolaridades es ON es.id = c.escolaridade_id
         LEFT JOIN rh_escalas esc ON esc.id = c.escala_id
         LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
         LEFT JOIN rh_departamentos dep ON dep.id = c.departamento_id
         LEFT JOIN sectors s ON s.id = c.sector_id
         ${whereClause}
         ORDER BY c.nome ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataParams
      );

      res.json({
        data: colaboradores,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('List colaboradores error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getColaboradorById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await AppDataSource.query(
        `SELECT c.*,
                ca.nome AS cargo_nome,
                COALESCE(e.apelido, e.nome_fantasia) AS empresa_nome,
                e.cod_loja AS empresa_cod_loja,
                j.nome AS jornada_nome,
                es.nome AS escolaridade_nome,
                esc.nome AS escala_nome,
                rt.nome AS regime_trabalho_nome,
                td.nome AS tipo_desligamento_nome,
                md.nome AS motivo_desligamento_nome,
                s.name AS setor_nome
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_empresas e ON e.id = c.company_id
         LEFT JOIN rh_jornadas j ON j.id = c.jornada_id
         LEFT JOIN rh_escolaridades es ON es.id = c.escolaridade_id
         LEFT JOIN rh_escalas esc ON esc.id = c.escala_id
         LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
         LEFT JOIN rh_tipos_desligamento td ON td.id = c.tipo_desligamento_id
         LEFT JOIN rh_motivos_desligamento md ON md.id = c.motivo_desligamento_id
         LEFT JOIN sectors s ON s.id = c.sector_id
         WHERE c.id = $1`,
        [id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Get colaborador by ID error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createColaborador(req: AuthRequest, res: Response) {
    try {
      const {
        nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
        telefone, celular, email, email_pessoal,
        cep, endereco, numero, complemento, bairro, cidade, estado,
        matricula, cargo_id, empresa_id, company_id, jornada_id, escala_id, escala_domingo_id, escolaridade_id, regime_trabalho_id,
        sector_id, departamento_id,
        data_admissao, data_desligamento, salario, status,
        vale_transporte, vale_refeicao, valor_vale_refeicao, plano_saude,
        banco, agencia, conta, tipo_conta, pix,
        ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
        nome_mae, nome_pai,
        observacoes, filtro1, filtro2, filtro3, foto_url,
        tipo_desligamento_id, motivo_desligamento_id, observacoes_desligamento,
        beneficios_ids,
      } = req.body;

      if (!nome || !cpf) {
        return res.status(400).json({ error: 'Nome e CPF sao obrigatorios' });
      }

      // Helpers para converter strings vazias em null
      const nn = (v: any) => (v === '' || v === undefined ? null : v);
      const nnum = (v: any) => {
        if (v === '' || v === undefined || v === null) return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const result = await AppDataSource.query(
        `INSERT INTO rh_colaboradores (
          nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
          telefone, celular, email, email_pessoal,
          cep, endereco, numero, complemento, bairro, cidade, estado,
          matricula, cargo_id, empresa_id, jornada_id, escolaridade_id, regime_trabalho_id,
          data_admissao, data_desligamento, salario, status,
          vale_transporte, vale_refeicao, valor_vale_refeicao, plano_saude,
          banco, agencia, conta, tipo_conta, pix,
          ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
          nome_mae, nome_pai,
          observacoes, filtro1, filtro2, filtro3, foto_url,
          tipo_desligamento_id, motivo_desligamento_id, observacoes_desligamento,
          company_id, escala_id, escala_domingo_id, beneficios_ids, sector_id, departamento_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33,
          $34, $35, $36, $37, $38,
          $39, $40, $41, $42, $43,
          $44, $45,
          $46, $47, $48, $49, $50,
          $51, $52, $53,
          $54, $55, $56, $57, $58, $59
        ) RETURNING *`,
        [
          nome, cpf, rg, nn(data_nascimento), sexo, estado_civil, nacionalidade, naturalidade,
          telefone, celular, email, email_pessoal,
          cep, endereco, numero, complemento, bairro, cidade, estado,
          matricula, nnum(cargo_id), nnum(empresa_id), nnum(jornada_id), nnum(escolaridade_id), nnum(regime_trabalho_id),
          nn(data_admissao), nn(data_desligamento), nnum(salario), status || 'ativo',
          vale_transporte || false, vale_refeicao || false, nnum(valor_vale_refeicao), plano_saude || false,
          banco, agencia, conta, tipo_conta, pix,
          ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
          nome_mae, nome_pai,
          observacoes, filtro1, filtro2, filtro3, foto_url,
          nnum(tipo_desligamento_id), nnum(motivo_desligamento_id), observacoes_desligamento,
          nn(company_id), nnum(escala_id), nnum(escala_domingo_id), Array.isArray(beneficios_ids) ? beneficios_ids : [], nnum(sector_id), nnum(departamento_id),
        ]
      );

      // Cria automaticamente as 6 pastas obrigatorias do sistema pra esse colaborador.
      // Ficam marcadas como protegida=true (nao podem ser deletadas/renomeadas).
      const novoColabId = result[0]?.id;
      if (novoColabId) {
        const PASTAS_OBRIGATORIAS: Array<[string, number]> = [
          ['ATESTADO', 1],
          ['DOCS CONTRATAÇÃO', 2],
          ['FÉRIAS', 3],
          ['HOLERITES', 4],
          ['TREINAMENTOS', 5],
          ['ADVERTÊNCIAS', 6],
        ];
        for (const [nome, ordem] of PASTAS_OBRIGATORIAS) {
          try {
            await AppDataSource.query(
              `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
               VALUES ($1::int, $2::text, $3::int, true)
               ON CONFLICT (colaborador_id, nome) DO UPDATE SET protegida = true, ordem = EXCLUDED.ordem`,
              [novoColabId, nome, ordem]
            );
          } catch (e) {
            console.warn(`[colab ${novoColabId}] falha ao criar pasta obrigatoria ${nome}:`, (e as Error).message);
          }
        }
      }

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Create colaborador error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'CPF ou matricula ja cadastrado' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateColaborador(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
        telefone, celular, email, email_pessoal,
        cep, endereco, numero, complemento, bairro, cidade, estado,
        matricula, cargo_id, empresa_id, company_id, jornada_id, escala_id, escala_domingo_id, escolaridade_id, regime_trabalho_id,
        sector_id, departamento_id,
        data_admissao, data_desligamento, salario, status,
        vale_transporte, vale_refeicao, valor_vale_refeicao, plano_saude,
        banco, agencia, conta, tipo_conta, pix,
        ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
        nome_mae, nome_pai,
        observacoes, filtro1, filtro2, filtro3, foto_url,
        tipo_desligamento_id, motivo_desligamento_id, observacoes_desligamento,
        beneficios_ids,
      } = req.body;

      // Helpers para converter strings vazias em null (para campos numericos / date)
      const nn = (v: any) => (v === '' || v === undefined ? null : v);
      const nnum = (v: any) => {
        if (v === '' || v === undefined || v === null) return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      // Auto-preenche data_desligamento quando status muda pra desligado/inativo e a data nao foi informada.
      // Pra isso le o status anterior do colaborador.
      let dataDeslg = nn(data_desligamento);
      const statusFinal = status || 'ativo';
      if ((statusFinal === 'desligado' || statusFinal === 'inativo') && !dataDeslg) {
        const [atual] = await AppDataSource.query(
          `SELECT status, data_desligamento FROM rh_colaboradores WHERE id = $1`,
          [id]
        );
        // So preenche se nao havia data antes
        if (!atual?.data_desligamento) {
          dataDeslg = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        } else {
          dataDeslg = atual.data_desligamento; // mantem a anterior
        }
      }

      const result = await AppDataSource.query(
        `UPDATE rh_colaboradores SET
          nome = $1, cpf = $2, rg = $3, data_nascimento = $4, sexo = $5, estado_civil = $6, nacionalidade = $7, naturalidade = $8,
          telefone = $9, celular = $10, email = $11, email_pessoal = $12,
          cep = $13, endereco = $14, numero = $15, complemento = $16, bairro = $17, cidade = $18, estado = $19,
          matricula = $20, cargo_id = $21, empresa_id = $22, jornada_id = $23, escolaridade_id = $24, regime_trabalho_id = $25,
          data_admissao = $26, data_desligamento = $27, salario = $28, status = $29,
          vale_transporte = $30, vale_refeicao = $31, valor_vale_refeicao = $32, plano_saude = $33,
          banco = $34, agencia = $35, conta = $36, tipo_conta = $37, pix = $38,
          ctps = $39, serie_ctps = $40, pis_pasep = $41, titulo_eleitor = $42, reservista = $43,
          nome_mae = $44, nome_pai = $45,
          observacoes = $46, filtro1 = $47, filtro2 = $48, filtro3 = $49, foto_url = $50,
          tipo_desligamento_id = $51, motivo_desligamento_id = $52, observacoes_desligamento = $53,
          company_id = $54, escala_id = $55, escala_domingo_id = $56, beneficios_ids = $57,
          sector_id = $58,
          departamento_id = $59,
          updated_at = NOW()
        WHERE id = $60
        RETURNING *`,
        [
          nome, cpf, rg, nn(data_nascimento), sexo, estado_civil, nacionalidade, naturalidade,
          telefone, celular, email, email_pessoal,
          cep, endereco, numero, complemento, bairro, cidade, estado,
          matricula, nnum(cargo_id), nnum(empresa_id), nnum(jornada_id), nnum(escolaridade_id), nnum(regime_trabalho_id),
          nn(data_admissao), dataDeslg, nnum(salario), statusFinal,
          vale_transporte || false, vale_refeicao || false, nnum(valor_vale_refeicao), plano_saude || false,
          banco, agencia, conta, tipo_conta, pix,
          ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
          nome_mae, nome_pai,
          observacoes, filtro1, filtro2, filtro3, foto_url,
          nnum(tipo_desligamento_id), nnum(motivo_desligamento_id), observacoes_desligamento,
          nn(company_id), nnum(escala_id), nnum(escala_domingo_id), Array.isArray(beneficios_ids) ? beneficios_ids : [],
          nnum(sector_id), nnum(departamento_id),
          id,
        ]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json(result[0]);
    } catch (error: any) {
      console.error('Update colaborador error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'CPF ou matricula ja cadastrado' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteColaborador(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await AppDataSource.query(
        'DELETE FROM rh_colaboradores WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json({ message: 'Colaborador deleted successfully' });
    } catch (error) {
      console.error('Delete colaborador error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // CONFIG TABLES - Generic CRUD helpers
  // =============================================

  private static async listarConfig(req: AuthRequest, res: Response, table: string, orderBy = 'nome') {
    try {
      const rows = await AppDataSource.query(
        `SELECT * FROM ${table} WHERE ativo = true ORDER BY ${orderBy} ASC`
      );
      res.json(rows);
    } catch (error) {
      console.error(`List ${table} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Transforma arrays/objects em JSON string + cast `::jsonb` na query.
  // Necessario pra colunas JSONB tipo epis_epcs_obrigatorios_ids.
  private static prepararValueParaSQL(v: any): { sql: string; value: any } {
    if (Array.isArray(v) || (v !== null && typeof v === 'object')) {
      return { sql: '::jsonb', value: JSON.stringify(v) };
    }
    // String vazia vira NULL pra evitar erro de cast em colunas numericas/timestamps
    return { sql: '', value: v === '' ? null : (v ?? null) };
  }

  private static async criarConfig(req: AuthRequest, res: Response, table: string, fields: string[]) {
    try {
      const prepared = fields.map(f => RhController.prepararValueParaSQL(req.body[f]));
      const values = prepared.map(p => p.value);
      const cols = fields.join(', ');
      const placeholders = prepared.map((p, i) => `$${i + 1}${p.sql}`).join(', ');
      const result = await AppDataSource.query(
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error(`Create ${table} error:`, error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Registro duplicado' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private static async atualizarConfig(req: AuthRequest, res: Response, table: string, fields: string[]) {
    try {
      const { id } = req.params;
      const prepared = fields.map(f => RhController.prepararValueParaSQL(req.body[f]));
      const values = prepared.map(p => p.value);
      const setClause = fields.map((f, i) => `${f} = $${i + 1}${prepared[i].sql}`).join(', ');
      const result = await AppDataSource.query(
        `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );
      if (result.length === 0) {
        return res.status(404).json({ error: 'Registro nao encontrado' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error(`Update ${table} error:`, error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Registro duplicado' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private static async deletarConfig(req: AuthRequest, res: Response, table: string) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query(
        `UPDATE ${table} SET ativo = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      if (result.length === 0) {
        return res.status(404).json({ error: 'Registro nao encontrado' });
      }
      res.json(result[0]);
    } catch (error) {
      console.error(`Delete ${table} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // --- Cargos ---
  static async listarCargos(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_cargos');
  }
  static async criarCargo(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_cargos', ['nome', 'descricao', 'salario_base', 'descritivo_atividades', 'requisitos', 'epis_epcs_obrigatorios_ids']);
  }
  static async atualizarCargo(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_cargos', ['nome', 'descricao', 'salario_base', 'descritivo_atividades', 'requisitos', 'epis_epcs_obrigatorios_ids']);
  }
  static async deletarCargo(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_cargos');
  }

  // --- EPIs e EPCs (catalogo proprio) ---
  static async listarEpisEpcs(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_epis_epcs');
  }
  static async criarEpiEpc(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_epis_epcs', ['nome', 'tipo', 'descricao', 'ca', 'validade_meses']);
  }
  static async atualizarEpiEpc(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_epis_epcs', ['nome', 'tipo', 'descricao', 'ca', 'validade_meses']);
  }
  static async deletarEpiEpc(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_epis_epcs');
  }

  // GET /rh/configuracoes/cargos/sugestao-salarios
  // Retorna salario medio dos colaboradores ativos por cargo (pra auto-preencher)
  static async sugestaoSalariosCargos(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT cargo_id,
               ROUND(AVG(salario)::numeric, 2)::float AS salario_medio,
               COUNT(*)::int AS qtd_colaboradores
        FROM rh_colaboradores
        WHERE status = 'ativo' AND salario IS NOT NULL AND salario > 0 AND cargo_id IS NOT NULL
        GROUP BY cargo_id
      `);
      return res.json(rows);
    } catch (e: any) {
      console.error('[RH] sugestaoSalariosCargos:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Empresas --- (stubs legados - use /rh/empresas via RhEmpresasController) ---
  static async listarEmpresas(_req: AuthRequest, res: Response) {
    return res.status(410).json({ error: 'Endpoint movido para /rh/empresas' });
  }
  static async criarEmpresa(_req: AuthRequest, res: Response) {
    return res.status(410).json({ error: 'Endpoint movido para /rh/empresas' });
  }
  static async atualizarEmpresa(_req: AuthRequest, res: Response) {
    return res.status(410).json({ error: 'Endpoint movido para /rh/empresas' });
  }
  static async deletarEmpresa(_req: AuthRequest, res: Response) {
    return res.status(410).json({ error: 'Endpoint movido para /rh/empresas' });
  }

  // --- Jornadas ---
  static async listarJornadas(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_jornadas');
  }
  static async criarJornada(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_jornadas', ['nome', 'carga_horaria', 'descricao']);
  }
  static async atualizarJornada(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_jornadas', ['nome', 'carga_horaria', 'descricao']);
  }
  static async deletarJornada(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_jornadas');
  }

  // --- Escolaridades ---
  static async listarEscolaridades(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_escolaridades');
  }
  static async criarEscolaridade(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_escolaridades', ['nome']);
  }
  static async atualizarEscolaridade(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_escolaridades', ['nome']);
  }
  static async deletarEscolaridade(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_escolaridades');
  }

  // --- Escalas ---
  static async listarEscalas(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_escalas');
  }
  static async criarEscala(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_escalas', ['nome', 'descricao']);
  }
  static async atualizarEscala(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_escalas', ['nome', 'descricao']);
  }
  static async deletarEscala(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_escalas');
  }

  // --- Escalas Especiais de Domingo (1x1, 2x1, etc) ---
  static async listarEscalasDomingo(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_escalas_domingo');
  }
  static async criarEscalaDomingo(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_escalas_domingo', ['nome', 'descricao']);
  }
  static async atualizarEscalaDomingo(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_escalas_domingo', ['nome', 'descricao']);
  }
  static async deletarEscalaDomingo(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_escalas_domingo');
  }

  // --- Regimes de Trabalho ---
  static async listarRegimesTrabalho(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_regimes_trabalho');
  }
  static async criarRegimeTrabalho(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_regimes_trabalho', ['nome', 'descricao']);
  }
  static async atualizarRegimeTrabalho(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_regimes_trabalho', ['nome', 'descricao']);
  }
  static async deletarRegimeTrabalho(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_regimes_trabalho');
  }

  // --- Formas de Pagamento ---
  static async listarFormasPagamento(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_formas_pagamento');
  }
  static async criarFormaPagamento(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_formas_pagamento', ['nome', 'descricao']);
  }
  static async atualizarFormaPagamento(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_formas_pagamento', ['nome', 'descricao']);
  }
  static async deletarFormaPagamento(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_formas_pagamento');
  }

  // --- Prazos de Experiencia ---
  static async listarPrazosExperiencia(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_prazos_experiencia');
  }
  static async criarPrazoExperiencia(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_prazos_experiencia', ['nome', 'dias', 'descricao']);
  }
  static async atualizarPrazoExperiencia(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_prazos_experiencia', ['nome', 'dias', 'descricao']);
  }
  static async deletarPrazoExperiencia(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_prazos_experiencia');
  }

  // --- Tipos de Desligamento ---
  static async listarTiposDesligamento(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_tipos_desligamento');
  }
  static async criarTipoDesligamento(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_tipos_desligamento', ['nome', 'descricao']);
  }
  static async atualizarTipoDesligamento(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_tipos_desligamento', ['nome', 'descricao']);
  }
  static async deletarTipoDesligamento(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_tipos_desligamento');
  }

  // --- Motivos de Desligamento ---
  static async listarMotivosDesligamento(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_motivos_desligamento');
  }
  static async criarMotivoDesligamento(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_motivos_desligamento', ['nome', 'descricao']);
  }
  static async atualizarMotivoDesligamento(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_motivos_desligamento', ['nome', 'descricao']);
  }
  static async deletarMotivoDesligamento(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_motivos_desligamento');
  }

  // --- Beneficios ---
  static async listarBeneficios(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_beneficios');
  }
  static async criarBeneficio(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_beneficios', ['nome', 'descricao', 'valor']);
  }
  static async atualizarBeneficio(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_beneficios', ['nome', 'descricao', 'valor']);
  }
  static async deletarBeneficio(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_beneficios');
  }

  // =============================================
  // ASO
  // =============================================
  static async listarAso(req: AuthRequest, res: Response) {
    try {
      const colaborador_id = req.query.colaborador_id ? parseInt(req.query.colaborador_id as string) : undefined;
      let where = '';
      const params: any[] = [];
      if (colaborador_id) {
        where = 'WHERE a.colaborador_id = $1';
        params.push(colaborador_id);
      }
      const rows = await AppDataSource.query(
        `SELECT a.*, c.nome AS colaborador_nome
         FROM rh_aso a
         LEFT JOIN rh_colaboradores c ON c.id = a.colaborador_id
         ${where}
         ORDER BY a.data_vencimento DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List ASO error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarAso(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, data_emissao, data_vencimento, validade_dias, tipo, medico_responsavel, crm, clinica, apto, observacoes, arquivo_url } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_aso (colaborador_id, data_emissao, data_vencimento, validade_dias, tipo, medico_responsavel, crm, clinica, apto, observacoes, arquivo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [colaborador_id, data_emissao, data_vencimento, validade_dias || 365, tipo, medico_responsavel, crm, clinica, apto ?? true, observacoes, arquivo_url]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create ASO error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarAso(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { colaborador_id, data_emissao, data_vencimento, validade_dias, tipo, medico_responsavel, crm, clinica, apto, observacoes, arquivo_url } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_aso SET colaborador_id=$1, data_emissao=$2, data_vencimento=$3, validade_dias=$4, tipo=$5, medico_responsavel=$6, crm=$7, clinica=$8, apto=$9, observacoes=$10, arquivo_url=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [colaborador_id, data_emissao, data_vencimento, validade_dias, tipo, medico_responsavel, crm, clinica, apto, observacoes, arquivo_url, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'ASO nao encontrado' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update ASO error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarAso(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_aso WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'ASO nao encontrado' });
      res.json({ message: 'ASO deletado com sucesso' });
    } catch (error) {
      console.error('Delete ASO error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // AUSENCIAS
  // =============================================
  static async listarAusencias(req: AuthRequest, res: Response) {
    try {
      const colaborador_id = req.query.colaborador_id ? parseInt(req.query.colaborador_id as string) : undefined;
      const mes = req.query.mes ? parseInt(req.query.mes as string) : undefined;
      const ano = req.query.ano ? parseInt(req.query.ano as string) : undefined;

      let where = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (colaborador_id) {
        where += ` AND a.colaborador_id = $${paramIndex++}`;
        params.push(colaborador_id);
      }
      if (mes && ano) {
        where += ` AND EXTRACT(MONTH FROM a.data_ausencia) = $${paramIndex++} AND EXTRACT(YEAR FROM a.data_ausencia) = $${paramIndex++}`;
        params.push(mes, ano);
      }

      const rows = await AppDataSource.query(
        `SELECT a.*, c.nome AS colaborador_nome, ta.nome AS tipo_ausencia_nome, ta.cor AS tipo_ausencia_cor, ma.nome AS motivo_ausencia_nome
         FROM rh_ausencias a
         LEFT JOIN rh_colaboradores c ON c.id = a.colaborador_id
         LEFT JOIN rh_tipos_ausencia ta ON ta.id = a.tipo_ausencia_id
         LEFT JOIN rh_motivos_ausencia ma ON ma.id = a.motivo_ausencia_id
         ${where}
         ORDER BY a.data_ausencia DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List ausencias error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarAusencia(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, data_ausencia, data_inicio, data_fim, tipo_ausencia_id, motivo_ausencia_id, justificativa, arquivo_comprovante, horas_ausentes, descontar_salario } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_ausencias (colaborador_id, data_ausencia, data_inicio, data_fim, tipo_ausencia_id, motivo_ausencia_id, justificativa, arquivo_comprovante, horas_ausentes, descontar_salario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [colaborador_id, data_ausencia, data_inicio, data_fim, tipo_ausencia_id, motivo_ausencia_id, justificativa, arquivo_comprovante, horas_ausentes, descontar_salario || false]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create ausencia error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarAusencia(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { colaborador_id, data_ausencia, data_inicio, data_fim, tipo_ausencia_id, motivo_ausencia_id, justificativa, arquivo_comprovante, horas_ausentes, descontar_salario } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_ausencias SET colaborador_id=$1, data_ausencia=$2, data_inicio=$3, data_fim=$4, tipo_ausencia_id=$5, motivo_ausencia_id=$6, justificativa=$7, arquivo_comprovante=$8, horas_ausentes=$9, descontar_salario=$10
         WHERE id=$11 RETURNING *`,
        [colaborador_id, data_ausencia, data_inicio, data_fim, tipo_ausencia_id, motivo_ausencia_id, justificativa, arquivo_comprovante, horas_ausentes, descontar_salario, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Ausencia nao encontrada' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update ausencia error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarAusencia(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_ausencias WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Ausencia nao encontrada' });
      res.json({ message: 'Ausencia deletada com sucesso' });
    } catch (error) {
      console.error('Delete ausencia error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Tipos de Ausencia
  static async listarTiposAusencia(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_tipos_ausencia');
  }
  static async criarTipoAusencia(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_tipos_ausencia', ['nome', 'cor']);
  }
  static async atualizarTipoAusencia(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_tipos_ausencia', ['nome', 'cor']);
  }
  static async deletarTipoAusencia(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_tipos_ausencia');
  }

  // Motivos de Ausencia
  static async listarMotivosAusencia(req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT ma.*, ta.nome AS tipo_nome FROM rh_motivos_ausencia ma
         LEFT JOIN rh_tipos_ausencia ta ON ta.id = ma.tipo_id
         WHERE ma.ativo = true ORDER BY ma.nome ASC`
      );
      res.json(rows);
    } catch (error) {
      console.error('List motivos ausencia error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  static async criarMotivoAusencia(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_motivos_ausencia', ['tipo_id', 'nome', 'descontar_salario']);
  }
  static async atualizarMotivoAusencia(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_motivos_ausencia', ['tipo_id', 'nome', 'descontar_salario']);
  }
  static async deletarMotivoAusencia(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_motivos_ausencia');
  }

  // =============================================
  // TREINAMENTOS
  // =============================================
  static async listarTreinamentos(req: AuthRequest, res: Response) {
    try {
      const colaborador_id = req.query.colaborador_id ? parseInt(req.query.colaborador_id as string) : undefined;
      let where = '';
      const params: any[] = [];
      if (colaborador_id) {
        where = 'WHERE t.colaborador_id = $1';
        params.push(colaborador_id);
      }
      const rows = await AppDataSource.query(
        `SELECT t.*, c.nome AS colaborador_nome, tt.nome AS tipo_treinamento_nome, st.nome AS status_nome, st.cor AS status_cor
         FROM rh_treinamentos t
         LEFT JOIN rh_colaboradores c ON c.id = t.colaborador_id
         LEFT JOIN rh_tipos_treinamento tt ON tt.id = t.tipo_treinamento_id
         LEFT JOIN rh_status_treinamento st ON st.id = t.status_id
         ${where}
         ORDER BY t.data_inicio DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List treinamentos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarTreinamento(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, carga_horaria, data_inicio, data_fim, custo, status_id, certificado_url, observacoes } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_treinamentos (colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, carga_horaria, data_inicio, data_fim, custo, status_id, certificado_url, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, carga_horaria, data_inicio, data_fim, custo, status_id, certificado_url, observacoes]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create treinamento error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarTreinamento(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, carga_horaria, data_inicio, data_fim, custo, status_id, certificado_url, observacoes } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_treinamentos SET colaborador_id=$1, tipo_treinamento_id=$2, nome_treinamento=$3, instrutor=$4, instituicao=$5, local=$6, carga_horaria=$7, data_inicio=$8, data_fim=$9, custo=$10, status_id=$11, certificado_url=$12, observacoes=$13
         WHERE id=$14 RETURNING *`,
        [colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, carga_horaria, data_inicio, data_fim, custo, status_id, certificado_url, observacoes, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Treinamento nao encontrado' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update treinamento error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarTreinamento(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_treinamentos WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Treinamento nao encontrado' });
      res.json({ message: 'Treinamento deletado com sucesso' });
    } catch (error) {
      console.error('Delete treinamento error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Tipos de Treinamento
  static async listarTiposTreinamento(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_tipos_treinamento');
  }
  static async criarTipoTreinamento(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_tipos_treinamento', ['nome', 'categoria']);
  }
  static async atualizarTipoTreinamento(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_tipos_treinamento', ['nome', 'categoria']);
  }
  static async deletarTipoTreinamento(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_tipos_treinamento');
  }

  // Status de Treinamento
  static async listarStatusTreinamento(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_status_treinamento');
  }
  static async criarStatusTreinamento(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_status_treinamento', ['nome', 'cor']);
  }
  static async atualizarStatusTreinamento(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_status_treinamento', ['nome', 'cor']);
  }
  static async deletarStatusTreinamento(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_status_treinamento');
  }

  // =============================================
  // VAGAS (Recrutamento)
  // =============================================
  static async listarVagas(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      let where = '';
      const params: any[] = [];
      if (status) {
        where = 'WHERE v.status = $1';
        params.push(status);
      }
      const rows = await AppDataSource.query(
        `SELECT v.*, ca.nome AS cargo_nome, d.nome AS departamento_nome,
                j.nome AS jornada_nome, j.carga_horaria AS jornada_carga_horaria,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                    'curriculo_id', c.id,
                    'nome', c.nome,
                    'whatsapp', c.whatsapp,
                    'email', c.email,
                    'cidade', c.cidade,
                    'created_at', c.created_at,
                    'status', c.status,
                    'foto_url', c.foto_url
                  ) ORDER BY c.created_at DESC)
                   FROM curriculos c
                   WHERE c.vagas_interesse_ids @> jsonb_build_array(v.id)),
                  '[]'::json
                ) AS interessados
         FROM rh_vagas v
         LEFT JOIN rh_cargos ca ON ca.id = v.cargo_id
         LEFT JOIN rh_departamentos d ON d.id = v.departamento_id
         LEFT JOIN rh_jornadas j ON j.id = v.jornada_id
         ${where}
         ORDER BY v.data_abertura DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List vagas error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarVaga(req: AuthRequest, res: Response) {
    try {
      const { cargo_id, departamento_id, titulo, descricao, quantidade_vagas, salario_min, salario_max, data_abertura, data_fechamento, status, motivo_fechamento, requisitos, beneficios, selecionados, cod_loja, experiencia_obrigatoria, experiencia_meses_minimo, turnos, jornada_id } = req.body;
      // String vazia vira NULL pra evitar erro de cast em colunas numericas/date
      const nn = (v: any) => (v === '' || v === undefined ? null : v);
      const result = await AppDataSource.query(
        `INSERT INTO rh_vagas (cargo_id, departamento_id, titulo, descricao, quantidade_vagas, salario_min, salario_max, data_abertura, data_fechamento, status, motivo_fechamento, requisitos, beneficios, selecionados, cod_loja, experiencia_obrigatoria, experiencia_meses_minimo, turnos, jornada_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18::jsonb, $19) RETURNING *`,
        [nn(cargo_id), nn(departamento_id), titulo, descricao, quantidade_vagas || 1, nn(salario_min), nn(salario_max), nn(data_abertura), nn(data_fechamento), status || 'Aberta', motivo_fechamento, requisitos, beneficios, JSON.stringify(selecionados || []), cod_loja ?? null, !!experiencia_obrigatoria, experiencia_obrigatoria ? (nn(experiencia_meses_minimo)) : null, JSON.stringify(Array.isArray(turnos) ? turnos : []), nn(jornada_id)]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create vaga error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarVaga(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { cargo_id, departamento_id, titulo, descricao, quantidade_vagas, salario_min, salario_max, data_abertura, data_fechamento, status, motivo_fechamento, requisitos, beneficios, selecionados, cod_loja, experiencia_obrigatoria, experiencia_meses_minimo, turnos, jornada_id } = req.body;
      const nn = (v: any) => (v === '' || v === undefined ? null : v);
      const result = await AppDataSource.query(
        `UPDATE rh_vagas SET cargo_id=$1, departamento_id=$2, titulo=$3, descricao=$4, quantidade_vagas=$5, salario_min=$6, salario_max=$7, data_abertura=$8, data_fechamento=$9, status=$10, motivo_fechamento=$11, requisitos=$12, beneficios=$13, selecionados=$14::jsonb, cod_loja=$15, experiencia_obrigatoria=$16, experiencia_meses_minimo=$17, turnos=$18::jsonb, jornada_id=$19
         WHERE id=$20 RETURNING *`,
        [nn(cargo_id), nn(departamento_id), titulo, descricao, quantidade_vagas || 1, nn(salario_min), nn(salario_max), nn(data_abertura), nn(data_fechamento), status, motivo_fechamento, requisitos, beneficios, JSON.stringify(selecionados || []), cod_loja ?? null, !!experiencia_obrigatoria, experiencia_obrigatoria ? (nn(experiencia_meses_minimo)) : null, JSON.stringify(Array.isArray(turnos) ? turnos : []), nn(jornada_id), id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Vaga nao encontrada' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update vaga error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarVaga(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_vagas WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Vaga nao encontrada' });
      res.json({ message: 'Vaga deletada com sucesso' });
    } catch (error) {
      console.error('Delete vaga error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // CANDIDATOS
  // =============================================
  static async listarCandidatos(req: AuthRequest, res: Response) {
    try {
      const vaga_id = req.query.vaga_id ? parseInt(req.query.vaga_id as string) : undefined;
      let where = '';
      const params: any[] = [];
      if (vaga_id) {
        where = 'WHERE cd.vaga_id = $1';
        params.push(vaga_id);
      }
      const rows = await AppDataSource.query(
        `SELECT cd.*, v.titulo AS vaga_titulo, es.nome AS escolaridade_nome
         FROM rh_candidatos cd
         LEFT JOIN rh_vagas v ON v.id = cd.vaga_id
         LEFT JOIN rh_escolaridades es ON es.id = cd.escolaridade_id
         ${where}
         ORDER BY cd.created_at DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List candidatos error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarCandidato(req: AuthRequest, res: Response) {
    try {
      const { vaga_id, nome, cpf, email, telefone, data_nascimento, escolaridade_id, curriculo_url, status, pontuacao, observacoes } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_candidatos (vaga_id, nome, cpf, email, telefone, data_nascimento, escolaridade_id, curriculo_url, status, pontuacao, observacoes, data_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
        [vaga_id, nome, cpf, email, telefone, data_nascimento, escolaridade_id, curriculo_url, status || 'Triagem', pontuacao, observacoes]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create candidato error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarCandidato(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { vaga_id, nome, cpf, email, telefone, data_nascimento, escolaridade_id, curriculo_url, status, pontuacao, observacoes } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_candidatos SET vaga_id=$1, nome=$2, cpf=$3, email=$4, telefone=$5, data_nascimento=$6, escolaridade_id=$7, curriculo_url=$8, status=$9, pontuacao=$10, observacoes=$11, data_status=NOW()
         WHERE id=$12 RETURNING *`,
        [vaga_id, nome, cpf, email, telefone, data_nascimento, escolaridade_id, curriculo_url, status, pontuacao, observacoes, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Candidato nao encontrado' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update candidato error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarCandidato(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_candidatos WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Candidato nao encontrado' });
      res.json({ message: 'Candidato deletado com sucesso' });
    } catch (error) {
      console.error('Delete candidato error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // LANCAMENTOS FINANCEIROS (Folha)
  // =============================================
  static async listarLancamentosFinanceiros(req: AuthRequest, res: Response) {
    try {
      const ano = req.query.ano ? parseInt(req.query.ano as string) : undefined;
      let where = '';
      const params: any[] = [];
      if (ano) {
        where = 'WHERE ano = $1';
        params.push(ano);
      }
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_lancamentos_financeiros ${where} ORDER BY ano DESC, mes DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List lancamentos financeiros error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarLancamentoFinanceiro(req: AuthRequest, res: Response) {
    try {
      const { mes, ano, receita_bruta, folha_salario, folha_estagiarios, folha_familia, beneficios_vt, beneficios_vr, beneficios_saude, outros_custos, observacoes } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_lancamentos_financeiros (mes, ano, receita_bruta, folha_salario, folha_estagiarios, folha_familia, beneficios_vt, beneficios_vr, beneficios_saude, outros_custos, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [mes, ano, receita_bruta, folha_salario, folha_estagiarios, folha_familia, beneficios_vt, beneficios_vr, beneficios_saude, outros_custos, observacoes]
      );
      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Create lancamento financeiro error:', error);
      if (error.code === '23505') return res.status(409).json({ error: 'Lancamento para este mes/ano ja existe' });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarLancamentoFinanceiro(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { mes, ano, receita_bruta, folha_salario, folha_estagiarios, folha_familia, beneficios_vt, beneficios_vr, beneficios_saude, outros_custos, observacoes } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_lancamentos_financeiros SET mes=$1, ano=$2, receita_bruta=$3, folha_salario=$4, folha_estagiarios=$5, folha_familia=$6, beneficios_vt=$7, beneficios_vr=$8, beneficios_saude=$9, outros_custos=$10, observacoes=$11
         WHERE id=$12 RETURNING *`,
        [mes, ano, receita_bruta, folha_salario, folha_estagiarios, folha_familia, beneficios_vt, beneficios_vr, beneficios_saude, outros_custos, observacoes, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Lancamento nao encontrado' });
      res.json(result[0]);
    } catch (error: any) {
      console.error('Update lancamento financeiro error:', error);
      if (error.code === '23505') return res.status(409).json({ error: 'Lancamento para este mes/ano ja existe' });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarLancamentoFinanceiro(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_lancamentos_financeiros WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Lancamento nao encontrado' });
      res.json({ message: 'Lancamento deletado com sucesso' });
    } catch (error) {
      console.error('Delete lancamento financeiro error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // DEPENDENTES
  // =============================================
  static async listarDependentes(req: AuthRequest, res: Response) {
    try {
      const colaborador_id = req.query.colaborador_id ? parseInt(req.query.colaborador_id as string) : undefined;
      let where = '';
      const params: any[] = [];
      if (colaborador_id) {
        where = 'WHERE d.colaborador_id = $1';
        params.push(colaborador_id);
      }
      const rows = await AppDataSource.query(
        `SELECT d.*, c.nome AS colaborador_nome
         FROM rh_dependentes d
         LEFT JOIN rh_colaboradores c ON c.id = d.colaborador_id
         ${where}
         ORDER BY d.nome ASC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List dependentes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarDependente(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, nome, sexo, parentesco_id, data_nascimento, cpf, dependente_ir, dependente_sf } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_dependentes (colaborador_id, nome, sexo, parentesco_id, data_nascimento, cpf, dependente_ir, dependente_sf)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [colaborador_id, nome, sexo, parentesco_id, data_nascimento, cpf, dependente_ir || false, dependente_sf || false]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create dependente error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarDependente(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { colaborador_id, nome, sexo, parentesco_id, data_nascimento, cpf, dependente_ir, dependente_sf } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_dependentes SET colaborador_id=$1, nome=$2, sexo=$3, parentesco_id=$4, data_nascimento=$5, cpf=$6, dependente_ir=$7, dependente_sf=$8, updated_at=NOW()
         WHERE id=$9 RETURNING *`,
        [colaborador_id, nome, sexo, parentesco_id, data_nascimento, cpf, dependente_ir, dependente_sf, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Dependente nao encontrado' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update dependente error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarDependente(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_dependentes WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Dependente nao encontrado' });
      res.json({ message: 'Dependente deletado com sucesso' });
    } catch (error) {
      console.error('Delete dependente error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // HISTORICO DE ALTERACOES
  // =============================================
  static async listarHistoricoAlteracoes(req: AuthRequest, res: Response) {
    try {
      const colaborador_id = req.query.colaborador_id ? parseInt(req.query.colaborador_id as string) : undefined;
      let where = '';
      const params: any[] = [];
      if (colaborador_id) {
        where = 'WHERE h.colaborador_id = $1';
        params.push(colaborador_id);
      }
      const rows = await AppDataSource.query(
        `SELECT h.*, c.nome AS colaborador_nome, ca.nome AS cargo_nome, j.nome AS jornada_nome
         FROM rh_historico_alteracoes h
         LEFT JOIN rh_colaboradores c ON c.id = h.colaborador_id
         LEFT JOIN rh_cargos ca ON ca.id = h.cargo_id
         LEFT JOIN rh_jornadas j ON j.id = h.jornada_id
         ${where}
         ORDER BY h.data_inicio DESC`,
        params
      );
      res.json(rows);
    } catch (error) {
      console.error('List historico alteracoes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarHistoricoAlteracao(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, data_inicio, data_fim, cargo_id, jornada_id, salario, motivo, observacoes } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_historico_alteracoes (colaborador_id, data_inicio, data_fim, cargo_id, jornada_id, salario, motivo, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [colaborador_id, data_inicio, data_fim, cargo_id, jornada_id, salario, motivo, observacoes]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create historico alteracao error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async atualizarHistoricoAlteracao(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { colaborador_id, data_inicio, data_fim, cargo_id, jornada_id, salario, motivo, observacoes } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_historico_alteracoes SET colaborador_id=$1, data_inicio=$2, data_fim=$3, cargo_id=$4, jornada_id=$5, salario=$6, motivo=$7, observacoes=$8
         WHERE id=$9 RETURNING *`,
        [colaborador_id, data_inicio, data_fim, cargo_id, jornada_id, salario, motivo, observacoes, id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Historico nao encontrado' });
      res.json(result[0]);
    } catch (error) {
      console.error('Update historico alteracao error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarHistoricoAlteracao(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_historico_alteracoes WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Historico nao encontrado' });
      res.json({ message: 'Historico deletado com sucesso' });
    } catch (error) {
      console.error('Delete historico alteracao error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // DEPARTAMENTOS
  // =============================================
  static async listarDepartamentos(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_departamentos');
  }
  static async criarDepartamento(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_departamentos', ['nome', 'descricao']);
  }
  static async atualizarDepartamento(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_departamentos', ['nome', 'descricao']);
  }
  static async deletarDepartamento(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_departamentos');
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const empresa_id = req.query.empresa_id ? parseInt(req.query.empresa_id as string) : undefined;

      let empresaFilter = '';
      const params: any[] = [];

      if (empresa_id) {
        empresaFilter = 'WHERE empresa_id = $1';
        params.push(empresa_id);
      }

      const totalResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores ${empresaFilter}`,
        params
      );

      const ativosResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores ${empresaFilter ? empresaFilter + " AND status = 'ativo'" : "WHERE status = 'ativo'"}`,
        params
      );

      const desligadosResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores ${empresaFilter ? empresaFilter + " AND status = 'desligado'" : "WHERE status = 'desligado'"}`,
        params
      );

      const generoResult = await AppDataSource.query(
        `SELECT sexo, COUNT(*) as total FROM rh_colaboradores ${empresaFilter} GROUP BY sexo`,
        params
      );

      const admissoesRecentesResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores
         ${empresaFilter ? empresaFilter + ' AND' : 'WHERE'} data_admissao >= NOW() - INTERVAL '30 days'`,
        params
      );

      // Contagem por regime de trabalho (so ativos)
      const ativosWhere = empresaFilter ? empresaFilter + " AND c.status = 'ativo'" : "WHERE c.status = 'ativo'";
      const cltsResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores c
         LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
         ${ativosWhere} AND UPPER(COALESCE(rt.nome, '')) LIKE '%CLT%'`,
        params
      );
      const aprendizesResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores c
         LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
         ${ativosWhere} AND UPPER(COALESCE(rt.nome, '')) LIKE '%APRENDIZ%'`,
        params
      );

      res.json({
        total: parseInt(totalResult[0].total),
        ativos: parseInt(ativosResult[0].total),
        desligados: parseInt(desligadosResult[0].total),
        clts: parseInt(cltsResult[0].total),
        aprendizes: parseInt(aprendizesResult[0].total),
        genero: generoResult.map((r: any) => ({ sexo: r.sexo, total: parseInt(r.total) })),
        admissoesRecentes: parseInt(admissoesRecentesResult[0].total),
      });
    } catch (error) {
      console.error('Get RH stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================
  // DISC - Perfil Comportamental
  // =============================================
  // Endpoint PUBLICO - sem auth. Candidato/colaborador preenche pelo link direto.
  static async salvarDiscResultadoPublico(req: any, res: Response) {
    try {
      const { nome, scores, perfil_primario, perfil_secundario, respostas, curriculo_id } = req.body;
      if (!nome || !perfil_primario || !scores) {
        return res.status(400).json({ error: 'Dados incompletos' });
      }
      const cidNum = curriculo_id != null && curriculo_id !== '' ? Number(curriculo_id) : null;
      const result = await AppDataSource.query(
        `INSERT INTO rh_disc_resultados (nome, colaborador_id, curriculo_id, score_d, score_i, score_s, score_c, perfil_primario, perfil_secundario, respostas, avaliador_id)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, NULL) RETURNING id, perfil_primario, perfil_secundario`,
        [nome, cidNum, scores.D || 0, scores.I || 0, scores.S || 0, scores.C || 0, perfil_primario, perfil_secundario || null, JSON.stringify(respostas || {})]
      );
      res.status(201).json({ success: true, resultado: result[0] });
    } catch (error: any) {
      console.error('Save DISC result (public) error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async salvarDiscResultado(req: AuthRequest, res: Response) {
    try {
      const { nome, colaborador_id, scores, perfil_primario, perfil_secundario, respostas } = req.body;
      if (!nome || !perfil_primario || !scores) {
        return res.status(400).json({ error: 'Dados incompletos' });
      }
      const result = await AppDataSource.query(
        `INSERT INTO rh_disc_resultados (nome, colaborador_id, score_d, score_i, score_s, score_c, perfil_primario, perfil_secundario, respostas, avaliador_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [nome, colaborador_id || null, scores.D || 0, scores.I || 0, scores.S || 0, scores.C || 0, perfil_primario, perfil_secundario || null, JSON.stringify(respostas || {}), req.user?.id || null]
      );
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Save DISC result error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async listarDiscResultados(req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT r.*, c.matricula AS colaborador_matricula
         FROM rh_disc_resultados r
         LEFT JOIN rh_colaboradores c ON c.id = r.colaborador_id
         ORDER BY r.created_at DESC
         LIMIT 100`
      );
      res.json(rows);
    } catch (error) {
      console.error('List DISC results error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getDiscResultado(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query(
        `SELECT r.*, c.matricula AS colaborador_matricula
         FROM rh_disc_resultados r
         LEFT JOIN rh_colaboradores c ON c.id = r.colaborador_id
         WHERE r.id = $1`,
        [id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Resultado nao encontrado' });
      res.json(result[0]);
    } catch (error) {
      console.error('Get DISC result error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deletarDiscResultado(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const result = await AppDataSource.query('DELETE FROM rh_disc_resultados WHERE id = $1 RETURNING id', [id]);
      if (result.length === 0) return res.status(404).json({ error: 'Resultado nao encontrado' });
      res.json({ message: 'Resultado DISC deletado com sucesso' });
    } catch (error) {
      console.error('Delete DISC result error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
