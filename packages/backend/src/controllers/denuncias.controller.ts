import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

// Tipos pre-definidos (NR-1 + Lei 14.457/22)
const TIPOS_PERMITIDOS = new Set([
  'assedio_moral', 'assedio_sexual', 'discriminacao', 'violencia_fisica',
  'violencia_verbal', 'conflito_grave',
  'falta_epi', 'sobrecarga', 'jornada_irregular', 'acidente_nao_registrado',
  'furto_interno', 'fraude', 'corrupcao', 'conflito_interesse',
  'sugestao', 'outro',
]);

const CATEGORIAS_POR_TIPO: Record<string, string> = {
  assedio_moral: 'conduta',
  assedio_sexual: 'conduta',
  discriminacao: 'conduta',
  violencia_fisica: 'conduta',
  violencia_verbal: 'conduta',
  conflito_grave: 'conduta',
  falta_epi: 'saude_seguranca',
  sobrecarga: 'saude_seguranca',
  jornada_irregular: 'saude_seguranca',
  acidente_nao_registrado: 'saude_seguranca',
  furto_interno: 'compliance',
  fraude: 'compliance',
  corrupcao: 'compliance',
  conflito_interesse: 'compliance',
  sugestao: 'outros',
  outro: 'outros',
};

function gerarProtocolo(): string {
  // Formato: DEN-YYYYMMDD-XXXXX
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DEN-${ymd}-${rand}`;
}

export class DenunciasController {
  /** POST /api/denuncias/publica  -- endpoint publico, sem auth */
  static async criarPublica(req: Request, res: Response): Promise<void> {
    try {
      const {
        empresa_id, tipo, descricao, local, data_ocorrido,
        anonima, autor_nome, autor_contato,
      } = req.body || {};

      if (!empresa_id || !tipo || !descricao) {
        res.status(400).json({ error: 'empresa_id, tipo e descricao sao obrigatorios' });
        return;
      }
      if (!TIPOS_PERMITIDOS.has(tipo)) {
        res.status(400).json({ error: `tipo invalido: ${tipo}` });
        return;
      }
      if (String(descricao).trim().length < 10) {
        res.status(400).json({ error: 'Descreva o ocorrido com pelo menos 10 caracteres' });
        return;
      }

      // Valida empresa existe
      const [emp] = await AppDataSource.query(`SELECT id FROM rh_empresas WHERE id = $1 LIMIT 1`, [empresa_id]);
      if (!emp) {
        res.status(404).json({ error: 'Empresa nao encontrada' });
        return;
      }

      const categoria = CATEGORIAS_POR_TIPO[tipo] || 'outros';
      const protocolo = gerarProtocolo();
      const isAnonima = anonima === undefined ? true : !!anonima;
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '';
      const ua = String(req.headers['user-agent'] || '').slice(0, 500);

      const insResult = await AppDataSource.query(
        `INSERT INTO denuncias
          (empresa_id, protocolo, tipo, categoria, descricao, local, data_ocorrido,
           anonima, autor_nome, autor_contato, ip_origem, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, protocolo, criada_em`,
        [
          empresa_id, protocolo, tipo, categoria,
          String(descricao).slice(0, 5000), local || null, data_ocorrido || null,
          isAnonima, isAnonima ? null : (autor_nome || null), isAnonima ? null : (autor_contato || null),
          ip, ua,
        ]
      );
      const insRows = Array.isArray(insResult?.[0]) ? insResult[0] : insResult;
      const row = Array.isArray(insRows) ? insRows[0] : insRows;

      res.json({
        success: true,
        protocolo: row.protocolo,
        mensagem: 'Sua denuncia foi registrada. Guarde o protocolo para consultar o andamento.',
      });
    } catch (e: any) {
      console.error('[denuncias.criarPublica]', e);
      res.status(500).json({ error: 'Falha ao registrar denuncia. Tente novamente.' });
    }
  }

  /** GET /api/denuncias/publica/empresa/:empresaId  -- info publica da empresa pra UI do form */
  static async infoEmpresa(req: Request, res: Response): Promise<void> {
    try {
      const [emp] = await AppDataSource.query(
        `SELECT id, nome_fantasia, razao_social FROM rh_empresas WHERE id = $1 LIMIT 1`,
        [req.params.empresaId]
      );
      if (!emp) { res.status(404).json({ error: 'Empresa nao encontrada' }); return; }
      res.json({ id: emp.id, nome: emp.nome_fantasia || emp.razao_social });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** GET /api/denuncias/publica/consulta/:protocolo  -- consultar status pelo protocolo */
  static async consultarProtocolo(req: Request, res: Response): Promise<void> {
    try {
      const [row] = await AppDataSource.query(
        `SELECT protocolo, tipo, status, criada_em, atualizada_em, resolucao
         FROM denuncias WHERE protocolo = $1 LIMIT 1`,
        [req.params.protocolo]
      );
      if (!row) { res.status(404).json({ error: 'Protocolo nao encontrado' }); return; }
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** GET /api/denuncias  -- listagem admin */
  static async listar(req: Request, res: Response): Promise<void> {
    try {
      const empresaId = req.query.empresa_id;
      const status = req.query.status;
      const where: string[] = [];
      const params: any[] = [];
      let p = 1;
      if (empresaId) { where.push(`empresa_id = $${p++}`); params.push(empresaId); }
      if (status) { where.push(`status = $${p++}`); params.push(status); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const rows = await AppDataSource.query(
        `SELECT id, empresa_id, protocolo, tipo, categoria,
                descricao, LEFT(descricao, 200) AS resumo,
                local, data_ocorrido,
                anonima, autor_nome, autor_contato,
                status, prioridade, anotacoes_internas,
                responsavel_id, resolucao, resolvida_em,
                criada_em, atualizada_em
         FROM denuncias
         ${whereSql}
         ORDER BY criada_em DESC
         LIMIT 500`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** GET /api/denuncias/:id  -- detalhe admin (descricao completa) */
  static async detalhe(req: Request, res: Response): Promise<void> {
    try {
      const [row] = await AppDataSource.query(
        `SELECT * FROM denuncias WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (!row) { res.status(404).json({ error: 'Denuncia nao encontrada' }); return; }
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** PATCH /api/denuncias/:id  -- atualiza status, anotacoes, resolucao */
  static async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const allowed = ['status', 'prioridade', 'anotacoes_internas', 'responsavel_id', 'resolucao'];
      const sets: string[] = [];
      const params: any[] = [];
      let p = 1;
      for (const f of allowed) {
        if (req.body[f] !== undefined) {
          sets.push(`${f} = $${p++}`);
          params.push(req.body[f]);
        }
      }
      if (!sets.length) { res.status(400).json({ error: 'Nada para atualizar' }); return; }
      sets.push(`atualizada_em = NOW()`);
      if (req.body.status === 'concluida' || req.body.status === 'improcedente') {
        sets.push(`resolvida_em = COALESCE(resolvida_em, NOW())`);
      }
      params.push(req.params.id);
      const result = await AppDataSource.query(
        `UPDATE denuncias SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
        params
      );
      // TypeORM com pg retorna [rows[], affectedCount] em UPDATE/INSERT com RETURNING
      const rows = Array.isArray(result?.[0]) ? result[0] : result;
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) { res.status(404).json({ error: 'Denuncia nao encontrada' }); return; }
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /** GET /api/denuncias/stats?empresa_id=... */
  static async stats(req: Request, res: Response): Promise<void> {
    try {
      const empresaId = req.query.empresa_id;
      const where = empresaId ? 'WHERE empresa_id = $1' : '';
      const params = empresaId ? [empresaId] : [];
      const [r] = await AppDataSource.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'nova')::int AS novas,
           COUNT(*) FILTER (WHERE status = 'em_apuracao')::int AS em_apuracao,
           COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas,
           COUNT(*) FILTER (WHERE status = 'improcedente')::int AS improcedentes,
           COUNT(*) FILTER (WHERE prioridade = 'alta')::int AS alta_prioridade
         FROM denuncias ${where}`,
        params
      );
      res.json(r);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}
