import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { minioService } from '../services/minio.service';

/** Departamento Pessoal: documentos da EMPRESA (nao por colaborador) */
export class RhDpController {
  /**
   * GET /rh/dp/indicadores?ano=&company_id= — dashboard do Departamento Pessoal.
   * Consolida 3 fontes: ASO (rh_asos, vencimento real por colaborador), documentos
   * obrigatórios por colaborador (faltantes + conformidade) e documentos da empresa
   * (dp_documentos, com data_vencimento). Retorna kpis + charts + tabela de vencidos.
   */
  static async indicadores(req: AuthRequest, res: Response) {
    try {
      const ano = parseInt((req.query.ano as string) || '') || new Date().getFullYear();
      const companyId = (req.query.company_id as string) || null;
      // Filtro de loja (via rh_colaboradores.company_id -> companies). $1 sempre é companyId.
      const colabFiltro = companyId ? ' AND c.company_id = $1' : '';
      const p = companyId ? [companyId] : [];

      // 1) ASO vigente por colaborador ativo não dispensado (periódico > admissional, mais recente).
      const asoVig = await AppDataSource.query(
        `SELECT DISTINCT ON (a.colaborador_id)
           a.colaborador_id, a.tipo, a.data_exame, a.data_vencimento,
           c.nome AS colaborador_nome,
           COALESCE(comp.apelido, comp.nome_fantasia) AS loja, comp.cod_loja
         FROM rh_asos a
         JOIN rh_colaboradores c ON c.id = a.colaborador_id
         LEFT JOIN companies comp ON comp.id = c.company_id
         WHERE c.status = 'ativo' AND COALESCE(c.aso_dispensado, false) = false
           AND a.tipo IN ('admissional','periodico')${colabFiltro}
         ORDER BY a.colaborador_id,
           CASE WHEN a.tipo = 'periodico' THEN 0 ELSE 1 END, a.data_exame DESC`, p);

      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);
      const vencidos: any[] = [];
      let asoVencidos = 0, asoAVencer = 0;
      for (const r of asoVig) {
        if (!r.data_vencimento) continue;
        const dv = new Date(r.data_vencimento); dv.setHours(0, 0, 0, 0);
        if (dv < hoje) {
          asoVencidos++;
          vencidos.push({ tipo: 'ASO', descricao: `ASO ${r.tipo}`, colaborador: r.colaborador_nome, loja: r.loja, data_vencimento: r.data_vencimento });
        } else if (dv <= em30) asoAVencer++;
      }

      // 2) Documentos da empresa (dp_documentos) com vencimento.
      let dpVencidos = 0, dpAVencer = 0;
      try {
        const dpDocs = await AppDataSource.query(
          `SELECT nome, data_vencimento FROM dp_documentos WHERE data_vencimento IS NOT NULL`);
        for (const d of dpDocs) {
          const dv = new Date(d.data_vencimento); dv.setHours(0, 0, 0, 0);
          if (dv < hoje) { dpVencidos++; vencidos.push({ tipo: 'Empresa', descricao: d.nome, colaborador: '—', loja: '—', data_vencimento: d.data_vencimento }); }
          else if (dv <= em30) dpAVencer++;
        }
      } catch { /* dp_documentos pode não existir em base antiga */ }

      // 3) Obrigatórios por colaborador (faltantes + conformidade), agrupável por loja.
      const conf = await AppDataSource.query(
        `SELECT c.id, COALESCE(comp.apelido, comp.nome_fantasia) AS loja, comp.cod_loja,
           COUNT(s.id) FILTER (WHERE s.obrigatorio) AS obrig,
           COUNT(s.id) FILTER (WHERE s.obrigatorio AND NOT EXISTS (
             SELECT 1 FROM rh_documentos d WHERE d.subpasta_id = s.id)) AS pend
         FROM rh_colaboradores c
         LEFT JOIN companies comp ON comp.id = c.company_id
         LEFT JOIN rh_documento_pastas pa ON pa.colaborador_id = c.id
         LEFT JOIN rh_documento_subpastas s ON s.pasta_id = pa.id
         WHERE c.status = 'ativo'${colabFiltro}
         GROUP BY c.id, comp.apelido, comp.nome_fantasia, comp.cod_loja`, p);
      let obrigTotal = 0, faltantes = 0;
      const porLoja: Record<string, { loja: string; obrig: number; pend: number }> = {};
      for (const r of conf) {
        const ob = Number(r.obrig) || 0, pe = Number(r.pend) || 0;
        obrigTotal += ob; faltantes += pe;
        const key = r.loja || 'Sem loja';
        (porLoja[key] ||= { loja: key, obrig: 0, pend: 0 });
        porLoja[key].obrig += ob; porLoja[key].pend += pe;
      }
      const conformidade = obrigTotal > 0 ? Math.round(((obrigTotal - faltantes) / obrigTotal) * 100) : 100;
      const conformidadePorLoja = Object.values(porLoja)
        .map(l => ({ loja: l.loja, pct: l.obrig > 0 ? Math.round(((l.obrig - l.pend) / l.obrig) * 100) : 100, obrig: l.obrig, pend: l.pend }))
        .sort((a, b) => a.pct - b.pct);

      // 4) Total de documentos + pastas com mais documentos.
      const totRes = await AppDataSource.query(
        `SELECT COUNT(d.id)::int AS total
         FROM rh_documentos d
         JOIN rh_documento_pastas pa ON pa.id = d.pasta_id
         JOIN rh_colaboradores c ON c.id = pa.colaborador_id
         WHERE c.status = 'ativo'${colabFiltro}`, p);
      const totalDocumentos = totRes[0]?.total || 0;

      const pastas = await AppDataSource.query(
        `SELECT pa.nome, COUNT(d.id)::int AS qtd
         FROM rh_documentos d
         JOIN rh_documento_pastas pa ON pa.id = d.pasta_id
         JOIN rh_colaboradores c ON c.id = pa.colaborador_id
         WHERE c.status = 'ativo'${colabFiltro}
         GROUP BY pa.nome ORDER BY qtd DESC LIMIT 10`, p);

      // 5) ASO mensal (emissão x vencimento) no ano-base.
      const anoFiltro = companyId ? ' AND c.company_id = $2' : '';
      const pAno = companyId ? [ano, companyId] : [ano];
      const mensal = await AppDataSource.query(
        `SELECT EXTRACT(MONTH FROM a.data_exame)::int AS mes, 'emissao' AS k, COUNT(*)::int AS qtd
           FROM rh_asos a JOIN rh_colaboradores c ON c.id = a.colaborador_id
           WHERE EXTRACT(YEAR FROM a.data_exame) = $1${anoFiltro} GROUP BY 1
         UNION ALL
         SELECT EXTRACT(MONTH FROM a.data_vencimento)::int, 'vencimento', COUNT(*)::int
           FROM rh_asos a JOIN rh_colaboradores c ON c.id = a.colaborador_id
           WHERE a.data_vencimento IS NOT NULL AND EXTRACT(YEAR FROM a.data_vencimento) = $1${anoFiltro} GROUP BY 1`, pAno);
      const emissoes = Array(12).fill(0), vencimentos = Array(12).fill(0);
      for (const r of mensal) {
        const i = (r.mes || 1) - 1;
        if (i < 0 || i > 11) continue;
        if (r.k === 'emissao') emissoes[i] = r.qtd; else vencimentos[i] = r.qtd;
      }

      vencidos.sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

      return res.json({
        kpis: {
          vencidos: asoVencidos + dpVencidos,
          a_vencer: asoAVencer + dpAVencer,
          faltantes,
          conformidade,
          total_documentos: totalDocumentos,
        },
        aso_mensal: { emissoes, vencimentos },
        pastas_top: pastas,
        conformidade_por_loja: conformidadePorLoja,
        vencidos_detalhe: vencidos.slice(0, 100),
      });
    } catch (e: any) {
      console.error('[RH-DP] indicadores:', e?.message);
      return res.status(500).json({ error: e?.message || 'Erro ao carregar indicadores DP' });
    }
  }

  // --- PASTAS ---
  static async listarPastas(req: AuthRequest, res: Response) {
    try {
      const companyId = req.query.company_id as string | undefined;
      const params: any[] = [];
      let where = '';
      if (companyId && companyId !== '') {
        params.push(companyId);
        where = `WHERE p.company_id = $1`;
      }
      const pastas = await AppDataSource.query(
        `SELECT p.*,
                (SELECT COUNT(*) FROM dp_documentos d WHERE d.pasta_id = p.id)::int AS qtd_arquivos,
                (SELECT name FROM users WHERE id = p.created_by) AS criado_por_nome
         FROM dp_pastas p
         ${where}
         ORDER BY COALESCE(p.ordem, 999999) ASC, p.nome ASC`,
        params
      );
      return res.json(pastas);
    } catch (err: any) {
      console.error('[DP] listarPastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async criarPasta(req: AuthRequest, res: Response) {
    try {
      const { nome, company_id, senha_protegida } = req.body;
      if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });
      if (!company_id) return res.status(400).json({ error: 'company_id obrigatorio' });
      const userId = req.user?.id || null;
      const [pasta] = await AppDataSource.query(
        `INSERT INTO dp_pastas (nome, company_id, senha_protegida, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (company_id, nome) DO UPDATE SET updated_at = NOW(),
           senha_protegida = EXCLUDED.senha_protegida,
           created_by = COALESCE(dp_pastas.created_by, EXCLUDED.created_by)
         RETURNING *`,
        [nome.trim().toUpperCase(), company_id, !!senha_protegida, userId]
      );
      return res.status(201).json(pasta);
    } catch (err: any) {
      console.error('[DP] criarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Valida senha pra abrir pasta protegida. Aceita senha do criador OU de qualquer master. */
  static async validarSenhaPasta(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.params.id, 10);
      const { senha } = req.body;
      if (!senha) return res.status(400).json({ error: 'senha obrigatoria' });
      const [pasta] = await AppDataSource.query(
        `SELECT id, senha_protegida, created_by FROM dp_pastas WHERE id = $1`,
        [pastaId]
      );
      if (!pasta) return res.status(404).json({ error: 'pasta nao encontrada' });
      if (!pasta.senha_protegida) return res.json({ ok: true });

      const userLogadoId = req.user?.id;
      // Tenta: (1) senha do criador da pasta  (2) senha de qualquer master
      const candidatos = await AppDataSource.query(
        `SELECT password FROM users
         WHERE id = $1
            OR is_master = true
            OR id = $2`,
        [pasta.created_by, userLogadoId]
      );
      for (const c of candidatos) {
        if (c.password && (await bcrypt.compare(senha, c.password))) {
          return res.json({ ok: true });
        }
      }
      return res.status(401).json({ error: 'Senha incorreta' });
    } catch (err: any) {
      console.error('[DP] validarSenhaPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Seed das 3 pastas padrao (DOCS EMPRESA, DOCS VIGILANCIA, DOCS MODELOS RH) para uma empresa */
  static async seedPadraoPorEmpresa(req: AuthRequest, res: Response) {
    try {
      const companyId = req.params.companyId;
      if (!companyId) return res.status(400).json({ error: 'companyId obrigatorio' });
      await AppDataSource.query(`
        INSERT INTO dp_pastas (nome, ordem, company_id)
        SELECT v.nome, v.ordem, $1
        FROM (VALUES
          ('DOCS EMPRESA', 1),
          ('DOCS VIGILANCIA', 2),
          ('DOCS MODELOS RH', 3)
        ) AS v(nome, ordem)
        WHERE NOT EXISTS (SELECT 1 FROM dp_pastas x WHERE x.nome = v.nome AND x.company_id = $1)
      `, [companyId]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] seedPadrao:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async atualizarPasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, senha_protegida } = req.body;
      if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });
      const [pasta] = await AppDataSource.query(
        `UPDATE dp_pastas
            SET nome = $1,
                senha_protegida = COALESCE($3, senha_protegida),
                updated_at = NOW()
          WHERE id = $2 RETURNING *`,
        [nome.trim().toUpperCase(), id, typeof senha_protegida === 'boolean' ? senha_protegida : null]
      );
      if (!pasta) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.json(pasta);
    } catch (err: any) {
      console.error('[DP] atualizarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async reordenarPastas(req: AuthRequest, res: Response) {
    try {
      const { pasta_ids } = req.body;
      if (!Array.isArray(pasta_ids)) return res.status(400).json({ error: 'pasta_ids array obrigatorio' });
      for (let i = 0; i < pasta_ids.length; i++) {
        await AppDataSource.query(
          `UPDATE dp_pastas SET ordem = $1, updated_at = NOW() WHERE id = $2`,
          [i + 1, pasta_ids[i]]
        );
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] reordenarPastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarPasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM dp_pastas WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] deletarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- SUBPASTAS ---
  static async listarSubpastas(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.query.pasta_id as string);
      if (!pastaId) return res.status(400).json({ error: 'pasta_id obrigatorio' });
      const subs = await AppDataSource.query(
        `SELECT s.*,
                (SELECT COUNT(*) FROM dp_documentos d WHERE d.subpasta_id = s.id)::int AS qtd_arquivos
         FROM dp_subpastas s
         WHERE s.pasta_id = $1
         ORDER BY COALESCE(s.ordem, 999999) ASC, s.nome ASC`,
        [pastaId]
      );
      return res.json(subs);
    } catch (err: any) {
      console.error('[DP] listarSubpastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async criarSubpasta(req: AuthRequest, res: Response) {
    try {
      const { pasta_id, nome, obrigatorio, com_vencimento } = req.body;
      if (!pasta_id || !nome?.trim()) return res.status(400).json({ error: 'pasta_id e nome obrigatorios' });
      const [sub] = await AppDataSource.query(
        `INSERT INTO dp_subpastas (pasta_id, nome, obrigatorio, com_vencimento) VALUES ($1, $2, $3, $4) RETURNING *`,
        [pasta_id, nome.trim().toUpperCase(), !!obrigatorio, !!com_vencimento]
      );
      return res.status(201).json(sub);
    } catch (err: any) {
      console.error('[DP] criarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async atualizarSubpasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, obrigatorio, com_vencimento } = req.body;
      const [sub] = await AppDataSource.query(
        `UPDATE dp_subpastas
         SET nome = COALESCE($1, nome),
             obrigatorio = COALESCE($2, obrigatorio),
             com_vencimento = COALESCE($3, com_vencimento),
             updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [
          nome ? nome.trim().toUpperCase() : null,
          obrigatorio !== undefined ? !!obrigatorio : null,
          com_vencimento !== undefined ? !!com_vencimento : null,
          id,
        ]
      );
      if (!sub) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      return res.json(sub);
    } catch (err: any) {
      console.error('[DP] atualizarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarSubpasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM dp_subpastas WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] deletarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- DOCUMENTOS ---
  static async listarDocumentos(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.query.pasta_id as string);
      if (!pastaId) return res.status(400).json({ error: 'pasta_id obrigatorio' });
      const docs = await AppDataSource.query(
        `SELECT * FROM dp_documentos WHERE pasta_id = $1 ORDER BY uploaded_at DESC`,
        [pastaId]
      );
      return res.json(docs);
    } catch (err: any) {
      console.error('[DP] listarDocumentos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async uploadDocumento(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file;
      const { pasta_id, subpasta_id, observacao, data_vencimento, data_alerta } = req.body;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      if (!pasta_id) return res.status(400).json({ error: 'pasta_id obrigatorio' });
      const ext = (file.originalname || 'bin').split('.').pop() || 'bin';
      const objectName = `rh/dp/${pasta_id}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'application/octet-stream');
      const subpastaIdNum = subpasta_id && subpasta_id !== '' ? parseInt(subpasta_id) : null;
      const [doc] = await AppDataSource.query(
        `INSERT INTO dp_documentos (pasta_id, subpasta_id, nome, arquivo_url, mime_type, tamanho_bytes, observacao, data_vencimento, data_alerta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          pasta_id, subpastaIdNum, file.originalname, url, file.mimetype, file.size,
          observacao || null,
          data_vencimento || null,
          data_alerta || null,
        ]
      );
      return res.status(201).json(doc);
    } catch (err: any) {
      console.error('[DP] uploadDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Atualiza datas de vencimento/alerta de um documento existente */
  static async atualizarDatasDocumento(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { data_vencimento, data_alerta } = req.body;
      const [doc] = await AppDataSource.query(
        `UPDATE dp_documentos
            SET data_vencimento = $1,
                data_alerta = $2
          WHERE id = $3 RETURNING *`,
        [data_vencimento || null, data_alerta || null, id]
      );
      if (!doc) return res.status(404).json({ error: 'Documento nao encontrado' });
      return res.json(doc);
    } catch (err: any) {
      console.error('[DP] atualizarDatasDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarDocumento(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM dp_documentos WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Documento nao encontrado' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] deletarDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
