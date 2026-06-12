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

interface ResumoLoja { loja: string; cargos: { cargo: string; qtd: number }[]; }
interface Resumo { total: number; lojas: ResumoLoja[]; }

interface Candidato {
  id: number; nome: string; whatsapp: string; cidade: string; recebido: string; foto_url: string | null; status: string;
}
interface VagaDetalhe { loja: string; cargo: string; titulo: string; candidatos: Candidato[]; }

export class VagasAbertasWhatsService {
  // ===== Dados pro CORPO da mensagem (resumo por loja -> cargo) =====
  static async getResumo(): Promise<Resumo> {
    const rows: any[] = await AppDataSource.query(`
      SELECT COALESCE(e.apelido, e.nome_fantasia, 'Loja ' || v.cod_loja::text) AS loja, ca.nome AS cargo
      FROM rh_vagas v
      LEFT JOIN rh_cargos ca ON ca.id = v.cargo_id
      LEFT JOIN rh_empresas e ON e.cod_loja = v.cod_loja
      WHERE v.status IN ('Aberta', 'Em Selecao')
      ORDER BY loja, cargo
    `);
    const total = rows.length;
    const map = new Map<string, ResumoLoja>();
    for (const r of rows) {
      const loja = r.loja || 'Sem loja';
      if (!map.has(loja)) map.set(loja, { loja, cargos: [] });
      const L = map.get(loja)!;
      const cargo = r.cargo || 'Sem cargo definido';
      const ex = L.cargos.find(c => c.cargo === cargo);
      if (ex) ex.qtd += 1; else L.cargos.push({ cargo, qtd: 1 });
    }
    return { total, lojas: [...map.values()] };
  }

  static buildMensagem(resumo: Resumo): string {
    let msg = `📢 *VAGAS EM ABERTO*\n\nVagas em Aberto No Total: *${resumo.total}*\n`;
    for (const L of resumo.lojas) {
      msg += `\n🏪 *${L.loja}*\n`;
      for (const c of L.cargos) msg += `${c.cargo}: ${c.qtd} vaga${c.qtd > 1 ? 's' : ''}\n`;
    }
    msg += `\n📄 Veja a lista completa de candidatos (com foto e contato) no PDF anexo.`;
    return msg;
  }

  // ===== Dados pro PDF (cada vaga com a lista de candidatos e o status) =====
  static async getDetalhe(): Promise<VagaDetalhe[]> {
    const rows: any[] = await AppDataSource.query(`
      SELECT COALESCE(e.apelido, e.nome_fantasia, 'Loja ' || v.cod_loja::text) AS loja,
             ca.nome AS cargo, v.titulo AS titulo, v.id AS vaga_id,
             c.id AS cand_id, c.nome, c.whatsapp, c.cidade, c.created_at, c.foto_url,
             CASE
               WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int=c.id AND (s->>'contratado')::boolean IS TRUE) THEN 'Contratado'
               WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.selecionados,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int=c.id) THEN 'Selecionado'
               WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.recusados,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int=c.id) THEN 'Recusado'
               WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v.vagas_futuras,'[]'::jsonb)) s WHERE (s->>'curriculo_id')::int=c.id) THEN 'Vagas Futuras'
               ELSE 'Novo'
             END AS status
      FROM rh_vagas v
      LEFT JOIN rh_cargos ca ON ca.id = v.cargo_id
      LEFT JOIN rh_empresas e ON e.cod_loja = v.cod_loja
      JOIN curriculos c ON c.vagas_interesse_ids @> jsonb_build_array(v.id)
      WHERE v.status IN ('Aberta', 'Em Selecao')
      ORDER BY loja, cargo, v.id, c.created_at DESC
    `);
    const map = new Map<number, VagaDetalhe>();
    for (const r of rows) {
      if (!map.has(r.vaga_id)) map.set(r.vaga_id, { loja: r.loja, cargo: r.cargo || 'Sem cargo', titulo: r.titulo, candidatos: [] });
      const d = new Date(r.created_at);
      const recebido = isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      map.get(r.vaga_id)!.candidatos.push({
        id: r.cand_id, nome: r.nome || '', whatsapp: r.whatsapp || '', cidade: r.cidade || '',
        recebido, foto_url: r.foto_url || null, status: r.status,
      });
    }
    return [...map.values()];
  }

  // PDF em PAISAGEM com a tabela de candidatos por vaga (nome, whats, cidade, recebido, status).
  static buildPdf(vagas: VagaDetalhe[], total: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 30;
      const right = doc.page.width - 30;
      // colunas: foto | nome | whatsapp | cidade | recebido | status
      const cols = [
        { x: left, w: 34, label: '' },
        { x: left + 38, w: 200, label: 'Nome' },
        { x: left + 242, w: 120, label: 'WhatsApp' },
        { x: left + 366, w: 150, label: 'Cidade' },
        { x: left + 520, w: 90, label: 'Recebido' },
        { x: left + 614, w: 110, label: 'Status' },
      ];
      const statusColor: Record<string, string> = {
        'Contratado': '#7c3aed', 'Selecionado': '#2563eb', 'Recusado': '#6b7280',
        'Vagas Futuras': '#d97706', 'Novo': '#e11d48',
      };

      // Logo Kontrata.ai (texto estilizado: caixa roxa + "Kontrata.ai" amarelo)
      doc.save();
      doc.roundedRect(30, 20, 150, 42, 8).fill('#6B21A8');
      doc.fillColor('#FFD60A').font('Helvetica-Bold').fontSize(21).text('Kontrata.ai', 30, 32, { width: 150, align: 'center' });
      doc.restore();

      doc.fontSize(18).fillColor('#7c3aed').font('Helvetica-Bold').text('VAGAS EM ABERTO', 0, 32, { align: 'center' });
      doc.fontSize(10).fillColor('#555').font('Helvetica').text(`Total de vagas em aberto: ${total}`, { align: 'center' });
      doc.moveDown(0.5);

      const ensureSpace = (h: number) => { if (doc.y + h > doc.page.height - 30) doc.addPage({ layout: 'landscape', size: 'A4', margin: 30 }); };

      for (const v of vagas) {
        ensureSpace(60);
        const nome = v.titulo && v.titulo !== v.cargo ? `${v.cargo} — ${v.titulo}` : v.cargo;
        doc.moveDown(0.6).fontSize(13).fillColor('#7c3aed').font('Helvetica-Bold')
          .text(`${v.loja}  •  ${nome}  (${v.candidatos.length} candidato${v.candidatos.length === 1 ? '' : 's'})`, left);
        // cabecalho da tabela
        let y = doc.y + 4;
        doc.fontSize(8.5).fillColor('#888').font('Helvetica-Bold');
        cols.forEach(c => { if (c.label) doc.text(c.label, c.x, y, { width: c.w }); });
        y += 14;
        doc.moveTo(left, y - 2).lineTo(right, y - 2).strokeColor('#ddd').stroke();

        doc.font('Helvetica').fontSize(8.5);
        for (const cand of v.candidatos) {
          const rowH = 26;
          if (y + rowH > doc.page.height - 30) { doc.addPage({ layout: 'landscape', size: 'A4', margin: 30 }); y = 40; }
          // avatar com a inicial (sem foto — mais leve)
          doc.save().circle(cols[0].x + 14, y + 12, 11).fillColor('#ede9fe').fill();
          doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(9).text((cand.nome[0] || '?').toUpperCase(), cols[0].x + 9, y + 7);
          doc.restore();
          doc.fillColor('#111').fontSize(8.5).font('Helvetica');
          doc.text(cand.nome, cols[1].x, y + 6, { width: cols[1].w, ellipsis: true, lineBreak: false });
          doc.text(cand.whatsapp, cols[2].x, y + 6, { width: cols[2].w, ellipsis: true, lineBreak: false });
          doc.text(cand.cidade, cols[3].x, y + 6, { width: cols[3].w, ellipsis: true, lineBreak: false });
          doc.text(cand.recebido, cols[4].x, y + 6, { width: cols[4].w });
          doc.fillColor(statusColor[cand.status] || '#111').font('Helvetica-Bold')
            .text(cand.status, cols[5].x, y + 6, { width: cols[5].w });
          doc.font('Helvetica');
          doc.moveTo(left, y + rowH - 2).lineTo(right, y + rowH - 2).strokeColor('#f0f0f0').stroke();
          y += rowH;
        }
        doc.y = y + 6;
      }
      doc.end();
    });
  }

  static async enviar(): Promise<{ total: number }> {
    const groupId = await ConfigurationService.get('whatsapp_group_vagas_abertas', '');
    if (!groupId) throw new Error('Grupo de "Vagas em Aberto" nao configurado. Configure e salve antes.');
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API nao configurada (URL, Token e Instancia).');

    const resumo = await this.getResumo();
    const detalhe = await this.getDetalhe();
    const msg = this.buildMensagem(resumo);
    const pdf = await this.buildPdf(detalhe, resumo.total);

    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    await axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`,
      { number: groupId, text: msg }, { headers, timeout: 20000 });

    try {
      await axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
        { number: groupId, mediatype: 'document', mimetype: 'application/pdf',
          media: pdf.toString('base64'), fileName: 'vagas-em-aberto.pdf', caption: '' },
        { headers, timeout: 60000 });
    } catch (e: any) {
      console.error('[vagas-abertas] sendMedia falhou:', e.response?.status, JSON.stringify(e.response?.data || e.message));
      throw new Error('Falha ao enviar o PDF: ' + JSON.stringify(e.response?.data?.message || e.response?.data || e.message));
    }

    return { total: resumo.total };
  }
}
