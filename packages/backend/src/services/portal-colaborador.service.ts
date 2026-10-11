import axios from 'axios';
import * as crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';
import { minioService } from './minio.service';
import { replicarTemplateNoColaborador } from './doc-template.service';
import { gerarHoleritePdf } from './holerite.service';

/**
 * Portal do Colaborador — publicação de documento (holerite) com ciência.
 * Fluxo: PDF (importado da contabilidade ou gerado aqui) → SHA-256 → MinIO (pasta
 * HOLERITES do colaborador) → rh_documentos → rh_documento_aceites (pendente)
 * → WhatsApp (link do portal + PDF anexo).
 * Decisões e porquês em obsidian-vault/modulos/portal-colaborador.md.
 */

const SETUP_TOKEN_HORAS = 72;

export const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');

// Mesmo padrão dos *-whats.service.ts: credenciais por cliente em `configurations`
async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

/** "(12) 99689-6418" → "5512996896418". Devolve null se não parecer celular BR. */
export function normalizarCelular(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}

/** "12988426869" → "(12) *****-6869" */
export function mascararCelular(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length >= 10 ? `(${d.slice(0, 2)}) *****-${d.slice(-4)}` : '—';
}

export interface ResultadoPublicacao {
  colaborador_id: number;
  nome: string;
  aceite_id?: number;
  publicado: boolean;
  whats: 'enviado' | 'sem_celular' | 'falhou' | 'nao_enviado';
  link?: string;
  erro?: string;
}

export interface DocumentoParaPublicar {
  colaboradorId: number;
  competencia: string;        // YYYY-MM
  buffer: Buffer;
  fileName: string;
  tipoHoleriteId?: number | null;
  tipoNome?: string;          // "PAGAMENTO", "FÉRIAS"... (vai na mensagem)
  publicadoPor?: string | null;
  baseUrl: string;
  enviarWhats: boolean;
}

export class PortalColaboradorService {
  /**
   * Quem pode entrar no portal. Decisão do Beto (11/10/2026): desligado continua
   * acessando por N dias após data_desligamento (padrão 150 = 5 meses — LGPD art. 18: acesso aos
   * próprios dados; baixar holerites/rescisão). Bloqueio manual (acessos.ativo=false)
   * vale por cima de tudo. Checado no login E em toda requisição do portal.
   */
  static async podeAcessar(colaboradorId: number): Promise<{ ok: boolean; motivo?: string; acesso_ate?: string | null }> {
    const dias = Math.max(0, parseInt(String(await ConfigurationService.get('portal_dias_acesso_desligado', '150')), 10) || 0);
    const [r] = await AppDataSource.query(
      `SELECT c.status, c.data_desligamento, ac.ativo,
              (c.data_desligamento + ($2::int * interval '1 day'))::date AS acesso_ate
       FROM rh_colaboradores c LEFT JOIN rh_colaborador_acessos ac ON ac.colaborador_id = c.id WHERE c.id = $1`,
      [colaboradorId, dias]
    );
    if (!r) return { ok: false, motivo: 'Cadastro não encontrado.' };
    if (r.ativo === false) return { ok: false, motivo: 'Acesso bloqueado pelo RH. Procure o RH.' };
    if (r.status === 'ativo') return { ok: true, acesso_ate: null };
    if (!r.data_desligamento || dias === 0) return { ok: false, motivo: 'Acesso encerrado. Procure o RH.' };
    const ate = new Date(r.acesso_ate);
    ate.setHours(23, 59, 59);
    if (ate < new Date()) return { ok: false, motivo: 'O prazo de acesso após o desligamento terminou. Procure o RH.' };
    return { ok: true, acesso_ate: r.acesso_ate };
  }

  static async registrarEvento(aceiteId: number, evento: string, extra: { ip?: string; user_agent?: string; detalhe?: string } = {}) {
    await AppDataSource.query(
      `INSERT INTO rh_documento_aceite_eventos (aceite_id, evento, ip, user_agent, detalhe) VALUES ($1, $2, $3, $4, $5)`,
      [aceiteId, evento, extra.ip || null, extra.user_agent || null, extra.detalhe || null]
    );
  }

  /** Garante a pasta HOLERITES do colaborador (replica o template se faltar). */
  private static async pastaHolerites(colaboradorId: number): Promise<number> {
    const q = `SELECT id FROM rh_documento_pastas WHERE colaborador_id = $1 AND upper(nome) = 'HOLERITES' LIMIT 1`;
    let [p] = await AppDataSource.query(q, [colaboradorId]);
    if (!p) {
      await replicarTemplateNoColaborador(colaboradorId);
      [p] = await AppDataSource.query(q, [colaboradorId]);
    }
    if (!p) {
      [p] = await AppDataSource.query(
        `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida) VALUES ($1, 'HOLERITES', 2, true)
         ON CONFLICT (colaborador_id, nome) DO UPDATE SET protegida = true RETURNING id`,
        [colaboradorId]
      );
    }
    return p.id;
  }

  /**
   * Garante que o colaborador tem como entrar no portal. Sem senha ainda → gera
   * (ou renova) o token de primeiro acesso e devolve o link pra criar a senha.
   * Com senha → link fixo do portal.
   */
  static async garantirAcesso(colaboradorId: number, baseUrl: string, forcarNovoToken = false): Promise<{ link: string; primeiroAcesso: boolean }> {
    const [ac] = await AppDataSource.query(
      `SELECT id, senha_hash, setup_token, setup_expira_em, setup_usado_em FROM rh_colaborador_acessos WHERE colaborador_id = $1`,
      [colaboradorId]
    );
    const temSenha = !!ac?.senha_hash;
    if (temSenha && !forcarNovoToken) return { link: `${baseUrl}/portal`, primeiroAcesso: false };

    const tokenValido = ac?.setup_token && !ac.setup_usado_em && ac.setup_expira_em && new Date(ac.setup_expira_em) > new Date();
    let token = tokenValido && !forcarNovoToken ? ac.setup_token : null;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      const expira = new Date(Date.now() + SETUP_TOKEN_HORAS * 3600 * 1000);
      await AppDataSource.query(
        `INSERT INTO rh_colaborador_acessos (colaborador_id, setup_token, setup_expira_em, setup_usado_em)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (colaborador_id) DO UPDATE
           SET setup_token = EXCLUDED.setup_token, setup_expira_em = EXCLUDED.setup_expira_em,
               setup_usado_em = NULL, ativo = true, updated_at = NOW()`,
        [colaboradorId, token, expira]
      );
    }
    return { link: `${baseUrl}/portal/primeiro-acesso/${token}`, primeiroAcesso: true };
  }

  private static async enviarWhats(numero: string, texto: string, pdf: Buffer | null, fileName: string) {
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API não configurada (URL, Token e Instância).');
    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    await axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`, { number: numero, text: texto }, { headers, timeout: 20000 });
    if (pdf) {
      await axios.post(`${base}/message/sendMedia/${encodeURIComponent(instance)}`,
        { number: numero, mediatype: 'document', mimetype: 'application/pdf', media: pdf.toString('base64'), fileName, caption: '' },
        { headers, timeout: 60000 });
    }
  }

  private static mensagem(nome: string, competencia: string, tipoNome: string, empresa: string, link: string, primeiroAcesso: boolean, anexo: boolean): string {
    const [y, m] = competencia.split('-');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const comp = `${meses[parseInt(m) - 1] || m}/${y}`;
    const primeiro = nome.split(' ')[0];
    const tipo = tipoNome && tipoNome.toUpperCase() !== 'PAGAMENTO' ? ` (${tipoNome.toLowerCase()})` : '';
    let msg = `Olá, *${primeiro}*! 👋\n\nSeu holerite${tipo} de *${comp}* já está disponível${empresa ? ` — ${empresa}` : ''}.\n\n`;
    if (primeiroAcesso) {
      msg += `🔐 *Primeiro acesso:* crie sua senha pelo link abaixo (vale ${SETUP_TOKEN_HORAS}h). Depois é só entrar com seu CPF e senha.\n${link}\n\n`;
    } else {
      msg += `🔐 Acesse o *Portal do Colaborador* com seu CPF e senha:\n${link}\n\n`;
    }
    msg += anexo
      ? `📄 O PDF segue em anexo. No portal, confira e toque em *"Ciente / Recebi"* pra registrar o recebimento.\n\n_Mensagem automática — Kontrata.ai_`
      : `📄 O holerite fica disponível *dentro do portal*: entre, abra o PDF e toque em *"Ciente / Recebi"* pra registrar o recebimento.\n\n_Mensagem automática — Kontrata.ai_`;
    return msg;
  }

  /**
   * Publica UM documento pro colaborador. Republicar a mesma competência+tipo marca o
   * aceite anterior como 'substituido' (mantém histórico; documento antigo fica na pasta).
   */
  static async publicarDocumento(d: DocumentoParaPublicar): Promise<ResultadoPublicacao> {
    const r: ResultadoPublicacao = { colaborador_id: d.colaboradorId, nome: '', publicado: false, whats: 'nao_enviado' };
    const [colab] = await AppDataSource.query(
      `SELECT c.id, c.nome, c.celular, c.status, COALESCE(e.apelido, e.nome_fantasia, e.razao_social, '') AS empresa
       FROM rh_colaboradores c LEFT JOIN rh_empresas e ON e.id = c.company_id WHERE c.id = $1`,
      [d.colaboradorId]
    );
    if (!colab) throw new Error('Colaborador não encontrado');
    r.nome = colab.nome;

    const hash = sha256(d.buffer);
    const pastaId = await this.pastaHolerites(d.colaboradorId);
    const objectName = `rh/documentos/${pastaId}/holerite_${d.competencia}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.pdf`;
    const url = await minioService.uploadFile(objectName, d.buffer, 'application/pdf');
    const tipoTxt = d.tipoNome ? ` ${d.tipoNome}` : '';
    const [doc] = await AppDataSource.query(
      `INSERT INTO rh_documentos (pasta_id, nome, arquivo_url, mime_type, tamanho_bytes, observacao)
       VALUES ($1, $2, $3, 'application/pdf', $4, $5) RETURNING id`,
      [pastaId, d.fileName, url, d.buffer.length, `Holerite${tipoTxt} ${d.competencia} publicado no Portal do Colaborador · SHA-256 ${hash}`]
    );

    await AppDataSource.query(
      `UPDATE rh_documento_aceites SET status = 'substituido', updated_at = NOW()
       WHERE colaborador_id = $1 AND tipo = 'HOLERITE' AND competencia = $2
         AND COALESCE(tipo_holerite_id, 0) = COALESCE($3, 0) AND status IN ('pendente', 'visualizado')`,
      [d.colaboradorId, d.competencia, d.tipoHoleriteId || null]
    );
    const [aceite] = await AppDataSource.query(
      `INSERT INTO rh_documento_aceites (documento_id, colaborador_id, tipo, tipo_holerite_id, competencia, hash_sha256, status, publicado_por)
       VALUES ($1, $2, 'HOLERITE', $3, $4, $5, 'pendente', $6) RETURNING id`,
      [doc.id, d.colaboradorId, d.tipoHoleriteId || null, d.competencia, hash, d.publicadoPor || null]
    );
    r.aceite_id = aceite.id;
    r.publicado = true;
    await this.registrarEvento(aceite.id, 'publicado', { detalhe: `doc ${doc.id} · ${d.fileName}` });

    const acesso = await this.garantirAcesso(d.colaboradorId, d.baseUrl);
    r.link = acesso.link;

    if (d.enviarWhats) {
      await this.dispararAceite(aceite.id, r, d.buffer, d.fileName, colab.celular, d.competencia, d.tipoNome || '', colab.empresa, acesso);
    }
    return r;
  }

  /** Atalho: holerite gerado pelo nosso rh-folha (quando o cliente usar a Folha do sistema). */
  static async publicarGerado(competencia: string, colaboradorIds: number[], baseUrl: string, publicadoPor: string | null, enviarWhats = true): Promise<ResultadoPublicacao[]> {
    const out: ResultadoPublicacao[] = [];
    for (const colaboradorId of colaboradorIds) {
      try {
        const h = await gerarHoleritePdf(colaboradorId, competencia);
        out.push(await this.publicarDocumento({ colaboradorId, competencia, buffer: h.buffer, fileName: h.fileName, tipoNome: 'PAGAMENTO', publicadoPor, baseUrl, enviarWhats }));
      } catch (e: any) {
        out.push({ colaborador_id: colaboradorId, nome: '', publicado: false, whats: 'nao_enviado', erro: e.message });
      }
    }
    return out;
  }

  private static async dispararAceite(aceiteId: number, r: ResultadoPublicacao, pdf: Buffer, fileName: string, celularRaw: string | null, competencia: string, tipoNome: string, empresa: string, acesso: { link: string; primeiroAcesso: boolean }) {
    const numero = normalizarCelular(celularRaw);
    if (!numero) { r.whats = 'sem_celular'; await this.registrarEvento(aceiteId, 'whats_falhou', { detalhe: 'colaborador sem celular válido' }); return; }
    // Decisão do Beto (11/10/2026): o holerite fica SÓ dentro do portal — assim o colaborador precisa
    // entrar pra ver e a ciência fica registrada. Anexar no WhatsApp é opção desligada (config).
    const anexar = String(await ConfigurationService.get('portal_whats_anexar_pdf', 'false')).toLowerCase() === 'true';
    try {
      await this.enviarWhats(numero, this.mensagem(r.nome, competencia, tipoNome, empresa, acesso.link, acesso.primeiroAcesso, anexar), anexar ? pdf : null, fileName);
      await AppDataSource.query(`UPDATE rh_documento_aceites SET enviado_em = NOW(), enviado_para = $2, updated_at = NOW() WHERE id = $1`, [aceiteId, numero]);
      await this.registrarEvento(aceiteId, 'whats_enviado', { detalhe: numero });
      r.whats = 'enviado';
    } catch (e: any) {
      r.whats = 'falhou';
      r.erro = `WhatsApp: ${e.response?.data?.message || e.response?.data?.error || e.message}`;
      await this.registrarEvento(aceiteId, 'whats_falhou', { detalhe: r.erro });
    }
  }

  /**
   * Código de 6 dígitos pra dar ciência (assinatura avançada). Vale 10 min, só pro
   * documento `aceiteId`. Se não dá pra enviar (sem celular / WhatsApp fora), marca
   * otp_falhou_aceite_id e o controller libera a ciência simples pra esse documento.
   */
  static async enviarCodigoCiencia(colaboradorId: number, aceiteId: number): Promise<{ enviado: boolean; para?: string; motivo?: string; aguarde?: number }> {
    const [c] = await AppDataSource.query(
      `SELECT c.nome, c.celular, ac.otp_enviado_em, ac.otp_aceite_id FROM rh_colaboradores c
       LEFT JOIN rh_colaborador_acessos ac ON ac.colaborador_id = c.id WHERE c.id = $1`,
      [colaboradorId]
    );
    if (!c) throw new Error('Colaborador não encontrado');
    // anti-spam: 1 código por minuto pro mesmo documento
    if (c.otp_aceite_id === aceiteId && c.otp_enviado_em) {
      const passou = (Date.now() - new Date(c.otp_enviado_em).getTime()) / 1000;
      if (passou < 60) return { enviado: true, para: mascararCelular(c.celular), aguarde: Math.ceil(60 - passou) };
    }
    const falhou = async (motivo: string) => {
      await AppDataSource.query(`UPDATE rh_colaborador_acessos SET otp_falhou_aceite_id = $2, updated_at = NOW() WHERE colaborador_id = $1`, [colaboradorId, aceiteId]);
      await this.registrarEvento(aceiteId, 'codigo_falhou', { detalhe: motivo });
      return { enviado: false, motivo };
    };
    const numero = normalizarCelular(c.celular);
    if (!numero) return falhou('sem celular cadastrado');
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const primeiro = String(c.nome || '').split(' ')[0];
    try {
      await this.enviarWhats(numero, `🔐 *${codigo}* é o seu código pra confirmar o recebimento do holerite no Portal do Colaborador.\n\nVale 10 minutos. Não compartilhe com ninguém — nem com o RH.\n\n_${primeiro}, se não foi você que pediu, ignore esta mensagem._`, null, '');
    } catch (e: any) {
      return falhou(`WhatsApp: ${e.response?.data?.message || e.message}`);
    }
    await AppDataSource.query(
      `UPDATE rh_colaborador_acessos SET otp_hash = $2, otp_expira_em = NOW() + interval '10 minutes', otp_tentativas = 0,
              otp_aceite_id = $3, otp_enviado_em = NOW(), otp_falhou_aceite_id = NULL, updated_at = NOW() WHERE colaborador_id = $1`,
      [colaboradorId, sha256(codigo), aceiteId]
    );
    await this.registrarEvento(aceiteId, 'codigo_enviado', { detalhe: mascararCelular(c.celular) });
    return { enviado: true, para: mascararCelular(c.celular) };
  }

  /** Manda só o link de acesso ao portal (1º acesso ou login) no WhatsApp do colaborador — sem holerite. */
  static async enviarLinkAcesso(colaboradorId: number, baseUrl: string, forcarNovoToken = false): Promise<{ link: string; primeiroAcesso: boolean; whats: 'enviado' | 'sem_celular' | 'falhou'; erro?: string }> {
    const [c] = await AppDataSource.query(
      `SELECT c.nome, c.celular, COALESCE(e.apelido, e.nome_fantasia, e.razao_social, '') AS empresa
       FROM rh_colaboradores c LEFT JOIN rh_empresas e ON e.id = c.company_id WHERE c.id = $1`,
      [colaboradorId]
    );
    if (!c) throw new Error('Colaborador não encontrado');
    const acesso = await this.garantirAcesso(colaboradorId, baseUrl, forcarNovoToken);
    const numero = normalizarCelular(c.celular);
    if (!numero) return { ...acesso, whats: 'sem_celular' };
    const primeiro = String(c.nome || '').split(' ')[0];
    const texto = acesso.primeiroAcesso
      ? `Olá, *${primeiro}*! 👋\n\nSeu acesso ao *Portal do Colaborador*${c.empresa ? ` (${c.empresa})` : ''} está pronto.\n\n🔐 *Primeiro acesso:* confirme seu CPF e crie sua senha pelo link abaixo (vale ${SETUP_TOKEN_HORAS}h):\n${acesso.link}\n\nDepois é só entrar com CPF e senha. Lá ficam seus holerites e documentos.\n\n_Mensagem automática — Kontrata.ai_`
      : `Olá, *${primeiro}*! 👋\n\nEste é o link do seu *Portal do Colaborador*${c.empresa ? ` (${c.empresa})` : ''}. Entre com seu CPF e senha:\n${acesso.link}\n\n_Mensagem automática — Kontrata.ai_`;
    try {
      await this.enviarWhats(numero, texto, null, '');
      return { ...acesso, whats: 'enviado' };
    } catch (e: any) {
      return { ...acesso, whats: 'falhou', erro: `WhatsApp: ${e.response?.data?.message || e.response?.data?.error || e.message}` };
    }
  }

  /** Reenvia o WhatsApp de um aceite já publicado (baixa o PDF do MinIO de novo). */
  static async reenviar(aceiteId: number, baseUrl: string): Promise<ResultadoPublicacao> {
    const [a] = await AppDataSource.query(
      `SELECT a.id, a.colaborador_id, a.competencia, d.arquivo_url, d.nome AS file_name, c.nome, c.celular,
              t.nome AS tipo_nome, COALESCE(e.apelido, e.nome_fantasia, e.razao_social, '') AS empresa
       FROM rh_documento_aceites a
       JOIN rh_colaboradores c ON c.id = a.colaborador_id
       LEFT JOIN rh_empresas e ON e.id = c.company_id
       LEFT JOIN rh_documentos d ON d.id = a.documento_id
       LEFT JOIN rh_tipos_holerite t ON t.id = a.tipo_holerite_id
       WHERE a.id = $1`,
      [aceiteId]
    );
    if (!a) throw new Error('Publicação não encontrada');
    if (!a.arquivo_url) throw new Error('Documento do holerite não existe mais');
    const r: ResultadoPublicacao = { colaborador_id: a.colaborador_id, nome: a.nome, aceite_id: a.id, publicado: true, whats: 'nao_enviado' };
    const pdf = Buffer.from((await axios.get(a.arquivo_url, { responseType: 'arraybuffer', timeout: 30000 })).data);
    const acesso = await this.garantirAcesso(a.colaborador_id, baseUrl);
    r.link = acesso.link;
    await this.registrarEvento(a.id, 'reenviado');
    await this.dispararAceite(a.id, r, pdf, a.file_name || `holerite_${a.competencia}.pdf`, a.celular, a.competencia, a.tipo_nome || '', a.empresa, acesso);
    return r;
  }

  static async listarPublicacoes(competencia?: string, colaboradorId?: number) {
    const where: string[] = ["a.status <> 'substituido'"];
    const params: any[] = [];
    if (competencia) { params.push(competencia); where.push(`a.competencia = $${params.length}`); }
    if (colaboradorId) { params.push(colaboradorId); where.push(`a.colaborador_id = $${params.length}`); }
    return AppDataSource.query(
      `SELECT a.id, a.colaborador_id, c.nome, c.matricula, c.celular, a.tipo, t.nome AS tipo_nome, a.competencia, a.status,
              a.enviado_em, a.enviado_para, a.visualizado_em, a.aceito_em, a.aceite_ip, a.aceite_metodo,
              a.hash_sha256, a.created_at, a.publicado_por, d.nome AS arquivo_nome,
              (ac.senha_hash IS NOT NULL) AS tem_senha,
              (ac.setup_token IS NOT NULL AND ac.setup_usado_em IS NULL AND ac.setup_expira_em > NOW()) AS setup_pendente
       FROM rh_documento_aceites a
       JOIN rh_colaboradores c ON c.id = a.colaborador_id
       LEFT JOIN rh_documentos d ON d.id = a.documento_id
       LEFT JOIN rh_tipos_holerite t ON t.id = a.tipo_holerite_id
       LEFT JOIN rh_colaborador_acessos ac ON ac.colaborador_id = a.colaborador_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.competencia DESC, c.nome`,
      params
    );
  }

  static async eventos(aceiteId: number) {
    return AppDataSource.query(
      `SELECT evento, ip, user_agent, detalhe, created_at FROM rh_documento_aceite_eventos WHERE aceite_id = $1 ORDER BY created_at`,
      [aceiteId]
    );
  }
}
