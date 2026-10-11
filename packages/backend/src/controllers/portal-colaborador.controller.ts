import { Request, Response } from 'express';
import axios from 'axios';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { PortalColaboradorService } from '../services/portal-colaborador.service';

/**
 * Portal do Colaborador (/api/portal) — lado do COLABORADOR.
 * Login por CPF + senha; JWT type 'colaborador' (7 dias). O que ele vê: só os
 * próprios documentos publicados. A ciência grava IP/user-agent/hash (trilha).
 */

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MIN = 15;

// Mesma política dos usuários do painel (employees.controller.ts)
const SENHA_FORTE = (s: string) => s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(s);
const SENHA_MSG = 'Senha deve ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial';

// Mesmo helper do lgpd.controller (trust proxy não está setado no app)
function getIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.ip || req.socket?.remoteAddress || '';
}

const cpfDigits = (v: any) => String(v || '').replace(/\D/g, '');

export class PortalColaboradorController {
  // ---------- públicos ----------
  static async login(req: Request, res: Response) {
    try {
      const cpf = cpfDigits(req.body?.cpf);
      const senha = String(req.body?.senha || '');
      if (cpf.length !== 11 || !senha) return res.status(400).json({ error: 'Informe CPF e senha' });

      const [row] = await AppDataSource.query(
        `SELECT c.id, c.nome, c.status, ac.senha_hash, ac.tentativas, ac.bloqueado_ate, ac.ativo
         FROM rh_colaboradores c LEFT JOIN rh_colaborador_acessos ac ON ac.colaborador_id = c.id
         WHERE regexp_replace(COALESCE(c.cpf,''), '\\D', '', 'g') = $1
         ORDER BY (c.status = 'ativo') DESC, c.id DESC LIMIT 1`,
        [cpf]
      );
      const generico = { error: 'CPF ou senha inválidos' };
      if (!row || !row.senha_hash) return res.status(401).json(row ? { error: 'Você ainda não criou sua senha. Use o link de primeiro acesso enviado pelo RH.' } : generico);
      if (row.ativo === false || row.status !== 'ativo') return res.status(403).json({ error: 'Acesso desativado. Procure o RH.' });
      if (row.bloqueado_ate && new Date(row.bloqueado_ate) > new Date()) {
        return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${BLOQUEIO_MIN} minutos.` });
      }
      const ok = await bcrypt.compare(senha, row.senha_hash);
      if (!ok) {
        const t = (row.tentativas || 0) + 1;
        const bloqueadoAte = t >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MIN * 60 * 1000) : null;
        await AppDataSource.query(
          `UPDATE rh_colaborador_acessos SET tentativas = $2::int, bloqueado_ate = $3::timestamptz, updated_at = NOW() WHERE colaborador_id = $1`,
          [row.id, t, bloqueadoAte]
        );
        return res.status(401).json(generico);
      }
      await AppDataSource.query(`UPDATE rh_colaborador_acessos SET tentativas = 0, bloqueado_ate = NULL, ultimo_login = NOW(), updated_at = NOW() WHERE colaborador_id = $1`, [row.id]);
      const token = jwt.sign({ id: row.id, nome: row.nome, type: 'colaborador' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, colaborador: { id: row.id, nome: row.nome } });
    } catch (e: any) {
      console.error('[Portal] login:', e);
      return res.status(500).json({ error: 'Erro ao entrar' });
    }
  }

  static async getSetup(req: Request, res: Response) {
    try {
      const [row] = await AppDataSource.query(
        `SELECT c.nome, ac.setup_expira_em, ac.setup_usado_em FROM rh_colaborador_acessos ac JOIN rh_colaboradores c ON c.id = ac.colaborador_id WHERE ac.setup_token = $1`,
        [String(req.params.token || '')]
      );
      if (!row) return res.status(404).json({ error: 'Link inválido' });
      if (row.setup_usado_em) return res.status(410).json({ error: 'Link já utilizado. Entre com seu CPF e senha.' });
      if (new Date(row.setup_expira_em) < new Date()) return res.status(410).json({ error: 'Link expirado. Peça um novo ao RH.' });
      return res.json({ nome: row.nome });
    } catch (e: any) { return res.status(500).json({ error: 'Erro' }); }
  }

  static async postSetup(req: Request, res: Response) {
    try {
      const token = String(req.params.token || '');
      const cpf = cpfDigits(req.body?.cpf);
      const senha = String(req.body?.senha || '');
      if (!SENHA_FORTE(senha)) return res.status(400).json({ error: SENHA_MSG });
      const [row] = await AppDataSource.query(
        `SELECT ac.colaborador_id, ac.setup_expira_em, ac.setup_usado_em, regexp_replace(COALESCE(c.cpf,''), '\\D', '', 'g') AS cpf
         FROM rh_colaborador_acessos ac JOIN rh_colaboradores c ON c.id = ac.colaborador_id WHERE ac.setup_token = $1`,
        [token]
      );
      if (!row) return res.status(404).json({ error: 'Link inválido' });
      if (row.setup_usado_em) return res.status(410).json({ error: 'Link já utilizado' });
      if (new Date(row.setup_expira_em) < new Date()) return res.status(410).json({ error: 'Link expirado. Peça um novo ao RH.' });
      // Confirma o CPF pra ninguém que pegue o link criar senha no lugar do colaborador
      if (cpf.length !== 11 || cpf !== row.cpf) return res.status(400).json({ error: 'CPF não confere com o cadastro' });
      const hash = await bcrypt.hash(senha, 10);
      await AppDataSource.query(
        `UPDATE rh_colaborador_acessos SET senha_hash = $2, setup_usado_em = NOW(), tentativas = 0, bloqueado_ate = NULL, ativo = true, updated_at = NOW() WHERE colaborador_id = $1`,
        [row.colaborador_id, hash]
      );
      return res.json({ ok: true, message: 'Senha criada. Entre com seu CPF e senha.' });
    } catch (e: any) {
      console.error('[Portal] setup:', e);
      return res.status(500).json({ error: 'Erro ao criar senha' });
    }
  }

  // ---------- autenticado (colaborador) ----------
  static async me(req: AuthRequest, res: Response) {
    try {
      const [c] = await AppDataSource.query(
        `SELECT c.id, c.nome, c.matricula, ca.nome AS cargo, COALESCE(e.apelido, e.nome_fantasia, e.razao_social) AS empresa
         FROM rh_colaboradores c LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id LEFT JOIN rh_empresas e ON e.id = c.company_id WHERE c.id = $1`,
        [Number(req.user!.id)]
      );
      if (!c) return res.status(404).json({ error: 'Colaborador não encontrado' });
      res.json(c);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async holerites(req: AuthRequest, res: Response) {
    try {
      res.json(await AppDataSource.query(
        `SELECT a.id, a.competencia, a.status, t.nome AS tipo_nome, a.enviado_em, a.visualizado_em, a.aceito_em, a.hash_sha256, a.created_at, d.nome AS arquivo_nome
         FROM rh_documento_aceites a LEFT JOIN rh_tipos_holerite t ON t.id = a.tipo_holerite_id LEFT JOIN rh_documentos d ON d.id = a.documento_id
         WHERE a.colaborador_id = $1 AND a.tipo = 'HOLERITE' AND a.status <> 'substituido'
         ORDER BY a.competencia DESC, a.created_at DESC`,
        [Number(req.user!.id)]
      ));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  /** PDF via backend (bucket é público, mas a URL nunca sai daqui). 1ª abertura = 'visualizado'. */
  static async pdf(req: AuthRequest, res: Response) {
    try {
      const [a] = await AppDataSource.query(
        `SELECT a.id, a.status, d.arquivo_url, d.nome FROM rh_documento_aceites a LEFT JOIN rh_documentos d ON d.id = a.documento_id
         WHERE a.id = $1 AND a.colaborador_id = $2`,
        [Number(req.params.id), Number(req.user!.id)]
      );
      if (!a) return res.status(404).json({ error: 'Documento não encontrado' });
      if (!a.arquivo_url) return res.status(410).json({ error: 'Arquivo não está mais disponível' });
      const r = await axios.get(a.arquivo_url, { responseType: 'arraybuffer', timeout: 30000 });
      if (a.status === 'pendente') {
        await AppDataSource.query(`UPDATE rh_documento_aceites SET status = 'visualizado', visualizado_em = NOW(), updated_at = NOW() WHERE id = $1`, [a.id]);
        await PortalColaboradorService.registrarEvento(a.id, 'visualizado', { ip: getIp(req), user_agent: String(req.headers['user-agent'] || '') });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${a.nome || 'holerite.pdf'}"`);
      res.send(Buffer.from(r.data));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async ciencia(req: AuthRequest, res: Response) {
    try {
      const ip = getIp(req);
      const ua = String(req.headers['user-agent'] || '');
      const [a] = await AppDataSource.query(
        `SELECT id, status FROM rh_documento_aceites WHERE id = $1 AND colaborador_id = $2`,
        [Number(req.params.id), Number(req.user!.id)]
      );
      if (!a) return res.status(404).json({ error: 'Documento não encontrado' });
      if (a.status === 'aceito') return res.json({ ok: true, ja_aceito: true });
      await AppDataSource.query(
        `UPDATE rh_documento_aceites SET status = 'aceito', aceito_em = NOW(), aceite_ip = $2, aceite_user_agent = $3, aceite_metodo = 'cpf_senha',
                visualizado_em = COALESCE(visualizado_em, NOW()), updated_at = NOW() WHERE id = $1`,
        [a.id, ip, ua]
      );
      await PortalColaboradorService.registrarEvento(a.id, 'aceito', { ip, user_agent: ua, detalhe: 'cpf_senha' });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async trocarSenha(req: AuthRequest, res: Response) {
    try {
      const atual = String(req.body?.senha_atual || '');
      const nova = String(req.body?.nova_senha || '');
      if (!SENHA_FORTE(nova)) return res.status(400).json({ error: SENHA_MSG });
      const [ac] = await AppDataSource.query(`SELECT senha_hash FROM rh_colaborador_acessos WHERE colaborador_id = $1`, [Number(req.user!.id)]);
      if (!ac?.senha_hash || !(await bcrypt.compare(atual, ac.senha_hash))) return res.status(401).json({ error: 'Senha atual incorreta' });
      await AppDataSource.query(`UPDATE rh_colaborador_acessos SET senha_hash = $2, updated_at = NOW() WHERE colaborador_id = $1`, [Number(req.user!.id), await bcrypt.hash(nova, 10)]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
}
