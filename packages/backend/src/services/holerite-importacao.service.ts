import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import { AppDataSource } from '../config/database';
import { minioService } from './minio.service';
import { PortalColaboradorService, ResultadoPublicacao } from './portal-colaborador.service';

// pdf-parse v1 (CommonJS) — mesmo jeito que documento-escala.service.ts usa
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

/**
 * Importa o PDF de holerites da contabilidade: lê o texto de cada página, agrupa
 * páginas consecutivas do mesmo CPF+período (holerite que estourou uma página),
 * fatia cada grupo num PDF próprio e sugere colaborador (CPF → nome) e tipo
 * (palavras-chave de rh_tipos_holerite no título). O RH confere e publica.
 *
 * Calibrado com o layout "Demonstrativo de Pagamento de Salário" (Tradição, 09/2026):
 *   "... Periodo : 09/2026 Nro 111 Nome ALEX VALDEZ ROSA Admissão 01/07/2024 CBO 0848310 CPF 15015202881 Função CONFEITEIRO ..."
 * Cada página repete o conteúdo 2x (2 vias) — por isso só o 1º match conta.
 */

export interface PaginaLida {
  numero: number;        // 1-based
  texto: string;
  titulo: string | null;
  cpf: string | null;
  matricula: string | null;
  nome: string | null;
  periodo: string | null;   // "09/2026"
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function lerCamposDaPagina(numero: number, textoBruto: string): PaginaLida {
  const texto = textoBruto.replace(/\s+/g, ' ').trim();
  const titulo = (texto.match(/^(.{5,80}?)\s+(?=[A-Z0-9][A-Z0-9 .&-]{3,}\b(?:LTDA|S\/?A|ME|EPP|EIRELI|COMERCIAL|COMERCIO|SUPERMERCADO))/) || [])[1]
    || (texto.match(/^(Demonstrativo[^0-9]{0,60}?|Recibo[^0-9]{0,60}?)(?=\s[A-Z]{3,})/) || [])[1]
    || texto.slice(0, 60);
  const cpf = (texto.match(/\bCPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/i) || [])[1]?.replace(/\D/g, '') || null;
  const matricula = (texto.match(/\b(?:Nro|N[ºo°]\.?|Matr[ií]cula|Registro|C[óo]d(?:igo)?)\s*:?\s*(\d{1,10})\b/i) || [])[1] || null;
  const nome = (texto.match(/\bNome\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú' ]{3,}?)\s+(?=Admiss|CBO|CPF|Fun[cç]|Cargo|Depto|Setor)/) || [])[1]?.trim() || null;
  const periodo = (texto.match(/\b(?:Per[ií]odo|Compet[êe]ncia|Refer[êe]ncia|M[êe]s)\s*:?\s*(\d{2}\/\d{4})\b/i) || [])[1] || null;
  return { numero, texto, titulo: titulo ? titulo.trim() : null, cpf, matricula, nome, periodo };
}

export function periodoParaCompetencia(p: string | null): string | null {
  if (!p) return null;
  const m = p.match(/^(\d{2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1]}` : null;
}

export class HoleriteImportacaoService {
  static async extrairPaginas(buffer: Buffer): Promise<PaginaLida[]> {
    const textos: string[] = [];
    await pdfParse(buffer, {
      pagerender: async (pageData: any) => {
        const tc = await pageData.getTextContent();
        const t = tc.items.map((i: any) => i.str).join(' ');
        textos.push(t);
        return t;
      },
    });
    return textos.map((t, i) => lerCamposDaPagina(i + 1, t));
  }

  /** Páginas consecutivas com mesmo CPF (ou mesmo nome, se sem CPF) e mesmo período = 1 documento. */
  static agrupar(paginas: PaginaLida[]): PaginaLida[][] {
    const grupos: PaginaLida[][] = [];
    for (const p of paginas) {
      const ult = grupos[grupos.length - 1];
      const chave = (x: PaginaLida) => `${x.cpf || ''}|${x.cpf ? '' : normalizar(x.nome || '')}|${x.periodo || ''}`;
      if (ult && (p.cpf || p.nome) && chave(ult[0]) === chave(p)) ult.push(p);
      else grupos.push([p]);
    }
    return grupos;
  }

  private static async sugerirTipo(titulo: string | null, tipos: any[]): Promise<number | null> {
    if (!titulo) return null;
    const t = normalizar(titulo);
    // 13º/férias/adiantamento antes de "pagamento" (que é o genérico)
    const ordenados = [...tipos].sort((a, b) => (normalizar(a.nome) === 'pagamento' ? 1 : 0) - (normalizar(b.nome) === 'pagamento' ? 1 : 0));
    for (const tipo of ordenados) {
      const kws = String(tipo.palavras_chave || '').split(',').map((k: string) => normalizar(k)).filter(Boolean);
      if (kws.some(k => t.includes(k))) return tipo.id;
    }
    return null;
  }

  static async importar(buffer: Buffer, nomeArquivo: string, criadoPor: string | null, companyId: string | null = null) {
    const paginas = await this.extrairPaginas(buffer);
    if (!paginas.length) throw new Error('PDF sem páginas legíveis');
    if (paginas.every(p => p.texto.length < 30)) throw new Error('PDF sem camada de texto (escaneado). Peça à contabilidade o PDF original.');

    const grupos = this.agrupar(paginas);
    const tipos = await AppDataSource.query(`SELECT id, nome, palavras_chave FROM rh_tipos_holerite WHERE ativo = true ORDER BY ordem, nome`);
    const colabs = await AppDataSource.query(
      `SELECT id, nome, matricula, company_id, regexp_replace(COALESCE(cpf,''), '\\D', '', 'g') AS cpf_digits, status FROM rh_colaboradores`
    );
    const porCpf = new Map<string, any[]>();
    const porNome = new Map<string, any[]>();
    for (const c of colabs) {
      if (c.cpf_digits) porCpf.set(c.cpf_digits, [...(porCpf.get(c.cpf_digits) || []), c]);
      const n = normalizar(c.nome || '');
      if (n) porNome.set(n, [...(porNome.get(n) || []), c]);
    }
    // Empate (mesmo CPF/nome em mais de um cadastro): prefere a loja do lote, depois quem está ativo
    const preferirAtivo = (lista: any[]) =>
      (companyId && lista.find(c => c.company_id === companyId && c.status === 'ativo'))
      || (companyId && lista.find(c => c.company_id === companyId))
      || lista.find(c => c.status === 'ativo') || lista[0];

    // Competência mais frequente do lote = sugestão pro cabeçalho
    const freq = new Map<string, number>();
    for (const g of grupos) { const c = periodoParaCompetencia(g[0].periodo); if (c) freq.set(c, (freq.get(c) || 0) + 1); }
    const competenciaSugerida = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const loteUrl = await minioService.uploadFile(`rh/holerites-import/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${nomeArquivo.replace(/[^\w.-]+/g, '_')}`, buffer, 'application/pdf');
    const [lote] = await AppDataSource.query(
      `INSERT INTO rh_holerite_lotes (nome_arquivo, arquivo_url, total_paginas, total_itens, competencia_sugerida, criado_por, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [nomeArquivo, loteUrl, paginas.length, grupos.length, competenciaSugerida, criadoPor, companyId || null]
    );

    const src = await PDFDocument.load(buffer);
    let ordem = 0;
    for (const g of grupos) {
      ordem++;
      const idx = g.map(p => p.numero - 1);
      const out = await PDFDocument.create();
      const copiadas = await out.copyPages(src, idx);
      copiadas.forEach(pg => out.addPage(pg));
      const itemBuf = Buffer.from(await out.save());
      const itemUrl = await minioService.uploadFile(`rh/holerites-import/lote-${lote.id}/item_${String(ordem).padStart(3, '0')}.pdf`, itemBuf, 'application/pdf');

      const p0 = g[0];
      let colaboradorId: number | null = null;
      let confianca: 'alta' | 'media' | 'baixa' | 'nenhuma' = 'nenhuma';
      if (p0.cpf && porCpf.has(p0.cpf)) { colaboradorId = preferirAtivo(porCpf.get(p0.cpf)!).id; confianca = 'alta'; }
      else if (p0.nome && porNome.has(normalizar(p0.nome))) { colaboradorId = preferirAtivo(porNome.get(normalizar(p0.nome))!).id; confianca = 'media'; }
      else if (p0.nome) {
        // nome parecido (começa igual) — só sugere, RH confirma
        const n = normalizar(p0.nome);
        const cand = colabs.filter((c: any) => normalizar(c.nome || '').startsWith(n.split(' ').slice(0, 2).join(' ')) && n.split(' ').length >= 2);
        if (cand.length === 1) { colaboradorId = cand[0].id; confianca = 'baixa'; }
      }
      const tipoId = await this.sugerirTipo(p0.titulo, tipos);

      await AppDataSource.query(
        `INSERT INTO rh_holerite_lote_itens
           (lote_id, ordem, paginas, arquivo_url, tamanho_bytes, titulo_detectado, cpf_detectado, matricula_detectada, nome_detectado,
            periodo_detectado, colaborador_id, tipo_id, competencia, confianca)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [lote.id, ordem, g.map(p => p.numero), itemUrl, itemBuf.length, p0.titulo, p0.cpf, p0.matricula, p0.nome,
          p0.periodo, colaboradorId, tipoId, periodoParaCompetencia(p0.periodo) || competenciaSugerida, confianca]
      );
    }
    return this.obterLote(lote.id);
  }

  static async listarLotes(companyId: string | null = null) {
    return AppDataSource.query(
      `SELECT l.*, COALESCE(e.apelido, e.nome_fantasia, e.razao_social) AS empresa_nome,
              (SELECT count(*) FROM rh_holerite_lote_itens i WHERE i.lote_id = l.id AND i.status = 'publicado') AS publicados,
              (SELECT count(*) FROM rh_holerite_lote_itens i WHERE i.lote_id = l.id AND i.status = 'pendente') AS pendentes
       FROM rh_holerite_lotes l LEFT JOIN rh_empresas e ON e.id = l.company_id
       WHERE ($1::uuid IS NULL OR l.company_id = $1::uuid)
       ORDER BY l.created_at DESC LIMIT 50`,
      [companyId]
    );
  }

  static async obterLote(id: number) {
    const [lote] = await AppDataSource.query(
      `SELECT l.*, COALESCE(e.apelido, e.nome_fantasia, e.razao_social) AS empresa_nome
       FROM rh_holerite_lotes l LEFT JOIN rh_empresas e ON e.id = l.company_id WHERE l.id = $1`, [id]);
    if (!lote) return null;
    const itens = await AppDataSource.query(this.SQL_ITEM_JOIN + ` WHERE i.lote_id = $1 ORDER BY i.ordem`, [id]);
    return { ...lote, itens };
  }

  private static readonly SQL_ITEM_JOIN = `SELECT i.*, c.nome AS colaborador_nome, c.matricula AS colaborador_matricula, c.celular AS colaborador_celular,
              regexp_replace(COALESCE(c.cpf,''), '\\D', '', 'g') AS colaborador_cpf, t.nome AS tipo_nome
       FROM rh_holerite_lote_itens i
       LEFT JOIN rh_colaboradores c ON c.id = i.colaborador_id
       LEFT JOIN rh_tipos_holerite t ON t.id = i.tipo_id`;

  /** CPF impresso no PDF tem que ser o do colaborador escolhido — senão é holerite de outra pessoa. */
  static cpfConfere(it: { cpf_detectado?: string | null; colaborador_cpf?: string | null }): boolean {
    if (!it.cpf_detectado || !it.colaborador_cpf) return true; // sem CPF de um dos lados, não dá pra barrar
    return it.cpf_detectado.replace(/\D/g, '') === it.colaborador_cpf.replace(/\D/g, '');
  }

  static async atualizarLote(id: number, dados: { company_id?: string | null }) {
    if (!('company_id' in dados)) return null;
    const [row] = await AppDataSource.query(`UPDATE rh_holerite_lotes SET company_id = $2, updated_at = NOW() WHERE id = $1 RETURNING id`, [id, dados.company_id || null]);
    return row || null;
  }

  static async atualizarItem(itemId: number, dados: { colaborador_id?: number | null; tipo_id?: number | null; competencia?: string | null; status?: string }) {
    const sets: string[] = [];
    const params: any[] = [];
    const add = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if ('colaborador_id' in dados) { add('colaborador_id', dados.colaborador_id || null); add('confianca', dados.colaborador_id ? 'confirmada' : 'nenhuma'); }
    if ('tipo_id' in dados) add('tipo_id', dados.tipo_id || null);
    if ('competencia' in dados) add('competencia', dados.competencia || null);
    if (dados.status && ['pendente', 'ignorado'].includes(dados.status)) add('status', dados.status);
    if (!sets.length) return null;
    params.push(itemId);
    const [row] = await AppDataSource.query(
      `UPDATE rh_holerite_lote_itens SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} AND status <> 'publicado' RETURNING id`,
      params
    );
    if (!row) return null;
    const [full] = await AppDataSource.query(this.SQL_ITEM_JOIN + ` WHERE i.id = $1`, [row.id]);
    return full || null;
  }

  static async publicar(loteId: number, itemIds: number[] | null, baseUrl: string, publicadoPor: string | null, enviarWhats: boolean): Promise<(ResultadoPublicacao & { item_id: number })[]> {
    const params: any[] = [loteId];
    let filtro = '';
    if (itemIds && itemIds.length) { params.push(itemIds); filtro = ` AND i.id = ANY($2::int[])`; }
    const itens = await AppDataSource.query(
      this.SQL_ITEM_JOIN + ` WHERE i.lote_id = $1 AND i.status = 'pendente'${filtro} ORDER BY i.ordem`,
      params
    );
    const out: (ResultadoPublicacao & { item_id: number })[] = [];
    for (const it of itens) {
      const base = { item_id: it.id, colaborador_id: it.colaborador_id, nome: it.nome_detectado || '', publicado: false, whats: 'nao_enviado' as const };
      if (!it.colaborador_id || !it.tipo_id || !it.competencia) {
        out.push({ ...base, erro: 'Falta colaborador, tipo ou competência' });
        continue;
      }
      if (!this.cpfConfere(it)) {
        const msg = `CPF do PDF (${it.cpf_detectado}) não é do colaborador escolhido (CPF no cadastro: ${it.colaborador_cpf}) — corrija a pessoa ou o CPF do cadastro`;
        await AppDataSource.query(`UPDATE rh_holerite_lote_itens SET erro = $2, updated_at = NOW() WHERE id = $1`, [it.id, msg]);
        out.push({ ...base, erro: msg });
        continue;
      }
      try {
        const pdf = Buffer.from((await axios.get(it.arquivo_url, { responseType: 'arraybuffer', timeout: 30000 })).data);
        const fileName = `holerite_${String(it.tipo_nome || 'PAGAMENTO').replace(/[^\w]+/g, '_').toLowerCase()}_${it.competencia}.pdf`;
        const r = await PortalColaboradorService.publicarDocumento({
          colaboradorId: it.colaborador_id, competencia: it.competencia, buffer: pdf, fileName,
          tipoHoleriteId: it.tipo_id, tipoNome: it.tipo_nome, publicadoPor, baseUrl, enviarWhats,
        });
        await AppDataSource.query(
          `UPDATE rh_holerite_lote_itens SET status = 'publicado', aceite_id = $2, publicado_em = NOW(), erro = $3, updated_at = NOW() WHERE id = $1`,
          [it.id, r.aceite_id || null, r.erro || null]
        );
        out.push({ ...r, item_id: it.id });
      } catch (e: any) {
        await AppDataSource.query(`UPDATE rh_holerite_lote_itens SET erro = $2, updated_at = NOW() WHERE id = $1`, [it.id, e.message]);
        out.push({ ...base, erro: e.message });
      }
    }
    const [{ pendentes }] = await AppDataSource.query(`SELECT count(*)::int AS pendentes FROM rh_holerite_lote_itens WHERE lote_id = $1 AND status = 'pendente'`, [loteId]);
    await AppDataSource.query(`UPDATE rh_holerite_lotes SET status = $2, updated_at = NOW() WHERE id = $1`, [loteId, pendentes === 0 ? 'concluido' : 'classificando']);
    return out;
  }

  static async excluirLote(loteId: number) {
    // Só apaga o que ainda não virou documento do colaborador (itens publicados ficam na pasta dele)
    const itens = await AppDataSource.query(`SELECT arquivo_url FROM rh_holerite_lote_itens WHERE lote_id = $1`, [loteId]);
    const [lote] = await AppDataSource.query(`SELECT arquivo_url FROM rh_holerite_lotes WHERE id = $1`, [loteId]);
    await AppDataSource.query(`DELETE FROM rh_holerite_lotes WHERE id = $1`, [loteId]);
    for (const u of [...itens.map((i: any) => i.arquivo_url), lote?.arquivo_url].filter(Boolean)) {
      try { await minioService.deleteFile(minioService.extractFileNameFromUrl(u)); } catch { /* best effort */ }
    }
  }
}
