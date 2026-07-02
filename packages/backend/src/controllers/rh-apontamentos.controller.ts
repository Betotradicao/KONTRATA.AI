import { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { ConfigurationService } from '../services/configuration.service';

// Personalização das colunas da grid (salva por cliente, na tabela configurations)
const ORDEM_KEY_PROV = 'lancamentos_ordem_proventos';   // ordem (array de chaves)
const ORDEM_KEY_DESC = 'lancamentos_ordem_descontos';
const LABELS_KEY = 'lancamentos_labels';                // { chave: "Nome custom" }
const OCULTAS_KEY = 'lancamentos_ocultas';              // [chave, ...] colunas fixas escondidas

const CAMPOS_PROVENTOS = [
  { key: 'hora_extra_60', label: 'HE 60%' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interj.' },
  { key: 'hora_extra_100', label: 'HE 100%' },
  { key: 'adicional_noturno', label: 'Adic. Noturno' },
  { key: 'quebra_caixa', label: 'Quebra Caixa' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Custo Dom.' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Custo Fer.' },
  { key: 'insalubridade', label: 'Insalubridade' },
  { key: 'premio', label: 'Prêmio' },
];
const CAMPOS_DESCONTOS = [
  { key: 'falta_dias', label: 'Falta (dias)' },
  { key: 'atraso_horas', label: 'Atraso (horas)' },
  { key: 'desconto_dsr', label: 'Desc. DSR' },
  { key: 'vale_transporte', label: 'Vale Transp.' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra Caixa' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sindical' },
  { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'compras', label: 'Compras' },
];
const TODOS_CAMPOS = [...CAMPOS_PROVENTOS, ...CAMPOS_DESCONTOS];

/** Controla lancamentos financeiros (apontamentos) por periodo */
export class RhApontamentosController {
  /** Lista campos customizados (colunas extras de proventos/descontos) */
  static async listarCampos(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_apontamento_campos WHERE ativo = true ORDER BY ordem ASC, id ASC`
      );
      return res.json(rows);
    } catch (err: any) {
      console.error('[APONTAMENTOS] listarCampos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Cria campo customizado */
  static async criarCampo(req: AuthRequest, res: Response) {
    try {
      const { label, tipo, mostra_qtd, mostra_valor, mostra_horas } = req.body;
      if (!label?.trim() || !['provento', 'desconto'].includes(tipo)) {
        return res.status(400).json({ error: 'label e tipo (provento|desconto) obrigatorios' });
      }
      const showHoras = mostra_horas === true;
      // QTD e Horas sao mutuamente exclusivos (ambos sao "quantidade").
      // Se marcou Horas, ignora QTD. Senao, QTD segue o default (true).
      const showQtd = !showHoras && mostra_qtd !== false;
      const showValor = mostra_valor !== false;
      if (!showQtd && !showValor && !showHoras) {
        return res.status(400).json({ error: 'Marque pelo menos Horas, QTD ou R$ pra coluna' });
      }
      const chave = 'extra_' + label.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40);
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_apontamento_campos (chave, label, tipo, mostra_qtd, mostra_valor, mostra_horas)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (chave) DO UPDATE SET label = EXCLUDED.label, tipo = EXCLUDED.tipo,
           mostra_qtd = EXCLUDED.mostra_qtd, mostra_valor = EXCLUDED.mostra_valor,
           mostra_horas = EXCLUDED.mostra_horas, ativo = true
         RETURNING *`,
        [chave, label.trim().toUpperCase(), tipo, showQtd, showValor, showHoras]
      );
      return res.status(201).json(row);
    } catch (err: any) {
      console.error('[APONTAMENTOS] criarCampo:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Deleta campo customizado */
  static async deletarCampo(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.query(`UPDATE rh_apontamento_campos SET ativo = false WHERE id = $1`, [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[APONTAMENTOS] deletarCampo:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Retorna a personalização das colunas (ordem + nomes custom + ocultas) do cliente */
  static async getOrdemColunas(_req: AuthRequest, res: Response) {
    try {
      const parseArr = (v: string | null): string[] => {
        if (!v) return [];
        try {
          const a = JSON.parse(v);
          return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
        } catch { return []; }
      };
      const parseObj = (v: string | null): Record<string, string> => {
        if (!v) return {};
        try {
          const o = JSON.parse(v);
          if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
          const out: Record<string, string> = {};
          for (const k of Object.keys(o)) if (typeof o[k] === 'string') out[k] = o[k];
          return out;
        } catch { return {}; }
      };
      const [prov, desc, labels, ocultas] = await Promise.all([
        ConfigurationService.get(ORDEM_KEY_PROV),
        ConfigurationService.get(ORDEM_KEY_DESC),
        ConfigurationService.get(LABELS_KEY),
        ConfigurationService.get(OCULTAS_KEY),
      ]);
      return res.json({
        proventos: parseArr(prov),
        descontos: parseArr(desc),
        labels: parseObj(labels),
        ocultas: parseArr(ocultas),
      });
    } catch (err: any) {
      console.error('[APONTAMENTOS] getOrdemColunas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Salva personalização. Body: { proventos?, descontos?, labels?, ocultas? } */
  static async salvarOrdemColunas(req: AuthRequest, res: Response) {
    try {
      const { proventos, descontos, labels, ocultas } = req.body || {};
      const cleanArr = (arr: any): string[] =>
        Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
      const cleanObj = (o: any): Record<string, string> => {
        if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
        const out: Record<string, string> = {};
        for (const k of Object.keys(o)) if (typeof o[k] === 'string') out[k] = String(o[k]).slice(0, 60);
        return out;
      };
      if (proventos !== undefined) await ConfigurationService.set(ORDEM_KEY_PROV, JSON.stringify(cleanArr(proventos)), false);
      if (descontos !== undefined) await ConfigurationService.set(ORDEM_KEY_DESC, JSON.stringify(cleanArr(descontos)), false);
      if (labels !== undefined) await ConfigurationService.set(LABELS_KEY, JSON.stringify(cleanObj(labels)), false);
      if (ocultas !== undefined) await ConfigurationService.set(OCULTAS_KEY, JSON.stringify(cleanArr(ocultas)), false);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[APONTAMENTOS] salvarOrdemColunas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Lista colaboradores com seus apontamentos do periodo, para montar a grid */
  static async listar(req: AuthRequest, res: Response) {
    try {
      const { company_id, data_inicio, data_fim } = req.query as any;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });

      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id && company_id !== '') {
        params.push(company_id);
        whereCompany = ` AND c.company_id = $${params.length}`;
      }

      const rows = await AppDataSource.query(`
        SELECT c.id AS colaborador_id, c.nome, c.matricula, c.data_admissao, c.salario, c.foto_url,
               ca.nome AS cargo_nome,
               a.id AS apontamento_id,
               to_char(a.mes_referencia, 'YYYY-MM') AS mes_referencia,
               to_char(a.mes_caixa, 'YYYY-MM') AS mes_caixa,
               a.hora_extra_60, a.hora_extra_60_inter, a.hora_extra_100, a.adicional_noturno,
               a.quebra_caixa, a.ajuda_custo_domingo, a.ajuda_custo_feriado, a.insalubridade, a.premio,
               a.falta_dias, a.atraso_horas, a.desconto_dsr, a.vale_transporte, a.desconto_quebra_caixa,
               a.contribuicao_sindical, a.adiantamento, a.compras, a.observacao,
               a.campos_extras
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN rh_apontamentos a ON a.colaborador_id = c.id
          AND a.data_inicio = $1 AND a.data_fim = $2
        WHERE c.status = 'ativo'${whereCompany}
        ORDER BY c.nome ASC
      `, params);

      return res.json(rows);
    } catch (err: any) {
      console.error('[APONTAMENTOS] listar:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Apaga todos os apontamentos de um periodo (data_inicio + data_fim + opcional company_id) */
  static async deletarPeriodo(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, company_id } = req.body || {};
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });
      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id) { params.push(company_id); whereCompany = ` AND company_id = $${params.length}::uuid`; }
      else { whereCompany = ` AND company_id IS NULL`; }
      const r = await AppDataSource.query(
        `DELETE FROM rh_apontamentos WHERE data_inicio = $1::date AND data_fim = $2::date${whereCompany} RETURNING id`,
        params
      );
      return res.json({ success: true, removidos: r?.length ?? 0 });
    } catch (err: any) {
      console.error('[APONTAMENTOS] deletarPeriodo:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Lista os periodos salvos (1 linha por combinacao data_inicio/data_fim/company_id) */
  static async listarPeriodos(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT
          to_char(a.data_inicio, 'YYYY-MM-DD') AS data_inicio,
          to_char(a.data_fim, 'YYYY-MM-DD') AS data_fim,
          to_char(a.mes_referencia, 'YYYY-MM') AS mes_referencia,
          to_char(a.mes_caixa, 'YYYY-MM') AS mes_caixa,
          a.company_id,
          e.apelido AS empresa_apelido,
          e.nome_fantasia AS empresa_nome,
          COUNT(*) AS total_colaboradores,
          MAX(a.updated_at) AS ultima_alteracao,
          MIN(a.created_at) AS criado_em,
          SUM(COALESCE(c.salario, 0)) AS total_salario_bruto
        FROM rh_apontamentos a
        JOIN rh_colaboradores c ON c.id = a.colaborador_id
        LEFT JOIN rh_empresas e ON e.id = a.company_id
        GROUP BY a.data_inicio, a.data_fim, a.mes_referencia, a.mes_caixa, a.company_id, e.apelido, e.nome_fantasia
        ORDER BY a.mes_referencia DESC NULLS LAST, a.data_inicio DESC, a.data_fim DESC
      `);
      return res.json(rows);
    } catch (err: any) {
      console.error('[APONTAMENTOS] listarPeriodos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Salva/atualiza em lote os apontamentos de varios colaboradores */
  static async salvarLote(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, company_id, mes_referencia, mes_caixa, apontamentos } = req.body;
      if (!data_inicio || !data_fim || !Array.isArray(apontamentos)) {
        return res.status(400).json({ error: 'data_inicio, data_fim e apontamentos obrigatorios' });
      }
      if (!mes_referencia) {
        return res.status(400).json({ error: 'mes_referencia obrigatorio (formato YYYY-MM)' });
      }
      if (!mes_caixa) {
        return res.status(400).json({ error: 'mes_caixa obrigatorio (formato YYYY-MM)' });
      }
      const mesRefDate = String(mes_referencia).length === 7 ? `${mes_referencia}-01` : mes_referencia;
      const mesCxDate = String(mes_caixa).length === 7 ? `${mes_caixa}-01` : mes_caixa;
      let salvos = 0;
      for (const a of apontamentos) {
        // Aceita BR ("10,50"), US ("10.50") e horas ("1:20" -> 1.333, "2:00" -> 2.0).
        // Remove "R$", espaços, e separador de milhar.
        const num = (v: any) => {
          if (v === '' || v === null || v === undefined) return 0;
          if (typeof v === 'number') return isNaN(v) ? 0 : v;
          let s = String(v).trim().replace(/R\$|\s/gi, '');
          // Formato horas HH:MM -> decimal
          const m = s.match(/^(-?)(\d+):([0-5]?\d)$/);
          if (m) {
            const sign = m[1] === '-' ? -1 : 1;
            return sign * (parseInt(m[2], 10) + parseInt(m[3], 10) / 60);
          }
          if (s.includes(',') && s.includes('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
          } else if (s.includes(',')) {
            s = s.replace(',', '.');
          }
          const n = Number(s);
          return isNaN(n) ? 0 : n;
        };
        // Converte campos_extras em JSON (apenas numeros)
        const extras: any = {};
        if (a.campos_extras && typeof a.campos_extras === 'object') {
          for (const k of Object.keys(a.campos_extras)) extras[k] = num(a.campos_extras[k]);
        }
        await AppDataSource.query(`
          INSERT INTO rh_apontamentos (
            colaborador_id, company_id, data_inicio, data_fim, mes_referencia, mes_caixa,
            hora_extra_60, hora_extra_60_inter, hora_extra_100, adicional_noturno,
            quebra_caixa, ajuda_custo_domingo, ajuda_custo_feriado, insalubridade, premio,
            falta_dias, atraso_horas, desconto_dsr, vale_transporte, desconto_quebra_caixa,
            contribuicao_sindical, adiantamento, compras, observacao, campos_extras
          ) VALUES (
            $1, $2, $3::date, $4::date, $5::date, $6::date,
            $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb
          )
          ON CONFLICT (colaborador_id, data_inicio, data_fim) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            mes_referencia = EXCLUDED.mes_referencia,
            mes_caixa = EXCLUDED.mes_caixa,
            hora_extra_60 = EXCLUDED.hora_extra_60,
            hora_extra_60_inter = EXCLUDED.hora_extra_60_inter,
            hora_extra_100 = EXCLUDED.hora_extra_100,
            adicional_noturno = EXCLUDED.adicional_noturno,
            quebra_caixa = EXCLUDED.quebra_caixa,
            ajuda_custo_domingo = EXCLUDED.ajuda_custo_domingo,
            ajuda_custo_feriado = EXCLUDED.ajuda_custo_feriado,
            insalubridade = EXCLUDED.insalubridade,
            premio = EXCLUDED.premio,
            falta_dias = EXCLUDED.falta_dias,
            atraso_horas = EXCLUDED.atraso_horas,
            desconto_dsr = EXCLUDED.desconto_dsr,
            vale_transporte = EXCLUDED.vale_transporte,
            desconto_quebra_caixa = EXCLUDED.desconto_quebra_caixa,
            contribuicao_sindical = EXCLUDED.contribuicao_sindical,
            adiantamento = EXCLUDED.adiantamento,
            compras = EXCLUDED.compras,
            observacao = EXCLUDED.observacao,
            campos_extras = EXCLUDED.campos_extras,
            updated_at = NOW()
        `, [
          a.colaborador_id, company_id || null, data_inicio, data_fim, mesRefDate, mesCxDate,
          num(a.hora_extra_60), num(a.hora_extra_60_inter), num(a.hora_extra_100), num(a.adicional_noturno),
          num(a.quebra_caixa), num(a.ajuda_custo_domingo), num(a.ajuda_custo_feriado), num(a.insalubridade), num(a.premio),
          num(a.falta_dias), num(a.atraso_horas), num(a.desconto_dsr), num(a.vale_transporte), num(a.desconto_quebra_caixa),
          num(a.contribuicao_sindical), num(a.adiantamento), num(a.compras), a.observacao || null, JSON.stringify(extras)
        ]);
        salvos++;
      }
      return res.json({ success: true, salvos });
    } catch (err: any) {
      console.error('[APONTAMENTOS] salvarLote:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Exporta PDF do apontamento de um periodo */
  static async exportarPdf(req: AuthRequest, res: Response) {
    try {
      const { company_id, data_inicio, data_fim } = req.query as any;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });

      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id && company_id !== '') { params.push(company_id); whereCompany = ` AND c.company_id = $${params.length}`; }

      const rows = await AppDataSource.query(`
        SELECT c.nome, c.matricula, ca.nome AS cargo_nome, c.salario, c.data_admissao,
               a.*
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN rh_apontamentos a ON a.colaborador_id = c.id
          AND a.data_inicio = $1 AND a.data_fim = $2
        WHERE c.status = 'ativo'${whereCompany}
        ORDER BY c.nome ASC
      `, params);

      const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 18 });
      const fname = `apontamento_${data_inicio}_${data_fim}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      doc.pipe(res);

      const fmtBR = (d: string) => {
        if (!d) return '';
        const [y, m, day] = String(d).split('-');
        return `${day}/${m}/${y}`;
      };
      const fmtMoney = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Header
      doc.fontSize(16).fillColor('#1f2937').text('APONTAMENTO DE FOLHA DE PAGAMENTO', { align: 'center' });
      doc.fontSize(10).fillColor('#6b7280').text(`Periodo: ${fmtBR(data_inicio)} a ${fmtBR(data_fim)}  ·  ${rows.length} colaborador(es)`, { align: 'center' });
      doc.moveDown(0.5);

      // Tabela completa: Matricula | Nome | Cargo | Salario | proventos... | descontos... | Bruto | Liquido
      const colsBase = [
        { label: 'Mat', w: 26 },
        { label: 'Colaborador', w: 110 },
        { label: 'Cargo', w: 80 },
        { label: 'Salario', w: 50 },
      ];
      const colsProv = CAMPOS_PROVENTOS.map(c => ({ label: c.label, key: c.key, w: 38, tipo: 'prov' as const }));
      const colsDesc = CAMPOS_DESCONTOS.map(c => ({ label: c.label, key: c.key, w: 38, tipo: 'desc' as const }));
      const colsTot = [
        { label: 'Bruto', w: 50, tipo: 'tot' as const },
        { label: 'Liquido', w: 50, tipo: 'tot' as const },
      ];
      const allCols: { label: string; w: number; key?: string; tipo?: 'prov' | 'desc' | 'tot' }[] = [
        ...colsBase, ...colsProv, ...colsDesc, ...colsTot,
      ];

      const drawHeader = () => {
        let x = 18;
        const y = doc.y;
        const totalH = 28;
        allCols.forEach(c => {
          let bg = '#374151';
          if (c.tipo === 'prov') bg = '#15803D';
          else if (c.tipo === 'desc') bg = '#B91C1C';
          else if (c.tipo === 'tot') bg = '#1D4ED8';
          doc.rect(x, y, c.w, totalH).fill(bg);
          doc.fillColor('#FFFFFF').fontSize(7).text(c.label, x + 2, y + 4, { width: c.w - 4, align: 'center' });
          x += c.w;
        });
        doc.y = y + totalH;
      };

      doc.fontSize(8);
      drawHeader();

      const rowH = 18;
      let zebra = false;
      for (const r of rows) {
        if (doc.y + rowH > doc.page.height - 25) {
          doc.addPage();
          drawHeader();
          zebra = false;
        }
        const proventosTot = CAMPOS_PROVENTOS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
        const descontosTot = CAMPOS_DESCONTOS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
        const sal = Number(r.salario || 0);
        const bruto = sal + proventosTot;
        const liquido = bruto - descontosTot;

        const y = doc.y;
        let x = 18;
        // fundo da linha (zebra)
        if (zebra) {
          doc.rect(18, y, allCols.reduce((a, c) => a + c.w, 0), rowH).fill('#F9FAFB');
        }
        zebra = !zebra;

        // Pinta fundo verde/vermelho claro nas celulas de prov/desc
        let xPaint = 18 + colsBase.reduce((a, c) => a + c.w, 0);
        colsProv.forEach(c => {
          doc.rect(xPaint, y, c.w, rowH).fill('#DCFCE7');
          xPaint += c.w;
        });
        colsDesc.forEach(c => {
          doc.rect(xPaint, y, c.w, rowH).fill('#FEE2E2');
          xPaint += c.w;
        });
        // Totais
        doc.rect(xPaint, y, colsTot[0].w, rowH).fill('#FEF3C7'); xPaint += colsTot[0].w;
        doc.rect(xPaint, y, colsTot[1].w, rowH).fill('#DBEAFE');

        // Texto
        doc.fillColor('#1f2937').fontSize(7);
        x = 18;
        const baseVals = [
          r.matricula || '',
          r.nome || '',
          r.cargo_nome || '-',
          fmtMoney(sal),
        ];
        colsBase.forEach((c, i) => {
          doc.text(String(baseVals[i]), x + 2, y + 4, { width: c.w - 4, ellipsis: true, lineBreak: false });
          x += c.w;
        });
        // Proventos
        doc.fillColor('#166534');
        colsProv.forEach(c => {
          const v = Number(r[c.key!] || 0);
          doc.text(v ? v.toFixed(2) : '-', x + 2, y + 4, { width: c.w - 4, align: 'right' });
          x += c.w;
        });
        // Descontos
        doc.fillColor('#991B1B');
        colsDesc.forEach(c => {
          const v = Number(r[c.key!] || 0);
          doc.text(v ? v.toFixed(2) : '-', x + 2, y + 4, { width: c.w - 4, align: 'right' });
          x += c.w;
        });
        // Bruto / Liquido
        doc.fillColor('#92400E').text(fmtMoney(bruto), x + 2, y + 4, { width: colsTot[0].w - 4, align: 'right' });
        x += colsTot[0].w;
        doc.fillColor('#1E3A8A').text(fmtMoney(liquido), x + 2, y + 4, { width: colsTot[1].w - 4, align: 'right' });

        doc.y = y + rowH;
      }

      // Rodape com totais gerais
      const totSal = rows.reduce((s: number, r: any) => s + Number(r.salario || 0), 0);
      const totProv = rows.reduce((s: number, r: any) => s + CAMPOS_PROVENTOS.reduce((ss, c) => ss + Number(r[c.key] || 0), 0), 0);
      const totDesc = rows.reduce((s: number, r: any) => s + CAMPOS_DESCONTOS.reduce((ss, c) => ss + Number(r[c.key] || 0), 0), 0);
      doc.moveDown(1);
      doc.fontSize(10).fillColor('#1f2937');
      doc.text(`TOTAIS: Salario ${fmtMoney(totSal)}  ·  Proventos ${fmtMoney(totProv)}  ·  Descontos ${fmtMoney(totDesc)}  ·  Bruto ${fmtMoney(totSal + totProv)}  ·  Liquido ${fmtMoney(totSal + totProv - totDesc)}`, { align: 'right' });

      doc.end();
    } catch (err: any) {
      console.error('[APONTAMENTOS] exportarPdf:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }

  /** Exporta Excel do apontamento de um periodo (layout igual ao original) */
  static async exportarExcel(req: AuthRequest, res: Response) {
    try {
      const { company_id, data_inicio, data_fim } = req.query as any;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });

      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id && company_id !== '') { params.push(company_id); whereCompany = ` AND c.company_id = $${params.length}`; }

      const rows = await AppDataSource.query(`
        SELECT c.nome, c.matricula, ca.nome AS cargo_nome, c.salario, c.data_admissao,
               a.*
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN rh_apontamentos a ON a.colaborador_id = c.id
          AND a.data_inicio = $1 AND a.data_fim = $2
        WHERE c.status = 'ativo'${whereCompany}
        ORDER BY c.nome ASC
      `, params);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Apontamento');

      // Colunas pareadas: cada provento/desconto vira QTD + R$
      type Col = { header: string; key: string; width: number; tipo: 'fixa' | 'prov_qtd' | 'prov_val' | 'desc_qtd' | 'desc_val' | 'tot' };
      const colsFixas: Col[] = [
        { header: 'Matricula', key: 'matricula', width: 11, tipo: 'fixa' },
        { header: 'Funcionario', key: 'nome', width: 32, tipo: 'fixa' },
        { header: 'Admissao', key: 'admissao', width: 11, tipo: 'fixa' },
        { header: 'Funcao', key: 'funcao', width: 22, tipo: 'fixa' },
        { header: 'Salario', key: 'salario', width: 12, tipo: 'fixa' },
      ];
      const colsProv: Col[] = [];
      CAMPOS_PROVENTOS.forEach(c => {
        colsProv.push({ header: `${c.label} QTD`, key: `${c.key}_qtd`, width: 10, tipo: 'prov_qtd' });
        colsProv.push({ header: `${c.label} R$`, key: `${c.key}_val`, width: 12, tipo: 'prov_val' });
      });
      const colsDesc: Col[] = [];
      CAMPOS_DESCONTOS.forEach(c => {
        colsDesc.push({ header: `${c.label} QTD`, key: `${c.key}_qtd`, width: 10, tipo: 'desc_qtd' });
        colsDesc.push({ header: `${c.label} R$`, key: `${c.key}_val`, width: 12, tipo: 'desc_val' });
      });
      const colsTotais: Col[] = [
        { header: 'Total Proventos', key: '_totProv', width: 14, tipo: 'tot' },
        { header: 'Total Descontos', key: '_totDesc', width: 14, tipo: 'tot' },
        { header: 'Bruto', key: '_bruto', width: 13, tipo: 'tot' },
        { header: 'Liquido', key: '_liquido', width: 13, tipo: 'tot' },
        { header: 'Observacao', key: 'observacao', width: 25, tipo: 'fixa' },
      ];
      const allCols: Col[] = [...colsFixas, ...colsProv, ...colsDesc, ...colsTotais];
      ws.columns = allCols.map(c => ({ header: c.header, key: c.key, width: c.width }));

      // Style do header
      const header = ws.getRow(1);
      header.height = 30;
      header.eachCell((cell, colNumber) => {
        const col = allCols[colNumber - 1];
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        let bg = 'FF374151';
        if (col.tipo === 'prov_qtd') bg = 'FF22C55E';      // verde claro
        else if (col.tipo === 'prov_val') bg = 'FF15803D'; // verde escuro
        else if (col.tipo === 'desc_qtd') bg = 'FFEF4444'; // vermelho claro
        else if (col.tipo === 'desc_val') bg = 'FFB91C1C'; // vermelho escuro
        else if (col.tipo === 'tot') bg = 'FF1D4ED8';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      });

      // Linhas de dados
      for (const r of rows) {
        const totProv = CAMPOS_PROVENTOS.reduce((s, c) => s + Number(r.campos_extras?.[`${c.key}_valor`] || 0), 0);
        const totDesc = CAMPOS_DESCONTOS.reduce((s, c) => s + Number(r.campos_extras?.[`${c.key}_valor`] || 0), 0);
        const sal = Number(r.salario || 0);
        const bruto = sal + totProv;
        const liquido = bruto - totDesc;
        const rowData: any = {
          matricula: r.matricula || '',
          nome: r.nome || '',
          admissao: r.data_admissao ? new Date(r.data_admissao).toLocaleDateString('pt-BR') : '',
          funcao: r.cargo_nome || '',
          salario: sal,
          _totProv: totProv,
          _totDesc: totDesc,
          _bruto: bruto,
          _liquido: liquido,
          observacao: r.observacao || '',
        };
        CAMPOS_PROVENTOS.forEach(c => {
          rowData[`${c.key}_qtd`] = Number(r[c.key] || 0);
          rowData[`${c.key}_val`] = Number(r.campos_extras?.[`${c.key}_valor`] || 0);
        });
        CAMPOS_DESCONTOS.forEach(c => {
          rowData[`${c.key}_qtd`] = Number(r[c.key] || 0);
          rowData[`${c.key}_val`] = Number(r.campos_extras?.[`${c.key}_valor`] || 0);
        });
        const newRow = ws.addRow(rowData);

        newRow.eachCell((cell, colNumber) => {
          const col = allCols[colNumber - 1];
          if (col.tipo === 'prov_qtd' || col.tipo === 'prov_val') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.tipo === 'prov_qtd' ? 'FFF0FDF4' : 'FFDCFCE7' } };
            cell.font = { color: { argb: 'FF166534' } };
          } else if (col.tipo === 'desc_qtd' || col.tipo === 'desc_val') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.tipo === 'desc_qtd' ? 'FFFEF2F2' : 'FFFEE2E2' } };
            cell.font = { color: { argb: 'FF991B1B' } };
          } else if (col.tipo === 'tot') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            cell.font = { color: { argb: 'FF1E3A8A' }, bold: true };
          }
          // Formato: QTD = decimal puro, R$ = moeda
          if (typeof cell.value === 'number') {
            if (col.tipo === 'prov_val' || col.tipo === 'desc_val' || col.tipo === 'tot' || col.key === 'salario') {
              cell.numFmt = 'R$ #,##0.00';
            } else if (col.tipo === 'prov_qtd' || col.tipo === 'desc_qtd') {
              cell.numFmt = '#,##0.00';
            }
          }
        });
      }

      ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

      const buf = await wb.xlsx.writeBuffer();
      const fname = `apontamento_${data_inicio}_${data_fim}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.send(Buffer.from(buf));
    } catch (err: any) {
      console.error('[APONTAMENTOS] exportarExcel:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
