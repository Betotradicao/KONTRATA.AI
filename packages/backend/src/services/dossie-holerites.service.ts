import axios from 'axios';
import * as crypto from 'crypto';
import { PassThrough } from 'stream';
import { AppDataSource } from '../config/database';
import { anexarComprovante } from './comprovante-ciencia.service';

// archiver v7 é CommonJS sem tipos instalados
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');

/**
 * Dossiê pra processo: ZIP com tudo que prova entrega e ciência dos holerites de UM
 * colaborador — originais, versões com comprovante, trilha, resumo (com o SHA-256
 * RECONFERIDO na hora da exportação), termo de adesão e log de acessos ao portal.
 */

const sha256 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const fmt = (d: any) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
const csv = (rows: any[][]) => '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
const slug = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
const METODO: Record<string, string> = {
  cpf_senha: 'CPF + senha', cpf_senha_otp_whatsapp: 'CPF + senha + codigo WhatsApp',
  abertura_senha: 'Abertura do documento (apos aviso) - CPF + senha', abertura_otp_whatsapp: 'Abertura do documento (apos aviso) - CPF + senha + codigo WhatsApp',
};

async function baixar(url: string): Promise<Buffer | null> {
  try { return Buffer.from((await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })).data); }
  catch { return null; }
}

export async function gerarDossie(colaboradorId: number, geradoPor: string | null): Promise<{ stream: PassThrough; fileName: string }> {
  const [c] = await AppDataSource.query(
    `SELECT c.id, c.nome, c.cpf, c.matricula, c.status, c.data_admissao, c.data_desligamento,
            COALESCE(e.razao_social, e.nome_fantasia) AS empresa, e.cnpj
     FROM rh_colaboradores c LEFT JOIN rh_empresas e ON e.id = c.company_id WHERE c.id = $1`,
    [colaboradorId]
  );
  if (!c) throw new Error('Colaborador não encontrado');

  const aceites = await AppDataSource.query(
    `SELECT a.*, t.nome AS tipo_nome, d.arquivo_url, d.nome AS arquivo_nome
     FROM rh_documento_aceites a
     LEFT JOIN rh_tipos_holerite t ON t.id = a.tipo_holerite_id
     LEFT JOIN rh_documentos d ON d.id = a.documento_id
     WHERE a.colaborador_id = $1 AND a.status <> 'substituido'
     ORDER BY a.competencia, a.id`,
    [colaboradorId]
  );
  const termos = await AppDataSource.query(
    `SELECT d.nome, d.arquivo_url, d.uploaded_at FROM rh_documentos d
     JOIN rh_documento_pastas p ON p.id = d.pasta_id
     LEFT JOIN rh_documento_subpastas s ON s.id = d.subpasta_id
     WHERE p.colaborador_id = $1 AND (upper(s.nome) LIKE 'TERMO MEIO%' OR upper(d.nome) LIKE '%MEIO ELETR%' OR upper(d.nome) LIKE '%ADES%O%')`,
    [colaboradorId]
  );
  const acessos = await AppDataSource.query(
    `SELECT created_at, method, path, status_code, ip, user_agent FROM access_logs
     WHERE user_type = 'colaborador' AND user_name LIKE $1 ORDER BY created_at`,
    [`%(#${colaboradorId})`]
  );

  const zip = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  zip.pipe(stream);
  const base = `dossie_${slug(c.nome)}_${new Date().toISOString().slice(0, 10)}`;

  const resumo: any[][] = [['Competencia', 'Tipo', 'Status', 'Publicado em', 'Enviado WhatsApp em', 'Visualizado em', 'Ciente em', 'Metodo', 'IP da ciencia', 'Dispositivo', 'SHA-256 registrado', 'SHA-256 reconferido agora', 'Pasta no ZIP']];

  for (const a of aceites) {
    const pasta = `${a.competencia || 'sem_competencia'}_${slug(a.tipo_nome || 'PAGAMENTO')}_${a.id}`;
    const original = a.arquivo_url ? await baixar(a.arquivo_url) : null;
    let conferencia = 'ARQUIVO ORIGINAL INDISPONIVEL';
    if (original) {
      conferencia = sha256(original) === a.hash_sha256 ? 'OK - identico ao publicado' : 'DIVERGENTE';
      zip.append(original, { name: `${base}/${pasta}/1_original_${a.arquivo_nome || 'holerite.pdf'}` });
      if (a.status === 'aceito') {
        try { zip.append(await anexarComprovante(a.id, original), { name: `${base}/${pasta}/2_assinado_com_comprovante.pdf` }); }
        catch { /* original + trilha já provam */ }
      }
    }
    const eventos = await AppDataSource.query(
      `SELECT created_at, evento, ip, user_agent, detalhe FROM rh_documento_aceite_eventos WHERE aceite_id = $1 ORDER BY created_at`, [a.id]);
    zip.append(csv([['Data/hora', 'Evento', 'IP', 'Dispositivo', 'Detalhe'], ...eventos.map((e: any) => [fmt(e.created_at), e.evento, e.ip, e.user_agent, e.detalhe])]),
      { name: `${base}/${pasta}/3_trilha_de_eventos.csv` });
    resumo.push([a.competencia, a.tipo_nome || 'PAGAMENTO', a.status, fmt(a.created_at), fmt(a.enviado_em), fmt(a.visualizado_em), fmt(a.aceito_em),
      METODO[a.aceite_metodo] || a.aceite_metodo || '', a.aceite_ip, a.aceite_user_agent, a.hash_sha256, conferencia, pasta]);
  }
  zip.append(csv(resumo), { name: `${base}/resumo.csv` });

  let i = 0;
  for (const t of termos) {
    const b = t.arquivo_url ? await baixar(t.arquivo_url) : null;
    if (b) zip.append(b, { name: `${base}/termo_de_adesao/${++i}_${t.nome}` });
  }
  zip.append(csv([['Data/hora', 'Metodo', 'Caminho', 'HTTP', 'IP', 'Dispositivo'], ...acessos.map((x: any) => [fmt(x.created_at), x.method, x.path, x.status_code, x.ip, x.user_agent])]),
    { name: `${base}/acessos_ao_portal.csv` });

  const cpf = String(c.cpf || '').replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const leia = [
    'DOSSIE DE ENTREGA E CIENCIA DE HOLERITES - PORTAL DO COLABORADOR',
    '================================================================',
    '',
    `Colaborador: ${c.nome}`,
    `CPF: ${cpf}${c.matricula ? `    Matricula: ${c.matricula}` : ''}`,
    `Empresa: ${c.empresa || ''}${c.cnpj ? `    CNPJ: ${c.cnpj}` : ''}`,
    `Admissao: ${c.data_admissao ? new Date(c.data_admissao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}    Desligamento: ${c.data_desligamento ? new Date(c.data_desligamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}`,
    `Gerado em: ${fmt(new Date())}${geradoPor ? ` por ${geradoPor}` : ''}`,
    `Documentos: ${aceites.length}    Com ciencia: ${aceites.filter((a: any) => a.status === 'aceito').length}`,
    '',
    'CONTEUDO',
    '- resumo.csv: uma linha por holerite, com datas, metodo de autenticacao, IP e o',
    '  codigo SHA-256. A coluna "SHA-256 reconferido agora" foi recalculada no momento',
    '  desta exportacao a partir do arquivo guardado.',
    '- Uma pasta por holerite:',
    '    1_original_*.pdf              arquivo exatamente como foi publicado ao colaborador',
    '    2_assinado_com_comprovante    o mesmo documento + pagina "Comprovante de Ciencia Eletronica"',
    '    3_trilha_de_eventos.csv       publicado, codigo enviado, visualizado, ciente (data, IP, dispositivo)',
    '- termo_de_adesao/: termo de adesao ao meio eletronico assinado (se anexado ao cadastro).',
    '- acessos_ao_portal.csv: cada acesso do colaborador ao portal (data, IP, dispositivo).',
    '',
    'COMO CONFERIR A INTEGRIDADE (sem precisar do sistema)',
    'O SHA-256 e a "impressao digital" do arquivo: qualquer alteracao, por menor que seja,',
    'gera outro codigo. Calcule o SHA-256 do arquivo "1_original_*.pdf" e compare com o',
    'codigo do resumo.csv e da pagina de comprovante:',
    '  Windows:  certutil -hashfile "1_original_holerite.pdf" SHA256',
    '  Linux/Mac: sha256sum "1_original_holerite.pdf"',
    '',
    'BASE LEGAL',
    '- MP 2.200-2/2001, art. 10, par. 2: validade de assinatura eletronica fora da ICP-Brasil',
    '  quando admitida pelas partes (termo de adesao).',
    '- Lei 14.063/2020: assinatura eletronica simples (CPF + senha) e avancada',
    '  (CPF + senha + codigo enviado ao celular do titular).',
    '- CLT art. 464, par. unico: o comprovante de deposito bancario tem forca de recibo.',
    '',
    'Gerado por Kontrata.ai.',
  ].join('\r\n');
  zip.append(leia, { name: `${base}/LEIA-ME.txt` });
  zip.finalize();
  return { stream, fileName: `${base}.zip` };
}
