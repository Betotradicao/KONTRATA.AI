/**
 * Service de processamento de documentos pro Agente HELLEN.
 *
 * Recebe PDF / Excel / Imagem e:
 * 1. Extrai texto bruto
 * 2. Usa GPT pra estruturar em JSON normalizado
 * 3. Retorna conteudo pronto pra salvar em rh_escala_memoria
 *
 * Tipos suportados: cct_sindicato | escala_historica | regulamento_interno |
 *                   acordo_coletivo | restricao_colaborador
 */
import axios from 'axios';
import { ConfigurationService } from './configuration.service';

const { PDFParse } = require('pdf-parse');
const XLSX = require('xlsx');

export type TipoDocumento =
  | 'cct_sindicato'
  | 'escala_historica'
  | 'regulamento_interno'
  | 'acordo_coletivo'
  | 'restricao_colaborador';

interface ExtracaoResult {
  textoBruto: string;
  tipoFonte: 'pdf-texto' | 'pdf-escaneado' | 'xlsx' | 'imagem';
}

interface EstruturaCCT {
  sindicato?: string;
  categoria?: string;
  base_territorial?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  jornada_max_semanal_horas?: number;
  jornada_max_diaria_horas?: number;
  intervalo_intra_jornada_min?: number;
  intervalo_inter_jornada_min?: number;
  adicional_noturno_pct?: number;
  hora_inicio_noturno?: string;
  hora_fim_noturno?: string;
  hora_extra_pct?: number;
  hora_extra_dom_feriado_pct?: number;
  dsr_obrigatorio_domingo?: boolean;
  banco_horas_permitido?: boolean;
  banco_horas_prazo_dias?: number;
  clausulas_relevantes?: string[];
  observacoes?: string;
}

interface EstruturaEscalaHistorica {
  setor?: string;
  mes_referencia?: string;
  ano_referencia?: number;
  cobertura_observada?: { dia_semana: string; pessoas: number }[];
  rotacao_folgas?: { colaborador: string; folgas: string[] }[];
  observacoes?: string;
  raw_table?: any[];
}

interface EstruturaRegulamento {
  titulo?: string;
  regras: { regra: string; aplica_a: string; obrigatoriedade: 'rigida' | 'flexivel' }[];
  observacoes?: string;
}

export class DocumentoEscalaService {
  /** Extrai texto bruto de um buffer baseado no mimetype */
  static async extrairTexto(buffer: Buffer, mimetype: string, filename: string): Promise<ExtracaoResult> {
    const lower = (mimetype || '').toLowerCase();
    const ext = (filename || '').toLowerCase();

    // PDF (pdf-parse v2 API)
    if (lower.includes('pdf') || ext.endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const texto = (result.text || '').trim();
      // Se quase nada de texto, eh PDF escaneado (so imagem) -> usar Vision
      if (texto.length < 100) {
        const visionText = await this.lerImagemComVision(buffer, 'application/pdf');
        return { textoBruto: visionText, tipoFonte: 'pdf-escaneado' };
      }
      return { textoBruto: texto, tipoFonte: 'pdf-texto' };
    }

    // Excel
    if (lower.includes('spreadsheet') || lower.includes('excel') ||
        ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      let out = '';
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        out += `\n=== Sheet: ${sheetName} ===\n`;
        out += XLSX.utils.sheet_to_csv(sheet);
      }
      return { textoBruto: out.trim(), tipoFonte: 'xlsx' };
    }

    // Imagem (JPG, PNG, etc) -> GPT-4o Vision
    if (lower.startsWith('image/')) {
      const texto = await this.lerImagemComVision(buffer, mimetype);
      return { textoBruto: texto, tipoFonte: 'imagem' };
    }

    throw new Error(`Tipo de arquivo nao suportado: ${mimetype} (${filename})`);
  }

  /** Manda imagem/PDF escaneado pro GPT-4o Vision transcrever */
  private static async lerImagemComVision(buffer: Buffer, mimetype: string): Promise<string> {
    const apiKey = await ConfigurationService.get('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API Key nao configurada');

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;

    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Voce e um OCR especializado em documentos de RH brasileiros. Transcreva o conteudo da imagem em texto plano em portugues, preservando tabelas (use | como separador), titulos, valores numericos e datas. NAO interprete - apenas transcreva fielmente.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcreva todo o conteudo deste documento:' },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 4000,
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 120000,
    });

    return r.data.choices?.[0]?.message?.content || '';
  }

  /** Estrutura o texto extraido em JSON normalizado conforme o tipo do documento */
  static async estruturar(textoBruto: string, tipo: TipoDocumento): Promise<{
    estrutura: any;
    resumoHumano: string;
    titulo: string;
    tags: string[];
  }> {
    const apiKey = await ConfigurationService.get('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API Key nao configurada');

    const promptPorTipo: Record<TipoDocumento, string> = {
      cct_sindicato: `Voce e especialista em direito do trabalho brasileiro (CLT + CCT). Extraia da CONVENCAO COLETIVA abaixo um JSON com a estrutura EXATA:
{
  "sindicato": "sigla ou nome do sindicato laboral",
  "categoria": "categoria profissional (ex: Comerciarios, Acougueiros)",
  "base_territorial": "cidade ou regiao de abrangencia",
  "vigencia_inicio": "YYYY-MM-DD",
  "vigencia_fim": "YYYY-MM-DD",
  "jornada_max_semanal_horas": numero,
  "jornada_max_diaria_horas": numero,
  "intervalo_intra_jornada_min": minutos,
  "intervalo_inter_jornada_min": minutos (padrao CLT 660 = 11h),
  "adicional_noturno_pct": numero (CLT 20%, mas CCTs frequentemente 30%+),
  "hora_inicio_noturno": "HH:MM",
  "hora_fim_noturno": "HH:MM",
  "hora_extra_pct": numero,
  "hora_extra_dom_feriado_pct": numero,
  "dsr_obrigatorio_domingo": true/false,
  "banco_horas_permitido": true/false,
  "banco_horas_prazo_dias": numero (CLT permite ate 180),
  "clausulas_relevantes": ["lista de outras clausulas importantes pra escala"],
  "observacoes": "qualquer coisa relevante que nao se encaixou nos campos acima"
}
Use null para campos nao mencionados na CCT. NAO INVENTE valores.`,

      escala_historica: `Voce esta lendo uma ESCALA DE TRABALHO antiga. Extraia em JSON:
{
  "setor": "nome do setor (acougue, padaria, frente de caixa, etc)",
  "mes_referencia": "MMM" (ex: "junho"),
  "ano_referencia": YYYY,
  "cobertura_observada": [{ "dia_semana": "seg|ter|qua|qui|sex|sab|dom", "pessoas": numero_de_pessoas_trabalhando }],
  "rotacao_folgas": [{ "colaborador": "NOME", "folgas": ["YYYY-MM-DD", ...] }],
  "observacoes": "padroes identificados (ex: lider sempre trabalha sabado, junior nunca domingo)",
  "raw_table": [{ "colaborador": "NOME", "funcao": "...", "dias": { "1": "T|F|FE|AT", "2": "...", ... } }]
}
T=trabalho, F=folga, FE=ferias, AT=atestado.`,

      regulamento_interno: `Voce esta lendo um REGULAMENTO INTERNO de RH/escala. Extraia regras estruturadas:
{
  "titulo": "nome do regulamento",
  "regras": [{
    "regra": "descricao curta da regra",
    "aplica_a": "todos | funcao:X | colaborador:Y | setor:Z",
    "obrigatoriedade": "rigida | flexivel"
  }],
  "observacoes": "..."
}`,

      acordo_coletivo: `Voce esta lendo um ACORDO COLETIVO. Mesma estrutura da CCT:
{
  "sindicato": "...", "categoria": "...", "vigencia_inicio": "...", "vigencia_fim": "...",
  "regras_diferenciais": ["lista de regras que divergem da CCT geral"],
  "observacoes": "..."
}`,

      restricao_colaborador: `Voce esta lendo um documento que descreve RESTRICOES de um colaborador (atestado medico, recomendacao, etc). Extraia:
{
  "colaborador_nome": "...",
  "tipo_restricao": "fisica | jornada | horario | local",
  "descricao": "...",
  "validade_inicio": "YYYY-MM-DD",
  "validade_fim": "YYYY-MM-DD",
  "impacto_escala": "como isso afeta a escala (ex: nao pode levantar peso, so meio periodo)"
}`,
    };

    // Trunca texto se gigante (CCT as vezes 50+ paginas)
    const textoTrunc = textoBruto.slice(0, 30000);

    const r = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptPorTipo[tipo] },
        { role: 'user', content: textoTrunc },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2500,
    }, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 90000,
    });

    let estrutura: any;
    try {
      estrutura = JSON.parse(r.data.choices?.[0]?.message?.content || '{}');
    } catch {
      estrutura = {};
    }

    // Gerar titulo, tags, e resumo humano (markdown) pra mostrar pro usuario
    const meta = this.gerarMeta(estrutura, tipo, textoBruto);

    return { estrutura, ...meta };
  }

  /** Constroi titulo + tags + resumo markdown a partir da estrutura extraida */
  private static gerarMeta(estrutura: any, tipo: TipoDocumento, textoBruto: string): {
    titulo: string; tags: string[]; resumoHumano: string;
  } {
    let titulo = '';
    let tags: string[] = [`tipo:${tipo}`];
    let resumo = '';

    if (tipo === 'cct_sindicato') {
      titulo = `CCT ${estrutura.sindicato || 'Sindicato'} ${estrutura.vigencia_inicio?.slice(0, 4) || ''}`.trim();
      if (estrutura.sindicato) tags.push(`sindicato:${slugify(estrutura.sindicato)}`);
      if (estrutura.categoria) tags.push(`categoria:${slugify(estrutura.categoria)}`);
      if (estrutura.base_territorial) tags.push(`regiao:${slugify(estrutura.base_territorial)}`);
      resumo = `# ${titulo}\n\n`;
      resumo += `**Categoria:** ${estrutura.categoria || '—'}\n`;
      resumo += `**Base territorial:** ${estrutura.base_territorial || '—'}\n`;
      resumo += `**Vigência:** ${estrutura.vigencia_inicio || '?'} a ${estrutura.vigencia_fim || '?'}\n\n`;
      resumo += `## 📐 Regras de jornada\n`;
      resumo += `- Jornada semanal máxima: **${estrutura.jornada_max_semanal_horas || '?'}h**\n`;
      resumo += `- Jornada diária máxima: **${estrutura.jornada_max_diaria_horas || '?'}h**\n`;
      resumo += `- Intervalo intrajornada mínimo: **${estrutura.intervalo_intra_jornada_min || '?'} min**\n`;
      resumo += `- Intervalo interjornada mínimo: **${estrutura.intervalo_inter_jornada_min || '?'} min**\n\n`;
      resumo += `## 💰 Adicionais\n`;
      resumo += `- Hora extra: **${estrutura.hora_extra_pct || '?'}%**\n`;
      resumo += `- HE domingo/feriado: **${estrutura.hora_extra_dom_feriado_pct || '?'}%**\n`;
      resumo += `- Adicional noturno: **${estrutura.adicional_noturno_pct || '?'}%** (${estrutura.hora_inicio_noturno || '?'} a ${estrutura.hora_fim_noturno || '?'})\n\n`;
      resumo += `## ⚖️ Outras regras\n`;
      resumo += `- DSR obrigatório no domingo: ${estrutura.dsr_obrigatorio_domingo ? '✅ Sim' : '❌ Não'}\n`;
      resumo += `- Banco de horas: ${estrutura.banco_horas_permitido ? `✅ Permitido (${estrutura.banco_horas_prazo_dias || '?'} dias)` : '❌ Não'}\n\n`;
      if (estrutura.clausulas_relevantes?.length) {
        resumo += `## 📋 Cláusulas relevantes\n`;
        resumo += estrutura.clausulas_relevantes.map((c: string) => `- ${c}`).join('\n') + '\n';
      }
      if (estrutura.observacoes) resumo += `\n## 📝 Observações\n${estrutura.observacoes}\n`;
    }
    else if (tipo === 'escala_historica') {
      titulo = `Escala ${estrutura.setor || ''} ${estrutura.mes_referencia || ''}/${estrutura.ano_referencia || ''}`.trim();
      if (estrutura.setor) tags.push(`setor:${slugify(estrutura.setor)}`);
      if (estrutura.mes_referencia) tags.push(`mes:${slugify(estrutura.mes_referencia)}`);
      if (estrutura.ano_referencia) tags.push(`ano:${estrutura.ano_referencia}`);
      resumo = `# ${titulo}\n\n`;
      if (estrutura.observacoes) resumo += `## 🔍 Padrões identificados\n${estrutura.observacoes}\n\n`;
      if (estrutura.cobertura_observada?.length) {
        resumo += `## 📊 Cobertura por dia\n`;
        resumo += estrutura.cobertura_observada.map((c: any) => `- **${c.dia_semana}**: ${c.pessoas} pessoa(s)`).join('\n') + '\n\n';
      }
      if (estrutura.raw_table?.length) {
        resumo += `## 📅 Tabela completa\n\`\`\`json\n${JSON.stringify(estrutura.raw_table, null, 2)}\n\`\`\`\n`;
      }
    }
    else if (tipo === 'regulamento_interno') {
      titulo = estrutura.titulo || 'Regulamento Interno';
      resumo = `# ${titulo}\n\n`;
      if (estrutura.regras?.length) {
        resumo += `## 📋 Regras\n`;
        resumo += estrutura.regras.map((r: any) =>
          `- **[${r.obrigatoriedade?.toUpperCase()}]** ${r.regra} _(aplica a: ${r.aplica_a})_`
        ).join('\n') + '\n';
      }
      if (estrutura.observacoes) resumo += `\n## 📝 Observações\n${estrutura.observacoes}\n`;
    }
    else if (tipo === 'restricao_colaborador') {
      titulo = `Restrição ${estrutura.colaborador_nome || 'Colaborador'} (${estrutura.tipo_restricao || ''})`;
      if (estrutura.colaborador_nome) tags.push(`colaborador:${slugify(estrutura.colaborador_nome)}`);
      resumo = `# ${titulo}\n\n`;
      resumo += `- **Tipo:** ${estrutura.tipo_restricao}\n`;
      resumo += `- **Descrição:** ${estrutura.descricao}\n`;
      resumo += `- **Validade:** ${estrutura.validade_inicio || '?'} a ${estrutura.validade_fim || '?'}\n`;
      resumo += `- **Impacto na escala:** ${estrutura.impacto_escala}\n`;
    }
    else {
      titulo = `Documento ${tipo}`;
      resumo = '```\n' + textoBruto.slice(0, 2000) + '\n```';
    }

    // Anexa o JSON estruturado no fim do conteudo (pra agente consultar)
    resumo += `\n\n---\n\n## 🤖 Dados estruturados (pra IA)\n\`\`\`json\n${JSON.stringify(estrutura, null, 2)}\n\`\`\``;

    return { titulo, tags, resumoHumano: resumo };
  }
}

function slugify(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
