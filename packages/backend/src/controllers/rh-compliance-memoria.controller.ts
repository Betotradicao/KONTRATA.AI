import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { DocumentoEscalaService } from '../services/documento-escala.service';

// "Base de Conhecimento" do Agente Compliance — notas markdown + PDFs lidos pela IA.
// Categorias: sindicato | acordo_coletivo | regimento_interno | aprendizado_feedback | outro
// Tabela rh_compliance_memoria (mesmo formato do vault da Escala, separado).

function slugify(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140) || 'sem-titulo';
}

export class RhComplianceMemoriaController {
  // GET /rh/compliance/memoria?empresaId=&tipo=&q=
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
         FROM rh_compliance_memoria
         WHERE ${where}
         ORDER BY tipo ASC, titulo ASC`,
        params
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[RhComplianceMemoria] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // GET /rh/compliance/memoria/:slug?empresaId=
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
        `SELECT * FROM rh_compliance_memoria WHERE ${where} ORDER BY empresa_id NULLS LAST LIMIT 1`,
        params
      );
      if (!row) return res.status(404).json({ error: 'Nota nao encontrada' });

      const backlinks = await AppDataSource.query(
        `SELECT slug, titulo, tipo
         FROM rh_compliance_memoria
         WHERE ativo = true
           AND conteudo ~ ('\\[\\[' || $1 || '(\\|[^\\]]+)?\\]\\]')
           AND slug <> $1
         ORDER BY titulo ASC`,
        [row.slug]
      );

      res.json({ ...row, backlinks });
    } catch (e: any) {
      console.error('[RhComplianceMemoria] obter:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/compliance/memoria
  static async criar(req: Request, res: Response) {
    try {
      const { empresaId, departamentoId, titulo, tipo, tags, conteudo, slug: slugInput } = req.body;
      if (!titulo) return res.status(400).json({ error: 'titulo obrigatorio' });

      const slug = slugify(slugInput || titulo);
      const [conflict] = await AppDataSource.query(
        `SELECT id FROM rh_compliance_memoria
         WHERE slug = $1 AND COALESCE(empresa_id::text,'') = COALESCE($2::text,'') LIMIT 1`,
        [slug, empresaId || null]
      );
      if (conflict) return res.status(409).json({ error: 'Ja existe nota com esse slug nesta empresa' });

      const [row] = await AppDataSource.query(
        `INSERT INTO rh_compliance_memoria (empresa_id, departamento_id, slug, titulo, tipo, tags, conteudo)
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
      console.error('[RhComplianceMemoria] criar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /rh/compliance/memoria/:id
  static async atualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { titulo, tipo, tags, conteudo, departamentoId } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_compliance_memoria
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
      console.error('[RhComplianceMemoria] atualizar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // DELETE /rh/compliance/memoria/:id (soft delete)
  static async deletar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await AppDataSource.query(
        `UPDATE rh_compliance_memoria SET ativo = false, atualizado_em = NOW() WHERE id = $1`,
        [id]
      );
      res.json({ ok: true });
    } catch (e: any) {
      console.error('[RhComplianceMemoria] deletar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /rh/compliance/memoria/upload-doc
  // multipart: file + tipo + empresaId(opcional)
  // Le PDF/Excel/Imagem, extrai o TEXTO INTEGRAL e salva como nota (sem resumir —
  // guarda tudo que esta escrito pra IA consultar depois).
  static async uploadDocumento(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      const { tipo, empresaId } = req.body;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      if (!tipo) return res.status(400).json({ error: 'tipo obrigatorio' });

      console.log(`[ComplianceUpload] Processando ${file.originalname} (${file.size} bytes, tipo=${tipo})`);
      const extracao = await DocumentoEscalaService.extrairTexto(file.buffer, file.mimetype, file.originalname);
      if (extracao.textoBruto.length < 30) {
        return res.status(400).json({ error: 'Nao consegui extrair conteudo legivel do arquivo. Tente outro formato ou foto melhor.' });
      }

      const baseNome = (file.originalname || 'Documento').replace(/\.[^.]+$/, '').slice(0, 180);
      let slug = slugify(baseNome);
      const [conflict] = await AppDataSource.query(
        `SELECT id FROM rh_compliance_memoria WHERE slug = $1 AND COALESCE(empresa_id::text,'') = COALESCE($2::text,'') LIMIT 1`,
        [slug, empresaId || null]
      );
      if (conflict) slug = `${slug}-${Date.now()}`;

      // Guarda o texto integral. Cabecalho leve com a origem.
      const conteudo = `> 📎 Importado de **${file.originalname}** (${extracao.tipoFonte}, ${extracao.textoBruto.length} caracteres)\n\n${extracao.textoBruto}`;

      const [row] = await AppDataSource.query(
        `INSERT INTO rh_compliance_memoria (empresa_id, departamento_id, slug, titulo, tipo, tags, conteudo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [empresaId || null, null, slug, baseNome, tipo, [], conteudo]
      );

      res.json({
        success: true,
        memoria: row,
        meta: {
          arquivo: file.originalname,
          tamanho_bytes: file.size,
          fonte_extracao: extracao.tipoFonte,
          chars_extraidos: extracao.textoBruto.length,
        },
      });
    } catch (e: any) {
      console.error('[RhComplianceMemoria] uploadDocumento:', e?.message);
      const msg = String(e?.message || '');
      // Caso comum: PDF de imagem/design (sem texto selecionavel) cai no Vision,
      // que exige chave OpenAI valida. Traduz o erro cru ("status code 401") num aviso util.
      const aviso = /401|API key|api-keys|Incorrect API/i.test(msg)
        ? 'Este arquivo não tem texto selecionável (parece um PDF de imagem/design). A leitura por imagem precisa de uma chave OpenAI válida em Configurações → IA → Chave API. Dica: para regimento/sindicato, use um PDF com texto real (não escaneado) — esses são lidos direto, sem OpenAI.'
        : (msg || 'Falha ao processar documento');
      res.status(500).json({ error: aviso });
    }
  }
}
