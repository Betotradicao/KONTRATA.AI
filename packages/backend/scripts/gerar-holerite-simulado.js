/**
 * Gera um holerite SIMULADO no layout da contabilidade ("Demonstrativo de Pagamento
 * de Salário", 2 vias) pra testar o Portal do Colaborador sem expor holerite real.
 * Valores copiados de uma página do PDF de 09/2026 da Tradição; nome/CPF do teste.
 * Uso: node scripts/gerar-holerite-simulado.js <saida.pdf>
 */
const fs = require('fs');
const PDFDocument = require('pdfkit');

const out = process.argv[2] || 'holerite-simulado.pdf';
const d = {
  empresa: 'TRADICAO COMERCIAL LTDA', endereco: 'R JOSE DE PAULA FERREIRA, 172', cnpj: '45424842000109',
  periodo: '09/2026', nro: '999', nome: 'ROBERTO BASTOS RUIVO', admissao: '01/10/2026', cbo: '0141415',
  cpf: '39026607830', funcao: 'GERENTE',
  linhas: [
    ['1', 'Salario Base', '30', 2101.34, 0],
    ['59', 'Vale Transporte Pago em Dinheiro', '', 327.60, 0],
    ['971', 'Premio', '', 212.00, 0],
    ['23', 'Adiantamento Mensal de Salário', '', 0, 841.00],
    ['56', 'Vale Transporte', '6', 0, 126.08],
    ['301', 'INSS', '7,84', 0, 164.80],
  ],
  salarioBase: 2101.34, salContrInss: 2101.34, baseFgts: 2101.34, fgts: 168.11, baseIrrf: 1494.14,
};
const venc = d.linhas.reduce((s, l) => s + l[3], 0);
const desc = d.linhas.reduce((s, l) => s + l[4], 0);
const fmt = (n) => n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

const doc = new PDFDocument({ size: 'A4', margin: 20 });
const chunks = [];
doc.on('data', (c) => chunks.push(c));
doc.on('end', () => {
  fs.writeFileSync(out, Buffer.concat(chunks));
  console.log('ok', out, 'venc', venc.toFixed(2), 'desc', desc.toFixed(2), 'liq', (venc - desc).toFixed(2));
});
const W = doc.page.width - 40;

function via(y0) {
  const x = 20;
  doc.lineWidth(0.6).rect(x, y0, W, 380).stroke();
  doc.font('Helvetica-Bold').fontSize(11).text('Demonstrativo de Pagamento de Salário', x + 8, y0 + 8);
  doc.font('Helvetica-Bold').fontSize(9).text(d.empresa, x + 8, y0 + 24);
  doc.font('Helvetica').fontSize(8).text(d.endereco, x + 8, y0 + 36).text(`CNPJ : ${d.cnpj}`, x + 8, y0 + 47);
  doc.font('Helvetica-Bold').fontSize(9).text(`Periodo : ${d.periodo}`, x + W - 140, y0 + 24, { width: 130, align: 'right' });
  let y = y0 + 62;
  doc.rect(x, y, W, 26).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor('#444')
    .text('Nro', x + 6, y + 3).text('Nome', x + 40, y + 3).text('Admissão', x + 290, y + 3).text('CBO', x + 350, y + 3).text('CPF', x + 400, y + 3).text('Função', x + 470, y + 3);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
    .text(d.nro, x + 6, y + 13).text(d.nome, x + 40, y + 13).text(d.admissao, x + 290, y + 13).text(d.cbo, x + 350, y + 13).text(d.cpf, x + 400, y + 13).text(d.funcao, x + 470, y + 13);
  y += 26;
  const cols = [x, x + 45, x + 300, x + 380, x + 465];
  doc.rect(x, y, W, 14).fillAndStroke('#E5E7EB', '#000');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5)
    .text('Cod', cols[0] + 4, y + 4).text('Descrição', cols[1] + 4, y + 4).text('Referência', cols[2] + 4, y + 4)
    .text('Vencimentos', cols[3] + 4, y + 4, { width: 80, align: 'right' }).text('Descontos', cols[4] + 4, y + 4, { width: 80, align: 'right' });
  y += 14;
  doc.font('Helvetica').fontSize(8);
  for (const l of d.linhas) {
    doc.text(l[0], cols[0] + 4, y + 3).text(l[1], cols[1] + 4, y + 3).text(l[2], cols[2] + 4, y + 3)
      .text(fmt(l[3]), cols[3] + 4, y + 3, { width: 80, align: 'right' }).text(fmt(l[4]), cols[4] + 4, y + 3, { width: 80, align: 'right' });
    y += 13;
  }
  y = y0 + 270;
  doc.rect(x, y, W * 0.55, 40).stroke().rect(x + W * 0.55, y, W * 0.45, 40).stroke();
  doc.fontSize(6.5).fillColor('#444').text('Total Vencimentos', x + W * 0.55 + 6, y + 4).text('Total Descontos', x + W * 0.78, y + 4);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
    .text(fmt(venc), x + W * 0.55 + 6, y + 14).text(fmt(desc), x + W * 0.78, y + 14);
  doc.fontSize(7).text('Valor Líquido', x + W * 0.55 + 6, y + 28).fontSize(10).text(fmt(venc - desc), x + W * 0.78, y + 26);
  doc.font('Helvetica').fontSize(6.5).text('DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO', x + 6, y + 6, { width: W * 0.53 })
    .text('Data : ____/____/____     Assinatura : _______________________________', x + 6, y + 24);
  y += 40;
  doc.rect(x, y, W, 22).stroke();
  const bases = [['Salário Base', d.salarioBase], ['Sal. Contr. INSS', d.salContrInss], ['Base Calc. FGTS', d.baseFgts], ['Valor do FGTS', d.fgts], ['Base IRRF', d.baseIrrf]];
  bases.forEach((b, i) => {
    doc.fontSize(6).fillColor('#555').font('Helvetica').text(b[0], x + 6 + i * (W / 5), y + 3);
    doc.fontSize(8).fillColor('#000').font('Helvetica-Bold').text(fmt(b[1]), x + 6 + i * (W / 5), y + 11);
  });
  doc.font('Helvetica').fontSize(7).fillColor('#B91C1C').text('*** HOLERITE SIMULADO PARA TESTE DO PORTAL — SEM VALOR ***', x, y0 + 360, { width: W, align: 'center' });
  doc.fillColor('#000');
}
via(20);
doc.dash(3, { space: 3 }).moveTo(20, 410).lineTo(20 + W, 410).stroke().undash();
via(420);
doc.end();
