import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Performance por Setor (Financeiro RH).
 * Grade: setores (Setor da Loja ↔ Setor do Colaborador) × meses do ano.
 * Qtd de colaboradores = ativos daquele setor (departamento) naquela loja.
 * Performance = venda ÷ qtd (venda média por colaborador). Tudo por loja.
 */
export class RhPerformanceController {
  /** GET /rh/performance-setor?cod_loja=&ano= — a grade da loja no ano. */
  static async listar(req: AuthRequest, res: Response) {
    try {
      const codLoja = parseInt(req.query.cod_loja as string);
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      if (!codLoja && codLoja !== 0) return res.status(400).json({ error: 'cod_loja é obrigatório' });

      const setores = await AppDataSource.query(
        `SELECT s.id, s.nome_setor_loja, s.departamento_id, s.cod_loja, s.ordem,
                d.nome AS departamento_nome,
                (SELECT COUNT(*)::int FROM rh_colaboradores c
                   JOIN rh_empresas e ON e.id = c.company_id
                   WHERE c.status = 'ativo' AND e.cod_loja = s.cod_loja
                     AND c.departamento_id = s.departamento_id) AS qtd_colaboradores,
                (SELECT COUNT(*)::int FROM rh_colaboradores c
                   JOIN rh_empresas e ON e.id = c.company_id
                   LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
                   WHERE c.status = 'ativo' AND e.cod_loja = s.cod_loja
                     AND c.departamento_id = s.departamento_id
                     AND UPPER(COALESCE(rt.nome,'')) LIKE '%CLT%') AS qtd_clt,
                (SELECT COUNT(*)::int FROM rh_colaboradores c
                   JOIN rh_empresas e ON e.id = c.company_id
                   LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
                   WHERE c.status = 'ativo' AND e.cod_loja = s.cod_loja
                     AND c.departamento_id = s.departamento_id
                     AND UPPER(COALESCE(rt.nome,'')) LIKE '%APRENDIZ%') AS qtd_aprendiz
         FROM rh_performance_setores s
         LEFT JOIN rh_departamentos d ON d.id = s.departamento_id
         WHERE s.cod_loja = $1
         ORDER BY s.ordem, s.nome_setor_loja`, [codLoja]);

      const ids = setores.map((s: any) => s.id);
      let vendas: any[] = [];
      if (ids.length) {
        vendas = await AppDataSource.query(
          `SELECT setor_id, mes, venda FROM rh_performance_vendas
           WHERE ano = $1 AND setor_id = ANY($2)`, [ano, ids]);
      }
      const vendaMap: Record<string, number> = {};
      for (const v of vendas) vendaMap[`${v.setor_id}-${v.mes}`] = Number(v.venda);

      // Headcount REAL da loja (colaboradores ativos cadastrados) — usado no TOTAL.
      // NÃO é a soma das qtd por setor (os mesmos colaboradores se repetem entre setores).
      const [tot] = await AppDataSource.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE UPPER(COALESCE(rt.nome,'')) LIKE '%CLT%')::int AS clt,
                COUNT(*) FILTER (WHERE UPPER(COALESCE(rt.nome,'')) LIKE '%APRENDIZ%')::int AS aprendiz
           FROM rh_colaboradores c
           JOIN rh_empresas e ON e.id = c.company_id
           LEFT JOIN rh_regimes_trabalho rt ON rt.id = c.regime_trabalho_id
          WHERE c.status = 'ativo' AND e.cod_loja = $1`, [codLoja]);

      const linhas = setores.map((s: any) => {
        const qtd = s.qtd_colaboradores || 0;
        const meses = Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1;
          const venda = vendaMap[`${s.id}-${mes}`] || 0;
          return { mes, venda, performance: qtd > 0 ? +(venda / qtd).toFixed(2) : 0 };
        });
        return {
          id: s.id, nome_setor_loja: s.nome_setor_loja,
          departamento_id: s.departamento_id, departamento_nome: s.departamento_nome,
          qtd_colaboradores: qtd, qtd_clt: s.qtd_clt || 0, qtd_aprendiz: s.qtd_aprendiz || 0, meses,
        };
      });

      return res.json({
        cod_loja: codLoja, ano, setores: linhas,
        total_colaboradores: tot?.total || 0,
        total_clt: tot?.clt || 0,
        total_aprendiz: tot?.aprendiz || 0,
      });
    } catch (e: any) {
      console.error('[Performance] listar:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao listar performance' });
    }
  }

  /** POST /rh/performance-setor — cria um vínculo Setor da Loja ↔ Setor do Colaborador. */
  static async criarSetor(req: AuthRequest, res: Response) {
    try {
      const { cod_loja, nome_setor_loja, departamento_id } = req.body;
      if (!cod_loja && cod_loja !== 0) return res.status(400).json({ error: 'cod_loja é obrigatório' });
      if (!nome_setor_loja || !String(nome_setor_loja).trim()) return res.status(400).json({ error: 'Informe o nome do Setor da Loja' });
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_performance_setores (cod_loja, nome_setor_loja, departamento_id, ordem)
         VALUES ($1, $2, $3, COALESCE((SELECT MAX(ordem)+1 FROM rh_performance_setores WHERE cod_loja=$1), 0))
         RETURNING id`,
        [cod_loja, String(nome_setor_loja).trim().toUpperCase(), departamento_id || null]);
      return res.json({ id: row.id });
    } catch (e: any) {
      console.error('[Performance] criarSetor:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao criar setor' });
    }
  }

  /** PUT /rh/performance-setor/:id — edita nome/vínculo do setor. */
  static async atualizarSetor(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome_setor_loja, departamento_id } = req.body;
      await AppDataSource.query(
        `UPDATE rh_performance_setores SET nome_setor_loja = COALESCE($2, nome_setor_loja),
           departamento_id = $3 WHERE id = $1`,
        [id, nome_setor_loja ? String(nome_setor_loja).trim().toUpperCase() : null, departamento_id || null]);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[Performance] atualizarSetor:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao atualizar setor' });
    }
  }

  /** DELETE /rh/performance-setor/:id — remove o setor (e suas vendas em cascata). */
  static async deletarSetor(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.query(`DELETE FROM rh_performance_setores WHERE id = $1`, [id]);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[Performance] deletarSetor:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao excluir setor' });
    }
  }

  /** POST /rh/performance-setor/venda — grava/atualiza a venda de um setor num mês. */
  static async salvarVenda(req: AuthRequest, res: Response) {
    try {
      const { setor_id, ano, mes, venda } = req.body;
      if (!setor_id || !ano || !mes) return res.status(400).json({ error: 'setor_id, ano e mes são obrigatórios' });
      const val = Number(venda) || 0;
      await AppDataSource.query(
        `INSERT INTO rh_performance_vendas (setor_id, ano, mes, venda, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (setor_id, ano, mes) DO UPDATE SET venda = EXCLUDED.venda, updated_at = NOW()`,
        [setor_id, ano, mes, val]);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[Performance] salvarVenda:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao salvar venda' });
    }
  }
}
