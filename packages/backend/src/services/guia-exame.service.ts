import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

/**
 * Preenche o "GUIA - EXAME OCUPACIONAL" (.docx) que o RH manda pra empresa de
 * medicina do trabalho. So a parte de cima e preenchida aqui — a tabela de
 * exames embaixo vai em branco de proposito, e a clinica que marca.
 *
 * O template vive em src/templates/guia-exame-ocupacional.docx e foi gerado
 * pelo scripts/gerar-template-guia.js a partir do .docx original da clinica.
 * NAO editar o template no Word e salvar por cima: o Word re-fragmenta os
 * runs e quebra os $PLACEHOLDERS$. Se o formulario mudar, rode o script de novo.
 */

export interface TipoExame { key: string; label: string; placeholder: string; }

/** Ordem igual a do documento. `placeholder` e a caixinha ( ) correspondente. */
export const TIPOS_EXAME: TipoExame[] = [
  { key: 'admissional',     label: 'Admissional',                  placeholder: 'CB_ADMISSIONAL' },
  { key: 'demissional',     label: 'Demissional',                  placeholder: 'CB_DEMISSIONAL' },
  { key: 'periodico',       label: 'Periódico',                    placeholder: 'CB_PERIODICO' },
  { key: 'mudanca_funcao',  label: 'Mudança de Função',            placeholder: 'CB_MUDANCA_FUNCAO' },
  { key: 'retorno',         label: 'Retorno ao Trabalho',          placeholder: 'CB_RETORNO' },
  { key: 'avaliacao',       label: 'Avaliação Médica',             placeholder: 'CB_AVALIACAO' },
  { key: 'altura',          label: 'Trabalho em Altura',           placeholder: 'CB_ALTURA' },
  { key: 'confinado',       label: 'Trabalho em Espaço Confinado', placeholder: 'CB_CONFINADO' },
  { key: 'outro',           label: 'Outro',                        placeholder: 'CB_OUTRO' },
];

export interface DadosGuia {
  tipoExame?: string;
  outroDesc?: string;
  agendado?: string;
  nome?: string;
  dataNascimento?: string;
  rg?: string;
  cpf?: string;
  matricula?: string;
  funcao?: string;
  empresa?: string;
  setor?: string;
  medicoPcmso?: string;
  riscoFisico?: string;
  riscoQuimico?: string;
  riscoBiologico?: string;
  riscoOutros?: string;
  clinicaEndereco?: string;
  clinicaCidade?: string;
  clinicaTelefone?: string;
  clinicaSite?: string;
  responsavel?: string;
}

const TEMPLATE = path.join(__dirname, '..', 'templates', 'guia-exame-ocupacional.docx');

/** Texto do usuario vai pra DENTRO do XML — escapar e obrigatorio. */
const escXml = (v?: string | null) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export class GuiaExameService {
  static templateExiste(): boolean {
    return fs.existsSync(TEMPLATE);
  }

  static gerar(d: DadosGuia): Buffer {
    if (!fs.existsSync(TEMPLATE)) {
      throw new Error('Template do Guia de Exame nao encontrado no servidor');
    }

    const vars: Record<string, string> = {
      AGENDADO: d.agendado || '',
      OUTRO_DESC: d.tipoExame === 'outro' ? (d.outroDesc || '') : '',
      NOME: d.nome || '',
      DATA_NASCIMENTO: d.dataNascimento || '',
      RG: d.rg || '',
      CPF: d.cpf || '',
      // Ficha ainda nao virou colaborador -> matricula so existe depois. Sai em
      // branco de proposito, pra clinica nao receber numero inventado.
      MATRICULA: d.matricula || '',
      FUNCAO: d.funcao || '',
      EMPRESA: d.empresa || '',
      SETOR: d.setor || '',
      MEDICO_PCMSO: d.medicoPcmso || '',
      RISCO_FISICO: d.riscoFisico || '',
      RISCO_QUIMICO: d.riscoQuimico || '',
      RISCO_BIOLOGICO: d.riscoBiologico || '',
      RISCO_OUTROS: d.riscoOutros || '',
      CLINICA_ENDERECO: d.clinicaEndereco || '',
      CLINICA_CIDADE: d.clinicaCidade || '',
      CLINICA_TELEFONE: d.clinicaTelefone || '',
      CLINICA_SITE: d.clinicaSite || '',
      RESPONSAVEL: d.responsavel || '',
    };

    // Marca so a caixinha do tipo escolhido. Larguras batem com o original:
    // "(  x )" pro marcado e "(   )" pros demais.
    for (const t of TIPOS_EXAME) {
      vars[t.placeholder] = t.key === d.tipoExame ? '  x ' : '   ';
    }

    const zip = new AdmZip(TEMPLATE);
    for (const arquivo of ['word/document.xml', 'word/header1.xml', 'word/footer1.xml']) {
      const entrada = zip.getEntry(arquivo);
      if (!entrada) continue;
      let xml = entrada.getData().toString('utf8');
      for (const [chave, valor] of Object.entries(vars)) {
        xml = xml.split(`$${chave}$`).join(escXml(valor));
      }
      zip.updateFile(arquivo, Buffer.from(xml, 'utf8'));
    }
    return zip.toBuffer();
  }

  /** "CLAUDIA ANDRADE" + admissional -> "Guia Exame - Admissional - CLAUDIA ANDRADE.docx" */
  static nomeArquivo(nome?: string, tipoExame?: string): string {
    const tipo = TIPOS_EXAME.find((t) => t.key === tipoExame)?.label || 'Exame';
    const pessoa = String(nome || 'Candidato').replace(/[\/:*?"<>|]/g, '').trim();
    return `Guia Exame - ${tipo} - ${pessoa}.docx`;
  }
}
