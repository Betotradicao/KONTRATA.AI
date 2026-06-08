import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { RhEmpresa } from '../entities/RhEmpresa';

const repo = () => AppDataSource.getRepository(RhEmpresa);

export class RhEmpresasController {
  // Lista todas as empresas do RH (ordenadas: matriz primeiro, depois por cod_loja)
  static async listar(_req: Request, res: Response) {
    try {
      const rows = await repo().find({ where: { active: true } });
      rows.sort((a, b) => {
        if (a.isPrincipal && !b.isPrincipal) return -1;
        if (!a.isPrincipal && b.isPrincipal) return 1;
        const ca = a.codLoja ?? 999999;
        const cb = b.codLoja ?? 999999;
        return ca - cb;
      });
      res.json(rows);
    } catch (e: any) {
      console.error('[RhEmpresas] listar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // Formato compativel com /companies/stores/list para dropdowns
  static async listarStores(_req: Request, res: Response) {
    try {
      const rows = await repo().find({ where: { active: true } });
      const stores = rows
        .filter(c => c.codLoja !== null && c.codLoja !== undefined)
        .sort((a, b) => (a.codLoja ?? 0) - (b.codLoja ?? 0))
        .map(c => ({
          id: c.id,
          cod_loja: c.codLoja,
          nome_fantasia: c.nomeFantasia || null,
          razao_social: c.razaoSocial || null,
          apelido: c.apelido || null,
          label: `Loja ${c.codLoja}${c.nomeFantasia ? ' - ' + c.nomeFantasia : ''}${c.apelido ? ' - ' + c.apelido : ''}`,
        }));
      res.json(stores);
    } catch (e: any) {
      console.error('[RhEmpresas] listarStores:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criar(req: Request, res: Response) {
    try {
      const b = req.body || {};
      let codLoja: number | null = null;
      if (b.codLoja != null && b.codLoja !== '') {
        const n = parseInt(String(b.codLoja), 10);
        codLoja = isNaN(n) ? null : n;
      }
      const empresa = repo().create({
        nomeFantasia: b.nomeFantasia || null,
        razaoSocial: b.razaoSocial || null,
        cnpj: b.cnpj || null,
        codLoja,
        apelido: b.apelido || null,
        isPrincipal: !!b.isPrincipal,
        responsavelNome: b.responsavelNome || null,
        responsavelEmail: b.responsavelEmail || null,
        responsavelTelefone: b.responsavelTelefone || null,
        cep: b.cep || null,
        rua: b.rua || null,
        numero: b.numero || null,
        complemento: b.complemento || null,
        bairro: b.bairro || null,
        cidade: b.cidade || null,
        estado: b.estado || null,
        telefone: b.telefone || null,
        email: b.email || null,
        fotoFachadaUrl: b.fotoFachadaUrl || null,
        ocultoRecrutamento: !!b.ocultoRecrutamento,
        active: true,
      });
      await repo().save(empresa);
      res.status(201).json(empresa);
    } catch (e: any) {
      console.error('[RhEmpresas] criar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizar(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const e = await repo().findOne({ where: { id } });
      if (!e) return res.status(404).json({ error: 'Empresa nao encontrada' });
      const b = req.body || {};
      if (b.nomeFantasia !== undefined) e.nomeFantasia = b.nomeFantasia || undefined;
      if (b.razaoSocial !== undefined) e.razaoSocial = b.razaoSocial || undefined;
      if (b.cnpj !== undefined) e.cnpj = b.cnpj || undefined;
      if (b.codLoja !== undefined) {
        if (b.codLoja === null || b.codLoja === '') e.codLoja = null;
        else {
          const n = parseInt(String(b.codLoja), 10);
          e.codLoja = isNaN(n) ? null : n;
        }
      }
      if (b.apelido !== undefined) e.apelido = b.apelido || null;
      if (b.responsavelNome !== undefined) e.responsavelNome = b.responsavelNome || undefined;
      if (b.responsavelEmail !== undefined) e.responsavelEmail = b.responsavelEmail || undefined;
      if (b.responsavelTelefone !== undefined) e.responsavelTelefone = b.responsavelTelefone || undefined;
      if (b.cep !== undefined) e.cep = b.cep || undefined;
      if (b.rua !== undefined) e.rua = b.rua || undefined;
      if (b.numero !== undefined) e.numero = b.numero || undefined;
      if (b.complemento !== undefined) e.complemento = b.complemento || undefined;
      if (b.bairro !== undefined) e.bairro = b.bairro || undefined;
      if (b.cidade !== undefined) e.cidade = b.cidade || undefined;
      if (b.estado !== undefined) e.estado = b.estado || undefined;
      if (b.telefone !== undefined) e.telefone = b.telefone || undefined;
      if (b.email !== undefined) e.email = b.email || undefined;
      if (b.fotoFachadaUrl !== undefined) e.fotoFachadaUrl = b.fotoFachadaUrl || null;
      if (b.ocultoRecrutamento !== undefined) e.ocultoRecrutamento = !!b.ocultoRecrutamento;
      if (b.active !== undefined) e.active = !!b.active;
      await repo().save(e);
      res.json(e);
    } catch (e: any) {
      console.error('[RhEmpresas] atualizar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletar(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const e = await repo().findOne({ where: { id } });
      if (!e) return res.status(404).json({ error: 'Empresa nao encontrada' });
      if (e.isPrincipal) return res.status(400).json({ error: 'Nao e possivel excluir a matriz' });
      // Verifica se algum colaborador ativo ainda aponta pra essa empresa
      const emUso = await AppDataSource.query(
        `SELECT COUNT(*)::int as n FROM rh_colaboradores WHERE company_id = $1::uuid AND status = 'ativo'`,
        [id]
      );
      if (emUso?.[0]?.n > 0) {
        return res.status(400).json({ error: `Existem ${emUso[0].n} colaborador(es) ativos vinculados a esta empresa. Transfira antes de excluir.` });
      }
      await repo().delete({ id });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[RhEmpresas] deletar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // Importa empresas da tabela global companies (copia faltantes para rh_empresas)
  static async importarDeCompanies(_req: Request, res: Response) {
    try {
      const r = await AppDataSource.query(`
        INSERT INTO rh_empresas (
          id, nome_fantasia, razao_social, cnpj, cod_loja, apelido, is_principal,
          responsavel_nome, responsavel_email, responsavel_telefone,
          cep, rua, numero, complemento, bairro, cidade, estado,
          telefone, email, active, foto_fachada_url
        )
        SELECT
          c.id, c.nome_fantasia, c.razao_social, c.cnpj, c.cod_loja, c.apelido,
          (c.cod_loja IS NULL), c.responsavel_nome, c.responsavel_email, c.responsavel_telefone,
          c.cep, c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado,
          c.telefone, c.email, COALESCE(c.active, true), c.foto_fachada_url
        FROM companies c
        WHERE NOT EXISTS (SELECT 1 FROM rh_empresas r WHERE r.id = c.id)
        RETURNING id
      `);
      res.json({ success: true, importadas: r?.length ?? 0 });
    } catch (e: any) {
      console.error('[RhEmpresas] importarDeCompanies:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
