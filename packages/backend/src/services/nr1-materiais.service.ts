/**
 * Gera PDFs de conscientizacao customizados com o nome da empresa do cliente.
 *
 * Decisao de design: SEM emojis Unicode (pdfkit/Helvetica nao renderiza
 * emojis complexos — vira lixo tipo "Ø=Ý˜"). Em vez de emoji, usamos:
 *   - Letras/numeros grandes em circulos coloridos
 *   - Simbolos basicos seguros: ✓ ✕ → •
 *   - Formas geometricas e cores oficiais de cada campanha
 *
 * Tipos:
 *   - 4 cartazes NR-1: canal-denuncia, saude-mental, a-quem-recorrer, direitos-nr1
 *   - 12 campanhas anuais: janeiro-branco ... dezembro-vermelho
 */
import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/database';

type TipoNr1 = 'canal-denuncia' | 'saude-mental' | 'a-quem-recorrer' | 'direitos-nr1';
type TipoCampanha =
  | 'janeiro-branco' | 'fevereiro-roxo' | 'marco-lilas' | 'abril-azul'
  | 'maio-amarelo'   | 'junho-vermelho' | 'julho-amarelo' | 'agosto-dourado'
  | 'setembro-amarelo' | 'outubro-rosa' | 'novembro-azul' | 'dezembro-vermelho';
type Tipo = TipoNr1 | TipoCampanha;

async function getEmpresaNome(): Promise<string> {
  try {
    const rows = await AppDataSource.query(
      `SELECT COALESCE(nome_fantasia, razao_social) AS nome FROM companies WHERE active = true ORDER BY id LIMIT 1`
    );
    if (rows[0]?.nome) return String(rows[0].nome).trim();
  } catch { /* ignore */ }
  return 'Sua Empresa';
}

async function getCanalDenunciaConfig(): Promise<string> {
  try {
    const [r] = await AppDataSource.query(
      `SELECT value FROM configurations WHERE key = 'canal_denuncia_contato' LIMIT 1`
    );
    if (r?.value) return String(r.value).trim();
  } catch { /* ignore */ }
  return 'denuncia@suaempresa.com.br';
}

export async function gerarMaterialPdf(tipo: Tipo): Promise<Buffer> {
  const empresa = await getEmpresaNome();
  const canalDenuncia = await getCanalDenunciaConfig();

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Material - ${tipo}`, Author: empresa } });
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  switch (tipo) {
    case 'canal-denuncia':  cartazCanalDenuncia(doc, empresa, canalDenuncia); break;
    case 'saude-mental':    cartazSaudeMental(doc, empresa); break;
    case 'a-quem-recorrer': folderAQuemRecorrer(doc, empresa, canalDenuncia); break;
    case 'direitos-nr1':    posterDireitos(doc, empresa, canalDenuncia); break;
    default:                cartazCampanha(doc, empresa, tipo as TipoCampanha); break;
  }

  doc.end();
  return done;
}

// =============================================================
// Helpers de layout
// =============================================================
const W = 595.28;
const H = 841.89;
const M = 40;

function rect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill: string, stroke?: string, strokeWidth = 1) {
  doc.save();
  if (stroke) doc.lineWidth(strokeWidth).rect(x, y, w, h).fillAndStroke(fill, stroke);
  else doc.rect(x, y, w, h).fill(fill);
  doc.restore();
}

function circulo(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, fill: string) {
  doc.save();
  doc.circle(cx, cy, r).fill(fill);
  doc.restore();
}

// =============================================================
// 1. Cartaz "Canal de Denuncia"
// =============================================================
function cartazCanalDenuncia(doc: PDFKit.PDFDocument, empresa: string, canal: string) {
  // Header preto + faixa vermelha
  rect(doc, 0, 0, W, 160, '#111827');
  rect(doc, 0, 160, W, 8, '#DC2626');

  doc.font('Helvetica-Bold').fontSize(46).fillColor('#FFFFFF').text('ASSÉDIO ZERO', 0, 45, { width: W, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica').fontSize(13).fillColor('#FCA5A5').text('TOLERÂNCIA ZERO A QUALQUER FORMA DE VIOLÊNCIA NO TRABALHO', 0, 110, { width: W, align: 'center', characterSpacing: 1 });

  // Empresa
  rect(doc, M, 195, W - 2*M, 40, '#FFFFFF', '#DC2626', 2);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(empresa.toUpperCase(), M, 207, { width: W - 2*M, align: 'center', characterSpacing: 1 });

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827').text('NÃO TOLERAMOS:', M, 260, { width: W - 2*M, align: 'center' });

  // 4 tipos de assédio em caixas
  const tipos = [
    { letra: 'A', titulo: 'ASSÉDIO MORAL',    desc: 'Humilhações, agressões verbais, isolamento intencional' },
    { letra: 'B', titulo: 'ASSÉDIO SEXUAL',   desc: 'Comentários, insinuações ou contatos não consentidos' },
    { letra: 'C', titulo: 'DISCRIMINAÇÃO',    desc: 'Gênero, raça, idade, religião, orientação sexual' },
    { letra: 'D', titulo: 'VIOLÊNCIA FÍSICA', desc: 'Ameaças ou agressões físicas no ambiente de trabalho' },
  ];
  let y = 295;
  tipos.forEach(t => {
    rect(doc, M, y, W - 2*M, 52, '#FEF2F2', '#FECACA');
    circulo(doc, M + 30, y + 26, 18, '#DC2626');
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF').text(t.letra, M + 30 - 18, y + 17, { width: 36, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(t.titulo, M + 60, y + 12);
    doc.font('Helvetica').fontSize(10).fillColor('#4B5563').text(t.desc, M + 60, y + 30, { width: W - 2*M - 70 });
    y += 58;
  });

  // Canal de denúncia
  y += 10;
  rect(doc, M, y, W - 2*M, 130, '#111827');
  rect(doc, M, y, W - 2*M, 8, '#DC2626');
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FCA5A5').text('CANAL DE DENÚNCIA', M, y + 22, { width: W - 2*M, align: 'center', characterSpacing: 3 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF').text(canal, M, y + 48, { width: W - 2*M, align: 'center' });
  doc.font('Helvetica').fontSize(12).fillColor('#86EFAC').text('100% ANÔNIMO  ·  SIGILOSO  ·  SEM RETALIAÇÃO', M, y + 88, { width: W - 2*M, align: 'center', characterSpacing: 1 });

  // Rodapé
  doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF').text('Lei 14.457/2022  ·  Norma Regulamentadora 1 (NR-1)  ·  CLT', M, H - 65, { width: W - 2*M, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(`${empresa}  ·  CIPA`, M, H - 50, { width: W - 2*M, align: 'center' });
}

// =============================================================
// 2. Cartaz "Saúde Mental Importa"
// =============================================================
function cartazSaudeMental(doc: PDFKit.PDFDocument, empresa: string) {
  rect(doc, 0, 0, W, 160, '#7E22CE');
  rect(doc, 0, 160, W, 8, '#FBBF24');

  doc.font('Helvetica-Bold').fontSize(38).fillColor('#FFFFFF').text('SUA SAÚDE MENTAL', 0, 40, { width: W, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(38).fillColor('#FBBF24').text('IMPORTA.', 0, 85, { width: W, align: 'center', characterSpacing: 2 });

  rect(doc, M, 195, W - 2*M, 40, '#FFFFFF', '#7E22CE', 2);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#581C87').text(empresa.toUpperCase(), M, 207, { width: W - 2*M, align: 'center', characterSpacing: 1 });

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827').text('5 SINAIS DE ALERTA QUE NÃO DEVEM SER IGNORADOS', M, 260, { width: W - 2*M, align: 'center' });

  const sinais = [
    'Cansaço constante mesmo após o descanso',
    'Irritabilidade ou mudanças bruscas de humor',
    'Dificuldade pra dormir ou pesadelos frequentes',
    'Perda de motivação ou interesse pelo trabalho',
    'Dores físicas sem causa aparente',
  ];
  let y = 295;
  sinais.forEach((s, i) => {
    rect(doc, M, y, W - 2*M, 50, '#FAF5FF', '#E9D5FF');
    circulo(doc, M + 30, y + 25, 18, '#7E22CE');
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF').text(String(i + 1), M + 12, y + 16, { width: 36, align: 'center' });
    doc.font('Helvetica').fontSize(13).fillColor('#1F2937').text(s, M + 60, y + 19, { width: W - 2*M - 70 });
    y += 56;
  });

  // CVV em destaque
  y += 12;
  rect(doc, M, y, W - 2*M, 130, '#7E22CE');
  rect(doc, M, y, W - 2*M, 8, '#FBBF24');
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FBBF24').text('VOCÊ NÃO ESTÁ SOZINHO', M, y + 22, { width: W - 2*M, align: 'center', characterSpacing: 3 });
  doc.font('Helvetica').fontSize(11).fillColor('#E9D5FF').text('CVV — Centro de Valorização da Vida', M, y + 48, { width: W - 2*M, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(56).fillColor('#FFFFFF').text('188', M, y + 60, { width: W - 2*M, align: 'center' });

  doc.font('Helvetica').fontSize(9).fillColor('#9CA3AF').text('Atendimento 24h  ·  Gratuito  ·  Sigiloso  ·  cvv.org.br', M, H - 65, { width: W - 2*M, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(`${empresa}  ·  Programa de Saúde Mental  ·  NR-1`, M, H - 50, { width: W - 2*M, align: 'center' });
}

// =============================================================
// 3. Folder "A Quem Recorrer"
// =============================================================
function folderAQuemRecorrer(doc: PDFKit.PDFDocument, empresa: string, canal: string) {
  rect(doc, 0, 0, W, 140, '#0E7490');
  rect(doc, 0, 140, W, 8, '#FBBF24');

  doc.font('Helvetica-Bold').fontSize(38).fillColor('#FFFFFF').text('A QUEM RECORRER?', 0, 45, { width: W, align: 'center', characterSpacing: 1 });
  doc.font('Helvetica').fontSize(12).fillColor('#CFFAFE').text('Recorte este cartão e mantenha sempre por perto', 0, 95, { width: W, align: 'center' });

  rect(doc, M, 175, W - 2*M, 36, '#ECFEFF', '#0E7490', 2);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#155E75').text(empresa.toUpperCase(), M, 186, { width: W - 2*M, align: 'center', characterSpacing: 1 });

  const contatos = [
    { tit: 'EMERGÊNCIA — Crise emocional', val: 'CVV  188',            cor: '#DC2626' },
    { tit: 'POLÍCIA — Violência',          val: '190',                  cor: '#B91C1C' },
    { tit: 'DISQUE DIREITOS HUMANOS',      val: '100',                  cor: '#EA580C' },
    { tit: 'SUS — Saúde',                  val: '136',                  cor: '#16A34A' },
    { tit: 'CANAL DE DENÚNCIA INTERNO',    val: canal,                  cor: '#2563EB' },
    { tit: 'CIPA',                         val: 'cipa@suaempresa.com.br',cor: '#4338CA' },
    { tit: 'RH INTERNO',                   val: 'rh@suaempresa.com.br', cor: '#7E22CE' },
    { tit: 'CONVÊNIO PSICOLÓGICO',         val: 'Consulte seu plano',   cor: '#BE185D' },
  ];
  let y = 230;
  contatos.forEach(c => {
    rect(doc, M, y, W - 2*M, 42, '#FFFFFF', '#E5E7EB');
    rect(doc, M, y, 6, 42, c.cor);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#6B7280').text(c.tit, M + 16, y + 8, { characterSpacing: 0.5 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(c.cor).text(c.val, M + 16, y + 22);
    y += 46;
  });

  // Mensagem importante
  y += 12;
  rect(doc, M, y, W - 2*M, 60, '#FEF3C7', '#F59E0B', 2);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#92400E').text('IMPORTANTE', M + 16, y + 12);
  doc.font('Helvetica').fontSize(10).fillColor('#78350F')
     .text('Pedir ajuda NÃO é fraqueza — é cuidado. Todas as denúncias internas são tratadas com sigilo absoluto. Você não será retaliado por buscar apoio.',
       M + 16, y + 28, { width: W - 2*M - 30 });

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
     .text(`${empresa}  ·  NR-1  ·  Lei 14.457/2022`, M, H - 50, { width: W - 2*M, align: 'center' });
}

// =============================================================
// 4. Pôster "Seus Direitos — NR-1"
// =============================================================
function posterDireitos(doc: PDFKit.PDFDocument, empresa: string, canal: string) {
  rect(doc, 0, 0, W, 160, '#059669');
  rect(doc, 0, 160, W, 8, '#FBBF24');

  doc.font('Helvetica-Bold').fontSize(46).fillColor('#FFFFFF').text('SEUS DIREITOS', 0, 40, { width: W, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(24).fillColor('#FBBF24').text('NR-1', 0, 95, { width: W, align: 'center', characterSpacing: 4 });
  doc.font('Helvetica').fontSize(11).fillColor('#D1FAE5').text('Norma Regulamentadora 1 — Saúde e Segurança no Trabalho', 0, 130, { width: W, align: 'center' });

  rect(doc, M, 195, W - 2*M, 40, '#FFFFFF', '#059669', 2);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#065F46').text(empresa.toUpperCase(), M, 207, { width: W - 2*M, align: 'center', characterSpacing: 1 });

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827').text('A NR-1 GARANTE QUE VOCÊ TENHA:', M, 260, { width: W - 2*M, align: 'center' });

  const direitos = [
    'Ambiente livre de assédio moral, sexual e qualquer discriminação',
    'Pausas adequadas durante a jornada de trabalho',
    'Carga de trabalho compatível com sua função',
    'Comunicação clara sobre suas atribuições e responsabilidades',
    'Reconhecimento, feedback e oportunidades de desenvolvimento',
    'Apoio em momentos de dificuldade — pessoal ou profissional',
    'Canal seguro e anônimo pra reportar problemas',
  ];
  let y = 295;
  direitos.forEach(d => {
    rect(doc, M, y, W - 2*M, 38, '#F0FDF4', '#BBF7D0');
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#059669').text('✓', M + 14, y + 9);
    doc.font('Helvetica').fontSize(11).fillColor('#1F2937').text(d, M + 40, y + 13, { width: W - 2*M - 50 });
    y += 42;
  });

  y += 12;
  rect(doc, M, y, W - 2*M, 100, '#059669');
  rect(doc, M, y, W - 2*M, 8, '#FBBF24');
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FBBF24').text('DIREITO NÃO RESPEITADO? REPORTE:', M, y + 22, { width: W - 2*M, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF').text(canal, M, y + 50, { width: W - 2*M, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor('#A7F3D0').text('Multas por descumprimento: R$ 2.396 a R$ 6.708 por item (MTE)', M, y + 80, { width: W - 2*M, align: 'center' });

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
     .text(`${empresa}  ·  CIPA  ·  Portaria MTE 1.419/2024`, M, H - 50, { width: W - 2*M, align: 'center' });
}

// =============================================================
// Campanhas anuais — template parametrizado
// =============================================================

type CampanhaConfig = {
  mes: number;
  cor: string;
  corEscura: string;
  corClara: string;
  corDestaque: string;
  titulo: string;
  subtitulo: string;
  tema: string;
  slogan: string;
  // 6 destaques curtos pro layout estilo mural visual (grid 2x3)
  // Cada um eh um card colorido com TÍTULO em caixa alta + frase de apoio
  destaques: { titulo: string; frase: string }[];
  canalAjuda: { label: string; valor: string };
  fonte: string;
};

// Paleta vibrante usada nos 6 cards (rotativa) — visual estilo "mural"
const PALETA_CARDS = [
  { bg: '#DC2626', text: '#FFFFFF', subtitle: '#FECACA' }, // vermelho
  { bg: '#2563EB', text: '#FFFFFF', subtitle: '#BFDBFE' }, // azul
  { bg: '#059669', text: '#FFFFFF', subtitle: '#A7F3D0' }, // verde
  { bg: '#EAB308', text: '#111827', subtitle: '#854D0E' }, // amarelo
  { bg: '#9333EA', text: '#FFFFFF', subtitle: '#E9D5FF' }, // roxo
  { bg: '#EA580C', text: '#FFFFFF', subtitle: '#FED7AA' }, // laranja
];

const CAMPANHAS: Record<TipoCampanha, CampanhaConfig> = {
  'janeiro-branco': {
    mes: 1, cor: '#374151', corEscura: '#111827', corClara: '#F9FAFB', corDestaque: '#FBBF24',
    titulo: 'JANEIRO BRANCO', subtitulo: 'PAZ · EQUILÍBRIO · SAÚDE MENTAL',
    tema: 'Mês dedicado à saúde mental. Falar salva vidas.',
    slogan: 'Saúde mental também é saúde.',
    destaques: [
      { titulo: 'FALE SOBRE',         frase: 'Conversar reduz estigma e abre caminho pra ajuda' },
      { titulo: 'ESCUTE SEM JULGAR',  frase: 'Acolhimento sempre vem antes da correção' },
      { titulo: 'CUIDE DE VOCÊ',      frase: 'Pausa, sono, atividade física e alimentação' },
      { titulo: 'NÃO É FRAQUEZA',     frase: 'Pedir ajuda é cuidado — não é falha de caráter' },
      { titulo: 'CONECTE-SE',         frase: 'Pessoas de confiança fazem toda diferença' },
      { titulo: 'BUSQUE AJUDA',       frase: 'Profissional, gratuita pelo SUS e sigilosa' },
    ],
    canalAjuda: { label: 'CVV — Centro de Valorização da Vida', valor: '188 — 24h grátis' },
    fonte: 'Janeiro Branco · OMS · CFP',
  },
  'fevereiro-roxo': {
    mes: 2, cor: '#7E22CE', corEscura: '#581C87', corClara: '#FAF5FF', corDestaque: '#FBBF24',
    titulo: 'FEVEREIRO ROXO', subtitulo: 'ALZHEIMER · LÚPUS · FIBROMIALGIA',
    tema: 'Doenças crônicas afetam milhões. Diagnóstico precoce muda tudo.',
    slogan: 'Conhecer é o primeiro passo pra cuidar.',
    destaques: [
      { titulo: 'NÃO IGNORE',         frase: 'Esquecimentos frequentes merecem investigação' },
      { titulo: 'OBSERVE A PELE',     frase: 'Manchas em borboleta no rosto podem ser lúpus' },
      { titulo: 'DOR PERSISTE?',      frase: 'Dor por mais de 3 meses — procure reumatologista' },
      { titulo: 'HUMOR ABALADO?',     frase: 'Depressão é sintoma frequente dessas doenças' },
      { titulo: 'BUSQUE O MÉDICO',    frase: 'Quanto mais cedo o diagnóstico, melhor o controle' },
      { titulo: 'NÃO ESTÁ SOZINHO',   frase: 'Associações de pacientes oferecem apoio gratuito' },
    ],
    canalAjuda: { label: 'SUS — Disque Saúde', valor: '136' },
    fonte: 'Ministério da Saúde · SBR · ABRAz',
  },
  'marco-lilas': {
    mes: 3, cor: '#A855F7', corEscura: '#6B21A8', corClara: '#FAF5FF', corDestaque: '#FBBF24',
    titulo: 'MARÇO LILÁS', subtitulo: 'PREVENÇÃO AO CÂNCER DE COLO DO ÚTERO',
    tema: 'O 3º câncer mais comum entre mulheres — um dos mais evitáveis.',
    slogan: 'Vacine. Faça o exame. Previna-se.',
    destaques: [
      { titulo: 'VACINA HPV',         frase: 'Previne mais de 90% dos casos — gratuita no SUS' },
      { titulo: 'PAPANICOLAU',        frase: 'Anual a partir dos 25 anos — exame essencial' },
      { titulo: 'PRESERVATIVO',       frase: 'Use em todas as relações — reduz risco do HPV' },
      { titulo: 'NÃO FUME',           frase: 'O tabaco aumenta o risco de várias formas de câncer' },
      { titulo: '17 MIL POR ANO',     frase: 'Novos casos no Brasil — quase todos detectáveis cedo' },
      { titulo: 'CUIDE-SE',           frase: 'Sua saúde é prioridade — agende seu exame' },
    ],
    canalAjuda: { label: 'INCA — Instituto Nacional de Câncer', valor: 'inca.gov.br' },
    fonte: 'INCA · Ministério da Saúde · OMS',
  },
  'abril-azul': {
    mes: 4, cor: '#3B82F6', corEscura: '#1E3A8A', corClara: '#EFF6FF', corDestaque: '#FBBF24',
    titulo: 'ABRIL AZUL', subtitulo: 'CONSCIENTIZAÇÃO SOBRE O AUTISMO',
    tema: 'O TEA afeta 1 em cada 36 pessoas. Inclusão começa com informação.',
    slogan: 'Aceitar é evoluir. Incluir é transformar.',
    destaques: [
      { titulo: 'COMUNIQUE-SE',       frase: 'Fale de forma clara, direta — evite ironias' },
      { titulo: 'RESPEITE A ROTINA',  frase: 'Previsibilidade reduz ansiedade pra quem tem TEA' },
      { titulo: 'PEÇA LICENÇA',       frase: 'Hipersensibilidade ao toque é comum — sempre pergunte' },
      { titulo: 'AMBIENTE TRANQUILO', frase: 'Locais silenciosos beneficiam toda a equipe' },
      { titulo: 'COMBATA O ESTIGMA',  frase: 'Autismo não é doença — é uma forma de ser' },
      { titulo: 'TALENTO IMPORTA',    frase: 'Pessoas com TEA contribuem muito quando bem acolhidas' },
    ],
    canalAjuda: { label: 'ABRA — Assoc. Brasileira de Autismo', valor: 'autismo.org.br' },
    fonte: 'OMS · MS · Lei 12.764/2012',
  },
  'maio-amarelo': {
    mes: 5, cor: '#EAB308', corEscura: '#713F12', corClara: '#FEFCE8', corDestaque: '#DC2626',
    titulo: 'MAIO AMARELO', subtitulo: 'ATENÇÃO PELA VIDA NO TRÂNSITO',
    tema: 'Mais de 30 mil mortes por ano no trânsito brasileiro. A maioria evitável.',
    slogan: 'Atenção pela vida — comece na saída de casa.',
    destaques: [
      { titulo: 'CELULAR NUNCA',      frase: 'Não use ao volante — nem mesmo no semáforo' },
      { titulo: 'CINTO SEMPRE',       frase: 'Motorista e passageiros, banco da frente e de trás' },
      { titulo: 'CAPACETE NA MOTO',   frase: 'Salva vidas — não negocie em distâncias curtas' },
      { titulo: 'BEBEU? NÃO DIRIJA',  frase: 'Chame um motorista de aplicativo, ônibus ou táxi' },
      { titulo: 'RESPEITE LIMITES',   frase: 'Velocidade compatível com a via e o clima' },
      { titulo: 'CASA-TRABALHO',      frase: 'Acidente de trajeto é acidente de trabalho' },
    ],
    canalAjuda: { label: 'SAMU · Polícia Rodoviária', valor: '192 · 191' },
    fonte: 'Observatório Nacional de Segurança Viária',
  },
  'junho-vermelho': {
    mes: 6, cor: '#DC2626', corEscura: '#7F1D1D', corClara: '#FEF2F2', corDestaque: '#FBBF24',
    titulo: 'JUNHO VERMELHO', subtitulo: 'DOE SANGUE · SALVE VIDAS',
    tema: 'Um único doador pode salvar até 4 vidas. Só 1,6% dos brasileiros doam.',
    slogan: 'Doar sangue é gesto de amor.',
    destaques: [
      { titulo: 'ATÉ 4 VIDAS',        frase: 'Cada bolsa = plasma + plaquetas + hemácias' },
      { titulo: '16 A 69 ANOS',       frase: 'Idade mínima pra doar (acima de 50 kg)' },
      { titulo: 'É RÁPIDO',           frase: 'Cerca de 30 minutos — corpo repõe em semanas' },
      { titulo: 'COMA ANTES',         frase: 'Não doe em jejum — alimente-se normalmente' },
      { titulo: 'LEVE DOCUMENTO',     frase: 'Identidade ou outro documento oficial com foto' },
      { titulo: 'SEM TATTOO RECENTE', frase: 'Aguarde 6 a 12 meses após tatuagem ou piercing' },
    ],
    canalAjuda: { label: 'Pró-Sangue · Hemocentros', valor: 'Procure o do seu estado' },
    fonte: 'Ministério da Saúde · ANVISA',
  },
  'julho-amarelo': {
    mes: 7, cor: '#F59E0B', corEscura: '#78350F', corClara: '#FFFBEB', corDestaque: '#DC2626',
    titulo: 'JULHO AMARELO', subtitulo: 'COMBATE ÀS HEPATITES VIRAIS',
    tema: 'As hepatites virais são silenciosas — milhões têm sem saber.',
    slogan: 'Conheça. Trate. Elimine.',
    destaques: [
      { titulo: 'HEPATITE C CURA',    frase: 'Tratamento gratuito pelo SUS — não deixe pra depois' },
      { titulo: 'VACINA HEPATITE B',  frase: 'Gratuita no SUS pra todas as idades' },
      { titulo: 'TESTE RÁPIDO',       frase: 'Gratuito em UBS — resultado em 30 minutos' },
      { titulo: 'NÃO COMPARTILHE',    frase: 'Lâminas, alicates, agulhas — nunca de outra pessoa' },
      { titulo: 'SEXO PROTEGIDO',     frase: 'Preservativo previne hepatite e outras ISTs' },
      { titulo: 'TATTOO SEGURA',      frase: 'Exija material descartável no estúdio' },
    ],
    canalAjuda: { label: 'SUS — Disque Saúde', valor: '136' },
    fonte: 'Ministério da Saúde · OMS · SBH',
  },
  'agosto-dourado': {
    mes: 8, cor: '#CA8A04', corEscura: '#713F12', corClara: '#FEFCE8', corDestaque: '#DC2626',
    titulo: 'AGOSTO DOURADO', subtitulo: 'ALEITAMENTO MATERNO',
    tema: 'A amamentação é o padrão-ouro de nutrição infantil.',
    slogan: 'Amamentar é cuidar do futuro.',
    destaques: [
      { titulo: 'EXCLUSIVO 6 MESES',  frase: 'Recomendação OMS — só leite materno até os 6 meses' },
      { titulo: 'ATÉ 2 ANOS',         frase: 'Amamentação complementar até no mínimo 2 anos' },
      { titulo: 'PAUSAS GARANTIDAS',  frase: 'CLT Art. 396 — 2 pausas de 30 min após retorno' },
      { titulo: 'SALA DE APOIO',      frase: 'Privacidade e geladeira pra armazenar o leite' },
      { titulo: 'RETORNO GRADUAL',    frase: 'Sem viagens e jornada estendida nos 6 primeiros meses' },
      { titulo: 'TODOS APOIAM',       frase: 'Família, empresa e sociedade — apoio reduz desmame' },
    ],
    canalAjuda: { label: 'CLT Art. 396 · Ministério da Saúde', valor: 'gov.br/saude' },
    fonte: 'OMS · UNICEF · MS',
  },
  'setembro-amarelo': {
    mes: 9, cor: '#EAB308', corEscura: '#713F12', corClara: '#FEFCE8', corDestaque: '#111827',
    titulo: 'SETEMBRO AMARELO', subtitulo: 'PREVENÇÃO AO SUICÍDIO',
    tema: 'Falar sobre o assunto salva vidas. A maioria dos casos é evitável.',
    slogan: 'Falar é a melhor solução.',
    destaques: [
      { titulo: 'PERGUNTE',           frase: 'Falar sobre suicídio NÃO induz — alivia' },
      { titulo: 'ESCUTE',             frase: 'Sem julgamento, sem corrigir, sem minimizar' },
      { titulo: 'VALIDE A DOR',       frase: 'Nunca diga "isso passa" ou "tem gente em situação pior"' },
      { titulo: 'CONECTE COM AJUDA',  frase: 'CVV, médico, psicólogo — imediatamente' },
      { titulo: 'FIQUE PERTO',        frase: 'Não deixe a pessoa sozinha em momento de crise' },
      { titulo: '14 MIL POR ANO',     frase: 'Mortes evitáveis no Brasil — sua atenção importa' },
    ],
    canalAjuda: { label: 'CVV — 24h, gratuito, sigiloso', valor: '188' },
    fonte: 'CVV · CFM · ABP · OMS',
  },
  'outubro-rosa': {
    mes: 10, cor: '#EC4899', corEscura: '#831843', corClara: '#FDF2F8', corDestaque: '#FBBF24',
    titulo: 'OUTUBRO ROSA', subtitulo: 'PREVENÇÃO AO CÂNCER DE MAMA',
    tema: 'Câncer mais comum entre mulheres. Diagnóstico precoce = 95% de cura.',
    slogan: 'Toque-se. Examine-se. Cuide-se.',
    destaques: [
      { titulo: 'AUTOEXAME',          frase: 'Mensal — conheça suas mamas e identifique mudanças' },
      { titulo: 'MAMOGRAFIA',         frase: 'Anual a partir dos 40 anos (50 no SUS)' },
      { titulo: '95% DE CURA',        frase: 'Quando descoberto cedo — não espere sintomas' },
      { titulo: 'HOMENS TAMBÉM',      frase: '1% dos casos — fiquem atentos a nódulos' },
      { titulo: 'PESO + EXERCÍCIO',   frase: 'Estilo de vida saudável reduz o risco' },
      { titulo: 'HISTÓRICO FAMILIAR', frase: 'Casos na família? Converse com o médico cedo' },
    ],
    canalAjuda: { label: 'INCA · FEMAMA', valor: 'inca.gov.br' },
    fonte: 'INCA · Ministério da Saúde · FEMAMA',
  },
  'novembro-azul': {
    mes: 11, cor: '#2563EB', corEscura: '#1E3A8A', corClara: '#EFF6FF', corDestaque: '#FBBF24',
    titulo: 'NOVEMBRO AZUL', subtitulo: 'SAÚDE DO HOMEM · PRÓSTATA',
    tema: '2º câncer mais comum em homens. Detecção precoce salva vidas.',
    slogan: 'Cuide-se. Sua saúde é coisa de homem.',
    destaques: [
      { titulo: 'CONSULTA ANUAL',     frase: 'Urologista a partir dos 50 anos (40 com histórico)' },
      { titulo: 'PSA + TOQUE',        frase: 'Exames complementares — um não substitui o outro' },
      { titulo: 'NÃO É VERGONHA',     frase: 'O exame é cuidado — não é sobre masculinidade' },
      { titulo: '90% DE CURA',        frase: 'Quando descoberto cedo — preconceito mata mais' },
      { titulo: 'SEM TABACO',         frase: 'Reduza álcool e mantenha atividade física' },
      { titulo: 'CUIDE INTEIRO',      frase: 'Saúde mental, coração, próstata — tudo importa' },
    ],
    canalAjuda: { label: 'SBU · INCA · SUS', valor: 'sbu.org.br · 136' },
    fonte: 'INCA · SBU · Ministério da Saúde',
  },
  'dezembro-vermelho': {
    mes: 12, cor: '#DC2626', corEscura: '#7F1D1D', corClara: '#FEF2F2', corDestaque: '#FBBF24',
    titulo: 'DEZEMBRO VERMELHO', subtitulo: 'COMBATE AO HIV/AIDS E ISTs',
    tema: 'Hoje HIV é doença crônica tratável. Mas o preconceito mata mais que o vírus.',
    slogan: 'Informação previne. Tratamento salva.',
    destaques: [
      { titulo: 'I = I',              frase: 'Indetectável = Intransmissível (com tratamento)' },
      { titulo: 'PRESERVATIVO',       frase: 'Método mais eficaz pra prevenir HIV e ISTs' },
      { titulo: 'PREP',               frase: 'Profilaxia pré-exposição — gratuita no SUS' },
      { titulo: 'PEP EM 72H',         frase: 'Após exposição de risco — vá direto à emergência' },
      { titulo: 'TESTE RÁPIDO',       frase: 'Gratuito em UBS, CTA e farmácias parceiras' },
      { titulo: 'SEM PRECONCEITO',    frase: 'Discriminação afasta as pessoas do diagnóstico' },
    ],
    canalAjuda: { label: 'Departamento IST/AIDS · SUS', valor: 'gov.br/aids · 136' },
    fonte: 'Ministério da Saúde · UNAIDS',
  },
};

// Layout estilo MURAL VISUAL — header colorido + grid 2x3 de cards + footer com canal
function cartazCampanha(doc: PDFKit.PDFDocument, empresa: string, tipo: TipoCampanha) {
  const cfg = CAMPANHAS[tipo];
  if (!cfg) return;

  // ===== Header com cor da campanha =====
  rect(doc, 0, 0, W, 165, cfg.cor);
  rect(doc, 0, 165, W, 6, cfg.corDestaque);

  doc.font('Helvetica-Bold').fontSize(38).fillColor('#FFFFFF')
     .text(cfg.titulo, 0, 35, { width: W, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(cfg.corDestaque)
     .text(cfg.subtitulo, 0, 88, { width: W, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica-Oblique').fontSize(12).fillColor('#FFFFFF')
     .text(`"${cfg.slogan}"`, 0, 120, { width: W, align: 'center' });

  // ===== Faixa empresa =====
  rect(doc, M, 190, W - 2*M, 30, '#FFFFFF', cfg.cor, 2);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(cfg.corEscura)
     .text(empresa.toUpperCase(), M, 198, { width: W - 2*M, align: 'center', characterSpacing: 1 });

  // ===== Grid 2 colunas × 3 linhas de cards coloridos =====
  // Cada card: cor da paleta + título grande + frase curta
  const gridTop = 240;
  const cardW = (W - 2*M - 12) / 2; // 2 colunas, gap 12
  const cardH = 115;
  const gap = 12;

  cfg.destaques.slice(0, 6).forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    const palette = PALETA_CARDS[i % PALETA_CARDS.length];

    // Card colorido
    rect(doc, x, y, cardW, cardH, palette.bg);
    // Faixa de destaque no topo
    rect(doc, x, y, cardW, 4, palette.subtitle);

    // Numero grande no canto superior direito (estilo mural)
    doc.font('Helvetica-Bold').fontSize(36).fillColor(palette.subtitle).opacity(0.4)
       .text(String(i + 1).padStart(2, '0'), x + cardW - 50, y + 8, { width: 40, align: 'right' });
    doc.opacity(1);

    // Título do card (grande, caixa alta)
    doc.font('Helvetica-Bold').fontSize(16).fillColor(palette.text)
       .text(d.titulo, x + 14, y + 30, { width: cardW - 60, characterSpacing: 1 });

    // Linha divisória
    doc.lineWidth(2).strokeColor(palette.subtitle).opacity(0.5)
       .moveTo(x + 14, y + 58).lineTo(x + 44, y + 58).stroke();
    doc.opacity(1);

    // Frase de apoio
    doc.font('Helvetica').fontSize(10).fillColor(palette.text)
       .text(d.frase, x + 14, y + 70, { width: cardW - 28, lineGap: 1 });
  });

  // ===== Faixa de canal de ajuda em destaque =====
  const footerY = gridTop + 3 * (cardH + gap) + 8;
  rect(doc, M, footerY, W - 2*M, 70, cfg.corEscura);
  rect(doc, M, footerY, W - 2*M, 6, cfg.corDestaque);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(cfg.corDestaque)
     .text(cfg.canalAjuda.label.toUpperCase(), M, footerY + 18, { width: W - 2*M, align: 'center', characterSpacing: 2 });
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF')
     .text(cfg.canalAjuda.valor, M, footerY + 38, { width: W - 2*M, align: 'center' });

  // ===== Rodapé =====
  doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF')
     .text(`Fonte: ${cfg.fonte}`, M, H - 60, { width: W - 2*M, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
     .text(`${empresa}  ·  Campanha do mês ${String(cfg.mes).padStart(2, '0')}/12  ·  Programa de Saúde`,
       M, H - 45, { width: W - 2*M, align: 'center' });
}
