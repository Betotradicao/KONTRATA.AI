import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { minioService } from '../services/minio.service';

/** Controla ASOs (Atestados de Saúde Ocupacional) dos colaboradores */
export class RhAsoController {
  /** Lista ASOs de um colaborador ou todos */
  static async listar(req: AuthRequest, res: Response) {
    try {
      const colaboradorId = req.query.colaborador_id ? parseInt(req.query.colaborador_id as string) : null;
      let sql = `
        SELECT a.*, c.nome AS colaborador_nome, c.matricula, c.foto_url AS colaborador_foto,
               ca.nome AS cargo_nome
        FROM rh_asos a
        INNER JOIN rh_colaboradores c ON c.id = a.colaborador_id
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
      `;
      const params: any[] = [];
      if (colaboradorId) {
        sql += ` WHERE a.colaborador_id = $1`;
        params.push(colaboradorId);
      }
      sql += ` ORDER BY a.data_exame DESC`;
      const rows = await AppDataSource.query(sql, params);
      return res.json(rows);
    } catch (err: any) {
      console.error('[RH-ASO] listar:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Estatisticas globais: total, validos, a vencer 30d, vencidos
   *  Ciclo: o "ASO vigente" do colaborador eh o ultimo Periodico. Se nao houver
   *  Periodico, usa o ultimo Admissional. Demissional/Retorno/Mudanca de funcao
   *  sao eventos pontuais e nao definem vencimento. */
  static async stats(req: AuthRequest, res: Response) {
    try {
      // Colaboradores ativos NAO dispensados de ASO (aprendizes ficam de fora dos contadores).
      const totalColabAtivos = await AppDataSource.query(
        `SELECT COUNT(*)::int AS n FROM rh_colaboradores WHERE status='ativo' AND COALESCE(aso_dispensado, false) = false`
      );
      const total = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM rh_asos`);

      const aosDosAtivos = await AppDataSource.query(`
        SELECT DISTINCT ON (a.colaborador_id)
          a.id, a.colaborador_id, a.data_vencimento, a.resultado, a.tipo, a.data_exame
        FROM rh_asos a
        INNER JOIN rh_colaboradores c ON c.id = a.colaborador_id
          AND c.status='ativo'
          AND COALESCE(c.aso_dispensado, false) = false
        WHERE a.tipo IN ('admissional','periodico')
        ORDER BY a.colaborador_id,
                 CASE WHEN a.tipo='periodico' THEN 0 ELSE 1 END,
                 a.data_exame DESC
      `);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const em30 = new Date(hoje);
      em30.setDate(em30.getDate() + 30);

      let validos = 0, aVencer = 0, vencidos = 0, semAso = 0;
      const colaboradoresComAsoAtivo = new Set<number>();
      for (const a of aosDosAtivos) {
        colaboradoresComAsoAtivo.add(a.colaborador_id);
        if (!a.data_vencimento) continue;
        const venc = new Date(a.data_vencimento);
        venc.setHours(0, 0, 0, 0);
        if (venc < hoje) vencidos++;
        else if (venc <= em30) aVencer++;
        else validos++;
      }
      semAso = (totalColabAtivos[0].n || 0) - colaboradoresComAsoAtivo.size;

      return res.json({
        total_asos: total[0].n || 0,
        colaboradores_ativos: totalColabAtivos[0].n || 0,
        sem_aso: semAso,
        validos,
        a_vencer_30d: aVencer,
        vencidos,
      });
    } catch (err: any) {
      console.error('[RH-ASO] stats:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Lista colaboradores ativos com status do ASO mais recente (para a coluna esquerda) */
  static async listarColaboradoresComStatus(req: AuthRequest, res: Response) {
    try {
      const companyId = req.query.company_id as string | undefined;
      const params: any[] = [];
      let whereExtra = '';
      if (companyId && companyId !== '') {
        params.push(companyId);
        whereExtra = ` AND c.company_id = $${params.length}`;
      }
      // "vigente" = ultimo Periodico; se nao tem, ultimo Admissional.
      // Demissional/Retorno/Mudanca nao entram no calculo do status (eventos pontuais).
      // "counts" sao usados pra renderizar a trilha de fases na lista lateral.
      const rows = await AppDataSource.query(`
        SELECT c.id, c.nome, c.matricula, c.foto_url, c.status AS colab_status, c.company_id,
               COALESCE(c.aso_dispensado, false) AS aso_dispensado,
               ca.nome AS cargo_nome,
               COALESCE(comp.apelido, comp.nome_fantasia) AS empresa_nome,
               comp.cod_loja AS empresa_cod_loja,
               vig.id AS aso_id, vig.data_exame, vig.data_vencimento, vig.tipo, vig.resultado,
               counts.cnt_admissional, counts.cnt_periodico, counts.cnt_demissional,
               counts.cnt_retorno, counts.cnt_mudanca_funcao
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN companies comp ON comp.id = c.company_id
        LEFT JOIN LATERAL (
          SELECT a.id, a.data_exame, a.data_vencimento, a.tipo, a.resultado
          FROM rh_asos a
          WHERE a.colaborador_id = c.id AND a.tipo IN ('admissional','periodico')
          ORDER BY CASE WHEN a.tipo='periodico' THEN 0 ELSE 1 END, a.data_exame DESC
          LIMIT 1
        ) vig ON true
        LEFT JOIN LATERAL (
          SELECT
            SUM(CASE WHEN tipo='admissional' THEN 1 ELSE 0 END)::int AS cnt_admissional,
            SUM(CASE WHEN tipo='periodico' THEN 1 ELSE 0 END)::int AS cnt_periodico,
            SUM(CASE WHEN tipo='demissional' THEN 1 ELSE 0 END)::int AS cnt_demissional,
            SUM(CASE WHEN tipo='retorno' THEN 1 ELSE 0 END)::int AS cnt_retorno,
            SUM(CASE WHEN tipo='mudanca_funcao' THEN 1 ELSE 0 END)::int AS cnt_mudanca_funcao
          FROM rh_asos WHERE colaborador_id = c.id
        ) counts ON true
        WHERE c.status = 'ativo'${whereExtra}
        ORDER BY c.nome ASC
      `, params);
      return res.json(rows);
    } catch (err: any) {
      console.error('[RH-ASO] listarColabsComStatus:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Alterna a flag aso_dispensado do colaborador (aprendiz/estagio).
   *  Quando true, o colaborador NAO entra em "Sem ASO" e nao dispara alerta de vencimento. */
  static async toggleDispensado(req: AuthRequest, res: Response) {
    try {
      const colabId = parseInt(req.params.colaboradorId);
      const dispensar = !!req.body?.aso_dispensado;
      const [row] = await AppDataSource.query(
        `UPDATE rh_colaboradores SET aso_dispensado = $1 WHERE id = $2 RETURNING id, nome, aso_dispensado`,
        [dispensar, colabId]
      );
      if (!row) return res.status(404).json({ error: 'Colaborador nao encontrado' });
      return res.json(row);
    } catch (err: any) {
      console.error('[RH-ASO] toggleDispensado:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Cria novo ASO */
  static async criar(req: AuthRequest, res: Response) {
    try {
      const {
        colaborador_id, tipo, data_exame, validade_meses,
        resultado, clinica, medico_nome, medico_crm, observacoes,
      } = req.body;
      if (!colaborador_id || !tipo || !data_exame) {
        return res.status(400).json({ error: 'colaborador_id, tipo e data_exame sao obrigatorios' });
      }
      const meses = parseInt(validade_meses) || 12;
      // Calcula data_vencimento = data_exame + validade_meses
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_asos (colaborador_id, tipo, data_exame, validade_meses, data_vencimento, resultado, clinica, medico_nome, medico_crm, observacoes)
         VALUES ($1, $2, $3::date, $4::int, ($3::date + ($4::int * INTERVAL '1 month'))::date, $5, $6, $7, $8, $9)
         RETURNING *`,
        [colaborador_id, tipo, data_exame, meses, resultado || 'apto', clinica || null, medico_nome || null, medico_crm || null, observacoes || null]
      );
      return res.status(201).json(row);
    } catch (err: any) {
      console.error('[RH-ASO] criar:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Atualiza ASO */
  static async atualizar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const {
        tipo, data_exame, validade_meses,
        resultado, clinica, medico_nome, medico_crm, observacoes,
      } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_asos SET
           tipo = COALESCE($1, tipo),
           data_exame = COALESCE($2::date, data_exame),
           validade_meses = COALESCE($3::int, validade_meses),
           data_vencimento = (COALESCE($2::date, data_exame) + (COALESCE($3::int, validade_meses) * INTERVAL '1 month'))::date,
           resultado = COALESCE($4, resultado),
           clinica = COALESCE($5, clinica),
           medico_nome = COALESCE($6, medico_nome),
           medico_crm = COALESCE($7, medico_crm),
           observacoes = COALESCE($8, observacoes),
           updated_at = NOW()
         WHERE id = $9 RETURNING *`,
        [tipo || null, data_exame || null, validade_meses ? parseInt(validade_meses) : null, resultado || null, clinica || null, medico_nome || null, medico_crm || null, observacoes || null, id]
      );
      if (!row) return res.status(404).json({ error: 'ASO nao encontrado' });
      return res.json(row);
    } catch (err: any) {
      console.error('[RH-ASO] atualizar:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Upload do arquivo (PDF/foto) do ASO */
  static async uploadArquivo(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      const ext = (file.originalname || 'pdf').split('.').pop() || 'pdf';
      const objectName = `rh/asos/${id}/${Date.now()}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'application/pdf');
      const [row] = await AppDataSource.query(
        `UPDATE rh_asos SET arquivo_url = $1, arquivo_nome = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [url, file.originalname, id]
      );
      return res.json(row);
    } catch (err: any) {
      console.error('[RH-ASO] uploadArquivo:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Deleta ASO */
  static async deletar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM rh_asos WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'ASO nao encontrado' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[RH-ASO] deletar:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
