import PDFDocument from 'pdfkit';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

const DEFAULT_ANTECEDENCIA = 45;

interface AsoItem {
  colaborador_id: number;
  nome: string;
  matricula: string;
  cargo: string;
  loja: string;
  data_vencimento: string; // DD/MM/AAAA
  dias: number;            // dias vencido (vencidos) ou dias restantes (a vencer)
}
interface AsoRelatorio {
  antecedencia: number;
  vencidos: AsoItem[];
  aVencer: AsoItem[];
}

export class AsoWhatsService {
  // ===== Coleta o ASO vigente de cada colaborador ativo (mesma logica do Controle de ASO) =====
  // vigente = ultimo Periodico; se nao houver, ultimo Admissional. Dispensados ficam de fora.
  static async getRelatorio(antecedencia = DEFAULT_ANTECEDENCIA): Promise<AsoRelatorio> {
    const rows: any[] = await AppDataSource.query(`
      SELECT c.id AS colaborador_id, c.nome, c.matricula,
             ca.nome AS cargo,
             COALESCE(e.apelido, e.nome_fantasia, 'Loja ' || e.cod_loja::text, 'Sem loja') AS loja,
             vig.data_vencimento
      FROM rh_colaboradores c
      LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
      LEFT JOIN rh_empresas e ON e.cod_loja = c.empresa_id
      JOIN LATERAL (
        SELECT a.data_vencimento
        FROM rh_asos a
        WHERE a.colaborador_id = c.id AND a.tipo IN ('admissional','periodico')
        ORDER BY CASE WHEN a.tipo='periodico' THEN 0 ELSE 1 END, a.data_exame DESC
        LIMIT 1
      ) vig ON true
      WHERE c.status = 'ativo'
        AND COALESCE(c.aso_dispensado, false) = false
        AND vig.data_vencimento IS NOT NULL
      ORDER BY loja, vig.data_vencimento ASC
    `);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const MS_DIA = 24 * 60 * 60 * 1000;
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const vencidos: AsoItem[] = [];
    const aVencer: AsoItem[] = [];

    for (const r of rows) {
      const venc = new Date(r.data_vencimento);
      venc.setHours(0, 0, 0, 0);
      const diffDias = Math.round((venc.getTime() - hoje.getTime()) / MS_DIA);
      const base: Omit<AsoItem, 'dias'> = {
        colaborador_id: r.colaborador_id,
        nome: r.nome || '',
        matricula: r.matricula || '',
        cargo: r.cargo || 'Sem cargo',
        loja: r.loja || 'Sem loja',
        data_vencimento: fmt(venc),
      };
      if (diffDias < 0) {
        vencidos.push({ ...base, dias: Math.abs(diffDias) });
      } else if (diffDias <= antecedencia) {
        aVencer.push({ ...base, dias: diffDias });
      }
    }
    return { antecedencia, vencidos, aVencer };
  }

  static buildMensagem(rel: AsoRelatorio): string {
    const porLoja = (itens: AsoItem[], aVencer: boolean) => {
      const map = new Map<string, AsoItem[]>();
      for (const i of itens) {
        if (!map.has(i.loja)) map.set(i.loja, []);
        map.get(i.loja)!.push(i);
      }
      let s = '';
      for (const [loja, lista] of map) {
        s += `\n🏪 *${loja}*\n`;
        for (const i of lista) {
          const quando = aVencer
            ? `vence ${i.data_vencimento} · faltam ${i.dias} dia${i.dias === 1 ? '' : 's'}`
            : `venceu ${i.data_vencimento} · há ${i.dias} dia${i.dias === 1 ? '' : 's'}`;
          const mat = i.matricula ? `  ·  Mat ${i.matricula}` : '';
          s += `\n• *${i.nome}*${mat}\n`;
          s += `   ${i.cargo}\n`;
          s += `   📅 ${quando}\n`;
        }
      }
      return s;
    };

    let msg = `🩺 *SAÚDE OCUPACIONAL — ASO*\n`;
    msg += `\n🔴 *VENCIDOS: ${rel.vencidos.length}*\n`;
    msg += rel.vencidos.length ? porLoja(rel.vencidos, false) : '_Nenhum ASO vencido._\n';
    msg += `\n🟡 *A VENCER (até ${rel.antecedencia} dias): ${rel.aVencer.length}*\n`;
    msg += rel.aVencer.length ? porLoja(rel.aVencer, true) : '_Nenhum ASO a vencer nesse período._\n';
    msg += `\n📄 Veja a lista completa (loja, colaborador e vencimento) no PDF anexo.`;
    return msg;
  }

  // PDF em PAISAGEM com duas seções: VENCIDOS e A VENCER (até X dias).
  static buildPdf(rel: AsoRelatorio): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 30;
      const right = doc.page.width - 30;
      // colunas: avatar | colaborador | matricula | cargo | vencimento | situacao
      // (loja virou faixa/cabecalho de grupo, nao e mais coluna)
      const cols = [
        { x: left, w: 34, label: '' },
        { x: left + 38, w: 240, label: 'Colaborador' },
        { x: left + 285, w: 60, label: 'Matrícula' },
        { x: left + 350, w: 250, label: 'Cargo' },
        { x: left + 606, w: 80, label: 'Vencimento' },
        { x: left + 688, w: 90, label: 'Situação' },
      ];

      const ensureSpace = (h: number) => { if (doc.y + h > doc.page.height - 30) doc.addPage({ layout: 'landscape', size: 'A4', margin: 30 }); };

      // Logo Kontrata.ai (caixa roxa + "Kontrata.ai" amarelo)
      doc.save();
      doc.roundedRect(30, 20, 150, 42, 8).fill('#6B21A8');
      doc.fillColor('#FFD60A').font('Helvetica-Bold').fontSize(21).text('Kontrata.ai', 30, 32, { width: 150, align: 'center' });
      doc.restore();

      doc.fontSize(18).fillColor('#7c3aed').font('Helvetica-Bold').text('SAÚDE OCUPACIONAL — ASO', 0, 32, { align: 'center' });
      doc.fontSize(10).fillColor('#555').font('Helvetica')
        .text(`Vencidos: ${rel.vencidos.length}   •   A vencer (até ${rel.antecedencia} dias): ${rel.aVencer.length}`, { align: 'center' });
      doc.moveDown(0.5);

      const rowH = 26;
      const bottom = () => doc.page.height - 30;
      const novaPagina = () => { doc.addPage({ layout: 'landscape', size: 'A4', margin: 30 }); return 40; };

      const drawSecao = (titulo: string, cor: string, itens: AsoItem[], aVencer: boolean) => {
        ensureSpace(60);
        doc.moveDown(0.6).fontSize(14).fillColor(cor).font('Helvetica-Bold')
          .text(`${titulo} (${itens.length})`, left);
        if (itens.length === 0) {
          doc.fontSize(9).fillColor('#888').font('Helvetica').text('Nenhum registro.', left);
          return;
        }

        // agrupa por loja (rows ja vem ORDER BY loja, entao a ordem se mantem)
        const grupos = new Map<string, AsoItem[]>();
        for (const it of itens) {
          if (!grupos.has(it.loja)) grupos.set(it.loja, []);
          grupos.get(it.loja)!.push(it);
        }

        let y = doc.y + 6;
        const drawColHeader = () => {
          doc.fontSize(8.5).fillColor('#888').font('Helvetica-Bold');
          cols.forEach(c => { if (c.label) doc.text(c.label, c.x, y, { width: c.w }); });
          y += 14;
          doc.moveTo(left, y - 2).lineTo(right, y - 2).strokeColor('#ddd').stroke();
        };

        for (const [loja, lista] of grupos) {
          // garante que a faixa da loja + cabecalho + 1 linha caibam na pagina
          if (y + 22 + 14 + rowH > bottom()) y = novaPagina();
          // faixa da loja
          doc.save().rect(left, y, right - left, 18).fill('#f3e8ff').restore();
          doc.fillColor('#6B21A8').font('Helvetica-Bold').fontSize(10)
            .text(`${loja}  (${lista.length})`, left + 6, y + 5);
          y += 22;
          drawColHeader();

          for (const it of lista) {
            if (y + rowH > bottom()) { y = novaPagina(); drawColHeader(); }
            // avatar com a inicial
            doc.save().circle(cols[0].x + 14, y + 12, 11).fillColor('#ede9fe').fill();
            doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(9).text((it.nome[0] || '?').toUpperCase(), cols[0].x + 9, y + 7);
            doc.restore();
            doc.fillColor('#111').fontSize(8.5).font('Helvetica');
            doc.text(it.nome, cols[1].x, y + 6, { width: cols[1].w, ellipsis: true, lineBreak: false });
            doc.text(it.matricula, cols[2].x, y + 6, { width: cols[2].w, ellipsis: true, lineBreak: false });
            doc.text(it.cargo, cols[3].x, y + 6, { width: cols[3].w, ellipsis: true, lineBreak: false });
            doc.text(it.data_vencimento, cols[4].x, y + 6, { width: cols[4].w });
            const situacao = aVencer ? `Faltam ${it.dias}d` : `Vencido há ${it.dias}d`;
            doc.fillColor(cor).font('Helvetica-Bold').text(situacao, cols[5].x, y + 6, { width: cols[5].w });
            doc.font('Helvetica');
            doc.moveTo(left, y + rowH - 2).lineTo(right, y + rowH - 2).strokeColor('#f0f0f0').stroke();
            y += rowH;
          }
          y += 8; // respiro entre lojas
        }
        doc.y = y + 6;
      };

      drawSecao('VENCIDOS', '#e11d48', rel.vencidos, false);
      drawSecao(`A VENCER (até ${rel.antecedencia} dias)`, '#d97706', rel.aVencer, true);

      doc.end();
    });
  }

  static async enviar(): Promise<{ vencidos: number; aVencer: number }> {
    const groupId = await ConfigurationService.get('whatsapp_group_aso', '');
    if (!groupId) throw new Error('Grupo de "Saúde Ocupacional" nao configurado. Configure e salve antes.');
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API nao configurada (URL, Token e Instancia).');

    const antRaw = await ConfigurationService.get('whatsapp_aso_dias_antecedencia', String(DEFAULT_ANTECEDENCIA));
    const antecedencia = parseInt(String(antRaw || DEFAULT_ANTECEDENCIA)) || DEFAULT_ANTECEDENCIA;
    const rel = await this.getRelatorio(antecedencia);
    const msg = this.buildMensagem(rel);
    const pdf = await this.buildPdf(rel);

    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    await axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`,
      { number: groupId, text: msg }, { headers, timeout: 20000 });

    try {
      await axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
        { number: groupId, mediatype: 'document', mimetype: 'application/pdf',
          media: pdf.toString('base64'), fileName: 'saude-ocupacional-aso.pdf', caption: '' },
        { headers, timeout: 60000 });
    } catch (e: any) {
      console.error('[aso] sendMedia falhou:', e.response?.status, JSON.stringify(e.response?.data || e.message));
      throw new Error('Falha ao enviar o PDF: ' + JSON.stringify(e.response?.data?.message || e.response?.data || e.message));
    }

    return { vencidos: rel.vencidos.length, aVencer: rel.aVencer.length };
  }
}
