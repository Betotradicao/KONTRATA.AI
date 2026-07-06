import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { minioService } from '../services/minio.service';
import { GeocodeService } from '../services/geocode.service';

// ============================================================
// Helpers pra gravar os campos "extras" do colaborador (alinhados à Ficha
// de Admissão completa) — RG completo, características, CTPS expandido,
// Título expandido, Reservista, CNH, cônjuge, estrangeiro, dependentes.
// Roda como UPDATE secundário pra não mexer no INSERT/UPDATE principal
// (que já é grande). Idempotente — pode chamar várias vezes.
// ============================================================
const CAMPOS_EXTRAS_COLAB = [
  'rg_orgao_emissor', 'rg_uf', 'rg_emissao',
  'naturalidade_uf',
  'raca_cor', 'tipo_sanguineo', 'altura', 'peso', 'cor_cabelos', 'cor_olhos', 'deficiente',
  'tamanho_uniforme', 'tipo_uniforme',
  'ctps_uf', 'ctps_emissao',
  'titulo_zona', 'titulo_secao', 'titulo_emissao',
  'reservista_uf', 'reservista_emissao',
  'cnh', 'cnh_categoria', 'cnh_uf', 'cnh_validade',
  'conjuge_nome', 'conjuge_cpf', 'conjuge_data_nascimento', 'conjuge_data_casamento',
  'pais_nacionalidade', 'condicao_ingresso_brasil', 'data_chegada_brasil',
  'filhos_brasileiros', 'filhos_brasileiros_qtd', 'casado_brasileiro',
  'portaria_naturalizacao', 'data_naturalizacao',
];

async function gravarCamposExtrasColab(colaboradorId: number, body: any) {
  if (!colaboradorId || !body) return;
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const campo of CAMPOS_EXTRAS_COLAB) {
    if (Object.prototype.hasOwnProperty.call(body, campo)) {
      let v: any = body[campo];
      if (v === '' || v === undefined) v = null;
      // booleans
      if (campo === 'filhos_brasileiros' || campo === 'casado_brasileiro') v = !!v;
      sets.push(`${campo} = $${idx++}`);
      params.push(v);
    }
  }
  if (sets.length === 0) return;
  params.push(colaboradorId);
  await AppDataSource.query(
    `UPDATE rh_colaboradores SET ${sets.join(', ')} WHERE id = $${idx}`,
    params
  );
}

async function gravarDependentes(colaboradorId: number, dependentes: any[]) {
  if (!colaboradorId || !Array.isArray(dependentes)) return;
  // Estratégia simples: apaga todos e re-insere (o front sempre manda a lista atual).
  await AppDataSource.query(`DELETE FROM rh_colaborador_dependentes WHERE colaborador_id = $1`, [colaboradorId]);
  for (const d of dependentes) {
    if (!d?.nome) continue;
    await AppDataSource.query(
      `INSERT INTO rh_colaborador_dependentes
         (colaborador_id, nome, parentesco, sexo, cpf, data_nascimento,
          certidao_numero, certidao_data, certidao_cartorio, certidao_folha,
          dependente_ir, dependente_sf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        colaboradorId,
        d.nome,
        d.parentesco || null,
        d.sexo || null,
        d.cpf || null,
        d.data_nascimento || null,
        d.certidao_numero || null,
        d.certidao_data || null,
        d.certidao_cartorio || null,
        d.certidao_folha || null,
        !!d.dependente_ir,
        !!d.dependente_sf,
      ]
    );
  }
}

async function listarDependentes(colaboradorId: number) {
  if (!colaboradorId) return [];
  return await AppDataSource.query(
    `SELECT * FROM rh_colaborador_dependentes WHERE colaborador_id = $1 ORDER BY id`,
    [colaboradorId]
  );
}

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

      // Inclui dependentes (1-N) na resposta — Família do colaborador
      const dependentes = await listarDependentes(Number(id)).catch(() => []);
      res.json({ ...result[0], dependentes });
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
        beneficios_ids, nao_bate_ponto,
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
          company_id, escala_id, escala_domingo_id, beneficios_ids, sector_id, departamento_id, nao_bate_ponto
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
          $54, $55, $56, $57, $58, $59, $60
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
          nao_bate_ponto === true,
        ]
      );

      // Cria automaticamente as pastas/subpastas padronizadas pra esse colaborador,
      // baseadas no TEMPLATE centralizado (rh_documento_pastas_template /
      // rh_documento_subpastas_template). Configurado em
      // "Configuracoes RH -> Documentacao Padronizada".
      // Pastas protegidas no template ficam protegidas no colaborador.
      const novoColabId = result[0]?.id;
      if (novoColabId) {
        const pastasTemplate = await AppDataSource.query(
          `SELECT id, nome, ordem, protegida FROM rh_documento_pastas_template
            WHERE obrigatoria = true
            ORDER BY ordem, nome`
        );
        for (const pt of pastasTemplate) {
          try {
            const [pastaCriada] = await AppDataSource.query(
              `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
               VALUES ($1::int, $2::text, $3::int, $4::boolean)
               ON CONFLICT (colaborador_id, nome) DO UPDATE SET protegida = EXCLUDED.protegida, ordem = EXCLUDED.ordem
               RETURNING id`,
              [novoColabId, pt.nome, pt.ordem, pt.protegida]
            );
            // Cria subpastas obrigatorias do template pra esta pasta
            const subs = await AppDataSource.query(
              `SELECT nome, ordem, obrigatoria FROM rh_documento_subpastas_template
                WHERE pasta_template_id = $1 AND obrigatoria = true
                ORDER BY ordem, nome`,
              [pt.id]
            );
            for (const sub of subs) {
              await AppDataSource.query(
                `INSERT INTO rh_documento_subpastas (pasta_id, nome, ordem, obrigatorio)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (pasta_id, nome) DO NOTHING`,
                [pastaCriada.id, sub.nome, sub.ordem, sub.obrigatoria]
              );
            }
          } catch (e) {
            console.warn(`[colab ${novoColabId}] falha ao criar pasta template ${pt.nome}:`, (e as Error).message);
          }
        }
      }

      // Grava campos extras (RG completo, CTPS UF/emissão, Título zona/seção,
      // Reservista UF, CNH, características pessoais, cônjuge, estrangeiro)
      // + dependentes em tabela separada.
      try {
        if (novoColabId) {
          await gravarCamposExtrasColab(novoColabId, req.body);
          if (Array.isArray(req.body.dependentes)) {
            await gravarDependentes(novoColabId, req.body.dependentes);
          }
        }
      } catch (e) {
        console.warn(`[colab ${novoColabId}] falha ao gravar campos extras/dependentes:`, (e as Error).message);
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
        beneficios_ids, nao_bate_ponto,
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
          nao_bate_ponto = $60,
          updated_at = NOW()
        WHERE id = $61
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
          nao_bate_ponto === true,
          id,
        ]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      // Grava campos extras + dependentes (idempotente)
      try {
        await gravarCamposExtrasColab(Number(id), req.body);
        if (Array.isArray(req.body.dependentes)) {
          await gravarDependentes(Number(id), req.body.dependentes);
        }
      } catch (e) {
        console.warn(`[colab ${id}] falha ao gravar campos extras/dependentes:`, (e as Error).message);
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
    // Se vier dias_inicial + dias_final, calcula `dias` (total) automaticamente
    const b = req.body || {};
    if (b.dias_inicial != null && b.dias_final != null && b.dias == null) {
      b.dias = Number(b.dias_inicial) + Number(b.dias_final);
      req.body = b;
    }
    return RhController.criarConfig(req, res, 'rh_prazos_experiencia', ['nome', 'dias', 'dias_inicial', 'dias_final', 'descricao']);
  }
  static async atualizarPrazoExperiencia(req: AuthRequest, res: Response) {
    const b = req.body || {};
    if (b.dias_inicial != null && b.dias_final != null && b.dias == null) {
      b.dias = Number(b.dias_inicial) + Number(b.dias_final);
      req.body = b;
    }
    return RhController.atualizarConfig(req, res, 'rh_prazos_experiencia', ['nome', 'dias', 'dias_inicial', 'dias_final', 'descricao']);
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

  // --- Motivos de Advertência (usado nos docs da fase 4 ADVERTÊNCIA) ---
  static async listarMotivosAdvertencia(req: AuthRequest, res: Response) {
    return RhController.listarConfig(req, res, 'rh_motivos_advertencia', 'ordem');
  }
  static async criarMotivoAdvertencia(req: AuthRequest, res: Response) {
    return RhController.criarConfig(req, res, 'rh_motivos_advertencia', ['nome', 'texto', 'artigo', 'ordem']);
  }
  static async atualizarMotivoAdvertencia(req: AuthRequest, res: Response) {
    return RhController.atualizarConfig(req, res, 'rh_motivos_advertencia', ['nome', 'texto', 'artigo', 'ordem', 'ativo']);
  }
  static async deletarMotivoAdvertencia(req: AuthRequest, res: Response) {
    return RhController.deletarConfig(req, res, 'rh_motivos_advertencia');
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
        `SELECT t.*, c.nome AS colaborador_nome, tt.nome AS tipo_treinamento_nome,
                st.nome AS status_nome, st.cor AS status_cor,
                e.razao_social AS empresa_nome
         FROM rh_treinamentos t
         LEFT JOIN rh_colaboradores c ON c.id = t.colaborador_id
         LEFT JOIN rh_tipos_treinamento tt ON tt.id = t.tipo_treinamento_id
         LEFT JOIN rh_status_treinamento st ON st.id = t.status_id
         LEFT JOIN rh_empresas e ON e.id = t.empresa_id
         ${where}
         ORDER BY t.data_inicio DESC, t.hora_inicio DESC`,
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
      const { empresa_id, colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, local_tipo, carga_horaria, data_inicio, data_fim, hora_inicio, hora_fim, custo, status_id, certificado_url, observacoes } = req.body;
      const result = await AppDataSource.query(
        `INSERT INTO rh_treinamentos
           (empresa_id, colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, local_tipo, carga_horaria, data_inicio, data_fim, hora_inicio, hora_fim, custo, status_id, certificado_url, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [empresa_id || null, colaborador_id || null, tipo_treinamento_id || null, nome_treinamento, instrutor || null, instituicao || null, local || null, local_tipo || null, carga_horaria || null, data_inicio || null, data_fim || null, hora_inicio || null, hora_fim || null, custo || null, status_id || null, certificado_url || null, observacoes || null]
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
      const { empresa_id, colaborador_id, tipo_treinamento_id, nome_treinamento, instrutor, instituicao, local, local_tipo, carga_horaria, data_inicio, data_fim, hora_inicio, hora_fim, custo, status_id, certificado_url, observacoes } = req.body;
      const result = await AppDataSource.query(
        `UPDATE rh_treinamentos SET
           empresa_id=$1, colaborador_id=$2, tipo_treinamento_id=$3, nome_treinamento=$4, instrutor=$5,
           instituicao=$6, local=$7, local_tipo=$8, carga_horaria=$9, data_inicio=$10, data_fim=$11,
           hora_inicio=$12, hora_fim=$13, custo=$14, status_id=$15, certificado_url=$16, observacoes=$17
         WHERE id=$18 RETURNING *`,
        [empresa_id || null, colaborador_id || null, tipo_treinamento_id || null, nome_treinamento, instrutor || null, instituicao || null, local || null, local_tipo || null, carga_horaria || null, data_inicio || null, data_fim || null, hora_inicio || null, hora_fim || null, custo || null, status_id || null, certificado_url || null, observacoes || null, id]
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

  // ============================================================
  // Biblioteca de Materiais de Treinamento (slides, PDFs, Word, vídeos...)
  // Aqui o RH guarda assets reutilizáveis pra usar em treinamentos futuros.
  // NÃO confundir com rh_treinamentos (uso real com colaborador/data/instrutor).
  // ============================================================
  static async listarTreinamentosMateriais(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_treinamentos_materiais WHERE ativo = true ORDER BY tema ASC NULLS LAST, nome ASC`
      );
      res.json(rows);
    } catch (error: any) {
      console.error('[RH] listarTreinamentosMateriais:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async criarTreinamentoMaterial(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file;
      const { nome, descricao, tema, tags } = req.body;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatorio' });

      const ext = (file.originalname || 'bin').split('.').pop() || 'bin';
      const objectName = `rh/treinamentos-materiais/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'application/octet-stream');

      const userId = (req as any).user?.id || (req as any).user?.username || null;
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_treinamentos_materiais
           (nome, descricao, tema, tags, arquivo_url, arquivo_nome_original, mime_type, tamanho_bytes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          nome.trim(),
          descricao || null,
          tema || null,
          tags || null,
          url,
          file.originalname,
          file.mimetype,
          file.size,
          userId ? String(userId) : null,
        ]
      );
      res.status(201).json(row);
    } catch (error: any) {
      console.error('[RH] criarTreinamentoMaterial:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async atualizarTreinamentoMaterial(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nome, descricao, tema, tags } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_treinamentos_materiais SET
           nome = COALESCE($1, nome),
           descricao = COALESCE($2, descricao),
           tema = COALESCE($3, tema),
           tags = COALESCE($4, tags),
           updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [nome || null, descricao || null, tema || null, tags || null, id]
      );
      if (!row) return res.status(404).json({ error: 'Material nao encontrado' });
      res.json(row);
    } catch (error: any) {
      console.error('[RH] atualizarTreinamentoMaterial:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deletarTreinamentoMaterial(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      // Soft delete (mantem o arquivo no MinIO pra eventuais auditorias)
      const [row] = await AppDataSource.query(
        `UPDATE rh_treinamentos_materiais SET ativo = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );
      if (!row) return res.status(404).json({ error: 'Material nao encontrado' });
      res.json({ message: 'Material deletado' });
    } catch (error: any) {
      console.error('[RH] deletarTreinamentoMaterial:', error);
      res.status(500).json({ error: error.message });
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
  // ANIVERSARIANTES DO MES
  // =============================================
  // GET /rh/aniversariantes?mes=9 -> colaboradores ATIVOS que fazem aniversario
  // no mes, ordenados por dia. Usado no modelo de "Aniversariantes do Mes".
  static async listarAniversariantes(req: AuthRequest, res: Response) {
    try {
      const hoje = new Date();
      let mes = parseInt(String(req.query.mes || ''), 10);
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) mes = hoje.getMonth() + 1;

      // Filtro opcional por loja. Vinculo colaborador->loja: c.empresa_id = rh_empresas.cod_loja.
      const codLoja = parseInt(String(req.query.loja || ''), 10);
      const params: any[] = [mes];
      let filtroLoja = '';
      if (Number.isInteger(codLoja)) {
        params.push(codLoja);
        filtroLoja = ` AND c.empresa_id = $2`;
      }

      const rows = await AppDataSource.query(
        `SELECT c.nome, c.matricula,
                to_char(c.data_nascimento, 'DD/MM') AS data_aniversario,
                EXTRACT(DAY FROM c.data_nascimento)::int AS dia
         FROM rh_colaboradores c
         WHERE c.status = 'ativo'
           AND c.data_nascimento IS NOT NULL
           AND EXTRACT(MONTH FROM c.data_nascimento) = $1
           ${filtroLoja}
         ORDER BY EXTRACT(DAY FROM c.data_nascimento) ASC, c.nome ASC`,
        params
      );
      res.json({ mes, loja: Number.isInteger(codLoja) ? codLoja : null, aniversariantes: rows });
    } catch (error) {
      console.error('Aniversariantes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
                emp.cep AS loja_cep, emp.latitude AS loja_lat, emp.longitude AS loja_lng, emp.geo_cep AS loja_geo_cep,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                    'curriculo_id', c.id,
                    'nome', c.nome,
                    'whatsapp', c.whatsapp,
                    'email', c.email,
                    'cidade', c.cidade,
                    'created_at', c.created_at,
                    -- status_local: 100% LOCAL por vaga (nao vaza pra outras vagas).
                    -- Calculado a partir dos 3 arrays JSONB da vaga: selecionados, recusados, vagas_futuras.
                    'status', CASE
                      WHEN EXISTS (
                        SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados, '[]'::jsonb)) sel
                        WHERE (sel->>'curriculo_id')::int = c.id AND (sel->>'contratado')::boolean = true
                      ) THEN 'contratado'
                      WHEN EXISTS (
                        SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados, '[]'::jsonb)) sel
                        WHERE (sel->>'curriculo_id')::int = c.id
                      ) THEN 'selecionado'
                      WHEN EXISTS (
                        SELECT 1 FROM jsonb_array_elements(COALESCE(v.recusados, '[]'::jsonb)) r
                        WHERE (r->>'curriculo_id')::int = c.id
                      ) THEN 'recusado'
                      WHEN EXISTS (
                        SELECT 1 FROM jsonb_array_elements(COALESCE(v.vagas_futuras, '[]'::jsonb)) f
                        WHERE (f->>'curriculo_id')::int = c.id
                      ) THEN 'em_analise'
                      ELSE 'novo'
                    END,
                    'status_global', c.status,
                    'foto_url', c.foto_url,
                    -- CEP + coords pra calcular distancia residencia -> loja da vaga
                    'cep', c.cep,
                    'latitude', c.latitude,
                    'longitude', c.longitude,
                    'geo_cep', c.geo_cep
                  ) ORDER BY c.created_at DESC)
                   FROM curriculos c
                   WHERE c.vagas_interesse_ids @> jsonb_build_array(v.id)
                  ),
                  '[]'::json
                ) AS interessados
         FROM rh_vagas v
         LEFT JOIN rh_cargos ca ON ca.id = v.cargo_id
         LEFT JOIN rh_departamentos d ON d.id = v.departamento_id
         LEFT JOIN rh_jornadas j ON j.id = v.jornada_id
         LEFT JOIN rh_empresas emp ON emp.cod_loja = v.cod_loja
         ${where}
         ORDER BY v.data_abertura DESC`,
        params
      );

      // KM Residencia: distancia em linha reta da casa do candidato ate a loja
      // da vaga. Usa coords ja geocodadas; o que faltar geocoda em background
      // (self-heal: aparece no proximo refresh). Ver GeocodeService.
      const aGeocodar: Array<{ tipo: 'curriculo' | 'empresa'; chave: number }> = [];
      for (const v of rows) {
        const lojaCepNorm = GeocodeService.normalizarCep(v.loja_cep);
        const lojaCoords = (v.loja_lat != null && v.loja_lng != null) ? { lat: v.loja_lat, lng: v.loja_lng } : null;
        if (v.cod_loja != null && lojaCepNorm && (!lojaCoords || v.loja_geo_cep !== lojaCepNorm)) {
          aGeocodar.push({ tipo: 'empresa', chave: v.cod_loja });
        }
        const interessados = Array.isArray(v.interessados) ? v.interessados : [];
        for (const c of interessados) {
          const candCepNorm = GeocodeService.normalizarCep(c.cep);
          const candCoords = (c.latitude != null && c.longitude != null) ? { lat: c.latitude, lng: c.longitude } : null;
          if (candCepNorm && (!candCoords || c.geo_cep !== candCepNorm)) {
            aGeocodar.push({ tipo: 'curriculo', chave: c.curriculo_id });
          }
          if (lojaCoords && candCoords) {
            const m = GeocodeService.distanciaMetros(candCoords, lojaCoords);
            c.distancia_m = Math.round(m);
            c.km_residencia = GeocodeService.formatarDistancia(m);
          } else {
            c.distancia_m = null;
            c.km_residencia = null;
          }
        }
        // limpa colunas auxiliares da loja do payload (nao precisam ir pro front)
        delete v.loja_cep; delete v.loja_lat; delete v.loja_lng; delete v.loja_geo_cep;
      }
      if (aGeocodar.length) GeocodeService.warmInBackground(aGeocodar);

      res.json(rows);
    } catch (error) {
      console.error('List vagas error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async criarVaga(req: AuthRequest, res: Response) {
    try {
      const { cargo_id, departamento_id, titulo, descricao, quantidade_vagas, salario_min, salario_max, data_abertura, data_fechamento, status, motivo_fechamento, requisitos, beneficios, selecionados, cod_loja, experiencia_obrigatoria, experiencia_meses_minimo, turnos, jornada_id, hora_entrada, hora_almoco_ini, hora_almoco_fim, hora_saida, tipo_vaga_slug } = req.body;
      // String vazia vira NULL pra evitar erro de cast em colunas numericas/date
      const nn = (v: any) => (v === '' || v === undefined ? null : v);
      const result = await AppDataSource.query(
        `INSERT INTO rh_vagas (cargo_id, departamento_id, titulo, descricao, quantidade_vagas, salario_min, salario_max, data_abertura, data_fechamento, status, motivo_fechamento, requisitos, beneficios, selecionados, cod_loja, experiencia_obrigatoria, experiencia_meses_minimo, turnos, jornada_id, hora_entrada, hora_almoco_ini, hora_almoco_fim, hora_saida, tipo_vaga_slug)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18::jsonb, $19, $20, $21, $22, $23, $24) RETURNING *`,
        [nn(cargo_id), nn(departamento_id), titulo, descricao, quantidade_vagas || 1, nn(salario_min), nn(salario_max), nn(data_abertura), nn(data_fechamento), status || 'Aberta', motivo_fechamento, requisitos, beneficios, JSON.stringify(selecionados || []), cod_loja ?? null, !!experiencia_obrigatoria, experiencia_obrigatoria ? (nn(experiencia_meses_minimo)) : null, JSON.stringify(Array.isArray(turnos) ? turnos : []), nn(jornada_id), nn(hora_entrada), nn(hora_almoco_ini), nn(hora_almoco_fim), nn(hora_saida), nn(tipo_vaga_slug)]
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
      const { cargo_id, departamento_id, titulo, descricao, quantidade_vagas, salario_min, salario_max, data_abertura, data_fechamento, status, motivo_fechamento, requisitos, beneficios, selecionados, cod_loja, experiencia_obrigatoria, experiencia_meses_minimo, turnos, jornada_id, hora_entrada, hora_almoco_ini, hora_almoco_fim, hora_saida, tipo_vaga_slug } = req.body;
      const nn = (v: any) => (v === '' || v === undefined ? null : v);
      // data_fechamento e autoritativo no backend: ao finalizar (Contratado(a)/Fechada)
      // grava a data (preserva a existente; senao usa a do body ou hoje); ao reabrir, limpa.
      const STATUS_FINALIZADO = ['Contratado(a)', 'Fechada'];
      const [vagaAtual] = await AppDataSource.query(`SELECT data_fechamento, status, selecionados FROM rh_vagas WHERE id = $1`, [id]);
      // prioridade: data que veio do modal (correcao manual) > existente > hoje
      const dataFechamentoFinal = STATUS_FINALIZADO.includes(status)
        ? (nn(data_fechamento) || vagaAtual?.data_fechamento || new Date())
        : null;
      // Coerencia: vaga NAO finalizada nao pode ter candidato marcado contratado.
      // Ao reabrir (Em Selecao/Aberta) limpa contratado dos selecionados (viram Selecionados de novo).
      const selecionadosFinal = (Array.isArray(selecionados) && !STATUS_FINALIZADO.includes(status))
        ? selecionados.map((s: any) => ({ ...s, contratado: false }))
        : (selecionados || []);
      const result = await AppDataSource.query(
        `UPDATE rh_vagas SET cargo_id=$1, departamento_id=$2, titulo=$3, descricao=$4, quantidade_vagas=$5, salario_min=$6, salario_max=$7, data_abertura=$8, data_fechamento=$9, status=$10, motivo_fechamento=$11, requisitos=$12, beneficios=$13, selecionados=$14::jsonb, cod_loja=$15, experiencia_obrigatoria=$16, experiencia_meses_minimo=$17, turnos=$18::jsonb, jornada_id=$19,
            hora_entrada=$20, hora_almoco_ini=$21, hora_almoco_fim=$22, hora_saida=$23, tipo_vaga_slug=$24
         WHERE id=$25 RETURNING *`,
        [nn(cargo_id), nn(departamento_id), titulo, descricao, quantidade_vagas || 1, nn(salario_min), nn(salario_max), nn(data_abertura), dataFechamentoFinal, status, motivo_fechamento, requisitos, beneficios, JSON.stringify(selecionadosFinal), cod_loja ?? null, !!experiencia_obrigatoria, experiencia_obrigatoria ? (nn(experiencia_meses_minimo)) : null, JSON.stringify(Array.isArray(turnos) ? turnos : []), nn(jornada_id), nn(hora_entrada), nn(hora_almoco_ini), nn(hora_almoco_fim), nn(hora_saida), nn(tipo_vaga_slug), id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Vaga nao encontrada' });

      // Sincroniza o status GLOBAL no Banco de Curriculos:
      // - finalizou (Contratado(a)/Fechada) -> carimba SO quem ja esta contratado.
      //   Os demais candidatos NAO sao tocados aqui: o RH triará cada um na mao
      //   (e cada triagem na vaga finalizada reflete no Banco via setCandidatoStatusVaga).
      // - reabriu (estava finalizada e saiu) -> reverte o contratado de antes.
      if (STATUS_FINALIZADO.includes(status)) {
        await RhController.carimbarStatusGlobalVaga(result[0], { incluirRecusados: false });
      } else {
        const estavaFinalizada = STATUS_FINALIZADO.includes(vagaAtual?.status) || !!vagaAtual?.data_fechamento;
        if (estavaFinalizada) {
          await RhController.reverterContratadoGlobalVaga(vagaAtual?.selecionados, Number(id));
        }
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Update vaga error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Carimba o status GLOBAL (curriculos.status / Banco de Curriculos) dos
  // candidatos de uma vaga QUANDO ela e FINALIZADA (Contratado(a)/Fechada) ou
  // EXCLUIDA. Escreve SOMENTE em curriculos.status — NUNCA toca no JSONB de
  // outra vaga, pra nao repetir o bug de status vazando entre processos.
  // Regras:
  //  - contratado=true -> 'contratado' (definitivo; sobrescreve qualquer status)
  //  - recusado        -> 'recusado'  (SO se o candidato nao estiver selecionado
  //                       em OUTRA vaga ABERTA — nao queima bom candidato)
  //  - demais          -> nao mexe (seguem disponiveis no banco)
  static async carimbarStatusGlobalVaga(vaga: any, opts: { incluirRecusados?: boolean } = {}) {
    const incluirRecusados = opts.incluirRecusados !== false;
    try {
      const sel = Array.isArray(vaga?.selecionados) ? vaga.selecionados : [];
      const rec = Array.isArray(vaga?.recusados) ? vaga.recusados : [];
      const idDe = (x: any) => Number(x?.curriculo_id) || 0;

      const contratadosIds = [...new Set(sel.filter((x: any) => x?.contratado === true).map(idDe).filter(Boolean))];
      for (const cid of contratadosIds) {
        await AppDataSource.query(`UPDATE curriculos SET status = 'contratado' WHERE id = $1`, [cid]);
      }

      if (!incluirRecusados) return;
      const recusadosIds = [...new Set(rec.map(idDe).filter(Boolean))].filter((id) => !contratadosIds.includes(id));
      for (const cid of recusadosIds) {
        const [ativoEmOutra] = await AppDataSource.query(
          `SELECT 1 FROM rh_vagas
            WHERE id <> $1
              AND status NOT IN ('Contratado(a)', 'Fechada')
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(selecionados, '[]'::jsonb)) s
                 WHERE (s->>'curriculo_id')::int = $2
              )
            LIMIT 1`,
          [vaga.id, cid]
        );
        if (!ativoEmOutra) {
          await AppDataSource.query(`UPDATE curriculos SET status = 'recusado' WHERE id = $1 AND status <> 'contratado'`, [cid]);
        }
      }
    } catch (e) {
      console.error('[Rh] carimbarStatusGlobalVaga:', e);
    }
  }

  // Reverte o carimbo de 'contratado' quando a vaga REABRE: candidatos que
  // estavam contratados NESTA vaga voltam a 'novo' no banco, exceto se ainda
  // estiverem contratados em OUTRA vaga.
  static async reverterContratadoGlobalVaga(selecionadosAntes: any[], vagaId: number) {
    try {
      const ids = [...new Set((Array.isArray(selecionadosAntes) ? selecionadosAntes : [])
        .filter((x: any) => x?.contratado === true)
        .map((x: any) => Number(x?.curriculo_id) || 0)
        .filter(Boolean))];
      for (const cid of ids) {
        const [contratadoEmOutra] = await AppDataSource.query(
          `SELECT 1 FROM rh_vagas
            WHERE id <> $1
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(selecionados, '[]'::jsonb)) s
                 WHERE (s->>'curriculo_id')::int = $2 AND (s->>'contratado')::boolean = true
              )
            LIMIT 1`,
          [vagaId, cid]
        );
        if (!contratadoEmOutra) {
          await AppDataSource.query(`UPDATE curriculos SET status = 'novo' WHERE id = $1 AND status = 'contratado'`, [cid]);
        }
      }
    } catch (e) {
      console.error('[Rh] reverterContratadoGlobalVaga:', e);
    }
  }

  // Carimba o status GLOBAL (Banco de Curriculos) de UM candidato a partir do
  // status LOCAL que ele acabou de receber na vaga. Usado quando a vaga ja esta
  // FINALIZADA: cada triagem manual reflete no Banco. Mapa posicao -> global:
  //   contratado->contratado | selecionado->aprovado | recusado->recusado
  //   em_analise->em_analise | novo->novo
  // Trava: nunca rebaixa quem esta contratado em OUTRA vaga (so contratado vence).
  static async carimbarCandidatoGlobal(curriculoId: number, statusLocal: string, vagaId: number) {
    try {
      const cid = Number(curriculoId);
      if (!cid) return;
      const map: Record<string, string> = {
        contratado: 'contratado', selecionado: 'aprovado', aprovado: 'aprovado',
        recusado: 'recusado', em_analise: 'em_analise', novo: 'novo',
      };
      const global = map[statusLocal];
      if (!global) return;

      if (global === 'contratado') {
        await AppDataSource.query(`UPDATE curriculos SET status = 'contratado' WHERE id = $1`, [cid]);
        return;
      }
      // Qualquer outro status: nao rebaixa quem esta contratado em OUTRA vaga.
      const [contratadoEmOutra] = await AppDataSource.query(
        `SELECT 1 FROM rh_vagas
          WHERE id <> $1
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(selecionados, '[]'::jsonb)) s
               WHERE (s->>'curriculo_id')::int = $2 AND (s->>'contratado')::boolean = true
            )
          LIMIT 1`,
        [vagaId, cid]
      );
      if (contratadoEmOutra) return;
      await AppDataSource.query(`UPDATE curriculos SET status = $2 WHERE id = $1`, [cid, global]);
    } catch (e) {
      console.error('[Rh] carimbarCandidatoGlobal:', e);
    }
  }

  // POST /rh/vagas/:vagaId/candidato-status
  // Define o status LOCAL do candidato dentro da vaga (selecionado, recusado,
  // em_analise/vagas_futuras, contratado, novo). Move o curriculo entre os 3
  // arrays JSONB: selecionados, recusados, vagas_futuras. Sem efeito global
  // ENQUANTO a vaga esta aberta — o carimbo global so acontece no fechamento.
  static async setCandidatoStatusVaga(req: AuthRequest, res: Response) {
    try {
      const vagaId = parseInt(req.params.vagaId);
      const { curriculo_id, status } = req.body;
      if (!curriculo_id || !status) return res.status(400).json({ error: 'curriculo_id e status obrigatorios' });
      const statusValidos = ['novo', 'selecionado', 'aprovado', 'recusado', 'em_analise', 'contratado'];
      const s = status === 'aprovado' ? 'selecionado' : status;
      if (!statusValidos.includes(s)) return res.status(400).json({ error: 'status invalido' });

      const [vaga] = await AppDataSource.query(
        `SELECT id, selecionados, recusados, vagas_futuras FROM rh_vagas WHERE id = $1`, [vagaId]
      );
      if (!vaga) return res.status(404).json({ error: 'Vaga nao encontrada' });

      // Tenta achar o curriculo. Se nao existir mais (ex: foi deletado depois
      // de ser selecionado), usa o SNAPSHOT que ja esta nos arrays da vaga.
      // Caso contrario, candidato fica preso em "Selecionado" sem poder mudar.
      let [cv] = await AppDataSource.query(`SELECT id, nome, whatsapp, email, cidade, created_at FROM curriculos WHERE id = $1`, [curriculo_id]);
      if (!cv) {
        const arrays = [vaga.selecionados, vaga.recusados, vaga.vagas_futuras];
        for (const arr of arrays) {
          const found = (Array.isArray(arr) ? arr : []).find((x: any) => Number(x?.curriculo_id) === Number(curriculo_id));
          if (found) { cv = found; break; }
        }
      }
      if (!cv) return res.status(404).json({ error: 'Candidato nao encontrado nesta vaga' });

      // Helper: remove o curriculo de qualquer array
      const remove = (arr: any[]) =>
        (Array.isArray(arr) ? arr : []).filter((x: any) => Number(x?.curriculo_id) !== Number(curriculo_id));
      const has = (arr: any[]) =>
        (Array.isArray(arr) ? arr : []).some((x: any) => Number(x?.curriculo_id) === Number(curriculo_id));

      let selecionados: any[] = remove(vaga.selecionados);
      let recusados: any[] = remove(vaga.recusados);
      let vagas_futuras: any[] = remove(vaga.vagas_futuras);

      const entryBase = {
        curriculo_id: cv.id,
        nome: cv.nome,
        whatsapp: cv.whatsapp,
        email: cv.email,
        cidade: cv.cidade,
        created_at: cv.created_at,
        adicionado_em: new Date().toISOString(),
      };

      if (s === 'selecionado') {
        selecionados.push({ ...entryBase, contratado: false });
      } else if (s === 'contratado') {
        // Mantem em selecionados com contratado=true
        const original = (Array.isArray(vaga.selecionados) ? vaga.selecionados : []).find((x: any) => Number(x?.curriculo_id) === Number(curriculo_id));
        selecionados.push({ ...(original || entryBase), contratado: true });
      } else if (s === 'recusado') {
        recusados.push(entryBase);
      } else if (s === 'em_analise') {
        vagas_futuras.push(entryBase);
      }
      // 'novo' => fica fora de tudo

      // Atualiza tudo numa tacada
      await AppDataSource.query(
        `UPDATE rh_vagas
           SET selecionados = $1::jsonb,
               recusados    = $2::jsonb,
               vagas_futuras = $3::jsonb
         WHERE id = $4`,
        [JSON.stringify(selecionados), JSON.stringify(recusados), JSON.stringify(vagas_futuras), vagaId]
      );

      // Recalcula o status da PROPRIA vaga com base no estado FINAL dos arrays.
      // - Se ainda existe algum contratado=true     -> 'Contratado(a)'
      // - Senao, se vaga nao esta Fechada           -> 'Em Selecao'
      //   (cobre o caso de voltar contratado p/ selecionado: vaga sai de
      //    'Contratado(a)' e volta pra 'Em Selecao' automaticamente)
      const temContratado = selecionados.some((x: any) => x?.contratado === true);
      const tinhaContratadoAntes = (Array.isArray(vaga.selecionados) ? vaga.selecionados : []).some((x: any) => x?.contratado === true);
      if (temContratado) {
        // grava data_fechamento ao contratar (preserva se ja existia); pra coluna "Dias em Aberto" / indicadores
        await AppDataSource.query(`UPDATE rh_vagas SET status = 'Contratado(a)', data_fechamento = COALESCE(data_fechamento, now()) WHERE id = $1 AND status <> 'Fechada'`, [vagaId]);
      } else if (tinhaContratadoAntes) {
        // SO reabre quando o candidato contratado foi des-contratado agora.
        // Se a vaga foi fechada manualmente (nunca teve candidato contratado),
        // NAO mexe no status — senao triar os outros candidatos reabria a vaga.
        await AppDataSource.query(`UPDATE rh_vagas SET status = 'Em Selecao', data_fechamento = NULL WHERE id = $1 AND status <> 'Fechada'`, [vagaId]);
      }
      // else: nem contratado antes nem depois -> preserva o status atual (Contratado manual / Em Selecao)

      // Sincroniza com o Banco de Curriculos.
      // Regra: enquanto a vaga esta ABERTA, status fica 100% LOCAL (nao mexe no
      // Banco). Quando a vaga esta FINALIZADA (Contratado(a)/Fechada), cada
      // triagem manual do candidato reflete no status global (cada posicao -> seu
      // status). Assim o Alexandre fica "Selecionado" no Banco e so muda se voce
      // mudar a posicao dele aqui na vaga.
      const [vagaPos] = await AppDataSource.query(`SELECT status FROM rh_vagas WHERE id = $1`, [vagaId]);
      const finalizada = ['Contratado(a)', 'Fechada'].includes(vagaPos?.status);
      if (finalizada) {
        await RhController.carimbarCandidatoGlobal(curriculo_id, s, vagaId);
      } else if (tinhaContratadoAntes && !temContratado) {
        // Vaga reabriu ao des-contratar -> reverte o contratado de antes p/ 'novo'.
        await RhController.reverterContratadoGlobalVaga(vaga.selecionados, vagaId);
      }

      res.json({ success: true, status_local: s, nome: cv.nome });
    } catch (e: any) {
      console.error('[Rh] setCandidatoStatusVaga:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/vagas/:vagaId/adicionar-interesse
  // Adiciona um curriculo como INTERESSADO (status local "novo") na vaga, via
  // botao "Adicionar do Banco" da tela Vagas. Adiciona o vaga.id ao
  // vagas_interesse_ids do curriculo — NAO mexe em selecionados (entao o status
  // local na vaga fica "novo" ate o RH clicar Selecionar).
  static async adicionarInteresseVaga(req: AuthRequest, res: Response) {
    try {
      const vagaId = parseInt(req.params.vagaId);
      const { curriculo_id } = req.body;
      if (!curriculo_id) return res.status(400).json({ error: 'curriculo_id obrigatorio' });

      const [vaga] = await AppDataSource.query(`SELECT id FROM rh_vagas WHERE id = $1`, [vagaId]);
      if (!vaga) return res.status(404).json({ error: 'Vaga nao encontrada' });

      const [cv] = await AppDataSource.query(`SELECT id, nome, vagas_interesse_ids FROM curriculos WHERE id = $1`, [curriculo_id]);
      if (!cv) return res.status(404).json({ error: 'Curriculo nao encontrado' });

      const atual: number[] = Array.isArray(cv.vagas_interesse_ids) ? cv.vagas_interesse_ids : [];
      if (atual.includes(vagaId)) {
        return res.json({ success: true, ja_estava: true, nome: cv.nome });
      }
      const novo = [...atual, vagaId];
      await AppDataSource.query(
        `UPDATE curriculos SET vagas_interesse_ids = $1::jsonb WHERE id = $2`,
        [JSON.stringify(novo), curriculo_id]
      );
      res.json({ success: true, nome: cv.nome });
    } catch (e: any) {
      console.error('[Rh] adicionarInteresseVaga:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/vagas/:vagaId/sincronizar-banco
  // Replica a posicao ATUAL de cada candidato da vaga no Banco de Curriculos
  // (selecionado->aprovado/contratado, recusado->recusado, vagas_futuras->em_analise).
  // Usado pelo prompt de triagem pos-contratacao ("Nao" = mantem posicoes atuais;
  // "Sim" usa como baseline antes do RH ajustar manualmente). Interessados puros
  // (status 'novo', em nenhum array) NAO sao tocados — evita rebaixar quem tem
  // status melhor vindo de outra vaga.
  static async sincronizarBancoVaga(req: AuthRequest, res: Response) {
    try {
      const vagaId = parseInt(req.params.vagaId);
      const [vaga] = await AppDataSource.query(
        `SELECT id, selecionados, recusados, vagas_futuras FROM rh_vagas WHERE id = $1`, [vagaId]
      );
      if (!vaga) return res.status(404).json({ error: 'Vaga nao encontrada' });
      const arr = (x: any) => (Array.isArray(x) ? x : []);
      for (const s of arr(vaga.selecionados)) {
        await RhController.carimbarCandidatoGlobal(s?.curriculo_id, s?.contratado === true ? 'contratado' : 'selecionado', vagaId);
      }
      for (const r of arr(vaga.recusados)) {
        await RhController.carimbarCandidatoGlobal(r?.curriculo_id, 'recusado', vagaId);
      }
      for (const f of arr(vaga.vagas_futuras)) {
        await RhController.carimbarCandidatoGlobal(f?.curriculo_id, 'em_analise', vagaId);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Rh] sincronizarBancoVaga:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarVaga(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      // Carimba o status global ANTES de excluir (tratamento "A"): contratados
      // viram contratado, recusados viram recusado. Roda antes do DELETE pra a
      // trava "ativo em outra vaga aberta" ainda enxergar esta vaga via id <> $1.
      const [vagaDel] = await AppDataSource.query(`SELECT id, selecionados, recusados FROM rh_vagas WHERE id = $1`, [id]);
      if (vagaDel) await RhController.carimbarStatusGlobalVaga(vagaDel);
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
