import axios from 'axios';
import PDFDocument from 'pdfkit';
import { ConfigurationService } from './configuration.service';
import { SaldoBancoService, LinhaSaldo } from './saldo-banco.service';

/**
 * DISPARO DO BANCO DE HORAS PRO WHATSAPP
 * --------------------------------------
 * Gera UM PDF POR LOJA (colaboradores agrupados por setor, com subtotal de cada
 * setor e total da loja) e manda pros grupos configurados em
 * Configuracoes de Rede -> Grupos WhatsApp -> Banco de Horas.
 *
 * ⚠️ O PDF e gerado com pdfkit NO SERVIDOR, e nao com jsPDF no navegador como na
 * tela: o disparo e agendado (cron) e roda sem ninguem com o sistema aberto.
 * Os numeros vem do MESMO SaldoBancoService que alimenta a tela, entao o PDF
 * agendado e a tela nunca divergem.
 *
 * Config PROPRIA (`whatsapp_banco_horas_*`), separada do Disparo de Vagas: sao
 * publicos diferentes (gerente/RH x candidato) e grupos diferentes.
 */

const VERDE = '#059669';
const VERMELHO = '#dc2626';
const ROXO = '#7c3aed';
const CINZA = '#9ca3af';

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

export type GrupoWhats = { id: string; nome?: string };

export class BancoHorasWhatsService {
  static async getConfig() {
    const [rawGrupos, rawIntervalo, mensagem, modo, horario, diaSemana, diaMes] = await Promise.all([
      ConfigurationService.get('whatsapp_banco_horas_grupos', '[]'),
      ConfigurationService.get('whatsapp_banco_horas_intervalo', '5'),
      ConfigurationService.get('whatsapp_banco_horas_mensagem', ''),
      ConfigurationService.get('whatsapp_banco_horas_modo', ''),
      ConfigurationService.get('whatsapp_banco_horas_horario', ''),
      ConfigurationService.get('whatsapp_banco_horas_dia_semana', ''),
      ConfigurationService.get('whatsapp_banco_horas_dia_mes', ''),
    ]);

    let grupos: GrupoWhats[] = [];
    try {
      const p = JSON.parse(rawGrupos || '[]');
      if (Array.isArray(p)) grupos = p.filter((g) => g && g.id);
    } catch { grupos = []; }

    const intervalo = Math.max(1, parseInt(String(rawIntervalo || '5'), 10) || 5);
    return {
      grupos, intervalo,
      mensagem: String(mensagem || '').trim(),
      modo: String(modo || '').trim(),
      horario: String(horario || '').trim(),
      diaSemana: String(diaSemana || '').trim(),
      diaMes: String(diaMes || '').trim(),
    };
  }

  /** Texto que vai antes dos PDFs. Placeholder {data} vira a data de hoje. */
  static buildTexto(mensagem: string) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const base = mensagem || '🏦 *SALDO DE BANCO DE HORAS*\n\nSegue o relatório por loja, atualizado em {data}.';
    return base.replace(/\{data\}/g, hoje);
  }

  /** Monta o PDF de UMA loja. Resolve com o Buffer pronto. */
  static gerarPdfLoja(bloco: {
    loja: string;
    setores: { setor: string; itens: LinhaSaldo[]; positivo_min: number; negativo_min: number }[];
    positivo_min: number;
    negativo_min: number;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const L = doc.page.margins.left;
      const R = doc.page.width - doc.page.margins.right;
      // Colunas: nome (resto) | positivo | negativo
      const W_NEG = 75, W_POS = 75;
      const X_POS = R - W_NEG - W_POS;
      const X_NEG = R - W_NEG;

      doc.font('Helvetica-Bold').fontSize(15).fillColor('#111')
        .text('SALDO DE BANCO DE HORAS', L, doc.y);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(ROXO).text(bloco.loja);
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
        .text(`Fonte: RHiD (apuração oficial)  -  Gerado em ${new Date().toLocaleString('pt-BR')}`);
      doc.moveDown(0.8);

      const linhaSetor = (titulo: string) => {
        if (doc.y > doc.page.height - 110) doc.addPage();
        doc.moveDown(0.4);
        const y = doc.y;
        doc.rect(L, y - 2, R - L, 16).fill(ROXO);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff').text(titulo, L + 5, y + 2, { width: R - L - 10 });
        doc.fillColor('#111');
        doc.y = y + 18;
        // cabecalho das colunas
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#6b7280');
        const yh = doc.y;
        doc.text('COLABORADOR', L + 5, yh);
        doc.text('POSITIVO', X_POS, yh, { width: W_POS, align: 'right' });
        doc.text('NEGATIVO', X_NEG, yh, { width: W_NEG, align: 'right' });
        doc.y = yh + 11;
        doc.fillColor('#111');
      };

      for (const s of bloco.setores) {
        linhaSetor(s.setor);

        for (const it of s.itens) {
          if (doc.y > doc.page.height - 70) { doc.addPage(); linhaSetor(`${s.setor} (cont.)`); }
          const y = doc.y;
          doc.font('Helvetica').fontSize(8.5).fillColor('#111')
            .text(it.nome + (it.matricula ? ` (${it.matricula})` : ''), L + 5, y, { width: X_POS - L - 10, ellipsis: true });

          const pos = SaldoBancoService.fmt(it.positivo_min);
          const neg = SaldoBancoService.fmt(it.negativo_min);
          doc.font('Helvetica-Bold').fontSize(8.5);
          doc.fillColor(pos ? VERDE : CINZA).text(pos || '-', X_POS, y, { width: W_POS, align: 'right' });
          doc.fillColor(neg ? VERMELHO : CINZA).text(neg || '-', X_NEG, y, { width: W_NEG, align: 'right' });
          doc.fillColor('#111');
          doc.y = y + 12;
        }

        // Subtotal do setor
        const ys = doc.y + 1;
        doc.moveTo(L, ys).lineTo(R, ys).lineWidth(0.5).strokeColor('#d1d5db').stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151')
          .text(`Subtotal ${s.setor} (${s.itens.length})`, L + 5, ys + 3, { width: X_POS - L - 10 });
        doc.fillColor(VERDE).text(SaldoBancoService.fmt(s.positivo_min) || '0h00', X_POS, ys + 3, { width: W_POS, align: 'right' });
        doc.fillColor(VERMELHO).text(SaldoBancoService.fmt(s.negativo_min) || '0h00', X_NEG, ys + 3, { width: W_NEG, align: 'right' });
        doc.fillColor('#111');
        doc.y = ys + 16;
      }

      // Total da loja
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.moveDown(0.5);
      const yt = doc.y;
      doc.rect(L, yt - 2, R - L, 18).fill('#f3f4f6');
      const totalPessoas = bloco.setores.reduce((s, x) => s + x.itens.length, 0);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111')
        .text(`TOTAL DA LOJA (${totalPessoas} colaboradores)`, L + 5, yt + 3, { width: X_POS - L - 10 });
      doc.fillColor(VERDE).text(SaldoBancoService.fmt(bloco.positivo_min) || '0h00', X_POS, yt + 3, { width: W_POS, align: 'right' });
      doc.fillColor(VERMELHO).text(SaldoBancoService.fmt(bloco.negativo_min) || '0h00', X_NEG, yt + 3, { width: W_NEG, align: 'right' });
      doc.y = yt + 22;

      const liquido = bloco.positivo_min + bloco.negativo_min;
      doc.font('Helvetica-Bold').fontSize(9)
        .fillColor(liquido < 0 ? VERMELHO : VERDE)
        .text(`Saldo líquido da loja: ${SaldoBancoService.fmt(liquido) || '0h00'}`, L, doc.y + 4);

      doc.end();
    });
  }

  /** Gera os PDFs (1 por loja). Devolve nome + base64 pra mandar na Evolution. */
  static async gerarPdfs() {
    const dados = await SaldoBancoService.calcular({});
    const blocos = SaldoBancoService.agruparPorLojaESetor(dados.linhas);

    const arquivos: { nome: string; base64: string; loja: string }[] = [];
    for (const b of blocos) {
      const buf = await this.gerarPdfLoja(b);
      const slug = b.loja.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'LOJA';
      arquivos.push({
        loja: b.loja,
        nome: `saldo-banco-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`,
        base64: buf.toString('base64'),
      });
    }
    return { arquivos, dados, blocos };
  }

  /**
   * Dispara pros grupos. teste=true manda so pro 1o grupo.
   * O texto vai numa mensagem, e cada PDF como DOCUMENTO logo depois.
   */
  static async enviar(teste = false) {
    const { grupos, intervalo, mensagem } = await this.getConfig();
    if (!grupos.length) {
      throw new Error('Nenhum grupo configurado. Vá em Configurações de Rede → Grupos WhatsApp → Banco de Horas.');
    }

    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) {
      throw new Error('Evolution API não configurada (URL, Token e Instância).');
    }

    const { arquivos } = await this.gerarPdfs();
    if (!arquivos.length) throw new Error('Nenhuma loja com colaborador ativo pra gerar o relatório.');

    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    const texto = this.buildTexto(mensagem);
    const alvos = teste ? grupos.slice(0, 1) : grupos;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const sendText = (num: string) => axios.post(
      `${base}/message/sendText/${encodeURIComponent(instance)}`,
      { number: num, text: texto }, { headers, timeout: 20000 });

    const sendDoc = (num: string, a: { nome: string; base64: string; loja: string }) => axios.post(
      `${base}/message/sendMedia/${encodeURIComponent(instance)}`,
      { number: num, mediatype: 'document', mimetype: 'application/pdf',
        media: a.base64, fileName: a.nome, caption: '' },
      { headers, timeout: 120000 });

    let enviados = 0;
    const falhas: string[] = [];

    for (let i = 0; i < alvos.length; i++) {
      const g = alvos[i];
      try {
        await sendText(g.id);
        for (let k = 0; k < arquivos.length; k++) {
          await sendDoc(g.id, arquivos[k]);
          // respiro curto entre os PDFs do MESMO grupo
          if (k < arquivos.length - 1) await sleep(1500);
        }
        enviados++;
      } catch (e: any) {
        const motivo = e.response?.data?.message || e.message;
        console.error(`[banco-horas-whats] falha no grupo ${g.id}:`, motivo);
        falhas.push(`${g.nome || g.id}: ${motivo}`);
      }
      // intervalo anti-ban entre um grupo e outro (nao espera depois do ultimo)
      if (i < alvos.length - 1) await sleep(intervalo * 1000);
    }

    return { enviados, total: alvos.length, pdfs: arquivos.length, lojas: arquivos.map(a => a.loja), falhas };
  }
}
