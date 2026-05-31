import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { RhEscalaTurno } from '../entities/RhEscalaTurno';
import { RhEscalaTemplate } from '../entities/RhEscalaTemplate';
import { RhEscalaLancamento } from '../entities/RhEscalaLancamento';
import { RhEscalaCobertura } from '../entities/RhEscalaCobertura';
import { RhEscalaFerias } from '../entities/RhEscalaFerias';
import { RhEscalaLicenca } from '../entities/RhEscalaLicenca';
import { RhEscalaExcessao } from '../entities/RhEscalaExcessao';

const turnoRepo = () => AppDataSource.getRepository(RhEscalaTurno);
const templateRepo = () => AppDataSource.getRepository(RhEscalaTemplate);
const lancRepo = () => AppDataSource.getRepository(RhEscalaLancamento);
const coberturaRepo = () => AppDataSource.getRepository(RhEscalaCobertura);
const feriasRepo = () => AppDataSource.getRepository(RhEscalaFerias);
const licencaRepo = () => AppDataSource.getRepository(RhEscalaLicenca);
const excessaoRepo = () => AppDataSource.getRepository(RhEscalaExcessao);

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class RhEscalaController {
  // ============ TURNOS (catalogo) ============
  static async listarTurnos(_req: Request, res: Response) {
    try {
      const rows = await turnoRepo().find({ where: { ativo: true }, order: { tipo: 'ASC', codigo: 'ASC' } });
      res.json(rows);
    } catch (e: any) {
      console.error('[RhEscala] listarTurnos:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarTurno(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.codigo || !b.nome) return res.status(400).json({ error: 'codigo e nome obrigatorios' });
      const t = turnoRepo().create({
        codigo: String(b.codigo).trim().toUpperCase(),
        nome: String(b.nome).trim(),
        horaInicio: b.horaInicio || null,
        horaFim: b.horaFim || null,
        totalHoras: b.totalHoras != null ? Number(b.totalHoras) : null,
        pausaMinutos: b.pausaMinutos != null ? Number(b.pausaMinutos) : 0,
        pausaInicio: b.pausaInicio || null,
        pausaFim: b.pausaFim || null,
        tipo: b.tipo || 'turno',
        cor: b.cor || null,
        companyId: b.companyId || null,
        ativo: true,
      });
      await turnoRepo().save(t);
      res.status(201).json(t);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizarTurno(req: Request, res: Response) {
    try {
      const t = await turnoRepo().findOne({ where: { id: req.params.id } });
      if (!t) return res.status(404).json({ error: 'Turno nao encontrado' });
      const b = req.body || {};
      if (b.codigo !== undefined) t.codigo = String(b.codigo).trim().toUpperCase();
      if (b.nome !== undefined) t.nome = String(b.nome).trim();
      if (b.horaInicio !== undefined) t.horaInicio = b.horaInicio || null;
      if (b.horaFim !== undefined) t.horaFim = b.horaFim || null;
      if (b.totalHoras !== undefined) t.totalHoras = b.totalHoras != null ? Number(b.totalHoras) : null;
      if (b.pausaMinutos !== undefined) t.pausaMinutos = b.pausaMinutos != null ? Number(b.pausaMinutos) : 0;
      if (b.pausaInicio !== undefined) t.pausaInicio = b.pausaInicio || null;
      if (b.pausaFim !== undefined) t.pausaFim = b.pausaFim || null;
      if (b.tipo !== undefined) t.tipo = b.tipo;
      if (b.cor !== undefined) t.cor = b.cor || null;
      if (b.ativo !== undefined) t.ativo = !!b.ativo;
      await turnoRepo().save(t);
      res.json(t);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarTurno(req: Request, res: Response) {
    try {
      const t = await turnoRepo().findOne({ where: { id: req.params.id } });
      if (!t) return res.status(404).json({ error: 'Turno nao encontrado' });
      // Tipos fixos do sistema (feriado/ferias/folga/licenca) NAO podem ser
      // excluidos — sao usados em toda a escala como codigos especiais.
      if (t.tipo && t.tipo !== 'turno') {
        return res.status(400).json({ error: `Tipo "${t.tipo}" é fixo do sistema e não pode ser excluído` });
      }
      t.ativo = false;
      await turnoRepo().save(t);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ COBERTURA por setor x turno x dia-da-semana ============
  static async listarCobertura(req: Request, res: Response) {
    try {
      const { company_id, departamento_id } = req.query;
      const where: any = {};
      if (company_id) where.companyId = company_id;
      if (departamento_id) where.departamentoId = Number(departamento_id);
      const rows = await coberturaRepo().find({ where });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async salvarCobertura(req: Request, res: Response) {
    try {
      // payload: [{ companyId, departamentoId, turnoId, diaSemana, minimo }, ...]
      const items: any[] = Array.isArray(req.body) ? req.body : [];
      for (const it of items) {
        const existing = await coberturaRepo().findOne({
          where: {
            companyId: it.companyId || null,
            departamentoId: it.departamentoId || null,
            turnoId: it.turnoId,
            diaSemana: it.diaSemana,
          },
        });
        if (existing) {
          existing.minimo = Number(it.minimo) || 0;
          await coberturaRepo().save(existing);
        } else {
          await coberturaRepo().save(coberturaRepo().create({
            companyId: it.companyId || null,
            departamentoId: it.departamentoId || null,
            turnoId: it.turnoId,
            diaSemana: Number(it.diaSemana),
            minimo: Number(it.minimo) || 0,
          }));
        }
      }
      res.json({ success: true, total: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ TEMPLATES (por colaborador) ============
  static async obterTemplate(req: Request, res: Response) {
    try {
      const t = await templateRepo().findOne({
        where: { colaboradorId: Number(req.params.colaboradorId), ativo: true },
        order: { createdAt: 'DESC' },
      });
      res.json(t || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async salvarTemplate(req: Request, res: Response) {
    try {
      const colaboradorId = Number(req.params.colaboradorId);
      const b = req.body || {};
      let t = await templateRepo().findOne({ where: { colaboradorId, ativo: true } });
      if (!t) {
        t = templateRepo().create({ colaboradorId, tipoRotacao: '6x1', padraoSemanal: [] });
      }
      if (b.tipoRotacao !== undefined) t.tipoRotacao = b.tipoRotacao;
      if (b.folgaPreferida !== undefined) t.folgaPreferida = b.folgaPreferida || null;
      if (b.trabalhaFeriado !== undefined) t.trabalhaFeriado = !!b.trabalhaFeriado;
      if (b.padraoSemanal !== undefined) t.padraoSemanal = b.padraoSemanal;
      if (b.vigenciaInicio !== undefined) t.vigenciaInicio = b.vigenciaInicio || null;
      if (b.vigenciaFim !== undefined) t.vigenciaFim = b.vigenciaFim || null;
      if (b.observacao !== undefined) t.observacao = b.observacao || null;
      // Novos campos do motor de pre-preencher automatico
      if (b.tipoFolga !== undefined) t.tipoFolga = b.tipoFolga || null;
      if (b.diaFolgaFixa !== undefined) t.diaFolgaFixa = b.diaFolgaFixa === null || b.diaFolgaFixa === '' ? null : Number(b.diaFolgaFixa);
      if (b.diaFolgaFixa2 !== undefined) t.diaFolgaFixa2 = b.diaFolgaFixa2 === null || b.diaFolgaFixa2 === '' ? null : Number(b.diaFolgaFixa2);
      if (b.dataRefFolga !== undefined) t.dataRefFolga = b.dataRefFolga || null;
      if (b.rotacaoDomingo !== undefined) t.rotacaoDomingo = b.rotacaoDomingo || null;
      if (b.dataRefDomingo !== undefined) t.dataRefDomingo = b.dataRefDomingo || null;
      if (b.turnoPadraoId !== undefined) t.turnoPadraoId = b.turnoPadraoId || null;
      if (b.turnoSabadoId !== undefined) t.turnoSabadoId = b.turnoSabadoId || null;
      if (b.turnoDomingoId !== undefined) t.turnoDomingoId = b.turnoDomingoId || null;
      if (b.feriadoComportamento !== undefined) t.feriadoComportamento = b.feriadoComportamento || null;
      t.ativo = true;
      await templateRepo().save(t);
      res.json(t);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ PRE-PREENCHER MES (motor automatico) ============
  // POST /rh/escala/pre-preencher/:colaboradorId?mes=YYYY-MM
  //
  // Le o template do colaborador e GERA lancamentos de escala pro mes inteiro
  // seguindo as regras configuradas:
  //   - Folga semanal FIXA num dia OU ROTATIVA a cada 6 dias (a partir de data_ref)
  //   - Domingo: sempre / nunca / 1x1 / 2x1 / 3x1 / mensal_1/2/3 (com data_ref)
  //   - Turno padrao da semana, turno sabado, turno domingo
  //   - Feriado: trabalha / folga / compensa
  //   - Bloqueio: ferias programadas, atestados, licencas
  //
  // Estrategia: DELETE lancamentos com origem='auto' do mes + INSERT novos.
  // Lancamentos manuais (origem='manual') sao preservados.
  static async prePreencherMes(req: Request, res: Response) {
    try {
      const colaboradorId = Number(req.params.colaboradorId);
      const mes = (req.query.mes as string) || ymd(new Date()).slice(0, 7);
      const [yr, mn] = mes.split('-').map(Number);
      const primeiro = new Date(yr, mn - 1, 1);
      const ultimo = new Date(yr, mn, 0);

      // 1. Carregar template
      const t = await templateRepo().findOne({ where: { colaboradorId, ativo: true } });
      if (!t) return res.status(400).json({ error: 'Colaborador sem template cadastrado — abra o lapis e configure primeiro' });

      // 2. Carregar codigos especiais (FG, FE, FRDO, ATS) e turnos
      const turnos = await turnoRepo().find({ where: { ativo: true } });
      const turnoPorCodigo = (cod: string) => turnos.find(x => x.codigo === cod);
      const turnoFG = turnoPorCodigo('FG');
      const turnoFRDO = turnoPorCodigo('FRDO');
      const turnoFE = turnoPorCodigo('FE');
      const turnoATS = turnoPorCodigo('ATS');

      // 3. Buscar ferias/licencas vigentes no mes pra este colaborador
      const [feriasRows, licencasRows, feriadosRaw, excessoesRows] = await Promise.all([
        AppDataSource.query(
          `SELECT to_char(data_inicio,'YYYY-MM-DD') AS ini, to_char(data_fim,'YYYY-MM-DD') AS fim
           FROM rh_escala_ferias WHERE colaborador_id = $1 AND data_inicio <= $3 AND data_fim >= $2`,
          [colaboradorId, ymd(primeiro), ymd(ultimo)]
        ),
        AppDataSource.query(
          `SELECT to_char(data_inicio,'YYYY-MM-DD') AS ini, to_char(data_fim,'YYYY-MM-DD') AS fim
           FROM rh_escala_licencas WHERE colaborador_id = $1 AND data_inicio <= $3 AND data_fim >= $2`,
          [colaboradorId, ymd(primeiro), ymd(ultimo)]
        ),
        AppDataSource.query(
          `SELECT to_char(data,'YYYY-MM-DD') AS data, nome FROM rh_feriados WHERE data BETWEEN $1 AND $2`,
          [ymd(primeiro), ymd(ultimo)]
        ).catch(() => []),
        AppDataSource.query(
          `SELECT to_char(data,'YYYY-MM-DD') AS data, turno_id FROM rh_escala_excessoes
           WHERE colaborador_id = $1 AND data BETWEEN $2 AND $3`,
          [colaboradorId, ymd(primeiro), ymd(ultimo)]
        ).catch(() => []),
      ]);

      const isInRange = (d: string, ranges: any[]) => ranges.some((r: any) => d >= r.ini && d <= r.fim);
      const feriadosSet = new Set((feriadosRaw as any[]).map((f: any) => f.data));
      const excessaoPorData = new Map<string, string>();
      for (const e of excessoesRows as any[]) excessaoPorData.set(e.data, e.turno_id);

      // 4. Helpers de calculo de folga rotativa e domingo
      const diffDias = (d1: string, d2: string) => {
        const a = new Date(d1); const b = new Date(d2);
        return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
      };

      const ehFolgaRotativa = (dataStr: string): boolean => {
        if (!t.dataRefFolga) return false;
        const diff = diffDias(t.dataRefFolga, dataStr);
        if (diff < 0) return false;
        // ciclo: 6x1 -> a cada 7 dias; 5x2 -> a cada 7 dias 2x; etc
        const ciclo = t.tipoRotacao === '5x2' ? 7 : 7; // simplificacao: 6x1 = 1 folga a cada 7
        return diff % ciclo === 0;
      };

      const ehDomingoFolga = (dataStr: string): boolean => {
        const d = new Date(dataStr + 'T00:00:00');
        if (d.getDay() !== 0) return false; // nao e domingo
        const rot = t.rotacaoDomingo || 'sempre';
        if (rot === 'sempre') return false;
        if (rot === 'nunca') return true;
        if (rot === 'mensal_1') return Math.ceil(d.getDate() / 7) === 1;
        if (rot === 'mensal_2') return Math.ceil(d.getDate() / 7) === 2;
        if (rot === 'mensal_3') return Math.ceil(d.getDate() / 7) === 3;
        if (rot === 'mensal_4') return Math.ceil(d.getDate() / 7) === 4;
        if (rot === 'mensal_ultimo') {
          // Ultimo domingo do mes: somar 7 dias e ver se ainda esta no mesmo mes
          const proximo = new Date(d); proximo.setDate(proximo.getDate() + 7);
          return proximo.getMonth() !== d.getMonth();
        }
        // 1x1 / 2x1 / 3x1 — usa data_ref_domingo como pivo
        if (!t.dataRefDomingo) return false;
        const semanasDesde = diffDias(t.dataRefDomingo, dataStr) / 7;
        if (semanasDesde < 0) return false;
        if (rot === '1x1') return semanasDesde % 2 === 0; // folga a cada 2 semanas
        if (rot === '2x1') return semanasDesde % 3 === 0; // folga a cada 3 semanas
        if (rot === '3x1') return semanasDesde % 4 === 0; // folga a cada 4 semanas
        return false;
      };

      // 5. Gerar lancamentos dia a dia
      const lancamentosGerados: Array<{ data: string; turno_id: string | null; codigo: string }> = [];
      const cursor = new Date(primeiro);
      while (cursor <= ultimo) {
        const dataStr = ymd(cursor);
        const dow = cursor.getDay(); // 0=dom..6=sab
        let turnoId: string | null = null;
        let codigo = '';

        // Prioridade (decrescente):
        // 1. Excecao manual (excecoes)
        if (excessaoPorData.has(dataStr)) {
          turnoId = excessaoPorData.get(dataStr) || null;
          codigo = 'excecao';
        }
        // 2. Ferias
        else if (isInRange(dataStr, feriasRows as any[])) {
          turnoId = turnoFE?.id || null;
          codigo = 'FE';
        }
        // 3. Licenca/atestado
        else if (isInRange(dataStr, licencasRows as any[])) {
          turnoId = turnoATS?.id || null;
          codigo = 'ATS';
        }
        // 4. Feriado
        else if (feriadosSet.has(dataStr)) {
          const comp = t.feriadoComportamento || (t.trabalhaFeriado ? 'trabalha' : 'folga');
          if (comp === 'folga') {
            turnoId = turnoFRDO?.id || null;
            codigo = 'FRDO';
          } else if (comp === 'alternado') {
            // Conta quantos feriados ja passaram no ano até esta data — pares trabalham, ímpares folgam
            const feriadosAteAqui = (feriadosRaw as any[])
              .filter((f: any) => f.data <= dataStr)
              .length;
            if (feriadosAteAqui % 2 === 0) {
              turnoId = (dow === 0 ? t.turnoDomingoId : dow === 6 ? t.turnoSabadoId : t.turnoPadraoId) || t.turnoPadraoId;
              codigo = 'turno';
            } else {
              turnoId = turnoFRDO?.id || null;
              codigo = 'FRDO';
            }
          } else {
            // trabalha normal — segue regra do dia
            turnoId = (dow === 0 ? t.turnoDomingoId : dow === 6 ? t.turnoSabadoId : t.turnoPadraoId) || t.turnoPadraoId;
            codigo = 'turno';
          }
        }
        // 5. Domingo (folga ou trabalha)
        else if (dow === 0) {
          if (ehDomingoFolga(dataStr)) {
            turnoId = turnoFG?.id || null;
            codigo = 'FG';
          } else {
            turnoId = t.turnoDomingoId || t.turnoPadraoId;
            codigo = 'turno';
          }
        }
        // 6. Folga semanal FIXA (suporta 1 ou 2 dias — caso 5x2)
        else if (t.tipoFolga === 'FIXA' && (t.diaFolgaFixa === dow || t.diaFolgaFixa2 === dow)) {
          turnoId = turnoFG?.id || null;
          codigo = 'FG';
        }
        // 7. Folga ROTATIVA
        else if (t.tipoFolga === 'ROTATIVA' && ehFolgaRotativa(dataStr)) {
          turnoId = turnoFG?.id || null;
          codigo = 'FG';
        }
        // 8. Dia normal
        else {
          turnoId = (dow === 6 ? t.turnoSabadoId : t.turnoPadraoId) || t.turnoPadraoId;
          codigo = 'turno';
        }

        if (turnoId) lancamentosGerados.push({ data: dataStr, turno_id: turnoId, codigo });
        cursor.setDate(cursor.getDate() + 1);
      }

      // 6. Substituir lancamentos automaticos do mes (preserva manuais)
      await AppDataSource.query(
        `DELETE FROM rh_escala_lancamentos
         WHERE colaborador_id = $1 AND data BETWEEN $2 AND $3 AND (origem = 'auto' OR origem IS NULL)`,
        [colaboradorId, ymd(primeiro), ymd(ultimo)]
      );
      for (const l of lancamentosGerados) {
        await AppDataSource.query(
          `INSERT INTO rh_escala_lancamentos (colaborador_id, data, turno_id, origem)
           VALUES ($1, $2, $3, 'auto')
           ON CONFLICT (colaborador_id, data) DO UPDATE SET turno_id = EXCLUDED.turno_id, origem = 'auto'`,
          [colaboradorId, l.data, l.turno_id]
        ).catch((err: any) => {
          // sem unique constraint? tenta sem ON CONFLICT
          console.warn('[prePreencherMes] insert fallback:', err.message);
        });
      }

      res.json({
        ok: true,
        colaboradorId,
        mes,
        gerados: lancamentosGerados.length,
        amostra: lancamentosGerados.slice(0, 5),
      });
    } catch (e: any) {
      console.error('[RhEscala] prePreencherMes:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ============ GRID MENSAL (com resolucao de camadas) ============
  // GET /rh/escala/grid?company_id=X&departamento_id=Y&mes=2026-03
  static async obterGrid(req: Request, res: Response) {
    try {
      const company_id = req.query.company_id as string | undefined;
      const departamento_id = req.query.departamento_id ? Number(req.query.departamento_id) : undefined;
      const mes = (req.query.mes as string) || ymd(new Date()).slice(0, 7); // YYYY-MM
      const [yr, mn] = mes.split('-').map(Number);
      const primeiroDia = new Date(yr, mn - 1, 1);
      const ultimoDia = new Date(yr, mn, 0);
      const dataInicio = ymd(primeiroDia);
      const dataFim = ymd(ultimoDia);
      const qtdDias = ultimoDia.getDate();

      // Colaboradores do setor/empresa
      const whereParts: string[] = [`c.status = 'ativo'`];
      const params: any[] = [];
      if (company_id) { params.push(company_id); whereParts.push(`c.company_id = $${params.length}::uuid`); }
      if (departamento_id) { params.push(departamento_id); whereParts.push(`c.departamento_id = $${params.length}`); }

      const colaboradores = await AppDataSource.query(
        `SELECT c.id, c.nome, c.matricula, c.foto_url, c.company_id,
                ca.nome AS cargo_nome,
                dep.nome AS setor_nome,
                j.nome AS jornada_nome, j.carga_horaria AS jornada_carga,
                esc.nome AS escala_cadastro,
                ed.nome AS escala_domingo_nome,
                t.tipo_rotacao, t.padrao_semanal, t.trabalha_feriado, t.folga_preferida
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = c.departamento_id
         LEFT JOIN rh_jornadas j ON j.id = c.jornada_id
         LEFT JOIN rh_escalas esc ON esc.id = c.escala_id
         LEFT JOIN rh_escalas_domingo ed ON ed.id = c.escala_domingo_id
         LEFT JOIN rh_escala_templates t ON t.colaborador_id = c.id AND t.ativo = true
         WHERE ${whereParts.join(' AND ')}
         ORDER BY c.nome`,
        params
      );

      // Mapa de turnos pra hidratar codigo/cor a partir do id
      const turnos = await turnoRepo().find({ where: { ativo: true } });
      const turnoById = new Map(turnos.map(t => [t.id, t]));
      const turnoByCodigo = new Map(turnos.map(t => [t.codigo, t]));
      const turnoFG = turnoByCodigo.get('FG');
      const turnoFE = turnoByCodigo.get('FE');
      const turnoFR = turnoByCodigo.get('FR');
      const turnoLI = turnoByCodigo.get('LI');

      const colabIds = colaboradores.map((c: any) => c.id);
      if (colabIds.length === 0) {
        return res.json({ mes, qtdDias, colaboradores: [], turnos, feriados: [] });
      }

      // Eventos do periodo — cast DATE pra text (YYYY-MM-DD) pra casar com as chaves do JS
      const [lancamentos, excessoes, ferias, licencas, feriadosRaw] = await Promise.all([
        AppDataSource.query(
          `SELECT colaborador_id, to_char(data, 'YYYY-MM-DD') as data, turno_id, origem FROM rh_escala_lancamentos
           WHERE colaborador_id = ANY($1::int[]) AND data BETWEEN $2::date AND $3::date`,
          [colabIds, dataInicio, dataFim]
        ),
        AppDataSource.query(
          `SELECT colaborador_id, to_char(data, 'YYYY-MM-DD') as data, turno_id, motivo FROM rh_escala_excessoes
           WHERE colaborador_id = ANY($1::int[]) AND data BETWEEN $2::date AND $3::date`,
          [colabIds, dataInicio, dataFim]
        ),
        AppDataSource.query(
          `SELECT colaborador_id, to_char(data_inicio, 'YYYY-MM-DD') as data_inicio, to_char(data_fim, 'YYYY-MM-DD') as data_fim FROM rh_escala_ferias
           WHERE colaborador_id = ANY($1::int[])
             AND NOT (data_fim < $2::date OR data_inicio > $3::date)`,
          [colabIds, dataInicio, dataFim]
        ),
        AppDataSource.query(
          `SELECT colaborador_id, to_char(data_inicio, 'YYYY-MM-DD') as data_inicio, to_char(data_fim, 'YYYY-MM-DD') as data_fim, motivo FROM rh_escala_licencas
           WHERE colaborador_id = ANY($1::int[])
             AND NOT (data_fim < $2::date OR data_inicio > $3::date)`,
          [colabIds, dataInicio, dataFim]
        ),
        // Feriados: tabela holidays usa date "MM-DD" + cod_loja
        AppDataSource.query(
          `SELECT date, name, cod_loja FROM holidays`
        ),
      ]);

      // Feriados do mes (date em MM-DD) aplicaveis à loja dos colabs (matched por company_id->cod_loja)
      const feriadosPorMMDD = new Map<string, { name: string; cod_loja: number | null }[]>();
      for (const f of feriadosRaw) {
        if (!feriadosPorMMDD.has(f.date)) feriadosPorMMDD.set(f.date, []);
        feriadosPorMMDD.get(f.date)!.push({ name: f.name, cod_loja: f.cod_loja });
      }

      // Monta dias do mes com dia-semana
      const dias: { data: string; diaSemana: number; ehFeriado: boolean; nomeFeriado: string | null }[] = [];
      for (let d = 1; d <= qtdDias; d++) {
        const dt = new Date(yr, mn - 1, d);
        const mmdd = `${String(mn).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const feriado = feriadosPorMMDD.get(mmdd);
        dias.push({
          data: ymd(dt),
          diaSemana: dt.getDay(),
          ehFeriado: !!feriado && feriado.length > 0,
          nomeFeriado: feriado && feriado.length > 0 ? feriado[0].name : null,
        });
      }

      // Indexa eventos por colaborador+data
      const excPorChave = new Map<string, any>();
      for (const e of excessoes) excPorChave.set(`${e.colaborador_id}|${e.data}`, e);
      const feriasPorColab = new Map<string, { ini: string; fim: string }[]>();
      for (const f of ferias) {
        if (!feriasPorColab.has(f.colaborador_id)) feriasPorColab.set(f.colaborador_id, []);
        feriasPorColab.get(f.colaborador_id)!.push({ ini: f.data_inicio, fim: f.data_fim });
      }
      const licencasPorColab = new Map<string, { ini: string; fim: string; motivo: string | null }[]>();
      for (const l of licencas) {
        if (!licencasPorColab.has(l.colaborador_id)) licencasPorColab.set(l.colaborador_id, []);
        licencasPorColab.get(l.colaborador_id)!.push({ ini: l.data_inicio, fim: l.data_fim, motivo: l.motivo });
      }
      const lancPorChave = new Map<string, any>();
      for (const l of lancamentos) lancPorChave.set(`${l.colaborador_id}|${l.data}`, l);

      // Para cada colaborador, resolve cada dia em ordem de precedencia:
      // excessao > ferias > licenca > feriado(se !trabalha_feriado) > lancamento manual > template
      const colaboradoresOut = colaboradores.map((c: any) => {
        const padraoSemanal: (string | null)[][] = Array.isArray(c.padrao_semanal) ? c.padrao_semanal : [];
        const ciclo = padraoSemanal.length || 0;
        const trabalhaFeriado = c.trabalha_feriado !== false;
        const ferPeriodos = feriasPorColab.get(c.id) || [];
        const licPeriodos = licencasPorColab.get(c.id) || [];

        const celulas = dias.map((dia, idx) => {
          const chave = `${c.id}|${dia.data}`;
          let origem = 'template';
          let turnoId: string | null = null;
          let observacao: string | null = null;

          // 1. Excessao
          const exc = excPorChave.get(chave);
          if (exc) {
            origem = 'excessao';
            turnoId = exc.turno_id;
            observacao = exc.motivo;
          } else if (ferPeriodos.some(p => dia.data >= p.ini && dia.data <= p.fim)) {
            // 2. Ferias
            origem = 'ferias';
            turnoId = turnoFE?.id || null;
          } else if (licPeriodos.some(p => dia.data >= p.ini && dia.data <= p.fim)) {
            // 3. Licenca
            const per = licPeriodos.find(p => dia.data >= p.ini && dia.data <= p.fim)!;
            origem = 'licenca';
            turnoId = turnoLI?.id || null;
            observacao = per.motivo;
          } else if (dia.ehFeriado && !trabalhaFeriado) {
            // 4. Feriado (se colab nao trabalha em feriado)
            origem = 'feriado';
            turnoId = turnoFR?.id || null;
          } else {
            // 5. Lancamento salvo (manual OU automatico do pre-preencher)
            const lan = lancPorChave.get(chave);
            if (lan) {
              origem = lan.origem === 'manual' ? 'manual' : 'auto';
              turnoId = lan.turno_id;
            } else if (ciclo > 0) {
              // 6. Template: aplica a semana do ciclo (idx da semana do mes % ciclo)
              const semanaDoMes = Math.floor(idx / 7);
              const padraoSemana = padraoSemanal[semanaDoMes % ciclo] || [];
              const slot = padraoSemana[dia.diaSemana];
              if (slot) turnoId = slot;
            }
          }

          const turno = turnoId ? turnoById.get(turnoId) : null;
          return {
            data: dia.data,
            diaSemana: dia.diaSemana,
            ehFeriado: dia.ehFeriado,
            nomeFeriado: dia.nomeFeriado,
            origem,
            observacao,
            turnoId,
            codigo: turno?.codigo || null,
            cor: turno?.cor || null,
            totalHoras: turno?.totalHoras ? Number(turno.totalHoras) : 0,
          };
        });

        // Total horas do mes (soma total_horas dos turnos)
        const horasMes = celulas.reduce((s, c) => s + (c.totalHoras || 0), 0);

        return {
          id: c.id,
          nome: c.nome,
          matricula: c.matricula,
          fotoUrl: c.foto_url,
          cargoNome: c.cargo_nome,
          setorNome: c.setor_nome,
          jornadaNome: c.jornada_nome,
          jornadaCarga: c.jornada_carga,
          tipoRotacao: c.tipo_rotacao,
          escalaCadastro: c.escala_cadastro,
          escalaDomingo: c.escala_domingo_nome,
          temTemplate: Array.isArray(c.padrao_semanal) && c.padrao_semanal.length > 0,
          celulas,
          horasMes: Math.round(horasMes * 100) / 100,
        };
      });

      res.json({
        mes,
        qtdDias,
        dias,
        turnos,
        colaboradores: colaboradoresOut,
      });
    } catch (e: any) {
      console.error('[RhEscala] obterGrid:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ============ LANCAMENTO MANUAL (editar celula) ============
  static async salvarCelulaManual(req: Request, res: Response) {
    try {
      const { colaboradorId, data, turnoId, observacao } = req.body || {};
      if (!colaboradorId || !data) return res.status(400).json({ error: 'colaboradorId e data obrigatorios' });
      const cid = Number(colaboradorId);
      let l = await lancRepo().findOne({ where: { colaboradorId: cid, data } });
      if (!l) {
        l = lancRepo().create({ colaboradorId: cid, data, turnoId: turnoId || null, origem: 'manual', observacao });
      } else {
        l.turnoId = turnoId || null;
        l.origem = 'manual';
        l.observacao = observacao || null;
      }
      await lancRepo().save(l);
      res.json(l);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async limparCelulaManual(req: Request, res: Response) {
    try {
      const { colaboradorId, data } = req.body || {};
      await lancRepo().delete({ colaboradorId: Number(colaboradorId), data });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ EVENTOS: FERIAS / LICENCAS / EXCESSOES ============
  static async listarFerias(req: Request, res: Response) {
    try {
      const { colaborador_id } = req.query;
      const where: any = {};
      if (colaborador_id) where.colaboradorId = Number(colaborador_id);
      const rows = await feriasRepo().find({ where, order: { dataInicio: 'DESC' } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async criarFerias(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaboradorId || !b.dataInicio || !b.dataFim) return res.status(400).json({ error: 'obrigatorios' });
      const f = feriasRepo().create({ colaboradorId: Number(b.colaboradorId), dataInicio: b.dataInicio, dataFim: b.dataFim, observacao: b.observacao || null });
      await feriasRepo().save(f);
      res.status(201).json(f);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async deletarFerias(req: Request, res: Response) {
    try { await feriasRepo().delete({ id: req.params.id }); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async listarLicencas(req: Request, res: Response) {
    try {
      const { colaborador_id } = req.query;
      const where: any = {};
      if (colaborador_id) where.colaboradorId = Number(colaborador_id);
      const rows = await licencaRepo().find({ where, order: { dataInicio: 'DESC' } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async criarLicenca(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaboradorId || !b.dataInicio || !b.dataFim) return res.status(400).json({ error: 'obrigatorios' });
      const l = licencaRepo().create({ colaboradorId: Number(b.colaboradorId), dataInicio: b.dataInicio, dataFim: b.dataFim, motivo: b.motivo || null, arquivoUrl: b.arquivoUrl || null });
      await licencaRepo().save(l);
      res.status(201).json(l);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async deletarLicenca(req: Request, res: Response) {
    try { await licencaRepo().delete({ id: req.params.id }); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async listarExcessoes(req: Request, res: Response) {
    try {
      const { colaborador_id } = req.query;
      const where: any = {};
      if (colaborador_id) where.colaboradorId = Number(colaborador_id);
      const rows = await excessaoRepo().find({ where, order: { data: 'DESC' } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async criarExcessao(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaboradorId || !b.data) return res.status(400).json({ error: 'obrigatorios' });
      const cid = Number(b.colaboradorId);
      let e = await excessaoRepo().findOne({ where: { colaboradorId: cid, data: b.data } });
      if (!e) {
        e = excessaoRepo().create({ colaboradorId: cid, data: b.data, turnoId: b.turnoId || null, motivo: b.motivo || null });
      } else {
        e.turnoId = b.turnoId || null;
        e.motivo = b.motivo || null;
      }
      await excessaoRepo().save(e);
      res.status(201).json(e);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async deletarExcessao(req: Request, res: Response) {
    try { await excessaoRepo().delete({ id: req.params.id }); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  // ============ REGRAS DE COBERTURA POR SETOR ============
  // Base do motor IA: o que cada setor precisa em cada dia/turno pra
  // operar sem buraco. Usado pra validar escalas manuais e (futuro)
  // alimentar o solver de geracao automatica.

  static async listarRegrasSetor(req: Request, res: Response) {
    try {
      const { empresa_id, departamento_id } = req.query;
      const params: any[] = [];
      const wheres: string[] = ['r.ativo = true'];
      if (empresa_id) { params.push(empresa_id); wheres.push(`r.empresa_id = $${params.length}::uuid`); }
      if (departamento_id) { params.push(departamento_id); wheres.push(`r.departamento_id = $${params.length}::int`); }
      const rows = await AppDataSource.query(
        `SELECT r.*, e.apelido AS empresa_apelido, d.nome AS departamento_nome
         FROM rh_escala_regras_setor r
         LEFT JOIN rh_empresas e ON e.id = r.empresa_id
         LEFT JOIN rh_departamentos d ON d.id = r.departamento_id
         WHERE ${wheres.join(' AND ')}
         ORDER BY d.nome ASC`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[RhEscala] listarRegrasSetor:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async salvarRegraSetor(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.departamento_id) return res.status(400).json({ error: 'departamento_id obrigatorio' });
      // Upsert por (empresa_id, departamento_id)
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_escala_regras_setor
           (empresa_id, departamento_id, rotacao_padrao, dias_pico, cobertura_minima,
            picos_por_dia, funcionamento_inicio, funcionamento_fim,
            custo_hora_extra, observacoes)
         VALUES ($1::uuid, $2::int, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
         ON CONFLICT (empresa_id, departamento_id) DO UPDATE SET
           rotacao_padrao = EXCLUDED.rotacao_padrao,
           dias_pico = EXCLUDED.dias_pico,
           cobertura_minima = EXCLUDED.cobertura_minima,
           picos_por_dia = EXCLUDED.picos_por_dia,
           funcionamento_inicio = EXCLUDED.funcionamento_inicio,
           funcionamento_fim = EXCLUDED.funcionamento_fim,
           custo_hora_extra = EXCLUDED.custo_hora_extra,
           observacoes = EXCLUDED.observacoes,
           updated_at = NOW(),
           ativo = true
         RETURNING *`,
        [
          b.empresa_id || null,
          Number(b.departamento_id),
          b.rotacao_padrao || '6x1',
          JSON.stringify(b.dias_pico || []),
          JSON.stringify(b.cobertura_minima || {}),
          JSON.stringify(b.picos_por_dia || {}),
          b.funcionamento_inicio || '07:00',
          b.funcionamento_fim || '22:00',
          b.custo_hora_extra != null ? Number(b.custo_hora_extra) : null,
          b.observacoes || null,
        ]
      );
      res.json(row);
    } catch (e: any) {
      console.error('[RhEscala] salvarRegraSetor:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarRegraSetor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await AppDataSource.query(`UPDATE rh_escala_regras_setor SET ativo = false WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ AGENTE IA: ANALISAR ARQUIVO ============
  // Recebe escala antiga (Excel, PDF ou imagem) e usa OpenAI pra extrair
  // padroes e devolver um texto que sera anexado como contexto no chat.
  static async analisarArquivoAgente(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: 'arquivo obrigatorio (campo "arquivo")' });

      const { ConfigurationService } = await import('../services/configuration.service');
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) return res.status(400).json({ error: 'OpenAI API Key nao configurada' });

      const [agenteCfg] = await AppDataSource.query(`SELECT * FROM rh_escala_agente_config ORDER BY id ASC LIMIT 1`);
      const cfg = agenteCfg || {};
      const model = cfg.modelo_ia || 'gpt-4o-mini';
      const axios = require('axios');
      const mime = file.mimetype || '';
      const nome = file.originalname || 'arquivo';

      let textoExtraido = '';
      let isImagem = false;

      if (mime.startsWith('image/')) {
        isImagem = true;
      } else if (mime === 'application/pdf' || nome.toLowerCase().endsWith('.pdf')) {
        const pdfParse = require('pdf-parse');
        const pdf = await pdfParse(file.buffer);
        textoExtraido = pdf.text;
      } else if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        /\.(xlsx?|csv)$/i.test(nome)
      ) {
        const XLSX = require('xlsx');
        const wb = XLSX.read(file.buffer, { type: 'buffer' });
        const partes: string[] = [];
        wb.SheetNames.forEach((sn: string) => {
          const sheet = wb.Sheets[sn];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          partes.push(`### Aba: ${sn}\n` + (json as any[][]).map(row => row.join('\t')).join('\n'));
        });
        textoExtraido = partes.join('\n\n');
      } else if (mime.startsWith('text/')) {
        textoExtraido = file.buffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: `Tipo de arquivo nao suportado: ${mime} (${nome})` });
      }

      // Prompt pro modelo extrair padrao da escala
      const promptAnalise = `Voce vai analisar uma escala de trabalho de supermercado fornecida pelo RH.
Extraia:
1. PERIODO coberto (mes/ano, dias da semana)
2. TURNOS usados (horarios de entrada/saida, pausa)
3. PADRAO DE ROTACAO observado (6x1, 5x2, 1x1 domingo, etc)
4. COBERTURA por dia/turno (quantos por turno)
5. PONTOS FORTES (o que funciona bem)
6. PONTOS DE ATENCAO (sobrecarga, gaps, irregularidades)
7. SUGESTAO de como replicar/melhorar

Responda em markdown estruturado em pt-BR.`;

      let messages: any[];
      if (isImagem) {
        const b64 = file.buffer.toString('base64');
        messages = [
          { role: 'system', content: promptAnalise },
          { role: 'user', content: [
            { type: 'text', text: `Analise a imagem desta escala (${nome}):` },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ]},
        ];
      } else {
        messages = [
          { role: 'system', content: promptAnalise },
          { role: 'user', content: `Arquivo: ${nome}\n\n---CONTEUDO---\n${textoExtraido.slice(0, 80000)}` },
        ];
      }

      const payload: any = { model, messages };
      if (/^gpt-5/i.test(model)) {
        payload.max_completion_tokens = 3500;
      } else {
        payload.max_tokens = 2500;
        payload.temperature = 0.3;
      }

      const r = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 120000,
      });
      const analise = r.data?.choices?.[0]?.message?.content || '(sem resposta)';
      res.json({
        analise,
        nome,
        mime,
        tipo_detectado: isImagem ? 'imagem' : (mime === 'application/pdf' ? 'pdf' : 'planilha/texto'),
        chars_extraidos: textoExtraido.length,
        usage: r.data?.usage,
      });
    } catch (e: any) {
      console.error('[RhEscala] analisarArquivoAgente:', e?.response?.data || e);
      res.status(500).json({ error: e?.response?.data?.error?.message || e.message });
    }
  }

  // ============ AGENTE IA: VALIDAR SENHA ============
  // Verifica a senha do usuario logado pra liberar acoes que mudam dados.
  // Resposta: { valido: true, validoAte: ISO } - frontend cacheia esse timestamp.
  static async validarSenhaAgente(req: Request, res: Response) {
    try {
      const { senha } = req.body;
      const userId = (req as any).user?.id;
      if (!senha) return res.status(400).json({ valido: false, error: 'senha obrigatoria' });
      if (!userId) return res.status(401).json({ valido: false, error: 'nao autenticado' });

      const [user] = await AppDataSource.query(
        `SELECT password FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      if (!user?.password) {
        return res.status(404).json({ valido: false, error: 'Usuario nao encontrado' });
      }

      const bcrypt = require('bcrypt');
      const valido = await bcrypt.compare(senha, user.password);
      if (!valido) {
        return res.status(401).json({ valido: false, error: 'Senha incorreta' });
      }

      // Libera por 5 minutos
      const validoAte = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      res.json({ valido: true, validoAte });
    } catch (e: any) {
      console.error('[RhEscala] validarSenhaAgente:', e);
      res.status(500).json({ valido: false, error: e.message });
    }
  }

  // ============ AGENTE IA DE ESCALA ============
  // Config global (1 linha) com persona/modelo/regras do agente
  static async getAgenteConfig(_req: Request, res: Response) {
    try {
      const r = await AppDataSource.query(`SELECT * FROM rh_escala_agente_config ORDER BY id ASC LIMIT 1`);
      res.json(r[0] || {});
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async putAgenteConfig(req: Request, res: Response) {
    try {
      const fields = [
        'nome_agente', 'avatar_emoji', 'cor_tema',
        'saudacao_inicial', 'persona_descricao', 'tom_comunicacao',
        'modelo_ia', 'max_tokens_resposta', 'temperatura', 'timeout_segundos',
        'instrucoes_extras', 'usar_vault', 'sugerir_memoria',
      ];
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          sets.push(`${f} = $${p++}`);
          params.push(req.body[f]);
        }
      }
      sets.push(`updated_at = NOW()`);
      const existing = await AppDataSource.query(`SELECT id FROM rh_escala_agente_config ORDER BY id ASC LIMIT 1`);
      if (existing?.length > 0) {
        params.push(existing[0].id);
        const r = await AppDataSource.query(
          `UPDATE rh_escala_agente_config SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, params
        );
        res.json(r[0]);
      } else {
        const cols = fields.filter(f => req.body[f] !== undefined);
        const vals = cols.map(f => req.body[f]);
        const r = await AppDataSource.query(
          `INSERT INTO rh_escala_agente_config (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, vals
        );
        res.json(r[0]);
      }
    } catch (e: any) {
      console.error('[RhEscala] putAgenteConfig:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ============ AGENTE IA: EXECUTAR ACAO ============
  // Endpoint chamado depois do usuario autorizar com senha. Recebe a acao
  // proposta pelo agente e EXECUTA no banco. Loga em rh_escala_agente_acoes.
  static async executarAcaoAgente(req: Request, res: Response) {
    try {
      const { acao, params, descricao_humana, autorizado_ate, empresa_id, departamento_id, pergunta_original } = req.body;
      const userId = (req as any).user?.id;

      if (!acao || !params) return res.status(400).json({ error: 'acao e params obrigatorios' });

      // Validacao da autorizacao (cache 5min)
      const autValido = autorizado_ate && new Date(autorizado_ate) > new Date();
      if (!autValido) {
        return res.status(401).json({ error: 'autorizacao_expirada', detalhe: 'Senha precisa ser validada novamente' });
      }

      // Resolve colaborador (case-insensitive, primeira palavra basta)
      async function resolverColaborador(nome: string) {
        if (!nome) throw new Error('Nome do colaborador obrigatorio');
        const params: any[] = [`%${String(nome).toUpperCase()}%`];
        let where = `UPPER(nome) LIKE $1 AND ativo = true`;
        if (empresa_id) { params.push(empresa_id); where += ` AND empresa_id = $${params.length}`; }
        if (departamento_id) { params.push(parseInt(String(departamento_id))); where += ` AND departamento_id = $${params.length}`; }
        const rows = await AppDataSource.query(`SELECT id, nome FROM rh_colaboradores WHERE ${where} LIMIT 5`, params);
        if (rows.length === 0) throw new Error(`Colaborador "${nome}" nao encontrado no setor atual`);
        if (rows.length > 1) {
          const exato = rows.find((r: any) => r.nome.toUpperCase() === String(nome).toUpperCase());
          if (exato) return exato;
          throw new Error(`Mais de um colaborador com "${nome}": ${rows.map((r: any) => r.nome).join(', ')}. Seja mais especifico.`);
        }
        return rows[0];
      }

      let antes: any = null;
      let depois: any = null;
      let sucesso = false;
      let erroExec: string | null = null;
      let resultado: any = null;

      try {
        if (acao === 'pre_preencher_mes') {
          // Reusa o metodo prePreencherMes (controller) montando req/res mock
          const colab = await resolverColaborador(params.colaborador);
          antes = { acao: 'pre_preencher_mes', colaborador_id: colab.id, mes: params.mes };
          const mockReq: any = { params: { colaboradorId: String(colab.id) }, query: { mes: params.mes } };
          const respChunks: any[] = [];
          const mockRes: any = {
            json: (d: any) => { respChunks.push({ ok: true, body: d }); return mockRes; },
            status: (c: number) => ({ json: (d: any) => { respChunks.push({ ok: c < 400, status: c, body: d }); return mockRes; } }),
          };
          await RhEscalaController.prePreencherMes(mockReq, mockRes);
          const r0 = respChunks[0];
          if (!r0?.ok) throw new Error(r0?.body?.error || 'falha ao pre-preencher');
          depois = r0.body;
          resultado = r0.body;
          sucesso = true;
        } else if (acao === 'mudar_tipo_escala') {
          const colab = await resolverColaborador(params.colaborador);
          const [tplAntes] = await AppDataSource.query(
            `SELECT tipo_folga, dia_folga_fixa, dia_folga_fixa_2 FROM rh_escala_templates WHERE colaborador_id = $1 AND ativo = true LIMIT 1`,
            [colab.id]
          );
          antes = tplAntes;
          // Tipos suportados: 6x1, 5x2, 12x36, etc — vai pra coluna tipo_folga
          // Mapeamento simples: aceita o valor direto que o agente sugerir
          const novoTipo = String(params.novo_tipo || params.tipo).toUpperCase();
          await AppDataSource.query(
            `UPDATE rh_escala_templates SET tipo_folga = $1, atualizado_em = NOW() WHERE colaborador_id = $2 AND ativo = true`,
            [novoTipo, colab.id]
          );
          depois = { tipo_folga: novoTipo };
          resultado = { colaborador: colab.nome, novo_tipo: novoTipo };
          sucesso = true;
        } else if (acao === 'lancar_turno_em_dia') {
          const colab = await resolverColaborador(params.colaborador);
          const data = params.data;
          const turnoCodigo = params.turno_codigo || params.turno;
          // Resolve turno por codigo
          const [turno] = await AppDataSource.query(
            `SELECT id FROM rh_escala_turnos WHERE codigo = $1 AND ativo = true LIMIT 1`,
            [turnoCodigo]
          );
          if (!turno) throw new Error(`Turno "${turnoCodigo}" nao existe`);
          const [antesL] = await AppDataSource.query(
            `SELECT turno_id FROM rh_escala_lancamentos WHERE colaborador_id = $1 AND data = $2 LIMIT 1`,
            [colab.id, data]
          );
          antes = antesL;
          // Upsert
          await AppDataSource.query(
            `INSERT INTO rh_escala_lancamentos (colaborador_id, data, turno_id, origem)
             VALUES ($1, $2, $3, 'agente_ia')
             ON CONFLICT (colaborador_id, data) DO UPDATE SET turno_id = $3, origem = 'agente_ia', atualizado_em = NOW()`,
            [colab.id, data, turno.id]
          );
          depois = { turno_id: turno.id, codigo: turnoCodigo };
          resultado = { colaborador: colab.nome, data, turno: turnoCodigo };
          sucesso = true;
        } else if (acao === 'limpar_dia') {
          const colab = await resolverColaborador(params.colaborador);
          const data = params.data;
          const [antesL] = await AppDataSource.query(
            `SELECT turno_id FROM rh_escala_lancamentos WHERE colaborador_id = $1 AND data = $2 LIMIT 1`,
            [colab.id, data]
          );
          antes = antesL;
          await AppDataSource.query(
            `DELETE FROM rh_escala_lancamentos WHERE colaborador_id = $1 AND data = $2`,
            [colab.id, data]
          );
          depois = null;
          resultado = { colaborador: colab.nome, data, removido: true };
          sucesso = true;
        } else {
          throw new Error(`Acao desconhecida: ${acao}`);
        }
      } catch (e: any) {
        erroExec = e.message;
      }

      // Log
      try {
        await AppDataSource.query(
          `INSERT INTO rh_escala_agente_acoes
             (usuario_id, empresa_id, departamento_id, pergunta, acao, parametros, antes, depois, senha_validada, sucesso, erro)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            userId, empresa_id || null, departamento_id || null,
            pergunta_original || null, acao,
            JSON.stringify(params), JSON.stringify(antes), JSON.stringify(depois),
            true, sucesso, erroExec,
          ]
        );
      } catch (logErr: any) {
        console.warn('[RhEscala] log auditoria falhou:', logErr.message);
      }

      if (!sucesso) return res.status(400).json({ erro: erroExec, acao, params });
      res.json({ sucesso: true, acao, resultado, descricao_humana });
    } catch (e: any) {
      console.error('[RhEscala] executarAcaoAgente:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // Chat com OpenAI usando openai_api_key das configuracoes. O contexto
  // inclui as regras do setor atual + colaboradores ativos + escala vigente
  // (resumo). Persona, modelo e regras vem de rh_escala_agente_config.
  // O Vault de Memoria (rh_escala_memoria) e injetado se usar_vault=true.
  static async chatAgenteEscala(req: Request, res: Response) {
    try {
      const { messages, contexto } = req.body;
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array obrigatorio' });

      // Le chave OpenAI (criptografada) via ConfigurationService que ja descriptografa
      const { ConfigurationService } = await import('../services/configuration.service');
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API Key não configurada. Vá em Configurações → AI pra cadastrar.' });
      }

      // Le persona/config do agente (linha unica)
      const [agenteCfg] = await AppDataSource.query(`SELECT * FROM rh_escala_agente_config ORDER BY id ASC LIMIT 1`);
      const cfg = agenteCfg || {};
      const model = cfg.modelo_ia || (await ConfigurationService.get('openai_model')) || 'gpt-4o-mini';
      const temperature = cfg.temperatura !== undefined ? Number(cfg.temperatura) : 0.7;
      const maxTokens = cfg.max_tokens_resposta || 1200;
      const timeoutMs = ((cfg.timeout_segundos || 60) as number) * 1000;
      const usarVault = cfg.usar_vault !== false;
      const sugerirMemoria = cfg.sugerir_memoria !== false;
      const nomeAgente = cfg.nome_agente || 'Assistente de Escala';

      // ============ MEMORIA / VAULT ============
      // Carrega notas relevantes do vault baseado na ultima mensagem do usuario.
      // Notas viram parte do system prompt para que o agente "lembre" de fatos
      // aprendidos em conversas anteriores (estilo Obsidian).
      const ultimaPergunta = messages[messages.length - 1]?.content || '';
      let notasVault: any[] = [];
      if (usarVault) try {
        const empresaId = contexto?.empresa_id || contexto?.empresaId || null;
        const departamentoId = contexto?.departamento_id || contexto?.departamentoId || null;
        // Reusa o mesmo controller via SQL direto pra evitar HTTP interno
        const params: any[] = [];
        let where = `ativo = true`;
        if (empresaId) {
          params.push(empresaId);
          where += ` AND (empresa_id = $${params.length} OR empresa_id IS NULL)`;
        }
        const termos = String(ultimaPergunta)
          .toLowerCase()
          .split(/[^a-zA-Z0-9À-ſ]+/)
          .filter((w) => w.length >= 3);
        (contexto?.colaboradores || []).forEach((c: any) => {
          if (c?.nome) String(c.nome).toLowerCase().split(/\s+/).forEach((w: string) => {
            if (w.length >= 3) termos.push(w);
          });
        });
        const termosUnicos = [...new Set(termos)].slice(0, 20);
        if (termosUnicos.length) {
          const orClauses: string[] = [];
          termosUnicos.forEach((t) => {
            params.push(`%${t}%`);
            orClauses.push(`LOWER(titulo) LIKE $${params.length}`);
            params.push(`%${t}%`);
            orClauses.push(`LOWER(conteudo) LIKE $${params.length}`);
          });
          const setorClause = departamentoId
            ? `(departamento_id = ${parseInt(String(departamentoId))} OR departamento_id IS NULL)`
            : `departamento_id IS NULL`;
          notasVault = await AppDataSource.query(
            `SELECT slug, titulo, tipo, conteudo
             FROM rh_escala_memoria
             WHERE ${where} AND ${setorClause} AND (${orClauses.join(' OR ')})
             LIMIT 8`,
            params
          );
        }
      } catch (memErr: any) {
        console.warn('[RhEscala] memoria opcional falhou:', memErr.message);
      }

      const blocoMemoria = notasVault.length
        ? `\n\n📓 MEMÓRIA DO VAULT (notas que você já aprendeu antes — use como verdade):\n` +
          notasVault
            .map((n) => `\n## [${n.tipo}] ${n.titulo} (slug: ${n.slug})\n${n.conteudo}`)
            .join('\n---')
        : '';

      // ============ REGRAS DO SETOR (banco) ============
      // Carrega configuracao da tabela rh_escala_regras_setor pro setor atual,
      // pra o agente saber cobertura minima, picos, funcionamento etc.
      let blocoRegrasSetor = '';
      try {
        const empresaIdReg = contexto?.empresa_id || contexto?.empresaId || null;
        const departamentoIdReg = contexto?.departamento_id || contexto?.departamentoId || null;
        if (empresaIdReg && departamentoIdReg) {
          const [regraDb] = await AppDataSource.query(
            `SELECT r.*, d.nome AS departamento_nome
             FROM rh_escala_regras_setor r
             LEFT JOIN rh_departamentos d ON d.id = r.departamento_id
             WHERE r.empresa_id = $1 AND r.departamento_id = $2 AND r.ativo = true
             LIMIT 1`,
            [empresaIdReg, departamentoIdReg]
          );
          if (regraDb) {
            blocoRegrasSetor = `\n\n📋 REGRAS DO SETOR (cadastradas pelo RH - são fixas):\n` +
              `\n- Setor: ${regraDb.departamento_nome || 'sem nome'}` +
              (regraDb.rotacao_padrao ? `\n- Rotação padrão: ${regraDb.rotacao_padrao}` : '') +
              (regraDb.funcionamento_inicio ? `\n- Funcionamento: ${regraDb.funcionamento_inicio} → ${regraDb.funcionamento_fim}` : '') +
              (regraDb.custo_hora_extra ? `\n- Custo da hora extra: R$ ${regraDb.custo_hora_extra}` : '') +
              (regraDb.dias_pico ? `\n- Dias de pico: ${JSON.stringify(regraDb.dias_pico)}` : '') +
              (regraDb.picos_por_dia ? `\n- Picos por dia (faixas): ${JSON.stringify(regraDb.picos_por_dia)}` : '') +
              (regraDb.cobertura_minima ? `\n- Cobertura mínima por turno/dia: ${JSON.stringify(regraDb.cobertura_minima)}` : '');
          }
        }
      } catch (rsErr: any) {
        console.warn('[RhEscala] regras_setor opcional falhou:', rsErr.message);
      }

      // System prompt MONTADO da config (rh_escala_agente_config)
      const personaTxt = cfg.persona_descricao || 'Especialista em gestao de equipes de supermercado e legislacao trabalhista brasileira (CLT, NR-1).';
      const tomTxt = ({
        profissional: 'profissional e direto',
        descontraido: 'descontraido e proximo',
        formal: 'formal e tecnico',
        empolgado: 'empolgado e motivador',
      } as any)[cfg.tom_comunicacao || 'profissional'] || 'profissional e direto';

      const trecho_sugestao_memoria = sugerirMemoria
        ? `

Quando aprender algo NOVO e UTIL que vale a pena lembrar pra proximas conversas (preferencia fixa de colaborador, restricao medica, regra do setor, padrao que funciona, particularidade da loja), SALVE no Vault automaticamente com a marcacao:
\`\`\`save-memoria
{ "tipo": "colaborador|setor|regra|padrao", "titulo": "Titulo curto e descritivo", "tags": ["tag1","tag2"], "conteudo": "Conteudo em markdown explicando o fato" }
\`\`\`
Voce mesmo salva — o sistema persiste no banco. Use SOMENTE pra fatos duraveis (nao salve resposta de calculo trivial, nem opiniao do momento). Se ja existe nota similar, ELA SERA ATUALIZADA automaticamente.
NAO salve mais de 2 memorias por resposta.`
        : '';

      const systemPrompt = `Você é ${nomeAgente}, ${personaTxt}

Tom: ${tomTxt}. Sempre responda em pt-BR.

## Como FORMATAR suas respostas (importante)
- Use **markdown** sempre: \`## Titulo\` pra seções, \`### subtitulo\`, \`**negrito**\` pra destaques, \`- item\` pra listas
- Use **emojis** com moderação pra organizar visualmente:
  - 📊 dados/numeros · 💡 sugestao · ✅ ok · ⚠️ atencao · ❌ erro · 🎯 conclusao
  - 👤 colaborador · 🏪 setor · ⏰ horario · 📅 data · 💰 custo · 📈 impacto
- **Quebre em SEÇÕES** sempre que a resposta tem mais de 3 paragrafos
- **Negrito** pra nomes de colaboradores e valores importantes

## QUANDO O USUARIO QUER QUE VOCE EXECUTE UMA ACAO (mudar escala, preencher mes, etc)
Voce NAO executa nada direto. Voce PROPOE a acao usando o bloco abaixo no FIM da sua resposta.
O sistema vai pedir confirmacao com senha do RH antes de aplicar.

Acoes que voce pode propor:
- \`pre_preencher_mes\`: preenche o mes inteiro de UM colaborador usando o template dele
- \`mudar_tipo_escala\`: muda a rotacao de um colaborador (ex: 6x1 → 5x2)
- \`lancar_turno_em_dia\`: lanca um turno especifico num dia da escala
- \`limpar_dia\`: apaga o turno de um dia especifico

Formato EXATO (use SEMPRE que o usuario pedir uma acao - nao quando ele so quer informacao):
\`\`\`executar
{
  "acao": "pre_preencher_mes",
  "params": { "colaborador": "NOME EXATO DO COLABORADOR", "mes": "YYYY-MM" },
  "descricao_humana": "Frase amigavel descrevendo o que vai acontecer"
}
\`\`\`

Outro exemplo:
\`\`\`executar
{ "acao": "mudar_tipo_escala", "params": { "colaborador": "CHARLENE APARECIDA DA ROCHA", "novo_tipo": "5x2" }, "descricao_humana": "Mudar CHARLENE de 6x1 para 5x2" }
\`\`\`

IMPORTANTE: so use o bloco \`executar\` quando o usuario REALMENTE quer que voce mude algo (ex: "preenche", "muda", "lança", "altera"). Se ele so quer informacao/sugestao, RESPONDA NORMAL sem o bloco.

${cfg.instrucoes_extras || ''}${trecho_sugestao_memoria}

CONTEXTO ATUAL:
${contexto ? JSON.stringify(contexto, null, 2) : '(sem contexto enviado)'}${blocoRegrasSetor}${blocoMemoria}`;

      const payload: any = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      };
      // GPT-5+ usa max_completion_tokens e nao aceita temperature customizada.
      // GPT-5 gasta tokens em reasoning interno, entao garantimos um piso de 2500
      if (/^gpt-5/i.test(model)) {
        payload.max_completion_tokens = Math.max(maxTokens, 2500);
      } else {
        payload.max_tokens = maxTokens;
        payload.temperature = temperature;
      }

      const axios = require('axios');
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        payload,
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: timeoutMs,
        }
      );

      const reply = response.data.choices?.[0]?.message?.content || '(sem resposta)';

      // Extrai sugestoes ```save-memoria { ... } ``` e SALVA automaticamente no Vault.
      // Se ja existe slug, ATUALIZA (merge de conteudo + tags). Marca tag "auto-salvo"
      // pra o RH poder revisar/filtrar depois.
      const memoriasSalvas: any[] = [];
      const memoriasAtualizadas: any[] = [];
      const mr = /```save-memoria\s*([\s\S]*?)```/g;
      let mm;
      const empresaIdMem = contexto?.empresa_id || contexto?.empresaId || null;
      const departamentoIdMem = contexto?.departamento_id || contexto?.departamentoId || null;

      function slugMemoria(s: string): string {
        return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140) || 'sem-titulo';
      }

      while ((mm = mr.exec(reply)) !== null) {
        try {
          const obj = JSON.parse(mm[1].trim());
          if (!obj?.titulo) continue;
          const slug = slugMemoria(obj.titulo);
          const tagsArr = Array.isArray(obj.tags) ? obj.tags : [];
          if (!tagsArr.includes('auto-salvo')) tagsArr.push('auto-salvo');
          const tipo = ['colaborador', 'setor', 'regra', 'padrao'].includes(obj.tipo) ? obj.tipo : 'outro';

          // Existe nota com mesmo slug pra essa empresa? (ou global)
          const [existente] = await AppDataSource.query(
            `SELECT id, conteudo, tags FROM rh_escala_memoria
             WHERE slug = $1
               AND COALESCE(empresa_id::text, '') = COALESCE($2::text, '')
               AND ativo = true
             LIMIT 1`,
            [slug, empresaIdMem]
          );

          if (existente) {
            // Atualiza: anexa novo trecho com timestamp dentro do conteudo + merge tags
            const novoConteudo = (existente.conteudo || '').trim() +
              `\n\n---\n_Atualizado pelo agente em conversa_\n\n${obj.conteudo || ''}`;
            const tagsExist: string[] = existente.tags || [];
            const tagsMerged = [...new Set([...tagsExist, ...tagsArr])];
            await AppDataSource.query(
              `UPDATE rh_escala_memoria
               SET conteudo = $1, tags = $2, atualizado_em = NOW()
               WHERE id = $3`,
              [novoConteudo, tagsMerged, existente.id]
            );
            memoriasAtualizadas.push({ slug, titulo: obj.titulo, id: existente.id });
          } else {
            const [nova] = await AppDataSource.query(
              `INSERT INTO rh_escala_memoria (empresa_id, departamento_id, slug, titulo, tipo, tags, conteudo)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id, slug, titulo, tipo`,
              [empresaIdMem, departamentoIdMem, slug, obj.titulo, tipo, tagsArr, obj.conteudo || '']
            );
            memoriasSalvas.push(nova);
          }
        } catch (e: any) {
          console.warn('[RhEscala] auto-save memoria falhou:', e.message);
        }
      }

      // Remove o bloco save-memoria do texto exibido (o RH nao precisa ver JSON cru)
      let replyLimpo = reply.replace(/```save-memoria\s*[\s\S]*?```/g, '').trim();

      // Detecta bloco ```executar { ... } ``` - acao que precisa de confirmacao com senha
      let acaoPendente: any = null;
      const rxExec = /```executar\s*([\s\S]*?)```/g;
      const mExec = rxExec.exec(reply);
      if (mExec) {
        try {
          const obj = JSON.parse(mExec[1].trim());
          if (obj?.acao && obj?.params) {
            acaoPendente = {
              acao: obj.acao,
              params: obj.params,
              descricao_humana: obj.descricao_humana || `Executar ${obj.acao}`,
            };
          }
        } catch (e: any) {
          console.warn('[RhEscala] bloco executar invalido:', e.message);
        }
        // Sempre remove o JSON cru da resposta exibida
        replyLimpo = replyLimpo.replace(/```executar\s*[\s\S]*?```/g, '').trim();
      }

      res.json({
        reply: replyLimpo,
        usage: response.data.usage,
        notas_usadas: notasVault.map((n) => ({ slug: n.slug, titulo: n.titulo, tipo: n.tipo })),
        memorias_salvas: memoriasSalvas,
        memorias_atualizadas: memoriasAtualizadas,
        acao_pendente: acaoPendente,
      });
    } catch (e: any) {
      console.error('[RhEscala] chatAgenteEscala:', e?.response?.data || e);
      res.status(500).json({ error: e?.response?.data?.error?.message || e.message });
    }
  }
}
