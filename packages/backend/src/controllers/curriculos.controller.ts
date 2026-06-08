import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CurriculoCargo } from '../entities/CurriculoCargo';
import { CurriculoHabilidade } from '../entities/CurriculoHabilidade';
import { CurriculoTipoVaga } from '../entities/CurriculoTipoVaga';
import { Curriculo, CurriculoStatus } from '../entities/Curriculo';
import { Company } from '../entities/Company';
import { RhEmpresa } from '../entities/RhEmpresa';
import { ILike } from 'typeorm';
import { minioService } from '../services/minio.service';

export class CurriculosController {
  // ========== CARGOS (catalogo editavel) ==========
  static async listarCargos(_req: Request, res: Response) {
    try {
      const cargos = await AppDataSource.getRepository(CurriculoCargo).find({
        order: { ordem: 'ASC', nome: 'ASC' },
      });
      res.json({ success: true, cargos });
    } catch (e: any) {
      console.error('[Curriculos] listarCargos:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarCargo(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'nome obrigatorio' });
      const repo = AppDataSource.getRepository(CurriculoCargo);
      const existe = await repo.findOne({ where: { nome: ILike(nome.trim()) } });
      if (existe) return res.status(400).json({ success: false, error: 'Cargo ja existe' });
      const cargo = repo.create({ nome: nome.trim().toUpperCase(), ativo: true });
      await repo.save(cargo);
      res.json({ success: true, cargo });
    } catch (e: any) {
      console.error('[Curriculos] criarCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarCargo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, ativo, ordem } = req.body;
      const repo = AppDataSource.getRepository(CurriculoCargo);
      const cargo = await repo.findOne({ where: { id } });
      if (!cargo) return res.status(404).json({ success: false, error: 'Cargo nao encontrado' });
      if (nome !== undefined) cargo.nome = String(nome).trim().toUpperCase();
      if (ativo !== undefined) cargo.ativo = !!ativo;
      if (ordem !== undefined) cargo.ordem = Number(ordem) || 0;
      await repo.save(cargo);
      res.json({ success: true, cargo });
    } catch (e: any) {
      console.error('[Curriculos] atualizarCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarCargo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(CurriculoCargo);
      const cargo = await repo.findOne({ where: { id } });
      if (!cargo) return res.status(404).json({ success: false, error: 'Cargo nao encontrado' });
      await repo.remove(cargo);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== HABILIDADES (catalogo editavel) ==========
  static async listarHabilidades(_req: Request, res: Response) {
    try {
      const habilidades = await AppDataSource.getRepository(CurriculoHabilidade).find({
        order: { ordem: 'ASC', nome: 'ASC' },
      });
      res.json({ success: true, habilidades });
    } catch (e: any) {
      console.error('[Curriculos] listarHabilidades:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarHabilidade(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'nome obrigatorio' });
      const repo = AppDataSource.getRepository(CurriculoHabilidade);
      const existe = await repo.findOne({ where: { nome: ILike(nome.trim()) } });
      if (existe) return res.status(400).json({ success: false, error: 'Habilidade ja existe' });
      const h = repo.create({ nome: nome.trim().toUpperCase(), ativo: true });
      await repo.save(h);
      res.json({ success: true, habilidade: h });
    } catch (e: any) {
      console.error('[Curriculos] criarHabilidade:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarHabilidade(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, ativo, ordem } = req.body;
      const repo = AppDataSource.getRepository(CurriculoHabilidade);
      const h = await repo.findOne({ where: { id } });
      if (!h) return res.status(404).json({ success: false, error: 'Habilidade nao encontrada' });
      if (nome !== undefined) h.nome = String(nome).trim().toUpperCase();
      if (ativo !== undefined) h.ativo = !!ativo;
      if (ordem !== undefined) h.ordem = Number(ordem) || 0;
      await repo.save(h);
      res.json({ success: true, habilidade: h });
    } catch (e: any) {
      console.error('[Curriculos] atualizarHabilidade:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarHabilidade(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(CurriculoHabilidade);
      const h = await repo.findOne({ where: { id } });
      if (!h) return res.status(404).json({ success: false, error: 'Habilidade nao encontrada' });
      await repo.remove(h);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarHabilidade:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== TIPOS DE VAGA (catalogo editavel) ==========
  static async listarTiposVaga(_req: Request, res: Response) {
    try {
      const tipos = await AppDataSource.getRepository(CurriculoTipoVaga).find({
        order: { ordem: 'ASC', nome: 'ASC' },
      });
      res.json({ success: true, tipos });
    } catch (e: any) {
      console.error('[Curriculos] listarTiposVaga:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarTipoVaga(req: Request, res: Response) {
    try {
      const { nome, slug } = req.body;
      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'nome obrigatorio' });
      const slugFinal = (slug || nome).toString().trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!slugFinal) return res.status(400).json({ success: false, error: 'slug invalido' });
      const repo = AppDataSource.getRepository(CurriculoTipoVaga);
      const existe = await repo.findOne({ where: { slug: slugFinal } });
      if (existe) return res.status(400).json({ success: false, error: 'Tipo de vaga ja existe' });
      const tipo = repo.create({ slug: slugFinal, nome: nome.trim(), ativo: true });
      await repo.save(tipo);
      res.json({ success: true, tipo });
    } catch (e: any) {
      console.error('[Curriculos] criarTipoVaga:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarTipoVaga(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, ativo, ordem } = req.body;
      const repo = AppDataSource.getRepository(CurriculoTipoVaga);
      const tipo = await repo.findOne({ where: { id } });
      if (!tipo) return res.status(404).json({ success: false, error: 'Tipo de vaga nao encontrado' });
      if (nome !== undefined) tipo.nome = String(nome).trim();
      if (ativo !== undefined) tipo.ativo = !!ativo;
      if (ordem !== undefined) tipo.ordem = Number(ordem) || 0;
      await repo.save(tipo);
      res.json({ success: true, tipo });
    } catch (e: any) {
      console.error('[Curriculos] atualizarTipoVaga:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarTipoVaga(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(CurriculoTipoVaga);
      const tipo = await repo.findOne({ where: { id } });
      if (!tipo) return res.status(404).json({ success: false, error: 'Tipo de vaga nao encontrado' });
      // Protege CLT/aprendiz contra exclusao acidental (so desativa)
      if (tipo.slug === 'clt' || tipo.slug === 'aprendiz') {
        return res.status(400).json({ success: false, error: 'Tipos padrao (CLT, Aprendiz) nao podem ser excluidos. Desative ao inves disso.' });
      }
      await repo.remove(tipo);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarTipoVaga:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== PUBLICO (formulario do candidato) ==========

  /** Lista vagas abertas pra exibir ao candidato apos ele escolher a loja */
  static async listarVagasPublicasPorLoja(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja != null && req.query.cod_loja !== ''
        ? Number(req.query.cod_loja) : null;
      const params: any[] = [];
      let where = `v.status = 'Aberta' OR v.status = 'Em Selecao'`;
      if (codLoja != null) {
        params.push(codLoja);
        where = `(v.status = 'Aberta' OR v.status = 'Em Selecao') AND (v.cod_loja IS NULL OR v.cod_loja = $${params.length})`;
      }
      const rows = await AppDataSource.query(
        `SELECT v.id, v.titulo, v.descricao, v.requisitos, v.beneficios,
                v.salario_min, v.experiencia_obrigatoria, v.experiencia_meses_minimo,
                v.turnos, v.cod_loja, v.data_abertura,
                v.hora_entrada, v.hora_almoco_ini, v.hora_almoco_fim, v.hora_saida,
                ca.nome AS cargo_nome
         FROM rh_vagas v
         LEFT JOIN rh_cargos ca ON ca.id = v.cargo_id
         WHERE ${where}
         ORDER BY v.id DESC LIMIT 50`,
        params
      );
      res.json({ vagas: rows });
    } catch (e: any) {
      console.error('listarVagasPublicasPorLoja error:', e);
      res.status(500).json({ vagas: [], error: e.message });
    }
  }

  /** Devolve as listas ativas de cargos, habilidades e lojas para o formulario publico */
  static async obterFormularioPublico(_req: Request, res: Response) {
    try {
      const [cargos, habilidades, tiposVaga, lojas, configsResult, beneficiosCat] = await Promise.all([
        AppDataSource.getRepository(CurriculoCargo).find({ where: { ativo: true }, order: { ordem: 'ASC', nome: 'ASC' } }),
        AppDataSource.getRepository(CurriculoHabilidade).find({ where: { ativo: true }, order: { ordem: 'ASC', nome: 'ASC' } }),
        AppDataSource.getRepository(CurriculoTipoVaga).find({ where: { ativo: true }, order: { ordem: 'ASC', nome: 'ASC' } }),
        // Fonte: rh_empresas (cadastro local do RH, independente da tabela companies global).
        // Filtra empresas com `oculto_recrutamento=true` (filiais so pra documentos, sem vaga real).
        AppDataSource.getRepository(RhEmpresa).find({
          where: { active: true, ocultoRecrutamento: false },
          select: ['id', 'codLoja', 'nomeFantasia', 'apelido', 'bairro', 'cidade', 'estado', 'fotoFachadaUrl', 'isPrincipal'],
          order: { codLoja: 'ASC' } as any,
        }),
        // Le flags do banco de configurations
        AppDataSource.query(
          `SELECT key, value FROM configurations WHERE key IN ('curriculo_disc_habilitado', 'curriculo_preentrevista_habilitada')`
        ).catch(() => []),
        // Catalogo de beneficios (com valor) pra exibir nas vagas
        AppDataSource.query(`SELECT nome, valor FROM rh_beneficios WHERE ativo IS NOT FALSE ORDER BY nome`).catch(() => []),
      ]);
      const cfgMap: Record<string, string> = {};
      (configsResult || []).forEach((c: any) => { cfgMap[c.key] = c.value; });
      res.json({
        success: true,
        cargos: cargos.map(c => c.nome),
        habilidades: habilidades.map(h => h.nome),
        tipos_vaga: tiposVaga.map(t => ({ slug: t.slug, nome: t.nome })),
        lojas: (lojas || [])
          .map(l => ({
            id: l.id,
            cod_loja: l.codLoja,
            nome: l.nomeFantasia,
            apelido: l.apelido,
            bairro: l.bairro,
            cidade: l.cidade,
            estado: l.estado,
            foto_fachada_url: l.fotoFachadaUrl,
            is_principal: !!l.isPrincipal || l.codLoja == null,
          })),
        config: {
          disc_habilitado: String(cfgMap.curriculo_disc_habilitado || 'false') === 'true',
          preentrevista_habilitada: String(cfgMap.curriculo_preentrevista_habilitada || 'false') === 'true',
        },
        beneficios_catalogo: (beneficiosCat || []).map((b: any) => ({ nome: b.nome, valor: b.valor })),
      });
    } catch (e: any) {
      console.error('[Curriculos] obterFormularioPublico:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Upload publico de foto do candidato (para o currículo) */
  static async uploadFotoPublico(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ success: false, error: 'Arquivo obrigatorio' });
      const ext = (file.originalname || 'jpg').split('.').pop() || 'jpg';
      const objectName = `curriculos/fotos/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'image/jpeg');
      res.json({ success: true, url });
    } catch (e: any) {
      console.error('[Curriculos] uploadFotoPublico:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Recebe o currículo enviado pelo candidato (publico, sem auth) */
  static async enviarCurriculoPublico(req: Request, res: Response) {
    try {
      const {
        nome, data_nascimento, whatsapp, email, instagram,
        cep, rua, numero, complemento, bairro, cidade, estado,
        cargos, habilidades, experiencia_texto, disponibilidade_turnos,
        foto_url, resumo, experiencias_detalhadas, formacoes, cursos_adicionais,
        interesse_vaga, cod_loja, vagas_interesse_ids,
      } = req.body;

      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'Nome obrigatorio' });
      if (!interesse_vaga || typeof interesse_vaga !== 'string' || !interesse_vaga.trim()) {
        return res.status(400).json({ success: false, error: 'Interesse de vaga obrigatorio' });
      }
      // Valida que o slug enviado existe na tabela de tipos ativos
      const tipoExiste = await AppDataSource.getRepository(CurriculoTipoVaga).findOne({
        where: { slug: interesse_vaga, ativo: true }
      });
      if (!tipoExiste) {
        return res.status(400).json({ success: false, error: 'Tipo de vaga invalido ou desativado' });
      }

      const repo = AppDataSource.getRepository(Curriculo);
      const cv = repo.create({
        nome: String(nome).trim(),
        data_nascimento: data_nascimento || null,
        whatsapp: whatsapp || null,
        email: email || null,
        instagram: instagram || null,
        linkedin: null,
        cep: cep || null,
        rua: rua || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cargos: Array.isArray(cargos) ? cargos : [],
        habilidades: Array.isArray(habilidades) ? habilidades : [],
        experiencia_texto: experiencia_texto || null,
        disponibilidade_turnos: Array.isArray(disponibilidade_turnos) ? disponibilidade_turnos : [],
        foto_url: foto_url || null,
        resumo: resumo || null,
        interesse_vaga,
        experiencias_detalhadas: Array.isArray(experiencias_detalhadas) ? experiencias_detalhadas : [],
        formacoes: Array.isArray(formacoes) ? formacoes : [],
        cursos_adicionais: Array.isArray(cursos_adicionais) ? cursos_adicionais : [],
        cod_loja: cod_loja != null && cod_loja !== '' ? Number(cod_loja) : null,
        status: 'novo',
      });
      await repo.save(cv);

      // Salva ids das vagas que o candidato marcou interesse (coluna jsonb)
      if (Array.isArray(vagas_interesse_ids) && vagas_interesse_ids.length > 0) {
        try {
          await AppDataSource.query(
            `UPDATE curriculos SET vagas_interesse_ids = $1::jsonb WHERE id = $2`,
            [JSON.stringify(vagas_interesse_ids.map(Number).filter(Boolean)), cv.id]
          );
          // Se algum candidato se candidatou, vagas viram "Em Selecao"
          await AppDataSource.query(
            `UPDATE rh_vagas SET status = 'Em Selecao' WHERE status = 'Aberta' AND id = ANY($1::int[])`,
            [vagas_interesse_ids.map(Number).filter(Boolean)]
          );
        } catch (e) { console.warn('[Curriculos] vagas_interesse save:', e); }
      }

      res.json({ success: true, id: cv.id });
    } catch (e: any) {
      console.error('[Curriculos] enviarCurriculoPublico:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== BANCO (autenticado, RH) ==========

  static async listarCurriculos(req: Request, res: Response) {
    try {
      const { cidade, bairro, cargo, habilidade, status, dataDe, dataAte, q, interesse_vaga, cod_loja } = req.query as any;
      const qb = AppDataSource.getRepository(Curriculo).createQueryBuilder('c').orderBy('c.created_at', 'DESC').take(500);
      if (cod_loja != null && cod_loja !== '') {
        const clNum = parseInt(cod_loja as string);
        if (!isNaN(clNum)) qb.andWhere('c.cod_loja = :codLoja', { codLoja: clNum });
      }
      // Comparacao tolerante a acentos: o frontend manda o valor normalizado
      // (UPPER + sem acento), o banco pode ter dados com acento. TRANSLATE
      // remove acentos da coluna ANTES de comparar.
      const ACENTOS = 'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ';
      const SEM_ACENTOS = 'AAAAAEEEEIIIIOOOOOUUUUC';
      if (cidade) qb.andWhere(
        `TRANSLATE(UPPER(TRIM(COALESCE(c.cidade, ''))), :acentos, :sem) = UPPER(TRIM(:cidade))`,
        { cidade, acentos: ACENTOS, sem: SEM_ACENTOS }
      );
      if (bairro) qb.andWhere(
        `TRANSLATE(UPPER(TRIM(COALESCE(c.bairro, ''))), :acentos, :sem) = UPPER(TRIM(:bairro))`,
        { bairro, acentos: ACENTOS, sem: SEM_ACENTOS }
      );
      if (cargo) qb.andWhere(`c.cargos @> :cargo::jsonb`, { cargo: JSON.stringify([cargo]) });
      if (habilidade) qb.andWhere(`c.habilidades @> :habilidade::jsonb`, { habilidade: JSON.stringify([habilidade]) });
      if (status) qb.andWhere('c.status = :status', { status });
      if (interesse_vaga) qb.andWhere('c.interesse_vaga = :interesse', { interesse: interesse_vaga });
      if (dataDe) qb.andWhere('c.created_at >= :dataDe', { dataDe });
      if (dataAte) {
        const dt = new Date(dataAte); dt.setHours(23, 59, 59, 999);
        qb.andWhere('c.created_at <= :dataAte', { dataAte: dt });
      }
      if (q) qb.andWhere('(c.nome ILIKE :q OR c.whatsapp ILIKE :q OR c.email ILIKE :q)', { q: `%${q}%` });

      const lista = await qb.getMany();
      // Enriquecer com DISC + Entrevista amarrados ao curriculo (uma query cada, no maximo)
      const ids = lista.map(c => c.id);
      let discMap: Record<number, any> = {};
      let entrevistaMap: Record<number, any> = {};
      if (ids.length > 0) {
        const discRows: any[] = await AppDataSource.query(
          `SELECT DISTINCT ON (curriculo_id) curriculo_id, id, perfil_primario, perfil_secundario, created_at
           FROM rh_disc_resultados
           WHERE curriculo_id = ANY($1::int[])
           ORDER BY curriculo_id, created_at DESC`,
          [ids]
        ).catch(() => []);
        discRows.forEach(d => { discMap[d.curriculo_id] = d; });

        const entRows: any[] = await AppDataSource.query(
          `SELECT DISTINCT ON (curriculo_id) curriculo_id, id, token, status, finalizada_em, relatorio_json IS NOT NULL AS tem_relatorio, created_at
           FROM rh_recrutador_entrevistas
           WHERE curriculo_id = ANY($1::int[])
           ORDER BY curriculo_id, created_at DESC`,
          [ids]
        ).catch(() => []);
        entRows.forEach(e => { entrevistaMap[e.curriculo_id] = e; });
      }
      const listaEnriq = lista.map(cv => ({
        ...cv,
        disc: discMap[cv.id] ? {
          id: discMap[cv.id].id,
          perfil_primario: discMap[cv.id].perfil_primario,
          perfil_secundario: discMap[cv.id].perfil_secundario,
        } : null,
        entrevista: entrevistaMap[cv.id] ? {
          id: entrevistaMap[cv.id].id,
          token: entrevistaMap[cv.id].token,
          status: entrevistaMap[cv.id].status,
          tem_relatorio: !!entrevistaMap[cv.id].tem_relatorio,
        } : null,
      }));
      // Resumo pra cards
      const resumo = {
        total: lista.length,
        novo: lista.filter(c => c.status === 'novo').length,
        em_analise: lista.filter(c => c.status === 'em_analise').length,
        aprovado: lista.filter(c => c.status === 'aprovado').length,
        reprovado: lista.filter(c => c.status === 'reprovado').length,
        contratado: lista.filter(c => c.status === 'contratado').length,
      };
      res.json({ success: true, curriculos: listaEnriq, resumo });
    } catch (e: any) {
      console.error('[Curriculos] listarCurriculos:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async obterCurriculo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const cv = await AppDataSource.getRepository(Curriculo).findOne({ where: { id } });
      if (!cv) return res.status(404).json({ success: false, error: 'Curriculo nao encontrado' });
      res.json({ success: true, curriculo: cv });
    } catch (e: any) {
      console.error('[Curriculos] obterCurriculo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarCurriculo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status, avaliacao_rh, observacao_rh, cod_loja } = req.body;
      const repo = AppDataSource.getRepository(Curriculo);
      const cv = await repo.findOne({ where: { id } });
      if (!cv) return res.status(404).json({ success: false, error: 'Curriculo nao encontrado' });

      if (status !== undefined) {
        // Aceita aliases vindos da tela de Vagas: 'selecionado' = 'aprovado', 'recusado' = 'reprovado'
        const statusNormalizado = status === 'selecionado' ? 'aprovado'
          : status === 'recusado' ? 'reprovado'
          : status;
        const statusOk: CurriculoStatus[] = ['novo', 'em_analise', 'aprovado', 'reprovado', 'contratado'];
        if (!statusOk.includes(statusNormalizado)) return res.status(400).json({ success: false, error: 'status invalido' });
        cv.status = statusNormalizado;
      }
      if (avaliacao_rh !== undefined) {
        const n = Number(avaliacao_rh);
        cv.avaliacao_rh = isNaN(n) ? null : Math.max(0, Math.min(5, n));
      }
      if (observacao_rh !== undefined) cv.observacao_rh = observacao_rh || null;
      // Migrar curriculo de loja (botao "Migrar Loja" no modal de detalhe)
      if (cod_loja !== undefined) {
        cv.cod_loja = cod_loja != null && cod_loja !== '' ? Number(cod_loja) : null;
      }
      await repo.save(cv);
      res.json({ success: true, curriculo: cv });
    } catch (e: any) {
      console.error('[Curriculos] atualizarCurriculo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarCurriculo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(Curriculo);
      const cv = await repo.findOne({ where: { id } });
      if (!cv) return res.status(404).json({ success: false, error: 'Curriculo nao encontrado' });
      await repo.remove(cv);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarCurriculo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
}
