import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Modelos de documentos padronizados da empresa.
 * O cliente edita o texto (com variaveis $NOME$, $CPF$, $DATA_EXTENSO$ etc)
 * e usa pra gerar documentos prontos pros colaboradores.
 */
export class DocsPadronizadosController {
  static async listar(req: AuthRequest, res: Response) {
    try {
      const fase = req.query.fase ? parseInt(req.query.fase as string) : null;
      const params: any[] = [];
      let where = 'WHERE ativo = true';
      if (fase) { params.push(fase); where += ` AND fase = $${params.length}`; }
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_docs_padronizados ${where} ORDER BY ordem, nome`,
        params
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
      const { nome, descricao, titulo, conteudo, ordem, fase } = req.body;
      if (!nome || !titulo || !conteudo) {
        return res.status(400).json({ error: 'nome, titulo e conteudo são obrigatórios' });
      }
      const faseVal = fase === 1 || fase === 2 ? fase : 2;
      const [{ max }] = await AppDataSource.query(
        `SELECT COALESCE(MAX(ordem), 0)::int AS max FROM rh_docs_padronizados WHERE fase = $1`,
        [faseVal]
      );
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, fase)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [nome, descricao || null, titulo, conteudo, ordem ?? max + 1, faseVal]
      );
      res.status(201).json(row);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, descricao, titulo, conteudo, ativo, ordem, fase } = req.body;
      const [row] = await AppDataSource.query(
        `UPDATE rh_docs_padronizados SET
           nome      = COALESCE($1, nome),
           descricao = COALESCE($2, descricao),
           titulo    = COALESCE($3, titulo),
           conteudo  = COALESCE($4, conteudo),
           ativo     = COALESCE($5, ativo),
           ordem     = COALESCE($6, ordem),
           fase      = COALESCE($7, fase),
           updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [nome ?? null, descricao ?? null, titulo ?? null, conteudo ?? null, ativo ?? null, ordem ?? null, fase ?? null, id]
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
      const motivoId = req.query.motivo_id ? parseInt(req.query.motivo_id as string) : null;

      const [doc] = await AppDataSource.query(
        `SELECT * FROM rh_docs_padronizados WHERE id = $1`, [id]
      );
      if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });

      const [colab] = await AppDataSource.query(
        `SELECT c.id, c.nome, c.cpf, c.rg, c.matricula,
                c.ctps, c.serie_ctps, c.data_admissao, c.endereco,
                c.bairro AS colab_bairro, c.cidade AS colab_cidade,
                c.estado AS colab_estado, c.cep AS colab_cep,
                ca.nome AS cargo_nome,
                COALESCE(comp.apelido, comp.nome_fantasia, comp.razao_social) AS empresa_nome,
                comp.razao_social AS empresa_razao_social,
                comp.cnpj AS empresa_cnpj,
                comp.cidade AS empresa_cidade,
                comp.estado AS empresa_estado,
                comp.rua AS empresa_rua,
                comp.numero AS empresa_numero,
                comp.bairro AS empresa_bairro,
                comp.cep AS empresa_cep,
                comp.foto_fachada_url AS empresa_foto_fachada,
                (
                  SELECT jsonb_agg(jsonb_build_object('nome', e.nome, 'ca', e.ca) ORDER BY e.nome)
                  FROM rh_epis_epcs e
                  WHERE e.id = ANY(
                    ARRAY(SELECT jsonb_array_elements_text(COALESCE(ca.epis_epcs_obrigatorios_ids, '[]'::jsonb))::int)
                  )
                  AND e.tipo = 'epi' AND e.ativo = true
                ) AS epis_lista_json
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_empresas comp ON comp.id = c.company_id
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

      // Formata data (DATE do banco) para dd/mm/yyyy
      const formatData = (d: any) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      };

      // Motivo de advertência (opcional, usado em docs com $MOTIVO_ADVERTENCIA$).
      // Aceita motivo_id na query string. Substitui pelo texto + artigo de embasamento.
      let motivoAdvertencia = '';
      if (motivoId) {
        try {
          const [m] = await AppDataSource.query(
            `SELECT nome, texto, artigo FROM rh_motivos_advertencia WHERE id = $1`,
            [motivoId]
          );
          if (m) motivoAdvertencia = m.artigo ? `${m.texto} (${m.artigo})` : m.texto;
        } catch { /* tabela pode ainda não existir em clientes que não rodaram a migration */ }
      }

      // Endereço da empresa = rua + ", " + numero (bairro/CEP têm vars próprias)
      const empresaEndereco = colab.empresa_rua
        ? colab.empresa_rua + (colab.empresa_numero ? `, ${colab.empresa_numero}` : '')
        : '';

      // Lista de EPIs obrigatórios do cargo (array estruturado vindo de jsonb_agg).
      // Usado tanto pra montar o texto plano de $EPIS_DO_CARGO$ quanto pra
      // alimentar a tabela ($EPIS_TABELA$ — token tratado no frontend, não
      // substituído aqui — render via resultado.epis_lista).
      const episLista: { nome: string; ca: string | null }[] = Array.isArray(colab.epis_lista_json)
        ? colab.epis_lista_json
        : [];
      const episDoCargoTexto = episLista.length
        ? episLista.map(e => `(  ) ${e.nome}`).join('\n')
        : '(nenhum EPI obrigatório cadastrado para este cargo)';

      const vars: Record<string, string> = {
        '$NOME$':         colab.nome || '',
        '$CPF$':          formatCpf(colab.cpf),
        '$RG$':           colab.rg || '',
        '$MATRICULA$':    colab.matricula || '',
        '$CARGO$':        colab.cargo_nome || '',
        '$CTPS$':         colab.ctps || '',
        '$SERIE_CTPS$':   colab.serie_ctps || '',
        '$ADMISSAO$':     formatData(colab.data_admissao),
        '$ENDERECO$':     colab.endereco || '',
        '$COLAB_BAIRRO$': colab.colab_bairro || '',
        '$COLAB_CIDADE$': colab.colab_cidade || '',
        '$COLAB_ESTADO$': colab.colab_estado || '',
        '$COLAB_CEP$':    colab.colab_cep || '',
        '$DATA_HOJE$':    `${dd}/${mm}/${yyyy}`,
        '$DATA_EXTENSO$': dataExtenso,
        '$EMPRESA_NOME$': colab.empresa_nome || '',
        '$EMPRESA_CNPJ$': colab.empresa_cnpj || '',
        '$EMPRESA_ENDERECO$': empresaEndereco,
        '$EMPRESA_BAIRRO$': colab.empresa_bairro || '',
        '$EMPRESA_CEP$': colab.empresa_cep || '',
        '$EPIS_DO_CARGO$': episDoCargoTexto,
        '$MOTIVO_ADVERTENCIA$': motivoAdvertencia,
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
        epis_lista: episLista, // usado pelo token $EPIS_TABELA$ (renderizado no front)
        gerado_em: hoje.toISOString(),
      });
    } catch (e: any) {
      console.error('[DocsPadronizados] gerar:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
