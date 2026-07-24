import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/database';

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
  static async holerite(req: Request, res: Response) {
    try {
      const colaboradorId = req.query.colaborador_id as string;
      const competencia = req.query.competencia as string; // YYYY-MM
      if (!colaboradorId || !competencia) return res.status(400).json({ error: 'colaborador_id e competencia obrigatorios' });

      // Dados do colaborador
      const colabRows = await AppDataSource.query(
        `SELECT c.id, c.nome, c.matricula, c.cpf, c.salario, c.data_admissao,
                ca.nome AS cargo_nome,
                e.nome_fantasia AS empresa_nome, e.razao_social AS empresa_razao,
                e.cnpj AS empresa_cnpj, e.cep AS empresa_cep, e.rua AS empresa_rua,
                e.numero AS empresa_numero, e.bairro AS empresa_bairro,
                e.cidade AS empresa_cidade, e.estado AS empresa_estado
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_empresas e ON e.id = c.company_id
         WHERE c.id = $1`,
        [Number(colaboradorId)]
      );
      if (!colabRows.length) return res.status(404).json({ error: 'Colaborador nao encontrado' });
      const colab = colabRows[0];

      // Apontamentos do mes (todos os periodos com mes_referencia daquele YYYY-MM)
      const aps = await AppDataSource.query(
        `SELECT a.* FROM rh_apontamentos a
         WHERE a.colaborador_id = $1
           AND to_char(a.mes_referencia, 'YYYY-MM') = $2`,
        [Number(colaboradorId), competencia]
      );

      // Agrega proventos/descontos (soma R$ dos campos_extras *_valor)
      const PROV_KEYS = ['hora_extra_60', 'hora_extra_60_inter', 'hora_extra_100', 'adicional_noturno',
        'quebra_caixa', 'ajuda_custo_domingo', 'ajuda_custo_feriado', 'insalubridade', 'premio'];
      const PROV_LABELS: Record<string, string> = {
        hora_extra_60: 'Horas Extras 60%',
        hora_extra_60_inter: 'HE 60% Interjornada',
        hora_extra_100: 'Horas Extras 100%',
        adicional_noturno: 'Adicional Noturno',
        quebra_caixa: 'Quebra de Caixa',
        ajuda_custo_domingo: 'Ajuda Custo Domingo',
        ajuda_custo_feriado: 'Ajuda Custo Feriado',
        insalubridade: 'Insalubridade',
        premio: 'Premio',
      };
      const DESC_KEYS = ['falta_dias', 'atraso_horas', 'desconto_dsr', 'vale_transporte',
        'desconto_quebra_caixa', 'contribuicao_sindical', 'adiantamento', 'compras'];
      const DESC_LABELS: Record<string, string> = {
        falta_dias: 'Faltas (dias)',
        atraso_horas: 'Atrasos (horas)',
        desconto_dsr: 'Desconto DSR',
        vale_transporte: 'Vale Transporte',
        desconto_quebra_caixa: 'Desc. Quebra Caixa',
        contribuicao_sindical: 'Contrib. Sindical',
        adiantamento: 'Adiantamento',
        compras: 'Compras',
      };

      const linhas: { codigo: string; descricao: string; referencia: string; provento: number; desconto: number }[] = [];

      // Salario base
      const salarioBase = Number(colab.salario || 0);
      linhas.push({ codigo: '001', descricao: 'SALARIO BASE', referencia: '30 dias', provento: salarioBase, desconto: 0 });

      let codigo = 100;
      for (const k of PROV_KEYS) {
        const qtd = aps.reduce((s: number, a: any) => s + Number(a[k] || 0), 0);
        const val = aps.reduce((s: number, a: any) => s + Number(a.campos_extras?.[`${k}_valor`] || 0), 0);
        if (val > 0 || qtd > 0) {
          linhas.push({ codigo: String(codigo++), descricao: PROV_LABELS[k], referencia: qtd ? qtd.toFixed(2) : '-', provento: val, desconto: 0 });
        }
      }
      codigo = 200;
      for (const k of DESC_KEYS) {
        const qtd = aps.reduce((s: number, a: any) => s + Number(a[k] || 0), 0);
        const val = aps.reduce((s: number, a: any) => s + Number(a.campos_extras?.[`${k}_valor`] || 0), 0);
        if (val > 0 || qtd > 0) {
          linhas.push({ codigo: String(codigo++), descricao: DESC_LABELS[k], referencia: qtd ? qtd.toFixed(2) : '-', provento: 0, desconto: val });
        }
      }

      // Calculos
      const totalProventos = linhas.reduce((s, l) => s + l.provento, 0);
      const totalDescontos = linhas.reduce((s, l) => s + l.desconto, 0);
      const liquido = totalProventos - totalDescontos;
      // Bases de calculo (simplificadas - sem realmente calcular INSS/IRRF aqui)
      const baseFGTS = totalProventos;
      const fgtsMes = baseFGTS * 0.08;
      const baseINSS = totalProventos;
      const baseIRRF = totalProventos;

      const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtCompetencia = (() => {
        const [y, m] = competencia.split('-');
        const meses = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        return `${meses[parseInt(m) - 1]} / ${y}`;
      })();

      // PDF A4 portrait, 2 vias
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 25 });
      const fname = `holerite_${colab.matricula || colab.id}_${competencia}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      doc.pipe(res);

      const pageW = doc.page.width - 50; // 595 - 50 margens
      const viaH = 380; // altura de cada via

      const renderVia = (yStart: number, viaLabel: string) => {
        const x0 = 25;
        let y = yStart;
        // Borda externa
        doc.rect(x0, y, pageW, viaH).strokeColor('#000').lineWidth(0.7).stroke();

        // Cabecalho: Empregador (esquerda) | Recibo (direita)
        const headerH = 60;
        doc.rect(x0, y, pageW * 0.55, headerH).stroke();
        doc.rect(x0 + pageW * 0.55, y, pageW * 0.45, headerH).stroke();

        doc.fontSize(7).fillColor('#444').text('EMPREGADOR', x0 + 5, y + 4);
        doc.fontSize(10).fillColor('#000').font('Helvetica-Bold').text(colab.empresa_nome || colab.empresa_razao || '—', x0 + 5, y + 14, { width: pageW * 0.55 - 10 });
        doc.font('Helvetica').fontSize(8).text([colab.empresa_rua, colab.empresa_numero].filter(Boolean).join(', ') || '—', x0 + 5, y + 30, { width: pageW * 0.55 - 10 });
        doc.text(`CNPJ: ${colab.empresa_cnpj || '—'}`, x0 + 5, y + 42);

        doc.fontSize(11).font('Helvetica-Bold').text('Recibo de Pagamento de Salário', x0 + pageW * 0.55 + 5, y + 6, { width: pageW * 0.45 - 10, align: 'center' });
        doc.fontSize(7).font('Helvetica').fillColor('#444').text('Referente ao Mês / Ano', x0 + pageW * 0.55 + 5, y + 24, { width: pageW * 0.45 - 10, align: 'center' });
        doc.fontSize(11).fillColor('#000').font('Helvetica-Bold').text(fmtCompetencia, x0 + pageW * 0.55 + 5, y + 35, { width: pageW * 0.45 - 10, align: 'center' });
        doc.fontSize(7).font('Helvetica').fillColor('#666').text(viaLabel, x0 + pageW * 0.55 + 5, y + 50, { width: pageW * 0.45 - 10, align: 'right' });

        y += headerH;

        // Dados funcionario
        const funcH = 25;
        doc.rect(x0, y, pageW, funcH).stroke();
        doc.fontSize(7).fillColor('#444').font('Helvetica').text('CODIGO', x0 + 5, y + 3);
        doc.fontSize(7).text('NOME DO FUNCIONARIO', x0 + 70, y + 3);
        doc.fontSize(7).text('CPF', x0 + pageW * 0.55, y + 3);
        doc.fontSize(7).text('FUNCAO', x0 + pageW * 0.75, y + 3);
        doc.fontSize(9).fillColor('#000').font('Helvetica-Bold').text(colab.matricula || '-', x0 + 5, y + 13);
        doc.text(String(colab.nome || '-').toUpperCase(), x0 + 70, y + 13, { width: pageW * 0.55 - 75, ellipsis: true, lineBreak: false });
        doc.text(colab.cpf || '-', x0 + pageW * 0.55, y + 13);
        doc.text(String(colab.cargo_nome || '-').toUpperCase(), x0 + pageW * 0.75, y + 13, { width: pageW * 0.25 - 5, ellipsis: true, lineBreak: false });
        y += funcH;

        // Cabecalho da tabela
        const colsW = [40, pageW * 0.45, 70, 80, 80];
        const tableX = [x0, x0 + colsW[0], x0 + colsW[0] + colsW[1], x0 + colsW[0] + colsW[1] + colsW[2], x0 + colsW[0] + colsW[1] + colsW[2] + colsW[3]];
        const headRowH = 16;
        doc.rect(x0, y, pageW, headRowH).fillAndStroke('#E5E7EB', '#000');
        doc.fontSize(8).fillColor('#000').font('Helvetica-Bold');
        doc.text('Cod.', tableX[0] + 3, y + 4, { width: colsW[0] - 6 });
        doc.text('Descricao', tableX[1] + 3, y + 4, { width: colsW[1] - 6 });
        doc.text('Referencia', tableX[2] + 3, y + 4, { width: colsW[2] - 6, align: 'right' });
        doc.text('Proventos', tableX[3] + 3, y + 4, { width: colsW[3] - 6, align: 'right' });
        doc.text('Descontos', tableX[4] + 3, y + 4, { width: colsW[4] - 6, align: 'right' });
        y += headRowH;

        // Linhas
        const rowH = 13;
        doc.font('Helvetica').fontSize(8).fillColor('#000');
        const maxLinhas = 13;
        const linhasCorte = linhas.slice(0, maxLinhas);
        for (const l of linhasCorte) {
          doc.rect(x0, y, pageW, rowH).stroke();
          doc.text(l.codigo, tableX[0] + 3, y + 3, { width: colsW[0] - 6 });
          doc.text(l.descricao.toUpperCase(), tableX[1] + 3, y + 3, { width: colsW[1] - 6, ellipsis: true, lineBreak: false });
          doc.text(l.referencia || '-', tableX[2] + 3, y + 3, { width: colsW[2] - 6, align: 'right' });
          doc.text(l.provento ? fmtMoney(l.provento) : '-', tableX[3] + 3, y + 3, { width: colsW[3] - 6, align: 'right' });
          doc.text(l.desconto ? fmtMoney(l.desconto) : '-', tableX[4] + 3, y + 3, { width: colsW[4] - 6, align: 'right' });
          y += rowH;
        }
        // Linhas vazias pra ocupar tabela
        for (let i = linhasCorte.length; i < maxLinhas; i++) {
          doc.rect(x0, y, pageW, rowH).stroke();
          y += rowH;
        }

        // Totais (rodape direito)
        const totH = 28;
        doc.rect(x0, y, pageW * 0.55, totH).stroke();
        doc.fontSize(7).fillColor('#666').text('MENSAGENS / OBSERVACOES', x0 + 5, y + 3);

        const totaisX = x0 + pageW * 0.55;
        doc.rect(totaisX, y, pageW * 0.225, totH).stroke();
        doc.rect(totaisX + pageW * 0.225, y, pageW * 0.225, totH).stroke();
        doc.fontSize(7).fillColor('#666').text('Total dos Vencimentos', totaisX + 3, y + 3, { width: pageW * 0.225 - 6 });
        doc.text('Total dos Descontos', totaisX + pageW * 0.225 + 3, y + 3, { width: pageW * 0.225 - 6 });
        doc.fontSize(11).fillColor('#000').font('Helvetica-Bold').text(fmtMoney(totalProventos), totaisX + 3, y + 14, { width: pageW * 0.225 - 6, align: 'right' });
        doc.text(fmtMoney(totalDescontos), totaisX + pageW * 0.225 + 3, y + 14, { width: pageW * 0.225 - 6, align: 'right' });
        y += totH;

        // Liquido a Receber + assinatura
        const liqH = 22;
        doc.rect(x0, y, pageW * 0.55, liqH).stroke();
        doc.font('Helvetica').fontSize(6).fillColor('#444').text('DECLARO TER RECEBIDO A IMPORTANCIA LIQUIDA DISCRIMINADA NESTE RECIBO', x0 + 5, y + 3, { width: pageW * 0.55 - 10 });
        doc.fontSize(7).text('Data: ____/____/_______   Assinatura: _____________________________', x0 + 5, y + 12, { width: pageW * 0.55 - 10 });

        doc.rect(totaisX, y, pageW * 0.45, liqH).stroke();
        doc.fontSize(8).fillColor('#000').font('Helvetica-Bold').text('LIQUIDO A RECEBER →', totaisX + 5, y + 7);
        doc.fontSize(13).text(fmtMoney(liquido), totaisX + pageW * 0.225, y + 4, { width: pageW * 0.225 - 6, align: 'right' });
        y += liqH;

        // Bases de calculo
        const baseH = 18;
        const baseColW = pageW / 5;
        doc.rect(x0, y, pageW, baseH).stroke();
        doc.fontSize(7).fillColor('#444').font('Helvetica');
        const labels = [
          ['Salario Base', fmtMoney(salarioBase)],
          ['Base Calc. FGTS', fmtMoney(baseFGTS)],
          ['FGTS do Mes', fmtMoney(fgtsMes)],
          ['Base Calc. INSS', fmtMoney(baseINSS)],
          ['Base Calc. IRRF', fmtMoney(baseIRRF)],
        ];
        labels.forEach((l, i) => {
          if (i > 0) doc.moveTo(x0 + baseColW * i, y).lineTo(x0 + baseColW * i, y + baseH).stroke();
          doc.fontSize(6).fillColor('#666').text(l[0], x0 + baseColW * i + 3, y + 2, { width: baseColW - 6 });
          doc.fontSize(8).fillColor('#000').font('Helvetica-Bold').text(l[1], x0 + baseColW * i + 3, y + 9, { width: baseColW - 6 });
          doc.font('Helvetica');
        });
      };

      renderVia(25, '1ª VIA - EMPRESA');
      renderVia(25 + viaH + 20, '2ª VIA - EMPREGADO');

      // Linha pontilhada entre as 2 vias
      const cutY = 25 + viaH + 8;
      doc.dash(3, { space: 3 }).moveTo(25, cutY).lineTo(25 + pageW, cutY).strokeColor('#888').stroke();
      doc.undash();
      doc.fontSize(7).fillColor('#888').text('✂ destacar aqui', 25 + pageW / 2 - 30, cutY - 8);

      doc.end();
    } catch (e: any) {
      console.error('[RhFolha] holerite:', e);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  }
}
