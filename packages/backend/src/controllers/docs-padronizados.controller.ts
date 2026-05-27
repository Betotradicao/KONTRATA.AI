import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Modelos de documentos padronizados da empresa.
 * O cliente edita o texto (com variaveis $NOME$, $CPF$, $DATA_EXTENSO$ etc)
 * e usa pra gerar documentos prontos pros colaboradores.
 */
export class DocsPadronizadosController {
  static async listar(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_docs_padronizados WHERE ativo = true ORDER BY ordem, nome`
      );
      res.json(rows);
    } catch (e: any) {
      console.error('[DocsPadronizados] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async obter(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [row] = await AppDataSource.query(
        `SELECT * FROM rh_docs_padronizados WHERE id = $1`,
        [id]
      );
      if (!row) return res.status(404).json({ error: 'Documento não encontrado' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async criar(req: AuthRequest, res: Response) {
    try {
      const { nome, descricao, titulo, conteudo, ordem } = req.body;
      if (!nome || !titulo || !conteudo) {
        return res.status(400).json({ error: 'nome, titulo e conteudo são obrigatórios' });
      }
      const [{ max }] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS max FROM rh_docs_padronizados`
      );
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nome, descricao || null, titulo, conteudo, ordem ?? max + 1]
      );
      res.status(201).json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, descricao, titulo, conteudo, ativo, ordem } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_docs_padronizados SET
           nome      = COALESCE($1, nome),
           descricao = COALESCE($2, descricao),
           titulo    = COALESCE($3, titulo),
           conteudo  = COALESCE($4, conteudo),
           ativo     = COALESCE($5, ativo),
           ordem     = COALESCE($6, ordem),
           updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [nome ?? null, descricao ?? null, titulo ?? null, conteudo ?? null, ativo ?? null, ordem ?? null, id]
      );
      if (!row) return res.status(404).json({ error: 'Documento não encontrado' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async deletar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await AppDataSource.query(
        `SELECT protegido FROM rh_docs_padronizados WHERE id = $1`, [id]
      );
      if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });
      if (doc.protegido) return res.status(403).json({ error: 'Documento padrão do sistema não pode ser excluído.' });
      await AppDataSource.query(`DELETE FROM rh_docs_padronizados WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  /**
   * Gera o conteúdo substituindo as variáveis $NOME$ etc pelos dados do
   * colaborador. Retorna { titulo, conteudo, colaborador } pronto pra
   * exibir/imprimir no frontend.
   */
  static async gerarParaColaborador(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const colaboradorId = parseInt(req.params.colaboradorId);

      const [doc] = await AppDataSource.query(
        `SELECT * FROM rh_docs_padronizados WHERE id = $1`, [id]
      );
      if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

      const [colab] = await AppDataSource.query(
        `SELECT c.id, c.nome, c.cpf, c.rg, c.matricula,
                ca.nome AS cargo_nome,
                COALESCE(comp.apelido, comp.nome_fantasia) AS empresa_nome,
                comp.nome_fantasia AS empresa_nome_fantasia,
                comp.cnpj AS empresa_cnpj,
                comp.cidade AS empresa_cidade,
                comp.estado AS empresa_estado,
                comp.foto_fachada_url AS empresa_foto_fachada
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN companies comp ON comp.id = c.company_id
         WHERE c.id = $1`,
        [colaboradorId]
      );
      if (!colab) return res.status(404).json({ error: 'Colaborador não encontrado' });

      // Logo da empresa: prioridade pra client_logo_url (Personalização do
      // Sistema, base64 ou URL); fallback pra foto_fachada da empresa.
      let logoUrl: string | null = null;
      try {
        const [logoCfg] = await AppDataSource.query(
          `SELECT value FROM configurations WHERE key = 'client_logo_url' LIMIT 1`
        );
        if (logoCfg?.value) logoUrl = logoCfg.value;
      } catch { /* ignore */ }
      if (!logoUrl && colab.empresa_foto_fachada) logoUrl = colab.empresa_foto_fachada;

      const hoje = new Date();
      const dd = String(hoje.getDate()).padStart(2, '0');
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      const yyyy = hoje.getFullYear();
      const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                     'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${yyyy}`;

      // Formata CPF se vier sem máscara
      const formatCpf = (cpf: string | null) => {
        if (!cpf) return '';
        const d = String(cpf).replace(/\D/g, '');
        if (d.length !== 11) return cpf;
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
      };

      const vars: Record<string, string> = {
        '$NOME$':         colab.nome || '',
        '$CPF$':          formatCpf(colab.cpf),
        '$RG$':           colab.rg || '',
        '$MATRICULA$':    colab.matricula || '',
        '$CARGO$':        colab.cargo_nome || '',
        '$DATA_HOJE$':    `${dd}/${mm}/${yyyy}`,
        '$DATA_EXTENSO$': dataExtenso,
        '$EMPRESA_NOME$': colab.empresa_nome || '',
        '$EMPRESA_CNPJ$': colab.empresa_cnpj || '',
        '$CIDADE$':       colab.empresa_cidade || '',
        '$ESTADO$':       colab.empresa_estado || '',
      };

      let conteudo = doc.conteudo;
      let titulo = doc.titulo;
      for (const [k, v] of Object.entries(vars)) {
        const re = new RegExp(k.replace(/\$/g, '\\$'), 'g');
        conteudo = conteudo.replace(re, v);
        titulo = titulo.replace(re, v);
      }

      res.json({
        documento: { id: doc.id, nome: doc.nome },
        titulo,
        conteudo,
        logo_url: logoUrl,
        empresa_nome: colab.empresa_nome,
        colaborador: { id: colab.id, nome: colab.nome },
        gerado_em: hoje.toISOString(),
      });
    } catch (e: any) {
      console.error('[DocsPadronizados] gerar:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
