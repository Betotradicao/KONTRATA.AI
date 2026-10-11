import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { gerarHoleritePdf, HoleriteNotFound } from '../services/holerite.service';

// Catalogo dos lancamentos (mesma ordem da tela Lancamentos)
const PROVENTOS = [
  { key: 'hora_extra_60', label: 'HE 60%' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interjornada' },
  { key: 'hora_extra_100', label: 'HE 100%' },
  { key: 'adicional_noturno', label: 'Adic. Noturno' },
  { key: 'quebra_caixa', label: 'Quebra Caixa' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Custo Domingo' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Custo Feriado' },
  { key: 'insalubridade', label: 'Insalubridade' },
  { key: 'premio', label: 'Premio' },
];
const DESCONTOS = [
  { key: 'falta_dias', label: 'Falta (dias)' },
  { key: 'atraso_horas', label: 'Atraso (horas)' },
  { key: 'desconto_dsr', label: 'Desc. DSR' },
  { key: 'vale_transporte', label: 'Vale Transporte' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra Caixa' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sindical' },
  { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'compras', label: 'Compras' },
];

export class RhFolhaController {
  /**
   * GET /rh/folha/indicadores?ano=&company_id= — dashboard Financeiro RH.
   * Folha = salário base (rh_colaboradores.salario) + proventos − descontos (R$ em
   * rh_apontamentos.campos_extras->>'<key>_valor'). Encargos NÃO existem no banco →
   * são ESTIMADOS por percentual padrão (FGTS 8%, INSS patronal 20%, provisão 13º 8,33%,
   * férias+1/3 11,11%). Setor via rh_colaboradores.sector_id → sectors.
   */
  static async indicadores(req: Request, res: Response) {
    try {
      const ano = parseInt((req.query.ano as string) || '') || new Date().getFullYear();
      const companyId = (req.query.company_id as string) || null;
      const cf = companyId ? ' AND c.company_id = $1' : '';
      const p: any[] = companyId ? [companyId] : [];

      // Fatores de encargo (estimativa "custo Brasil"). ~47% sobre o bruto.
      const F_FGTS = 0.08, F_INSS = 0.20, F_13 = 1 / 12, F_FERIAS = (1 / 12) * (4 / 3);
      const FATOR_ENC = F_FGTS + F_INSS + F_13 + F_FERIAS;

      // 1) Colaboradores ativos: salário + setor
      const colabs = await AppDataSource.query(
        `SELECT c.id, COALESCE(c.salario, 0)::numeric AS salario, COALESCE(s.name, 'Sem setor') AS setor
         FROM rh_colaboradores c
         LEFT JOIN sectors s ON s.id = c.sector_id
         WHERE c.status = 'ativo'${cf}`, p);
      const ativos = colabs.length;
      let S = 0;
      const salarioPorSetor: Record<string, number> = {};
      for (const c of colabs) {
        const sal = Number(c.salario) || 0;
        S += sal;
        salarioPorSetor[c.setor] = (salarioPorSetor[c.setor] || 0) + sal;
      }

      // 2) Benefícios (rh_beneficios via beneficios_ids do colaborador)
      let beneficios = 0;
      try {
        const bres = await AppDataSource.query(
          `SELECT COALESCE(SUM(b.valor), 0)::numeric AS total
           FROM rh_colaboradores c
           JOIN rh_beneficios b ON b.id = ANY(c.beneficios_ids) AND COALESCE(b.ativo, true) = true
           WHERE c.status = 'ativo'${cf}`, p);
        beneficios = Number(bres[0]?.total) || 0;
      } catch { /* beneficios_ids pode não existir */ }

      // 3) Chaves de provento/desconto (padrão + extras ativos)
      const provKeys = PROVENTOS.map(x => x.key);
      const descKeys = DESCONTOS.map(x => x.key);
      try {
        const extras = await AppDataSource.query(`SELECT chave, tipo FROM rh_apontamento_campos WHERE ativo = true`);
        for (const e of extras) {
          if (e.tipo === 'provento') provKeys.push(e.chave);
          else if (e.tipo === 'desconto') descKeys.push(e.chave);
        }
      } catch { /* sem campos extras */ }

      // 4) Apontamentos do ano → proventos/descontos por mês (R$ em campos_extras)
      const proventosMes = Array(12).fill(0);
      const descontosMes = Array(12).fill(0);
      try {
        const apts = await AppDataSource.query(
          `SELECT EXTRACT(MONTH FROM a.mes_referencia)::int AS mes, a.campos_extras
           FROM rh_apontamentos a JOIN rh_colaboradores c ON c.id = a.colaborador_id
           WHERE a.mes_referencia IS NOT NULL AND EXTRACT(YEAR FROM a.mes_referencia) = ${companyId ? '$2' : '$1'}${cf}`,
          companyId ? [companyId, ano] : [ano]);
        const val = (ce: any, key: string) => {
          const v = ce ? ce[key + '_valor'] : null;
          const n = typeof v === 'string' ? parseFloat(v) : Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        for (const a of apts) {
          const mi = (a.mes || 1) - 1;
          if (mi < 0 || mi > 11) continue;
          const ce = a.campos_extras || {};
          for (const k of provKeys) proventosMes[mi] += val(ce, k);
          for (const k of descKeys) descontosMes[mi] += val(ce, k);
        }
      } catch { /* campos_extras pode não existir na base */ }

      // 5) Derivações mensais
      const brutoMes = proventosMes.map(pv => S + pv);
      const encargosMes = brutoMes.map(b => b * FATOR_ENC);
      const custoTotalMes = brutoMes.map((b, i) => b + encargosMes[i]);
      const liquidoMes = brutoMes.map((b, i) => b - descontosMes[i]);

      const now = new Date();
      const mesLimite = (ano === now.getFullYear()) ? (now.getMonth() + 1) : 12;
      const idx = mesLimite - 1;

      const folhaMes = brutoMes[idx] || 0;
      const folhaAno = brutoMes.slice(0, mesLimite).reduce((a, b) => a + b, 0);
      const encargosAno = encargosMes.slice(0, mesLimite).reduce((a, b) => a + b, 0);
      const custoMedio = ativos > 0 ? folhaMes / ativos : 0;

      const brutoAcum = folhaAno;
      const encargosDet = {
        fgts: brutoAcum * F_FGTS,
        inss: brutoAcum * F_INSS,
        decimo_terceiro: brutoAcum * F_13,
        ferias: brutoAcum * F_FERIAS,
      };
      const composicao = { salario: S, encargos: encargosMes[idx] || 0, beneficios };
      const provisoes = brutoMes.map((b, i) => ({ mes: i + 1, decimo_terceiro: b * F_13, ferias: b * F_FERIAS }));
      const custoPorSetor = Object.entries(salarioPorSetor)
        .map(([setor, sal]) => ({ setor, valor: sal * (1 + FATOR_ENC) }))
        .sort((a, b) => b.valor - a.valor);

      return res.json({
        kpis: { folha_mes: folhaMes, folha_ano: folhaAno, custo_medio: custoMedio, encargos_ano: encargosAno, ativos },
        evolucao_mensal: { bruto: brutoMes, custo_total: custoTotalMes, liquido: liquidoMes },
        custo_por_setor: custoPorSetor,
        composicao,
        encargos_detalhados: encargosDet,
        provisoes_mensais: provisoes,
      });
    } catch (e: any) {
      console.error('[RH-Folha] indicadores:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao carregar Financeiro RH' });
    }
  }

  /**
   * Pivot anual: linhas = lancamento (provento ou desconto), colunas = jan..dez (R$).
   * Filtros opcionais: empresa, colaborador, base (competencia|caixa), tipo (todos|proventos|descontos), lancamento (key especifico).
   * Default: ano = atual, base = competencia, tipo = todos.
   */
  static async resumoAnual(req: Request, res: Response) {
    try {
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const base = (req.query.base as string) === 'caixa' ? 'mes_caixa' : 'mes_referencia';
      const tipo = (req.query.tipo as string) || 'todos'; // todos | proventos | descontos
      const empresaId = req.query.empresa_id as string | undefined;
      const colaboradorId = req.query.colaborador_id as string | undefined;
      const lancamentoKey = req.query.lancamento as string | undefined;

      // Inclui colunas extras cadastradas em rh_apontamento_campos (que aparecem na tela Lancamentos)
      const extras = await AppDataSource.query(
        `SELECT chave, label, tipo, mostra_qtd, mostra_valor FROM rh_apontamento_campos WHERE ativo = true ORDER BY ordem ASC, id ASC`
      ).catch(() => []);

      // Filtra os lancamentos a retornar
      let lancamentos: { key: string; label: string; tipo: 'provento' | 'desconto'; extra?: boolean; mostra_valor?: boolean }[] = [
        ...PROVENTOS.map(p => ({ ...p, tipo: 'provento' as const })),
        ...DESCONTOS.map(d => ({ ...d, tipo: 'desconto' as const })),
        ...extras.map((e: any) => ({ key: e.chave, label: e.label, tipo: e.tipo as 'provento' | 'desconto', extra: true, mostra_valor: e.mostra_valor !== false })),
      ];
      if (tipo === 'proventos') lancamentos = lancamentos.filter(l => l.tipo === 'provento');
      if (tipo === 'descontos') lancamentos = lancamentos.filter(l => l.tipo === 'desconto');
      if (lancamentoKey) lancamentos = lancamentos.filter(l => l.key === lancamentoKey);

      // Monta SQL de agregacao por mes
      const params: any[] = [ano];
      let where = `EXTRACT(YEAR FROM a.${base}) = $1`;
      if (empresaId) { params.push(empresaId); where += ` AND a.company_id = $${params.length}::uuid`; }
      if (colaboradorId) { params.push(Number(colaboradorId)); where += ` AND a.colaborador_id = $${params.length}`; }

      // Pra cada lancamento, soma o R$:
      //  - lancamentos padrao: campos_extras->>'KEY_valor'
      //  - extras com mostra_valor: campos_extras->>'CHAVE_valor'
      //  - extras com so mostra_qtd: campos_extras->>'CHAVE' (assume valor monetario direto)
      const selects = lancamentos.map(l => {
        const chaveBanco = l.extra
          ? (l.mostra_valor ? `${l.key}_valor` : l.key)
          : `${l.key}_valor`;
        return `SUM(COALESCE((a.campos_extras->>'${chaveBanco}')::numeric, 0)) AS "${l.key}"`;
      }).join(', ');

      const rows = await AppDataSource.query(
        `SELECT EXTRACT(MONTH FROM a.${base})::int AS mes, ${selects}
         FROM rh_apontamentos a
         WHERE ${where} AND a.${base} IS NOT NULL
         GROUP BY EXTRACT(MONTH FROM a.${base})
         ORDER BY mes`,
        params
      );

      // Indexa por mes
      const porMes: Record<number, any> = {};
      for (const r of rows) porMes[r.mes] = r;

      // Monta resultado: 1 linha por lancamento, com 12 colunas + total
      const linhas = lancamentos.map(l => {
        const meses: number[] = [];
        let total = 0;
        for (let m = 1; m <= 12; m++) {
          const v = Number(porMes[m]?.[l.key] || 0);
          meses.push(v);
          total += v;
        }
        return { key: l.key, label: l.label, tipo: l.tipo, meses, total };
      });

      // Total geral por mes (separa proventos vs descontos)
      const totaisProv = Array(12).fill(0);
      const totaisDesc = Array(12).fill(0);
      for (const l of linhas) {
        for (let i = 0; i < 12; i++) {
          if (l.tipo === 'provento') totaisProv[i] += l.meses[i];
          else totaisDesc[i] += l.meses[i];
        }
      }
      const totalProvAno = totaisProv.reduce((a, b) => a + b, 0);
      const totalDescAno = totaisDesc.reduce((a, b) => a + b, 0);

      res.json({
        ano,
        base,
        linhas,
        totaisProv,
        totaisDesc,
        totalProvAno,
        totalDescAno,
        liquidoAno: totalProvAno - totalDescAno,
      });
    } catch (e: any) {
      console.error('[RhFolha] resumoAnual:', e);
      res.status(500).json({ error: e.message });
    }
  }

  /**
   * Gera holerite (recibo de pagamento) PDF A4 com 2 vias identicas (1a empregador, 2a empregado).
   * Filtros: colaborador_id (obrigatorio), competencia (YYYY-MM, obrigatorio), empresa_id (opcional).
   * Soma todos os apontamentos do mes de competencia daquele colaborador.
   */
  /**
   * GET /rh/folha/holerite?colaborador_id=&competencia=YYYY-MM — download do PDF.
   * Geracao fica em services/holerite.service.ts (compartilhada com o Portal do
   * Colaborador, que precisa do Buffer pra hash/MinIO/WhatsApp).
   */
  static async holerite(req: Request, res: Response) {
    try {
      const colaboradorId = req.query.colaborador_id as string;
      const competencia = req.query.competencia as string; // YYYY-MM
      if (!colaboradorId || !competencia) return res.status(400).json({ error: 'colaborador_id e competencia obrigatorios' });

      const h = await gerarHoleritePdf(Number(colaboradorId), competencia);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${h.fileName}"`);
      res.send(h.buffer);
    } catch (e: any) {
      if (e instanceof HoleriteNotFound) return res.status(404).json({ error: e.message });
      console.error('[RhFolha] holerite:', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  }
}
