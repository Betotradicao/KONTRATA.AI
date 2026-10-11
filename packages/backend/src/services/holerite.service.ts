import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/database';

/**
 * Gerador do holerite (recibo de pagamento) — extraído de RhFolhaController.holerite
 * pra devolver um Buffer: o mesmo PDF serve pro download na tela e pra publicação
 * no Portal do Colaborador (hash + MinIO + WhatsApp).
 *
 * Folha = salário base (rh_colaboradores.salario) + proventos − descontos vindos de
 * rh_apontamentos (qtd nas colunas, R$ em campos_extras->>'<key>_valor').
 * INSS/IRRF NÃO são calculados — só as bases. A4 retrato, 2 vias idênticas.
 */

export class HoleriteNotFound extends Error {}

export interface HoleriteGerado {
  buffer: Buffer;
  fileName: string;
  colaborador: { id: number; nome: string; matricula: string | null; cpf: string | null; celular: string | null };
  totais: { proventos: number; descontos: number; liquido: number };
}

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

export async function gerarHoleritePdf(colaboradorId: number, competencia: string): Promise<HoleriteGerado> {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error('competencia deve ser YYYY-MM');

  // Dados do colaborador
  const colabRows = await AppDataSource.query(
    `SELECT c.id, c.nome, c.matricula, c.cpf, c.celular, c.salario, c.data_admissao,
            ca.nome AS cargo_nome,
            e.nome_fantasia AS empresa_nome, e.razao_social AS empresa_razao,
            e.cnpj AS empresa_cnpj, e.cep AS empresa_cep, e.rua AS empresa_rua,
            e.numero AS empresa_numero, e.bairro AS empresa_bairro,
            e.cidade AS empresa_cidade, e.estado AS empresa_estado
     FROM rh_colaboradores c
     LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
     LEFT JOIN rh_empresas e ON e.id = c.company_id
     WHERE c.id = $1`,
    [colaboradorId]
  );
  if (!colabRows.length) throw new HoleriteNotFound('Colaborador nao encontrado');
  const colab = colabRows[0];

  // Apontamentos do mes (todos os periodos com mes_referencia daquele YYYY-MM)
  const aps = await AppDataSource.query(
    `SELECT a.* FROM rh_apontamentos a
     WHERE a.colaborador_id = $1
       AND to_char(a.mes_referencia, 'YYYY-MM') = $2`,
    [colaboradorId, competencia]
  );

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

  const fileName = `holerite_${colab.matricula || colab.id}_${competencia}.pdf`;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    // PDF A4 portrait, 2 vias
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 25 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

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
  });

  return {
    buffer,
    fileName,
    colaborador: { id: colab.id, nome: colab.nome, matricula: colab.matricula, cpf: colab.cpf, celular: colab.celular },
    totais: { proventos: totalProventos, descontos: totalDescontos, liquido },
  };
}
