import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DocumentoEscalaService, TipoDocumento } from '../services/documento-escala.service';

// "Vault" do Agente de Escala - notas markdown estilo Obsidian.
// Tipos sugeridos: 'colaborador' | 'setor' | 'regra' | 'padrao' | 'outro'
// Slug e unico por empresa_id (ou global quando empresa_id IS NULL).

function slugify(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'sem-titulo';
}

// Extrai [[refs]] do markdown - usado pra backlinks
function extrairLinks(md: string): string[] {
  if (!md) return [];
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const out = new Set<string>();
  let m;
  while ((m = re.exec(md)) !== null) {
    const ref = slugify(m[1].trim());
    if (ref) out.add(ref);
  }
  return [...out];
}

export class RhEscalaMemoriaController {
  // GET /rh/escala/memoria?empresaId=&tipo=&q=
  static async listar(req: Request, res: Response) {
    try {
      const { empresaId, tipo, q } = req.query;
      const params: any[] = [];
      let where = `ativo = true`;
      if (empresaId) {
        params.push(empresaId);
        where += ` AND (empresa_id = $${params.length} OR empresa_id IS NULL)`;
      }
      if (tipo) {
        params.push(tipo);
        where += ` AND tipo = $${params.length}`;
      }
      if (q) {
        params.push(`%${String(q).toLowerCase()}%`);
        where += ` AND (LOWER(titulo) LIKE $${params.length} OR LOWER(conteudo) LIKE $${params.length})`;
      }
      const rows = await AppDataSource.query(
        `SELECT id, empresa_id, departamento_id, slug, titulo, tipo, tags,
                LEFT(conteudo, 200) AS preview,
                criado_em, atualizado_em
         FROM rh_escala_memoria
         WHERE ${where}
         ORDER BY tipo ASC, titulo ASC`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[RhEscalaMemoria] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // GET /rh/escala/memoria/:slug?empresaId=
  static async obter(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const { empresaId } = req.query;
      const params: any[] = [slug];
      let where = `slug = $1 AND ativo = true`;
      if (empresaId) {
        params.push(empresaId);
        where += ` AND (empresa_id = $${params.length} OR empresa_id IS NULL)`;
      } else {
        where += ` AND empresa_id IS NULL`;
      }
      const [row] = await AppDataSource.query(
        `SELECT * FROM rh_escala_memoria WHERE ${where} ORDER BY empresa_id NULLS LAST LIMIT 1`,
        params
      );
      if (!row) return res.status(404).json({ error: 'Nota nao encontrada' });

      // Backlinks: quem referencia este slug em [[slug]]
      const backlinks = await AppDataSource.query(
        `SELECT slug, titulo, tipo
         FROM rh_escala_memoria
         WHERE ativo = true
           AND conteudo ~ ('\\[\\[' || $1 || '(\\|[^\\]]+)?\\]\\]')
           AND slug <> $1
         ORDER BY titulo ASC`,
        [row.slug]
      );

      res.json({ ...row, backlinks });
    } catch (e: any) {
      console.error('[RhEscalaMemoria] obter:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/escala/memoria
  static async criar(req: Request, res: Response) {
    try {
      const { empresaId, departamentoId, titulo, tipo, tags, conteudo, slug: slugInput } = req.body;
      if (!titulo) return res.status(400).json({ error: 'titulo obrigatorio' });

      const slug = slugify(slugInput || titulo);
      // Detecta conflito de slug na mesma empresa
      const [conflict] = await AppDataSource.query(
        `SELECT id FROM rh_escala_memoria
         WHERE slug = $1 AND COALESCE(empresa_id::text,'') = COALESCE($2::text,'') LIMIT 1`,
        [slug, empresaId || null]
      );
      if (conflict) return res.status(409).json({ error: 'Ja existe nota com esse slug nesta empresa' });

      const [row] = await AppDataSource.query(
        `INSERT INTO rh_escala_memoria (empresa_id, departamento_id, slug, titulo, tipo, tags, conteudo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          empresaId || null,
          departamentoId || null,
          slug,
          titulo,
          tipo || 'outro',
          Array.isArray(tags) ? tags : [],
          conteudo || '',
        ]
      );
      res.json(row);
    } catch (e: any) {
      console.error('[RhEscalaMemoria] criar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/escala/memoria/:id
  static async atualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { titulo, tipo, tags, conteudo, departamentoId } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_escala_memoria
         SET titulo = COALESCE($2, titulo),
             tipo = COALESCE($3, tipo),
             tags = COALESCE($4, tags),
             conteudo = COALESCE($5, conteudo),
             departamento_id = $6,
             atualizado_em = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, titulo, tipo, tags, conteudo, departamentoId ?? null]
      );
      if (!row) return res.status(404).json({ error: 'Nota nao encontrada' });
      res.json(row);
    } catch (e: any) {
      console.error('[RhEscalaMemoria] atualizar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/escala/memoria/upload-doc
  // multipart/form-data: file + tipo + empresaId(opcional) + departamentoId(opcional)
  // Le PDF/Excel/Imagem, extrai texto (Vision se for foto), estrutura via GPT, salva como memoria.
  static async uploadDocumento(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      const { tipo, empresaId, departamentoId } = req.body;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      if (!tipo) return res.status(400).json({ error: 'tipo obrigatorio (cct_sindicato | escala_historica | regulamento_interno | acordo_coletivo | restricao_colaborador)' });

      console.log(`[UploadDoc] Processando ${file.originalname} (${file.size} bytes, tipo=${tipo})`);

      // 1) Extracao de texto
      const extracao = await DocumentoEscalaService.extrairTexto(file.buffer, file.mimetype, file.originalname);
      console.log(`[UploadDoc] Extraido ${extracao.textoBruto.length} chars via ${extracao.tipoFonte}`);

      if (extracao.textoBruto.length < 30) {
        return res.status(400).json({ error: 'Nao consegui extrair conteudo legivel do arquivo. Tente outro formato ou foto melhor.' });
      }

      // 2) Estruturacao GPT
      const { estrutura, resumoHumano, titulo, tags } = await DocumentoEscalaService.estruturar(
        extracao.textoBruto,
        tipo as TipoDocumento
      );

      // 3) Salva em rh_escala_memoria
      let slug = slugify(titulo);
      // Evita conflito: append timestamp se ja existir
      const [conflict] = await AppDataSource.query(
        `SELECT id FROM rh_escala_memoria WHERE slug = $1 AND COALESCE(empresa_id::text,'') = COALESCE($2::text,'') LIMIT 1`,
        [slug, empresaId || null]
      );
      if (conflict) slug = `${slug}-${Date.now()}`;

      const [row] = await AppDataSource.query(
        `INSERT INTO rh_escala_memoria (empresa_id, departamento_id, slug, titulo, tipo, tags, conteudo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          empresaId || null,
          departamentoId || null,
          slug,
          titulo,
          tipo,
          tags,
          resumoHumano,
        ]
      );

      res.json({
        success: true,
        memoria: row,
        estrutura,
        meta: {
          arquivo: file.originalname,
          tamanho_bytes: file.size,
          fonte_extracao: extracao.tipoFonte,
          chars_extraidos: extracao.textoBruto.length,
        },
      });
    } catch (e: any) {
      console.error('[RhEscalaMemoria] uploadDocumento erro:', e);
      res.status(500).json({ error: e.message || 'Falha ao processar documento' });
    }
  }

  // DELETE /rh/escala/memoria/:id (soft delete)
  static async deletar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await AppDataSource.query(
        `UPDATE rh_escala_memoria SET ativo = false, atualizado_em = NOW() WHERE id = $1`,
        [id]
      );
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[RhEscalaMemoria] deletar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ============ Busca para o agente IA ============
  // POST /rh/escala/memoria/buscar-relevantes
  // body: { empresaId, departamentoId?, query, colaboradores? }
  // Retorna ate ~8 notas relevantes pra injetar no system prompt.
  static async buscarRelevantes(req: Request, res: Response) {
    try {
      const { empresaId, departamentoId, query, colaboradores } = req.body;
      const params: any[] = [];
      let where = `ativo = true`;
      if (empresaId) {
        params.push(empresaId);
        where += ` AND (empresa_id = $${params.length} OR empresa_id IS NULL)`;
      }

      // Sempre carregar notas do setor atual (se houver) + globais
      const setorClause = departamentoId
        ? `(departamento_id = ${parseInt(departamentoId)} OR departamento_id IS NULL)`
        : `departamento_id IS NULL`;

      // Termos: palavras da query + slugs de colaboradores conhecidos
      const termos: string[] = [];
      if (query) {
        String(query)
          .toLowerCase()
          .split(/[^a-zA-Z0-9À-ſ]+/)
          .filter((w) => w.length >= 3)
          .forEach((w) => termos.push(w));
      }
      if (Array.isArray(colaboradores)) {
        colaboradores.forEach((c: any) => {
          if (c?.nome) {
            const s = slugify(c.nome);
            if (s) termos.push(s);
            String(c.nome).toLowerCase().split(/\s+/).forEach((w: string) => {
              if (w.length >= 3) termos.push(w);
            });
          }
        });
      }

      const termosUnicos = [...new Set(termos)].slice(0, 30);

      let relevantes: any[] = [];
      if (termosUnicos.length) {
        const orClauses: string[] = [];
        termosUnicos.forEach((t) => {
          params.push(`%${t}%`);
          orClauses.push(`LOWER(titulo) LIKE $${params.length}`);
          params.push(`%${t}%`);
          orClauses.push(`LOWER(conteudo) LIKE $${params.length}`);
          params.push(t);
          orClauses.push(`slug = $${params.length}`);
        });
        relevantes = await AppDataSource.query(
          `SELECT slug, titulo, tipo, conteudo, tags
           FROM rh_escala_memoria
           WHERE ${where} AND ${setorClause} AND (${orClauses.join(' OR ')})
           LIMIT 8`,
          params
        );
      }

      // Sempre incluir notas de tipo 'padrao' globais + notas do setor (mesmo sem match)
      const sempre = await AppDataSource.query(
        `SELECT slug, titulo, tipo, conteudo, tags
         FROM rh_escala_memoria
         WHERE ativo = true
           AND (tipo = 'padrao' OR (tipo = 'setor' AND departamento_id = $1))
           ${empresaId ? `AND (empresa_id = $2 OR empresa_id IS NULL)` : ''}
         LIMIT 4`,
        empresaId ? [departamentoId || -1, empresaId] : [departamentoId || -1]
      );

      // Merge sem duplicar slug
      const map = new Map<string, any>();
      [...sempre, ...relevantes].forEach((n) => map.set(n.slug, n));
      res.json([...map.values()]);
    } catch (e: any) {
      console.error('[RhEscalaMemoria] buscarRelevantes:', e);
      res.status(500).json({ error: e.message });
    }
  }
}

export { slugify, extrairLinks };
