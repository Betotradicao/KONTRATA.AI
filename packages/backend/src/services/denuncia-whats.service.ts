import PDFDocument from 'pdfkit';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';

// Notificacao de NOVA denuncia (Canal de Denuncia / NR-1) num grupo de WhatsApp.
// Disparado automaticamente quando uma denuncia publica e registrada, e tambem
// pelo botao "Testar Envio" na aba Configuracoes > Grupos WhatsApp > Denuncia NR1.

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

const TIPO_LABELS: Record<string, string> = {
  assedio_moral: 'Assédio moral',
  assedio_sexual: 'Assédio sexual',
  discriminacao: 'Discriminação',
  violencia: 'Violência',
  irregularidade: 'Irregularidade',
  corrupcao: 'Corrupção / Fraude',
  seguranca: 'Segurança do trabalho',
  outro: 'Outro',
  outros: 'Outros',
};

export interface DenunciaInfo {
  protocolo: string;
  tipo: string;
  categoria?: string | null;
  descricao?: string | null;
  local?: string | null;
  data_ocorrido?: Date | string | null;
  anonima?: boolean;
  autor_nome?: string | null;
  autor_contato?: string | null;
  prioridade?: string | null;
  empresa_nome?: string | null;
  criada_em?: Date | string | null;
}

export class DenunciaWhatsService {
  static labelTipo(tipo?: string | null): string {
    if (!tipo) return 'Não informado';
    return TIPO_LABELS[tipo] || tipo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  static async carregar(denunciaId: number): Promise<DenunciaInfo | null> {
    const rows: any[] = await AppDataSource.query(
      `SELECT d.protocolo, d.tipo, d.categoria, d.descricao, d.local, d.data_ocorrido,
              d.anonima, d.autor_nome, d.autor_contato, d.prioridade, d.criada_em,
              COALESCE(e.apelido, e.nome_fantasia, e.razao_social) AS empresa_nome
       FROM denuncias d
       LEFT JOIN rh_empresas e ON e.id = d.empresa_id
       WHERE d.id = $1 LIMIT 1`,
      [denunciaId]
    );
    return rows[0] || null;
  }

  // Mensagem curta pro grupo (o detalhe vai no PDF). Confidencial.
  static buildMensagem(d: DenunciaInfo): string {
    let msg = `🚨 *ATENÇÃO RH*\n\n`;
    msg += `Você recebeu uma denúncia referente à *NR-1*.\n\n`;
    msg += `*Nº ${d.protocolo}*\n`;
    msg += `Tipo: ${this.labelTipo(d.tipo)}\n`;
    if (d.empresa_nome) msg += `Loja: ${d.empresa_nome}\n`;
    msg += `\nVeja no PDF abaixo e, para um melhor desempenho da empresa, faça a apuração e tome as devidas providências.\n`;
    msg += `\n_🔒 Conteúdo confidencial — trate com sigilo._`;
    return msg;
  }

  // PDF em retrato com os detalhes da denuncia.
  static buildPdf(d: DenunciaInfo): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 40;
      const right = doc.page.width - 40;
      const fmtData = (v: any) => {
        if (!v) return '—';
        const dt = new Date(v);
        if (isNaN(dt.getTime())) return String(v);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      };

      // Logo Kontrata.ai
      doc.save();
      doc.roundedRect(left, 36, 150, 40, 8).fill('#6B21A8');
      doc.fillColor('#FFD60A').font('Helvetica-Bold').fontSize(20).text('Kontrata.ai', left, 47, { width: 150, align: 'center' });
      doc.restore();

      // Titulo/subtitulo à DIREITA do logo (centralizados no espaço restante) pra nao encavalar.
      const tituloX = left + 170;
      const tituloW = right - tituloX;
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(16).text('CANAL DE DENÚNCIA — NR-1', tituloX, 46, { width: tituloW, align: 'center' });
      doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(9).text('CONFIDENCIAL — USO RESTRITO DO RH', tituloX, 68, { width: tituloW, align: 'center' });
      doc.moveDown(2);

      // Caixa de protocolo destacada
      let y = 100;
      doc.roundedRect(left, y, right - left, 38, 6).fillAndStroke('#f5f3ff', '#ddd6fe');
      doc.fillColor('#6B21A8').font('Helvetica-Bold').fontSize(13).text(`Protocolo: ${d.protocolo}`, left + 12, y + 7);
      doc.fillColor('#555').font('Helvetica').fontSize(9)
        .text(`Recebida em ${fmtData(d.criada_em)}${d.prioridade ? `   •   Prioridade: ${d.prioridade}` : ''}`, left + 12, y + 23);
      y += 56;

      const linha = (rotulo: string, valor: string) => {
        doc.fillColor('#888').font('Helvetica-Bold').fontSize(9).text(rotulo.toUpperCase(), left, y);
        doc.fillColor('#111').font('Helvetica').fontSize(11).text(valor || '—', left, y + 12, { width: right - left });
        y = doc.y + 10;
      };

      linha('Tipo', this.labelTipo(d.tipo));
      if (d.categoria) linha('Categoria', String(d.categoria));
      linha('Loja / Empresa', d.empresa_nome || '—');
      linha('Local do ocorrido', d.local || '—');
      linha('Data do ocorrido', fmtData(d.data_ocorrido));
      linha('Autoria', d.anonima ? 'Anônima' : `Identificada — ${d.autor_nome || '—'}${d.autor_contato ? ' (' + d.autor_contato + ')' : ''}`);

      // Descricao
      doc.fillColor('#888').font('Helvetica-Bold').fontSize(9).text('DESCRIÇÃO DO OCORRIDO', left, y);
      y += 14;
      doc.roundedRect(left, y, right - left, 0.1, 4); // no-op pra manter consistencia
      doc.fillColor('#111').font('Helvetica').fontSize(11).text(d.descricao || '—', left, y, { width: right - left, align: 'justify' });

      doc.end();
    });
  }

  // Envia a notificacao de uma denuncia ja existente (por id).
  static async notificar(denunciaId: number): Promise<{ enviado: boolean; motivo?: string }> {
    const groupId = await ConfigurationService.get('whatsapp_group_denuncia_nr1', '');
    if (!groupId) return { enviado: false, motivo: 'grupo de Denúncia NR1 não configurado' };
    const d = await this.carregar(denunciaId);
    if (!d) return { enviado: false, motivo: 'denúncia não encontrada' };
    await this.disparar(d, groupId);
    return { enviado: true };
  }

  // Disparo de teste (denuncia ficticia) pro botao "Testar Envio".
  static async enviarTeste(): Promise<{ enviado: boolean }> {
    const groupId = await ConfigurationService.get('whatsapp_group_denuncia_nr1', '');
    if (!groupId) throw new Error('Grupo de "Denúncia NR1" não configurado. Configure e salve antes.');
    const empresa_nome = await ConfigurationService.get('client_brand_name', '');
    const exemplo: DenunciaInfo = {
      protocolo: 'DEN-TESTE-0001',
      tipo: 'assedio_moral',
      categoria: 'assedio',
      descricao: 'Esta é uma denúncia de TESTE enviada pelo botão "Testar Envio". Serve apenas para você conferir como a notificação e o PDF chegam no grupo. Nenhum registro real foi criado.',
      local: 'Setor de exemplo',
      data_ocorrido: new Date(),
      anonima: true,
      prioridade: 'normal',
      empresa_nome: empresa_nome || null,
      criada_em: new Date(),
    };
    await this.disparar(exemplo, groupId);
    return { enviado: true };
  }

  private static async disparar(d: DenunciaInfo, groupId: string): Promise<void> {
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API não configurada (URL, Token e Instância).');
    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };

    const msg = this.buildMensagem(d);
    const pdf = await this.buildPdf(d);

    await axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`,
      { number: groupId, text: msg }, { headers, timeout: 20000 });

    await axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
      { number: groupId, mediatype: 'document', mimetype: 'application/pdf',
        media: pdf.toString('base64'), fileName: `denuncia-${d.protocolo}.pdf`, caption: '' },
      { headers, timeout: 60000 });
  }
}
