import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

// Helpers de calculo de periodos de ferias.
// Periodo aquisitivo: 12 meses a partir da admissao (ou do fim do anterior).
// Periodo concessivo: 12 meses imediatamente apos o aquisitivo.
// Limite "sem dobro": 11 meses do concessivo (1 mes antes do fim).
// Apos isso, qualquer dia gozado sai em DOBRO pra empresa.
// Normaliza qualquer formato (Date, ISO timestamp, YYYY-MM-DD) pra YYYY-MM-DD.
// Necessario porque pg retorna 'date' como objeto Date dependendo do driver.
function toDateStr(input: any): string {
  if (!input) return '';
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  const s = String(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO timestamp ou outro formato — tenta parse
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const base = toDateStr(dateStr);
  if (!base) return '';
  const d = new Date(base + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  // Ajuste pra ultimo dia do mes se o mes destino tem menos dias
  // (ex: 31/01 + 1 mes = 28/02, nao 03/03)
  if (d.getDate() < new Date(base + 'T00:00:00').getDate()) {
    d.setDate(0);
  }
  return d.toISOString().slice(0, 10);
}

function calcPeriodos(dataAdmissao: string, ferias: any[]): {
  periodoAquisitivoInicio: string;
  periodoAquisitivoFim: string;
  periodoConcessivoInicio: string;
  periodoConcessivoFim: string;
  limiteSemDobro: string;
  ultimoGozado: string | null;
} {
  // Pega o ultimo periodo TOTALMENTE GOZADO. Se nao houver, usa admissao.
  const gozadas = (ferias || [])
    .filter(f => f.status === 'gozada' && f.data_fim_gozo)
    .sort((a, b) => String(b.data_fim_gozo).localeCompare(String(a.data_fim_gozo)));
  const ultimoGozado = toDateStr(gozadas[0]?.data_fim_gozo) || null;
  // Inicio do proximo aquisitivo: dia seguinte ao fim do ultimo gozado,
  // OU data de admissao.
  let aquisitivoInicio: string;
  if (ultimoGozado) {
    const d = new Date(ultimoGozado + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    aquisitivoInicio = d.toISOString().slice(0, 10);
  } else {
    aquisitivoInicio = toDateStr(dataAdmissao);
  }
  const aquisitivoFim = addMonths(aquisitivoInicio, 12);
  // Concessivo comeca no dia seguinte ao fim do aquisitivo.
  const concDIni = new Date(aquisitivoFim + 'T00:00:00'); concDIni.setDate(concDIni.getDate() + 1);
  const concessivoInicio = concDIni.toISOString().slice(0, 10);
  const concessivoFim = addMonths(concessivoInicio, 12);
  const limiteSemDobro = addMonths(concessivoInicio, 11);
  return {
    periodoAquisitivoInicio: aquisitivoInicio,
    periodoAquisitivoFim: aquisitivoFim,
    periodoConcessivoInicio: concessivoInicio,
    periodoConcessivoFim: concessivoFim,
    limiteSemDobro,
    ultimoGozado,
  };
}

function calcStatus(hojeStr: string, periodos: ReturnType<typeof calcPeriodos>, programada: string | null): string {
  // Status agregado de exibicao na lista.
  // 'em_dia'       - aquisitivo ainda rodando
  // 'pode_tirar'   - concessivo aberto, longe do limite
  // 'vence_30d'   - concessivo no limite (faltam <=30 dias do limite sem dobro)
  // 'em_dobro'    - passou do limite sem dobro
  // 'programada'  - tem data_programada futura
  if (programada && programada >= hojeStr) return 'programada';
  if (hojeStr < periodos.periodoConcessivoInicio) return 'em_dia';
  if (hojeStr > periodos.limiteSemDobro) return 'em_dobro';
  // Quantos dias faltam pro limite
  const ms = new Date(periodos.limiteSemDobro + 'T00:00:00').getTime() - new Date(hojeStr + 'T00:00:00').getTime();
  const dias = Math.ceil(ms / 86400000);
  if (dias <= 30) return 'vence_30d';
  return 'pode_tirar';
}

export class RhFeriasController {
  // GET /rh/ferias — lista colaboradores ativos com dados calculados
  static async listar(_req: Request, res: Response) {
    try {
      const colabs = await AppDataSource.query(`
        SELECT c.id, c.matricula, c.nome, c.foto_url, c.data_admissao,
               ca.nome AS cargo_nome,
               d.nome AS setor_nome, d.id AS setor_id,
               comp.id AS empresa_id, comp.apelido AS empresa_apelido, comp.nome_fantasia AS empresa_nome
          FROM rh_colaboradores c
          LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
          LEFT JOIN rh_departamentos d ON d.id = c.departamento_id
          LEFT JOIN rh_empresas comp ON comp.id = c.company_id
          WHERE c.status = 'ativo' AND c.data_admissao IS NOT NULL
          ORDER BY c.nome
      `);

      // Pega TODAS as ferias dos colabs ativos numa query
      const ferias = await AppDataSource.query(`
        SELECT f.* FROM rh_ferias f
          JOIN rh_colaboradores c ON c.id = f.colaborador_id
          WHERE c.status = 'ativo'
      `);
      // Indexa por colaborador
      const feriasByColab = new Map<number, any[]>();
      for (const f of ferias) {
        const arr = feriasByColab.get(f.colaborador_id) || [];
        arr.push(f);
        feriasByColab.set(f.colaborador_id, arr);
      }

      const hoje = new Date().toISOString().slice(0, 10);

      const result = colabs.map((c: any) => {
        const colabFerias = feriasByColab.get(c.id) || [];
        const periodos = calcPeriodos(c.data_admissao, colabFerias);
        // Proxima programada (mais recente)
        const programada = colabFerias
          .filter(f => f.status === 'programada' && f.data_programada)
          .sort((a, b) => String(a.data_programada).localeCompare(String(b.data_programada)))[0];
        const status = calcStatus(hoje, periodos, programada?.data_programada || null);
        return {
          id: c.id,
          matricula: c.matricula,
          nome: c.nome,
          foto_url: c.foto_url,
          data_admissao: c.data_admissao,
          cargo_nome: c.cargo_nome,
          setor_id: c.setor_id,
          setor_nome: c.setor_nome,
          empresa_id: c.empresa_id,
          empresa_apelido: c.empresa_apelido,
          empresa_nome: c.empresa_nome,
          ultimo_periodo_gozado: periodos.ultimoGozado,
          periodo_aquisitivo_inicio: periodos.periodoAquisitivoInicio,
          periodo_aquisitivo_fim: periodos.periodoAquisitivoFim,
          periodo_concessivo_inicio: periodos.periodoConcessivoInicio,
          periodo_concessivo_fim: periodos.periodoConcessivoFim,
          limite_sem_dobro: periodos.limiteSemDobro,
          data_programada: programada?.data_programada || null,
          ferias_id_programada: programada?.id || null,
          status,
          // Historico pra detalhe
          historico: colabFerias.map(f => ({
            id: f.id,
            periodo_aquisitivo_inicio: f.periodo_aquisitivo_inicio,
            periodo_aquisitivo_fim: f.periodo_aquisitivo_fim,
            data_programada: f.data_programada,
            data_inicio_gozo: f.data_inicio_gozo,
            data_fim_gozo: f.data_fim_gozo,
            dias_gozados: f.dias_gozados,
            abono_pecuniario_dias: f.abono_pecuniario_dias,
            status: f.status,
          })),
        };
      });

      res.json(result);
    } catch (e: any) {
      console.error('[RhFerias] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // GET /rh/ferias/calendario?mes=YYYY-MM — retorna eventos de ferias no mes
  static async calendario(req: Request, res: Response) {
    try {
      const mes = String(req.query.mes || new Date().toISOString().slice(0, 7));
      const inicioMes = `${mes}-01`;
      const fimMesD = new Date(inicioMes + 'T00:00:00');
      fimMesD.setMonth(fimMesD.getMonth() + 1);
      fimMesD.setDate(0);
      const fimMes = fimMesD.toISOString().slice(0, 10);

      // Pega ferias programadas/em_gozo/gozadas que sobrepoem ao mes
      const eventos = await AppDataSource.query(`
        SELECT f.id, f.colaborador_id, f.status,
               f.data_programada, f.data_inicio_gozo, f.data_fim_gozo,
               f.dias_gozados, f.abono_pecuniario_dias,
               c.nome AS colab_nome, c.foto_url, c.matricula,
               ca.nome AS cargo_nome,
               d.nome AS setor_nome, d.id AS setor_id,
               COALESCE(comp.apelido, comp.nome_fantasia) AS empresa_nome
          FROM rh_ferias f
          JOIN rh_colaboradores c ON c.id = f.colaborador_id
          LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
          LEFT JOIN rh_departamentos d ON d.id = c.departamento_id
          LEFT JOIN rh_empresas comp ON comp.id = c.company_id
          WHERE c.status = 'ativo'
            AND f.status IN ('programada', 'em_gozo', 'gozada')
            AND (
              -- Programada: o periodo de gozo previsto (programada ate programada + dias_gozados - 1)
              -- se sobrepoe ao mes — pinta todo o periodo no calendario, nao so o primeiro dia.
              (f.data_programada IS NOT NULL
                AND f.data_programada <= $2::date
                AND (f.data_programada + (COALESCE(f.dias_gozados, 30) - 1) * INTERVAL '1 day')::date >= $1::date)
              -- Em gozo / gozada: intervalo sobrepoe o mes
              OR (f.data_inicio_gozo IS NOT NULL AND f.data_inicio_gozo <= $2 AND COALESCE(f.data_fim_gozo, '9999-12-31') >= $1)
            )
          ORDER BY COALESCE(f.data_inicio_gozo, f.data_programada)
      `, [inicioMes, fimMes]);

      res.json({ mes, inicio: inicioMes, fim: fimMes, eventos });
    } catch (e: any) {
      console.error('[RhFerias] calendario:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/ferias — cria registro (programar OU marcar gozado direto)
  static async criar(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaborador_id) return res.status(400).json({ error: 'colaborador_id obrigatorio' });

      // Calcula periodos com base no historico atual do colaborador
      const [colab] = await AppDataSource.query(
        `SELECT data_admissao FROM rh_colaboradores WHERE id = $1`, [b.colaborador_id]
      );
      if (!colab) return res.status(404).json({ error: 'Colaborador nao encontrado' });
      const historico = await AppDataSource.query(
        `SELECT * FROM rh_ferias WHERE colaborador_id = $1`, [b.colaborador_id]
      );
      const periodos = calcPeriodos(colab.data_admissao, historico);

      const status = b.status || (b.data_inicio_gozo ? 'gozada' : 'programada');
      const diasGozados = b.dias_gozados != null ? Number(b.dias_gozados) : 30;
      const abono = b.abono_pecuniario_dias != null ? Number(b.abono_pecuniario_dias) : 0;

      const [row] = await AppDataSource.query(
        `INSERT INTO rh_ferias (
          colaborador_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim,
          periodo_concessivo_inicio, periodo_concessivo_fim,
          data_programada, data_inicio_gozo, data_fim_gozo,
          dias_gozados, abono_pecuniario_dias, status, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          b.colaborador_id,
          periodos.periodoAquisitivoInicio,
          periodos.periodoAquisitivoFim,
          periodos.periodoConcessivoInicio,
          periodos.periodoConcessivoFim,
          b.data_programada || null,
          b.data_inicio_gozo || null,
          b.data_fim_gozo || null,
          diasGozados,
          abono,
          status,
          b.observacoes || null,
        ]
      );
      res.status(201).json(row);
    } catch (e: any) {
      console.error('[RhFerias] criar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/ferias/:id
  static async atualizar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const b = req.body || {};
      const fields: string[] = [];
      const values: any[] = [];
      let i = 1;
      const set = (col: string, val: any) => {
        if (val !== undefined) { fields.push(`${col} = $${i++}`); values.push(val); }
      };
      set('data_programada', b.data_programada ?? null);
      set('data_inicio_gozo', b.data_inicio_gozo ?? null);
      set('data_fim_gozo', b.data_fim_gozo ?? null);
      set('dias_gozados', b.dias_gozados);
      set('abono_pecuniario_dias', b.abono_pecuniario_dias);
      set('status', b.status);
      set('observacoes', b.observacoes ?? null);
      fields.push(`updated_at = NOW()`);
      values.push(id);
      const sql = `UPDATE rh_ferias SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
      const [row] = await AppDataSource.query(sql, values);
      if (!row) return res.status(404).json({ error: 'Ferias nao encontradas' });
      res.json(row);
    } catch (e: any) {
      console.error('[RhFerias] atualizar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // DELETE /rh/ferias/:id
  static async deletar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM rh_ferias WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Ferias nao encontradas' });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[RhFerias] deletar:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
