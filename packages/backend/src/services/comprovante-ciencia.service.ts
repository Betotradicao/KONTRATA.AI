import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { minioService } from './minio.service';

/**
 * Comprovante de ciência eletrônica: anexa ao final do PDF do holerite uma página
 * com a trilha de auditoria (quem, quando, de onde, como, e o SHA-256 do documento
 * ORIGINAL). O hash impresso é o do arquivo publicado — anexar esta página muda o
 * arquivo, por isso o texto deixa claro a qual documento o hash se refere.
 */

const fmt = (d: any) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
const fmtCpf = (v: string | null) => { const d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v || '—'); };
const METODO: Record<string, string> = {
  cpf_senha: 'Login pessoal (CPF + senha) — assinatura eletrônica simples',
  cpf_senha_otp_whatsapp: 'Login pessoal (CPF + senha) + código de 6 dígitos enviado ao WhatsApp do colaborador — assinatura eletrônica avançada (2 fatores)',
  abertura_otp_whatsapp: 'Ciência registrada na ABERTURA do documento, após aviso expresso de que abrir equivale a confirmar o recebimento. Login pessoal (CPF + senha) + código de 6 dígitos enviado ao WhatsApp do colaborador — assinatura eletrônica avançada (2 fatores)',
  abertura_senha: 'Ciência registrada na ABERTURA do documento, após aviso expresso de que abrir equivale a confirmar o recebimento. Login pessoal (CPF + senha) — assinatura eletrônica simples',
  visualizacao_otp_whatsapp: 'Documento ABERTO pelo colaborador com login pessoal (CPF + senha) + código de 6 dígitos enviado ao seu WhatsApp, em data anterior ao aviso de que abrir equivale a confirmar. Ciência convertida por decisão do RH em 24/10/2026; data/hora, IP e dispositivo são os da abertura original.',
  visualizacao_senha: 'Documento ABERTO pelo colaborador com login pessoal (CPF + senha), em data anterior ao aviso de que abrir equivale a confirmar. Ciência convertida por decisão do RH em 24/10/2026; data/hora, IP e dispositivo são os da abertura original.',
};

// Helvetica padrão do pdf-lib é WinAnsi: tira o que não cabe (emoji etc.)
const safe = (s: any) => String(s ?? '').replace(/[^\x20-\x7E -ÿ]/g, '');

/**
 * Grava na pasta do colaborador (mesma pasta do original) o PDF assinado:
 * holerite + página do comprovante. Idempotente (não duplica). Falha aqui NÃO
 * desfaz a ciência — é só a cópia de conveniência pro RH.
 */
export async function salvarVersaoAssinada(aceiteId: number): Promise<number | null> {
  const [a] = await AppDataSource.query(
    `SELECT a.id, a.status, a.documento_assinado_id, a.hash_sha256, d.id AS doc_id, d.pasta_id, d.arquivo_url, d.nome
     FROM rh_documento_aceites a JOIN rh_documentos d ON d.id = a.documento_id WHERE a.id = $1`,
    [aceiteId]
  );
  if (!a || a.status !== 'aceito' || !a.arquivo_url) return null;
  if (a.documento_assinado_id) return a.documento_assinado_id;
  const original = Buffer.from((await axios.get(a.arquivo_url, { responseType: 'arraybuffer', timeout: 30000 })).data);
  const assinado = await anexarComprovante(aceiteId, original);
  const nome = String(a.nome || 'holerite.pdf').replace(/\.pdf$/i, '') + '_ASSINADO.pdf';
  const url = await minioService.uploadFile(`rh/documentos/${a.pasta_id}/${nome.replace(/\.pdf$/i, '').replace(/[^\w.-]+/g, '_')}_${Date.now()}.pdf`, assinado, 'application/pdf');
  const [doc] = await AppDataSource.query(
    `INSERT INTO rh_documentos (pasta_id, nome, arquivo_url, mime_type, tamanho_bytes, observacao)
     VALUES ($1, $2, $3, 'application/pdf', $4, $5) RETURNING id`,
    [a.pasta_id, nome, url, assinado.length, `✅ Assinado no Portal do Colaborador (ciência eletrônica). Original: documento ${a.doc_id} · SHA-256 ${a.hash_sha256}`]
  );
  await AppDataSource.query(`UPDATE rh_documento_aceites SET documento_assinado_id = $2, updated_at = NOW() WHERE id = $1`, [aceiteId, doc.id]);
  await AppDataSource.query(
    `UPDATE rh_documentos SET observacao = COALESCE(observacao, '') || ' · (original — versão assinada: documento ' || $2 || ')' WHERE id = $1`,
    [a.doc_id, doc.id]
  );
  return doc.id;
}

export async function anexarComprovante(aceiteId: number, original: Buffer): Promise<Buffer> {
  const [a] = await AppDataSource.query(
    `SELECT a.*, c.nome, c.cpf, c.matricula, t.nome AS tipo_nome,
            COALESCE(e.razao_social, e.nome_fantasia) AS empresa, e.cnpj
     FROM rh_documento_aceites a
     JOIN rh_colaboradores c ON c.id = a.colaborador_id
     LEFT JOIN rh_empresas e ON e.id = c.company_id
     LEFT JOIN rh_tipos_holerite t ON t.id = a.tipo_holerite_id
     WHERE a.id = $1`,
    [aceiteId]
  );
  if (!a || a.status !== 'aceito') return original;
  const eventos = await AppDataSource.query(
    `SELECT evento, ip, detalhe, created_at FROM rh_documento_aceite_eventos WHERE aceite_id = $1 ORDER BY created_at`, [aceiteId]);

  const pdf = await PDFDocument.load(original);
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const roxo = rgb(0.24, 0.11, 0.49);
  let y = 790;
  const L = 50;
  const txt = (s: string, opt: { b?: boolean; size?: number; color?: any; x?: number } = {}) => {
    page.drawText(safe(s), { x: opt.x ?? L, y, size: opt.size ?? 10, font: opt.b ? bold : font, color: opt.color ?? rgb(0, 0, 0) });
  };
  const linha = (rotulo: string, valor: string) => {
    txt(rotulo, { b: true, size: 9, color: rgb(0.35, 0.35, 0.35) });
    // quebra valores longos (hash, user-agent, método)
    const max = 78;
    const partes = safe(valor).match(new RegExp(`.{1,${max}}(\\s|$)|.{1,${max}}`, 'g')) || ['—'];
    for (const p of partes) { page.drawText(p.trim(), { x: L + 150, y, size: 9, font }); y -= 13; }
    y -= 3;
  };

  page.drawRectangle({ x: 0, y: 800, width: 595.28, height: 42, color: roxo });
  page.drawText('COMPROVANTE DE CIÊNCIA ELETRÔNICA', { x: L, y: 815, size: 15, font: bold, color: rgb(1, 1, 1) });
  y = 770;
  txt('Este comprovante integra o documento acima e registra o recebimento e a ciência pelo colaborador,', { size: 9 }); y -= 12;
  txt('por meio do Portal do Colaborador (MP 2.200-2/2001, art. 10, § 2º; Lei 14.063/2020; CLT art. 464, par. único).', { size: 9 }); y -= 26;

  txt('DOCUMENTO', { b: true, color: roxo }); y -= 18;
  linha('Tipo', `Holerite — ${a.tipo_nome || 'PAGAMENTO'}`);
  linha('Competência', String(a.competencia || '—').split('-').reverse().join('/'));
  linha('Empresa', `${a.empresa || '—'}${a.cnpj ? ` — CNPJ ${a.cnpj}` : ''}`);
  linha('Código de verificação', `SHA-256 ${a.hash_sha256}`);
  linha('', '(impressão digital do arquivo publicado, sem esta página; qualquer alteração no documento gera outro código)');
  y -= 6;
  txt('COLABORADOR', { b: true, color: roxo }); y -= 18;
  linha('Nome', a.nome);
  linha('CPF', fmtCpf(a.cpf));
  if (a.matricula) linha('Matrícula', a.matricula);
  y -= 6;
  txt('CIÊNCIA', { b: true, color: roxo }); y -= 18;
  linha('Publicado em', fmt(a.created_at));
  linha('Visualizado em', fmt(a.visualizado_em));
  linha('Ciente em', fmt(a.aceito_em));
  linha('Método de autenticação', METODO[a.aceite_metodo] || a.aceite_metodo || '—');
  linha('Endereço IP', a.aceite_ip || '—');
  linha('Dispositivo / navegador', a.aceite_user_agent || '—');
  y -= 6;
  txt('TRILHA DE EVENTOS', { b: true, color: roxo }); y -= 16;
  for (const e of eventos) {
    if (y < 70) break;
    page.drawText(safe(`${fmt(e.created_at)}  ·  ${e.evento}${e.ip ? `  ·  IP ${e.ip}` : ''}${e.detalhe ? `  ·  ${String(e.detalhe).slice(0, 60)}` : ''}`), { x: L, y, size: 8, font });
    y -= 11;
  }
  page.drawText(safe(`Gerado em ${fmt(new Date())} · Kontrata.ai · registro nº ${a.id}`), { x: L, y: 40, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  return Buffer.from(await pdf.save());
}
