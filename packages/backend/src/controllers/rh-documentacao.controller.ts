import { Response } from 'express';
import PDFDocument from 'pdfkit';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { minioService } from '../services/minio.service';

export class RhDocumentacaoController {
  /**
   * Estatisticas globais da documentacao: total de pastas, subpastas obrigatorias e nao,
   * e lista de colaboradores com subpastas obrigatorias NAO populadas (com arquivo).
   */
  static async obterStats(req: AuthRequest, res: Response) {
    try {
      const [{ total_pastas }] = await AppDataSource.query(`
        SELECT COUNT(*)::int AS total_pastas FROM rh_documento_pastas p
        INNER JOIN rh_colaboradores c ON c.id = p.colaborador_id
        WHERE c.status = 'ativo'
      `);
      const [{ total_obrig }] = await AppDataSource.query(`
        SELECT COUNT(*)::int AS total_obrig FROM rh_documento_subpastas s
        INNER JOIN rh_documento_pastas p ON p.id = s.pasta_id
        INNER JOIN rh_colaboradores c ON c.id = p.colaborador_id
        WHERE s.obrigatorio = true AND c.status = 'ativo'
      `);
      const [{ total_nao_obrig }] = await AppDataSource.query(`
        SELECT COUNT(*)::int AS total_nao_obrig FROM rh_documento_subpastas s
        INNER JOIN rh_documento_pastas p ON p.id = s.pasta_id
        INNER JOIN rh_colaboradores c ON c.id = p.colaborador_id
        WHERE s.obrigatorio = false AND c.status = 'ativo'
      `);

      // Subpastas obrigatorias sem arquivo
      const pendentes = await AppDataSource.query(`
        SELECT p.colaborador_id, COUNT(s.id)::int AS qtd_pendente
        FROM rh_documento_subpastas s
        INNER JOIN rh_documento_pastas p ON p.id = s.pasta_id
        INNER JOIN rh_colaboradores c ON c.id = p.colaborador_id
        WHERE s.obrigatorio = true
          AND c.status = 'ativo'
          AND NOT EXISTS (SELECT 1 FROM rh_documentos d WHERE d.subpasta_id = s.id)
        GROUP BY p.colaborador_id
      `);
      const totalPendentesObrig = pendentes.reduce((sum: number, r: any) => sum + r.qtd_pendente, 0);
      const colaboradoresComPendencia = pendentes.map((r: any) => r.colaborador_id);

      return res.json({
        total_pastas,
        total_subpastas_obrigatorias: total_obrig,
        total_subpastas_nao_obrigatorias: total_nao_obrig,
        total_obrigatorias_nao_populadas: totalPendentesObrig,
        colaboradores_com_pendencia: colaboradoresComPendencia,
      });
    } catch (err: any) {
      console.error('[RH-DOC] obterStats:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Estatisticas de documentacao agrupadas por colaborador (ativos).
   * Retorna, para cada colaborador: total de subpastas, qtd obrigatorias e opcionais,
   * total de arquivos, e qtd de obrigatorias pendentes (sem arquivo).
   */
  static async obterStatsPorColaborador(req: AuthRequest, res: Response) {
    try {
      const empresaId = req.query.empresa_id ? parseInt(String(req.query.empresa_id), 10) : null;
      const params: any[] = [];
      let whereEmpresa = '';
      if (empresaId && !isNaN(empresaId)) {
        params.push(empresaId);
        whereEmpresa = ` AND c.company_id = $${params.length}`;
      }
      const rows = await AppDataSource.query(
        `SELECT
           c.id AS colaborador_id,
           c.nome,
           c.matricula,
           c.foto_url,
           cg.nome AS cargo_nome,
           COUNT(DISTINCT p.id)::int AS total_pastas,
           COUNT(s.id)::int AS total_subpastas,
           COUNT(s.id) FILTER (WHERE s.obrigatorio = true)::int AS obrigatorias,
           COUNT(s.id) FILTER (WHERE s.obrigatorio = false)::int AS opcionais,
           COUNT(s.id) FILTER (
             WHERE s.obrigatorio = true
               AND NOT EXISTS (SELECT 1 FROM rh_documentos d WHERE d.subpasta_id = s.id)
           )::int AS obrigatorias_pendentes,
           (SELECT COUNT(*)::int FROM rh_documentos d
              INNER JOIN rh_documento_pastas pp ON pp.id = d.pasta_id
              WHERE pp.colaborador_id = c.id) AS total_arquivos
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos cg ON cg.id = c.cargo_id
         LEFT JOIN rh_documento_pastas p ON p.colaborador_id = c.id
         LEFT JOIN rh_documento_subpastas s ON s.pasta_id = p.id
         WHERE c.status = 'ativo'${whereEmpresa}
         GROUP BY c.id, c.nome, c.matricula, c.foto_url, cg.nome
         ORDER BY c.nome ASC`,
        params
      );
      return res.json(rows);
    } catch (err: any) {
      console.error('[RH-DOC] obterStatsPorColaborador:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Arvore completa de documentacao de um colaborador, agrupada por sub-pasta obrigatoria/opcional.
   */
  static async obterTreeColaborador(req: AuthRequest, res: Response) {
    try {
      const colaboradorId = parseInt(String(req.query.colaborador_id), 10);
      if (!colaboradorId || isNaN(colaboradorId)) {
        return res.status(400).json({ error: 'colaborador_id obrigatorio' });
      }
      const rows = await AppDataSource.query(
        `SELECT
           p.id AS pasta_id, p.nome AS pasta_nome, COALESCE(p.ordem, 999999) AS pasta_ordem,
           s.id AS subpasta_id, s.nome AS subpasta_nome, s.obrigatorio AS subpasta_obrigatorio,
           COALESCE(s.ordem, 999999) AS subpasta_ordem,
           d.id AS doc_id, d.nome AS doc_nome, d.arquivo_url AS doc_url,
           d.tamanho_bytes AS doc_tamanho, d.uploaded_at AS doc_data
         FROM rh_documento_pastas p
         LEFT JOIN rh_documento_subpastas s ON s.pasta_id = p.id
         LEFT JOIN rh_documentos d ON d.subpasta_id = s.id
         WHERE p.colaborador_id = $1
         ORDER BY pasta_ordem ASC, p.nome ASC, subpasta_ordem ASC, s.nome ASC, d.uploaded_at DESC`,
        [colaboradorId]
      );
      const pastasMap = new Map<number, any>();
      for (const r of rows) {
        if (!pastasMap.has(r.pasta_id)) {
          pastasMap.set(r.pasta_id, { id: r.pasta_id, nome: r.pasta_nome, subpastas: new Map() });
        }
        const pasta = pastasMap.get(r.pasta_id);
        if (r.subpasta_id) {
          if (!pasta.subpastas.has(r.subpasta_id)) {
            pasta.subpastas.set(r.subpasta_id, {
              id: r.subpasta_id,
              nome: r.subpasta_nome,
              obrigatorio: r.subpasta_obrigatorio,
              documentos: [],
            });
          }
          if (r.doc_id) {
            pasta.subpastas.get(r.subpasta_id).documentos.push({
              id: r.doc_id,
              nome: r.doc_nome,
              url: r.doc_url,
              tamanho: r.doc_tamanho,
              data: r.doc_data,
            });
          }
        }
      }
      const pastas = Array.from(pastasMap.values()).map(p => ({
        ...p,
        subpastas: Array.from(p.subpastas.values()),
      }));
      const obrigatorias: any[] = [];
      const opcionais: any[] = [];
      for (const p of pastas) {
        const subObrig = p.subpastas.filter((s: any) => s.obrigatorio);
        const subOpc = p.subpastas.filter((s: any) => !s.obrigatorio);
        if (subObrig.length > 0) obrigatorias.push({ id: p.id, nome: p.nome, subpastas: subObrig });
        if (subOpc.length > 0) opcionais.push({ id: p.id, nome: p.nome, subpastas: subOpc });
      }
      return res.json({ obrigatorias, opcionais });
    } catch (err: any) {
      console.error('[RH-DOC] obterTreeColaborador:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- PASTAS ---

  /** Lista todas as pastas de um colaborador, com contagem de arquivos */
  static async listarPastas(req: AuthRequest, res: Response) {
    try {
      const colaboradorId = parseInt(req.query.colaborador_id as string);
      if (!colaboradorId || isNaN(colaboradorId)) {
        return res.status(400).json({ error: 'colaborador_id obrigatorio' });
      }
      const pastas = await AppDataSource.query(
        `SELECT p.*,
                (SELECT COUNT(*) FROM rh_documentos d WHERE d.pasta_id = p.id)::int AS qtd_arquivos
         FROM rh_documento_pastas p
         WHERE p.colaborador_id = $1
         ORDER BY COALESCE(p.ordem, 999999) ASC, p.nome ASC`,
        [colaboradorId]
      );
      return res.json(pastas);
    } catch (err: any) {
      console.error('[RH-DOC] listarPastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Cria uma pasta para um colaborador E replica automaticamente para TODOS os colaboradores ativos (template global) */
  static async criarPasta(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, nome } = req.body;
      if (!colaborador_id || !nome?.trim()) {
        return res.status(400).json({ error: 'colaborador_id e nome sao obrigatorios' });
      }
      const nomeUp = nome.trim().toUpperCase();
      // Cria para o colaborador atual
      const [pasta] = await AppDataSource.query(
        `INSERT INTO rh_documento_pastas (colaborador_id, nome)
         VALUES ($1, $2)
         ON CONFLICT (colaborador_id, nome) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [colaborador_id, nomeUp]
      );
      // Replica automaticamente pros demais ativos (template global)
      await AppDataSource.query(
        `INSERT INTO rh_documento_pastas (colaborador_id, nome)
         SELECT c.id, $1
         FROM rh_colaboradores c
         WHERE c.status = 'ativo' AND c.id <> $2
         ON CONFLICT (colaborador_id, nome) DO NOTHING`,
        [nomeUp, colaborador_id]
      );
      return res.status(201).json(pasta);
    } catch (err: any) {
      console.error('[RH-DOC] criarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Renomeia pasta - propaga o rename pra todas as pastas com o mesmo nome antigo */
  static async atualizarPasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome } = req.body;
      if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });
      const [origem] = await AppDataSource.query(`SELECT nome, protegida FROM rh_documento_pastas WHERE id = $1`, [id]);
      if (!origem) return res.status(404).json({ error: 'Pasta nao encontrada' });
      if (origem.protegida) {
        return res.status(403).json({ error: 'Pasta obrigatória do sistema não pode ser renomeada.' });
      }
      const novoNome = nome.trim().toUpperCase();
      // Atualiza todas as pastas com mesmo nome antigo (template global)
      await AppDataSource.query(
        `UPDATE rh_documento_pastas SET nome = $1, updated_at = NOW() WHERE UPPER(TRIM(nome)) = UPPER(TRIM($2))`,
        [novoNome, origem.nome]
      );
      const [pasta] = await AppDataSource.query(`SELECT * FROM rh_documento_pastas WHERE id = $1`, [id]);
      return res.json(pasta);
    } catch (err: any) {
      console.error('[RH-DOC] atualizarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Reordena pastas: recebe array de ids na nova ordem.
   *  Pastas protegidas (sistema) tem ordem fixa 1-8 — sao IGNORADAS pelo
   *  reorder. So pastas user-defined (protegida=false) podem ser
   *  movidas, e ficam com ordem >= 100. */
  static async reordenarPastas(req: AuthRequest, res: Response) {
    try {
      const { pasta_ids } = req.body;
      if (!Array.isArray(pasta_ids) || pasta_ids.length === 0) {
        return res.status(400).json({ error: 'pasta_ids (array) obrigatorio' });
      }
      // Filtra apenas as user-defined (protegida=false)
      const userDefined = await AppDataSource.query(
        `SELECT id FROM rh_documento_pastas WHERE id = ANY($1::int[]) AND protegida = false`,
        [pasta_ids]
      );
      const userDefinedIds = new Set(userDefined.map((r: any) => r.id));
      let ordem = 100;
      for (const pid of pasta_ids) {
        if (!userDefinedIds.has(pid)) continue; // pula pastas protegidas
        await AppDataSource.query(
          `UPDATE rh_documento_pastas SET ordem = $1, updated_at = NOW() WHERE id = $2 AND protegida = false`,
          [ordem++, pid]
        );
      }
      return res.json({ success: true, reordenadas: ordem - 100 });
    } catch (err: any) {
      console.error('[RH-DOC] reordenarPastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Replica uma pasta (com todas as suas subpastas) para todos os colaboradores ativos.
   * Idempotente: se o colaborador ja tem pasta com o mesmo nome, nao duplica;
   * adiciona apenas as subpastas que ainda faltam naquela pasta.
   */
  static async replicarPastaParaTodos(req: AuthRequest, res: Response) {
    try {
      const pastaOrigemId = parseInt(req.params.id);
      const [origem] = await AppDataSource.query(
        `SELECT * FROM rh_documento_pastas WHERE id = $1`,
        [pastaOrigemId]
      );
      if (!origem) return res.status(404).json({ error: 'Pasta de origem nao encontrada' });

      const subs = await AppDataSource.query(
        `SELECT * FROM rh_documento_subpastas WHERE pasta_id = $1`,
        [pastaOrigemId]
      );

      const ativos = await AppDataSource.query(
        `SELECT id FROM rh_colaboradores WHERE status = 'ativo'`
      );

      let pastasCriadas = 0;
      let subpastasCriadas = 0;

      for (const colab of ativos) {
        if (colab.id === origem.colaborador_id) continue; // origem ja tem

        // Encontra ou cria pasta de destino
        let [destino] = await AppDataSource.query(
          `SELECT * FROM rh_documento_pastas WHERE colaborador_id = $1 AND UPPER(TRIM(nome)) = UPPER(TRIM($2))`,
          [colab.id, origem.nome]
        );
        if (!destino) {
          [destino] = await AppDataSource.query(
            `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem)
             VALUES ($1, $2, $3) RETURNING *`,
            [colab.id, origem.nome, origem.ordem || 0]
          );
          pastasCriadas++;
        }

        // Replica subpastas que ainda nao existem nesse destino
        for (const s of subs) {
          const [existente] = await AppDataSource.query(
            `SELECT id FROM rh_documento_subpastas WHERE pasta_id = $1 AND UPPER(TRIM(nome)) = UPPER(TRIM($2))`,
            [destino.id, s.nome]
          );
          if (!existente) {
            await AppDataSource.query(
              `INSERT INTO rh_documento_subpastas (pasta_id, nome, obrigatorio, ordem)
               VALUES ($1, $2, $3, $4)`,
              [destino.id, s.nome, s.obrigatorio, s.ordem || 0]
            );
            subpastasCriadas++;
          }
        }
      }

      return res.json({
        success: true,
        colaboradores_ativos: ativos.length,
        pastas_criadas: pastasCriadas,
        subpastas_criadas: subpastasCriadas,
      });
    } catch (err: any) {
      console.error('[RH-DOC] replicarPastaParaTodos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Deleta pasta em TODOS os colaboradores com mesmo nome (template global) */
  static async deletarPasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [origem] = await AppDataSource.query(`SELECT nome, protegida FROM rh_documento_pastas WHERE id = $1`, [id]);
      if (!origem) return res.status(404).json({ error: 'Pasta nao encontrada' });
      if (origem.protegida) {
        return res.status(403).json({ error: 'Pasta obrigatória do sistema não pode ser excluída.' });
      }
      await AppDataSource.query(
        `DELETE FROM rh_documento_pastas WHERE UPPER(TRIM(nome)) = UPPER(TRIM($1)) AND protegida = false`,
        [origem.nome]
      );
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[RH-DOC] deletarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- SUBPASTAS (itens de documento por pasta, com flag obrigatorio) ---

  static async listarSubpastas(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.query.pasta_id as string);
      if (!pastaId || isNaN(pastaId)) {
        return res.status(400).json({ error: 'pasta_id obrigatorio' });
      }
      const subs = await AppDataSource.query(
        `SELECT s.*,
                (SELECT COUNT(*) FROM rh_documentos d WHERE d.subpasta_id = s.id)::int AS qtd_arquivos
         FROM rh_documento_subpastas s
         WHERE s.pasta_id = $1
         ORDER BY COALESCE(s.ordem, 999999) ASC, s.nome ASC`,
        [pastaId]
      );
      return res.json(subs);
    } catch (err: any) {
      console.error('[RH-DOC] listarSubpastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Cria subpasta E propaga em todas as pastas (mesmo nome) dos colaboradores ativos */
  static async criarSubpasta(req: AuthRequest, res: Response) {
    try {
      const { pasta_id, nome, obrigatorio } = req.body;
      if (!pasta_id || !nome?.trim()) {
        return res.status(400).json({ error: 'pasta_id e nome sao obrigatorios' });
      }
      const nomeUp = nome.trim().toUpperCase();
      const [origem] = await AppDataSource.query(`SELECT nome FROM rh_documento_pastas WHERE id = $1`, [pasta_id]);
      if (!origem) return res.status(404).json({ error: 'Pasta nao encontrada' });

      const [sub] = await AppDataSource.query(
        `INSERT INTO rh_documento_subpastas (pasta_id, nome, obrigatorio)
         VALUES ($1, $2, $3) RETURNING *`,
        [pasta_id, nomeUp, !!obrigatorio]
      );

      // Propaga pra outras pastas (mesmo nome) dos colaboradores ativos que ainda nao tem essa subpasta
      await AppDataSource.query(
        `INSERT INTO rh_documento_subpastas (pasta_id, nome, obrigatorio)
         SELECT p.id, $1, $2
         FROM rh_documento_pastas p
         INNER JOIN rh_colaboradores c ON c.id = p.colaborador_id
         WHERE UPPER(TRIM(p.nome)) = UPPER(TRIM($3))
           AND p.id <> $4
           AND c.status = 'ativo'
           AND NOT EXISTS (
             SELECT 1 FROM rh_documento_subpastas s
             WHERE s.pasta_id = p.id AND UPPER(TRIM(s.nome)) = $1
           )`,
        [nomeUp, !!obrigatorio, origem.nome, pasta_id]
      );

      return res.status(201).json(sub);
    } catch (err: any) {
      console.error('[RH-DOC] criarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Atualiza subpasta (rename ou toggle obrigatorio) - propaga pra todas subpastas com mesmo nome+pasta nome */
  static async atualizarSubpasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, obrigatorio } = req.body;
      const novoNome = nome ? nome.trim().toUpperCase() : null;
      const novoObrig = obrigatorio !== undefined ? !!obrigatorio : null;

      // Busca a subpasta origem pra saber o nome atual + nome da pasta pai
      const [origem] = await AppDataSource.query(
        `SELECT s.nome, s.obrigatorio, p.nome AS pasta_nome
         FROM rh_documento_subpastas s
         INNER JOIN rh_documento_pastas p ON p.id = s.pasta_id
         WHERE s.id = $1`,
        [id]
      );
      if (!origem) return res.status(404).json({ error: 'Subpasta nao encontrada' });

      // Atualiza TODAS as subpastas (rename/obrigatorio) em pastas com mesmo pasta_nome + subpasta_nome antigo
      await AppDataSource.query(
        `UPDATE rh_documento_subpastas s
         SET nome = COALESCE($1, s.nome),
             obrigatorio = COALESCE($2, s.obrigatorio),
             updated_at = NOW()
         FROM rh_documento_pastas p
         WHERE s.pasta_id = p.id
           AND UPPER(TRIM(p.nome)) = UPPER(TRIM($3))
           AND UPPER(TRIM(s.nome)) = UPPER(TRIM($4))`,
        [novoNome, novoObrig, origem.pasta_nome, origem.nome]
      );

      const [sub] = await AppDataSource.query(`SELECT * FROM rh_documento_subpastas WHERE id = $1`, [id]);
      return res.json(sub);
    } catch (err: any) {
      console.error('[RH-DOC] atualizarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarSubpasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await AppDataSource.query(
        `DELETE FROM rh_documento_subpastas WHERE id = $1 RETURNING id`,
        [id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[RH-DOC] deletarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- CID-10 ---

  /** Busca CIDs por codigo ou descricao (autocomplete na tela ATESTADO).
   *  Match: codigo prefix OR codigo_formatado prefix OR descricao ilike %q% */
  static async buscarCid10(req: AuthRequest, res: Response) {
    try {
      const q = String(req.query.q || '').trim();
      if (!q || q.length < 2) return res.json([]);
      const qUp = q.toUpperCase();
      const qLike = `%${q.toLowerCase()}%`;
      const rows = await AppDataSource.query(
        `SELECT codigo_formatado AS codigo, descricao
         FROM cid10
         WHERE codigo LIKE $1 || '%'
            OR codigo_formatado LIKE $1 || '%'
            OR LOWER(descricao) LIKE $2
         ORDER BY
           CASE WHEN codigo_formatado LIKE $1 || '%' THEN 0 ELSE 1 END,
           codigo
         LIMIT 30`,
        [qUp, qLike]
      );
      return res.json(rows);
    } catch (err: any) {
      console.error('[RH-DOC] buscarCid10:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- DOCUMENTOS ---

  /** Lista arquivos de uma pasta */
  static async listarDocumentos(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.query.pasta_id as string);
      if (!pastaId || isNaN(pastaId)) {
        return res.status(400).json({ error: 'pasta_id obrigatorio' });
      }
      const docs = await AppDataSource.query(
        `SELECT * FROM rh_documentos WHERE pasta_id = $1 ORDER BY uploaded_at DESC`,
        [pastaId]
      );
      return res.json(docs);
    } catch (err: any) {
      console.error('[RH-DOC] listarDocumentos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Upload de arquivo para uma pasta (e opcionalmente subpasta).
   *  Aceita tambem campos extras (medico_nome, cid_*, periodo_*) usados
   *  pela pasta ATESTADO — ficam null quando nao enviados. */
  static async uploadDocumento(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file;
      const {
        pasta_id, subpasta_id, observacao,
        medico_nome, cid_codigo, cid_descricao,
        periodo_tipo, periodo_inicio, periodo_fim, periodo_total,
      } = req.body;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      if (!pasta_id) return res.status(400).json({ error: 'pasta_id obrigatorio' });

      const ext = (file.originalname || 'bin').split('.').pop() || 'bin';
      const objectName = `rh/documentos/${pasta_id}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'application/octet-stream');

      const subpastaIdNum = subpasta_id && subpasta_id !== '' ? parseInt(subpasta_id) : null;

      const [doc] = await AppDataSource.query(
        `INSERT INTO rh_documentos (
            pasta_id, subpasta_id, nome, arquivo_url, mime_type, tamanho_bytes, observacao,
            medico_nome, cid_codigo, cid_descricao, periodo_tipo, periodo_inicio, periodo_fim, periodo_total
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamp, $13::timestamp, $14::numeric) RETURNING *`,
        [
          pasta_id, subpastaIdNum, file.originalname, url, file.mimetype, file.size, observacao || null,
          medico_nome || null,
          cid_codigo || null,
          cid_descricao || null,
          periodo_tipo || null,
          periodo_inicio || null,
          periodo_fim || null,
          periodo_total ? Number(periodo_total) : null,
        ]
      );
      return res.status(201).json(doc);
    } catch (err: any) {
      console.error('[RH-DOC] uploadDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Gera PDF consolidado com todos os arquivos da pasta (imagens embedadas + indice dos demais) */
  static async gerarPdfDaPasta(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.params.id);
      const [pasta] = await AppDataSource.query(
        `SELECT p.*, c.nome AS colaborador_nome, c.matricula
         FROM rh_documento_pastas p
         INNER JOIN rh_colaboradores c ON c.id = p.colaborador_id
         WHERE p.id = $1`,
        [pastaId]
      );
      if (!pasta) return res.status(404).json({ error: 'Pasta nao encontrada' });

      const documentos = await AppDataSource.query(
        `SELECT d.*, s.nome AS subpasta_nome, s.obrigatorio
         FROM rh_documentos d
         LEFT JOIN rh_documento_subpastas s ON s.id = d.subpasta_id
         WHERE d.pasta_id = $1
         ORDER BY s.nome NULLS LAST, d.uploaded_at ASC`,
        [pastaId]
      );

      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

      const filename = `${pasta.nome}_${pasta.colaborador_nome}_${new Date().toISOString().split('T')[0]}.pdf`
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      // Capa
      doc.fontSize(22).fillColor('#1f2937').text('DOCUMENTOS', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(18).fillColor('#ea580c').text(pasta.nome, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#374151').text(pasta.colaborador_nome, { align: 'center' });
      doc.fontSize(11).fillColor('#6b7280').text(`Matricula: ${pasta.matricula || '-'}`, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#9ca3af').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(11).fillColor('#374151').text(`Total de arquivos: ${documentos.length}`, { align: 'center' });

      for (const d of documentos) {
        doc.addPage();
        // Cabecalho da pagina
        doc.fontSize(10).fillColor('#6b7280').text(pasta.nome + (d.subpasta_nome ? ` > ${d.subpasta_nome}` : ''), 40, 30);
        doc.fontSize(13).fillColor('#1f2937').text(d.nome, 40, 50);
        if (d.subpasta_nome && d.obrigatorio) {
          doc.fontSize(9).fillColor('#dc2626').text('OBRIGATORIO', 40, 72);
        }

        const contentTop = 95;
        const mime = (d.mime_type || '').toLowerCase();

        try {
          if (mime.startsWith('image/')) {
            // Baixa a imagem e insere
            const resp = await axios.get(d.arquivo_url, { responseType: 'arraybuffer', timeout: 15000 });
            const buf = Buffer.from(resp.data);
            doc.image(buf, 40, contentTop, {
              fit: [515, 680],
              align: 'center',
              valign: 'center',
            });
          } else if (mime.includes('pdf')) {
            doc.fontSize(11).fillColor('#374151').text(
              'Arquivo PDF anexado. Baixe pelo link abaixo para visualizar.',
              40, contentTop
            );
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#2563eb').text(d.arquivo_url, { link: d.arquivo_url, underline: true });
          } else {
            doc.fontSize(11).fillColor('#374151').text(
              `Arquivo: ${d.nome} (${d.mime_type || 'tipo desconhecido'})`,
              40, contentTop
            );
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#2563eb').text(d.arquivo_url, { link: d.arquivo_url, underline: true });
          }
        } catch (e: any) {
          doc.fontSize(10).fillColor('#dc2626').text(
            `Nao foi possivel embutir este arquivo (${e.message || 'erro'}).`,
            40, contentTop
          );
          doc.moveDown(0.5);
          doc.fontSize(10).fillColor('#2563eb').text(d.arquivo_url, { link: d.arquivo_url, underline: true });
        }
      }

      if (documentos.length === 0) {
        doc.addPage();
        doc.fontSize(14).fillColor('#6b7280').text('Esta pasta nao possui arquivos.', { align: 'center' });
      }

      doc.end();
    } catch (err: any) {
      console.error('[RH-DOC] gerarPdfDaPasta:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }

  /** Deleta documento */
  static async deletarDocumento(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const result = await AppDataSource.query(
        `DELETE FROM rh_documentos WHERE id = $1 RETURNING id`,
        [id]
      );
      if (result.length === 0) return res.status(404).json({ error: 'Documento nao encontrado' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[RH-DOC] deletarDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Renomeia o documento (apenas o campo `nome`, sem mexer no arquivo no storage).
   *  Preserva a extensao original — se o user mandar "comprovante", o resultado
   *  fica "comprovante.jpg" (caso o nome atual fosse "qualquer.jpg"). */
  static async renomearDocumento(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const novoNomeRaw = String(req.body?.nome || '').trim();
      if (!novoNomeRaw) return res.status(400).json({ error: 'nome eh obrigatorio' });
      const [atual] = await AppDataSource.query(`SELECT nome FROM rh_documentos WHERE id = $1`, [id]);
      if (!atual) return res.status(404).json({ error: 'Documento nao encontrado' });
      // Sanitiza chars invalidos pra nome de arquivo
      const safe = novoNomeRaw.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
      // Preserva extensao original se o user nao mandou uma
      const extAtual = (atual.nome.match(/\.[a-z0-9]+$/i) || [''])[0];
      const temExt = /\.[a-z0-9]+$/i.test(safe);
      const novoNome = temExt ? safe : `${safe}${extAtual}`;
      const [row] = await AppDataSource.query(
        `UPDATE rh_documentos SET nome = $1 WHERE id = $2 RETURNING id, nome`,
        [novoNome, id]
      );
      return res.json(row);
    } catch (err: any) {
      console.error('[RH-DOC] renomearDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
