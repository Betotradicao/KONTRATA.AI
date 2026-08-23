/**
 * Gera o template do GUIA - EXAME OCUPACIONAL a partir do .docx original
 * que a AllCare fornece, trocando os valores de exemplo por $PLACEHOLDERS$.
 *
 * Rodar so quando o formulario da clinica mudar:
 *   node scripts/gerar-template-guia.js "caminho/do/guia-original.docx"
 *
 * POR QUE ESTE SCRIPT EXISTE (nao da pra fazer replace direto no .docx):
 * o Word fragmenta texto em varios <w:r>/<w:t>. No original, "25/08/2026 09:30"
 * estava quebrado em 12 pedacos e cada "( x )" em 3. Procurar a string inteira
 * no XML nao acha nada. Entao reescrevemos no nivel de PARAGRAFO: pegamos o
 * texto concatenado do <w:p>, e trocamos todos os runs por UM run com o
 * placeholder, preservando a formatacao (<w:pPr> do paragrafo e <w:rPr> do
 * primeiro run).
 *
 * Casamos por INDICE de paragrafo, nao por texto, porque textos como "OUTROS:"
 * e "98" se repetem no documento. Cada entrada declara o texto que ESPERA
 * encontrar; se nao bater, o script ABORTA em vez de gerar um docx corrompido.
 */
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const origem = process.argv[2];
const destino = path.join(__dirname, '..', 'src', 'templates', 'guia-exame-ocupacional.docx');
if (!origem || !fs.existsSync(origem)) {
  console.error('Uso: node scripts/gerar-template-guia.js "<guia-original.docx>"');
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textoDoParagrafo = (p) =>
  [...p.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');

/** Troca todos os runs do paragrafo por um unico run com `novoTexto`. */
function reescreverParagrafo(p, novoTexto) {
  const abertura = p.match(/^<w:p[^>]*>/)[0];
  const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
  // rPr do PRIMEIRO RUN (nao o de dentro do pPr, que e do marcador de paragrafo)
  const primeiroRun = (p.match(/<w:r(?: [^>]*)?>[\s\S]*?<\/w:r>/) || [''])[0];
  const rPr = (primeiroRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
  return `${abertura}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(novoTexto)}</w:t></w:r></w:p>`;
}

function aplicar(xml, mapa, arquivo) {
  const paragrafos = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  const trocas = new Map();
  for (const item of mapa) {
    const p = paragrafos[item.i];
    if (p === undefined) throw new Error(`${arquivo}: paragrafo ${item.i} nao existe`);
    const atual = textoDoParagrafo(p).trim();
    if (atual !== item.espera) {
      throw new Error(
        `${arquivo}: paragrafo ${item.i} mudou.\n  esperava: ${JSON.stringify(item.espera)}\n  achei:    ${JSON.stringify(atual)}`
      );
    }
    const novo = typeof item.para === 'function' ? item.para(textoDoParagrafo(p)) : item.para;
    trocas.set(p, reescreverParagrafo(p, novo));
  }
  let saida = xml;
  for (const [de, para] of trocas) saida = saida.replace(de, para);
  return saida;
}

// ── Mapa do documento ────────────────────────────────────────────────────
const DOCUMENTO = [
  { i: 1,  espera: 'Agendado para: (25//08/2026 09:30)', para: 'Agendado para: ($AGENDADO$)' },
  { i: 2,  espera: '(  x )   Admissional',                 para: '($CB_ADMISSIONAL$)   Admissional' },
  { i: 3,  espera: '(   )  Demissional',                   para: '($CB_DEMISSIONAL$)  Demissional' },
  { i: 4,  espera: '(   ) Periódico',                      para: '($CB_PERIODICO$) Periódico' },
  { i: 5,  espera: '(   )   Mudança de Função',            para: '($CB_MUDANCA_FUNCAO$)   Mudança de Função' },
  { i: 6,  espera: '(   ) Retorno ao Trabalho',            para: '($CB_RETORNO$) Retorno ao Trabalho' },
  { i: 7,  espera: '(   ) Avaliação Médica',               para: '($CB_AVALIACAO$) Avaliação Médica' },
  { i: 8,  espera: '(   )   Trabalho em Altura',           para: '($CB_ALTURA$)   Trabalho em Altura' },
  { i: 9,  espera: '(   ) Trabalho em Espaço Confinado',   para: '($CB_CONFINADO$) Trabalho em Espaço Confinado' },
  { i: 10, espera: '(   ) Outro:',                         para: '($CB_OUTRO$) Outro: $OUTRO_DESC$' },
  { i: 14, espera: 'Ronaldo Carneiro Sousa',               para: '$NOME$' },
  { i: 16, espera: '17/08/1979',                           para: '$DATA_NASCIMENTO$' },
  { i: 18, espera: 'RG: 012799871999-4   CPF:87930854353', para: 'RG: $RG$   CPF: $CPF$' },
  { i: 20, espera: '98',                                   para: '$MATRICULA$' },
  { i: 22, espera: 'Repositor FLV',                        para: '$FUNCAO$' },
  { i: 24, espera: 'TRADICAO COMERCIAL LTDA 45.424.842/0001-09', para: '$EMPRESA$' },
  { i: 26, espera: 'Hort frut',                            para: '$SETOR$' },
  { i: 28, espera: 'RENATO',                               para: '$MEDICO_PCMSO$' },
  { i: 35, espera: 'FISICO:',                              para: 'FISICO: $RISCO_FISICO$' },
  { i: 37, espera: 'QUIMICO:',                             para: 'QUIMICO: $RISCO_QUIMICO$' },
  { i: 39, espera: 'BIOLOGICO:',                           para: 'BIOLOGICO: $RISCO_BIOLOGICO$' },
  { i: 41, espera: 'OUTROS:',                              para: 'OUTROS: $RISCO_OUTROS$' },
];

// Cabecalho = papel timbrado da clinica. O LOGO e imagem em word/media/ e
// continua fixo; so o texto vira variavel.
const CABECALHO = [
  { i: 2, espera: 'Rua Major Vaz, 247',                      para: '$CLINICA_ENDERECO$' },
  { i: 3, espera: 'Vila Adyana | São José dos Campos | SP',  para: '$CLINICA_CIDADE$' },
  { i: 4, espera: 'Tel: (12) 3019-1664',                     para: 'Tel: $CLINICA_TELEFONE$' },
  { i: 5, espera: 'www.allcareocupacional.com.br',           para: '$CLINICA_SITE$' },
];

// Rodape: preserva os espacos de alinhamento, troca so o nome.
const RODAPE = [
  {
    i: 0,
    espera: 'ROBERTO BASTOS RUIVO',
    para: (original) => original.replace('ROBERTO BASTOS RUIVO', '$RESPONSAVEL$'),
  },
];

const zip = new AdmZip(origem);
const ler = (n) => zip.getEntry(n).getData().toString('utf8');

zip.updateFile('word/document.xml', Buffer.from(aplicar(ler('word/document.xml'), DOCUMENTO, 'document.xml'), 'utf8'));
zip.updateFile('word/header1.xml',  Buffer.from(aplicar(ler('word/header1.xml'),  CABECALHO,  'header1.xml'),  'utf8'));
zip.updateFile('word/footer1.xml',  Buffer.from(aplicar(ler('word/footer1.xml'),  RODAPE,     'footer1.xml'),  'utf8'));

fs.mkdirSync(path.dirname(destino), { recursive: true });
zip.writeZip(destino);
console.log('Template gerado:', destino);
