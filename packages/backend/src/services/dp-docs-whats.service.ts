import PDFDocument from 'pdfkit';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';

// Alertas dos Documentos do Departamento Pessoal (dp_pastas/dp_subpastas/dp_documentos)
// num grupo de WhatsApp. DUAS mensagens SEPARADAS:
//  1) VENCIMENTO  -> documentos cujo data_alerta e HOJE (dispara 1x na data do alerta).
//  2) OBRIGATORIOS -> subpastas marcadas como obrigatorio que estao SEM arquivo (dia X do mes).
// Vinculo loja: dp_pastas.company_id = rh_empresas.id.

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

interface ItemVenc { loja: string; pasta: string; subpasta: string | null; documento: string; vence: string | null; }
interface ItemObrig { loja: string; pasta: string; subpasta: string; }

export class DpDocsWhatsService {
  static async getVencimentosHoje(): Promise<ItemVenc[]> {
    return AppDataSource.query(
      `SELECT COALESCE(NULLIF(CONCAT_WS(' - ',
                CASE WHEN e.cod_loja IS NOT NULL THEN 'Loja ' || e.cod_loja::text END,
                COALESCE(e.apelido, e.nome_fantasia, e.razao_social)
              ), ''), 'Sem loja') AS loja,
              p.nome AS pasta, sp.nome AS subpasta, d.nome AS documento,
              to_char(d.data_vencimento, 'DD/MM/YYYY') AS vence
       FROM dp_documentos d
       JOIN dp_pastas p ON p.id = d.pasta_id
       LEFT JOIN dp_subpastas sp ON sp.id = d.subpasta_id
       LEFT JOIN rh_empresas e ON e.id = p.company_id
       WHERE d.data_alerta::date = CURRENT_DATE
       ORDER BY loja, p.nome, sp.nome`
    );
  }

  static async getObrigatoriosFaltando(): Promise<ItemObrig[]> {
    return AppDataSource.query(
      `SELECT COALESCE(NULLIF(CONCAT_WS(' - ',
                CASE WHEN e.cod_loja IS NOT NULL THEN 'Loja ' || e.cod_loja::text END,
                COALESCE(e.apelido, e.nome_fantasia, e.razao_social)
              ), ''), 'Sem loja') AS loja,
              p.nome AS pasta, sp.nome AS subpasta
       FROM dp_subpastas sp
       JOIN dp_pastas p ON p.id = sp.pasta_id
       LEFT JOIN rh_empresas e ON e.id = p.company_id
       WHERE sp.obrigatorio = true
         AND NOT EXISTS (SELECT 1 FROM dp_documentos d WHERE d.subpasta_id = sp.id)
       ORDER BY loja, p.nome, sp.nome`
    );
  }

  private static agrupar<T extends { loja: string }>(itens: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const i of itens) {
      if (!map.has(i.loja)) map.set(i.loja, []);
      map.get(i.loja)!.push(i);
    }
    return map;
  }

  static buildMsgVencimento(itens: ItemVenc[]): string {
    let msg = `📋 *DOCUMENTOS — DEPARTAMENTO PESSOAL*\n\n`;
    msg += `⏰ *ALERTA DE VENCIMENTO: ${itens.length}*\n`;
    if (itens.length === 0) return msg + `\n_Nenhum documento com alerta de vencimento hoje._`;
    for (const [loja, lista] of this.agrupar(itens)) {
      msg += `\n🏪 *${loja}*\n`;
      for (const i of lista) {
        const sub = i.subpasta ? ` › ${i.subpasta}` : '';
        msg += `• ${i.pasta}${sub} — ${i.documento}${i.vence ? ` (vence ${i.vence})` : ''}\n`;
      }
    }
    msg += `\n📄 Detalhes no PDF anexo. Providencie a renovação.`;
    return msg;
  }

  static buildMsgObrigatorios(itens: ItemObrig[]): string {
    let msg = `📋 *DOCUMENTOS — DEPARTAMENTO PESSOAL*\n\n`;
    msg += `📌 *OBRIGATÓRIOS SEM DOCUMENTO: ${itens.length}*\n`;
    if (itens.length === 0) return msg + `\n✅ _Todos os documentos obrigatórios estão em dia._`;
    for (const [loja, lista] of this.agrupar(itens)) {
      msg += `\n🏪 *${loja}*\n`;
      for (const i of lista) msg += `• ${i.pasta} › ${i.subpasta}\n`;
    }
    msg += `\n📄 Detalhes no PDF anexo. Faça o upload pra regularizar.`;
    return msg;
  }

  // PDF retrato, seções por loja.
  private static buildPdf(titulo: string, cor: string, grupos: Map<string, string[]>, total: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const left = 40;
      const right = doc.page.width - 40;

      doc.save();
      doc.roundedRect(left, 36, 150, 40, 8).fill('#6B21A8');
      doc.fillColor('#FFD60A').font('Helvetica-Bold').fontSize(20).text('Kontrata.ai', left, 47, { width: 150, align: 'center' });
      doc.restore();
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(15).text('DOCUMENTOS — DEPARTAMENTO PESSOAL', left + 170, 44, { width: right - (left + 170), align: 'center' });
      doc.fillColor(cor).font('Helvetica-Bold').fontSize(11).text(`${titulo} (${total})`, left + 170, 66, { width: right - (left + 170), align: 'center' });

      let y = 110;
      const ensure = (h: number) => { if (y + h > doc.page.height - 40) { doc.addPage(); y = 40; } };
      for (const [loja, linhas] of grupos) {
        ensure(30);
        doc.save().rect(left, y, right - left, 18).fill('#f3e8ff').restore();
        doc.fillColor('#6B21A8').font('Helvetica-Bold').fontSize(10).text(`${loja}  (${linhas.length})`, left + 6, y + 5);
        y += 24;
        for (const linha of linhas) {
          ensure(16);
          doc.fillColor('#111').font('Helvetica').fontSize(10).text(`•  ${linha}`, left + 8, y, { width: right - left - 16 });
          y = doc.y + 4;
        }
        y += 8;
      }
      doc.end();
    });
  }

  private static async disparar(groupId: string, texto: string, pdf: Buffer | null, fileName: string): Promise<void> {
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API não configurada (URL, Token e Instância).');
    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    await axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`, { number: groupId, text: texto }, { headers, timeout: 20000 });
    if (pdf) {
      await axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
        { number: groupId, mediatype: 'document', mimetype: 'application/pdf', media: pdf.toString('base64'), fileName, caption: '' },
        { headers, timeout: 60000 });
    }
  }

  // force=true (botao Testar): envia mesmo se vazio. force=false (cron): pula se vazio.
  static async enviarVencimentos(force = false): Promise<{ enviado: boolean; total: number }> {
    const groupId = await ConfigurationService.get('whatsapp_group_dp_docs', '');
    if (!groupId) { if (force) throw new Error('Grupo de "Departamento Pessoal" não configurado.'); return { enviado: false, total: 0 }; }
    const itens = await this.getVencimentosHoje();
    if (itens.length === 0 && !force) return { enviado: false, total: 0 };
    const grupos = new Map<string, string[]>();
    for (const [loja, lista] of this.agrupar(itens)) {
      grupos.set(loja, lista.map(i => `${i.pasta}${i.subpasta ? ' › ' + i.subpasta : ''} — ${i.documento}${i.vence ? ' (vence ' + i.vence + ')' : ''}`));
    }
    const pdf = itens.length ? await this.buildPdf('ALERTA DE VENCIMENTO', '#e11d48', grupos, itens.length) : null;
    await this.disparar(groupId, this.buildMsgVencimento(itens), pdf, 'dp-vencimentos.pdf');
    return { enviado: true, total: itens.length };
  }

  static async enviarObrigatorios(force = false): Promise<{ enviado: boolean; total: number }> {
    const groupId = await ConfigurationService.get('whatsapp_group_dp_docs', '');
    if (!groupId) { if (force) throw new Error('Grupo de "Departamento Pessoal" não configurado.'); return { enviado: false, total: 0 }; }
    const itens = await this.getObrigatoriosFaltando();
    if (itens.length === 0 && !force) return { enviado: false, total: 0 };
    const grupos = new Map<string, string[]>();
    for (const [loja, lista] of this.agrupar(itens)) {
      grupos.set(loja, lista.map(i => `${i.pasta} › ${i.subpasta}`));
    }
    const pdf = itens.length ? await this.buildPdf('OBRIGATÓRIOS SEM DOCUMENTO', '#d97706', grupos, itens.length) : null;
    await this.disparar(groupId, this.buildMsgObrigatorios(itens), pdf, 'dp-obrigatorios-faltando.pdf');
    return { enviado: true, total: itens.length };
  }
}
