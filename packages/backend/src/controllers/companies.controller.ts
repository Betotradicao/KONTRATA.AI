import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Company } from '../entities/Company';
import { User, UserRole } from '../entities/User';
import bcrypt from 'bcrypt';

const companyRepository = AppDataSource.getRepository(Company);
const userRepository = AppDataSource.getRepository(User);

export class CompaniesController {
  // Listar todas as empresas (apenas master)
  async index(req: Request, res: Response) {
    try {
      const companies = await companyRepository.find({
        order: { createdAt: 'DESC' }
      });

      return res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
  }

  // Buscar empresa por ID
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const company = await companyRepository.findOne({
        where: { id }
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      return res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
  }

  // Listar lojas para dropdown (apenas lojas com cod_loja definido)
  async listStores(req: Request, res: Response) {
    try {
      const companies = await companyRepository.find({
        where: { active: true },
        order: { codLoja: 'ASC' },
        select: ['id', 'codLoja', 'nomeFantasia', 'razaoSocial', 'apelido', 'identificador']
      });

      // Filtrar apenas empresas com cod_loja definido e formatar para dropdown
      const stores = companies
        .filter(c => c.codLoja !== null && c.codLoja !== undefined)
        .map(c => ({
          id: c.id,
          cod_loja: c.codLoja,
          nome_fantasia: c.nomeFantasia,
          razao_social: c.razaoSocial,
          apelido: c.apelido || c.identificador || null,
          // Label formatado: "Loja 1 - Nome Fantasia - Apelido"
          label: `Loja ${c.codLoja} - ${c.nomeFantasia}${c.apelido ? ' - ' + c.apelido : ''}`
        }));

      return res.json(stores);
    } catch (error) {
      console.error('Error listing stores:', error);
      return res.status(500).json({ error: 'Failed to list stores' });
    }
  }

  // Criar nova empresa (apenas master)
  async create(req: Request, res: Response) {
    try {
      const {
        nomeFantasia, razaoSocial, cnpj, identificador, codLoja, apelido,
        cep, rua, numero, complemento, bairro, cidade, estado,
        telefone, email, fotoFachadaUrl,
        responsavelNome, responsavelEmail, responsavelTelefone,
        adminEmail, adminPassword
      } = req.body;

      // Nenhum campo obrigatorio para loja adicional - so cadastra o que o usuario preencheu

      // Tratar codLoja - converter para número ou null
      let parsedCodLoja: number | null = null;
      if (codLoja !== null && codLoja !== '' && codLoja !== undefined) {
        const parsed = parseInt(String(codLoja), 10);
        parsedCodLoja = isNaN(parsed) ? null : parsed;
      }

      // Criar empresa com todos os campos (tudo opcional)
      const company = companyRepository.create({
        nomeFantasia: nomeFantasia || '',
        razaoSocial: razaoSocial || '',
        cnpj: cnpj || '',
        identificador: identificador || null,
        codLoja: parsedCodLoja,
        apelido: apelido && apelido.trim() !== '' ? apelido.trim() : null,
        cep: cep || null,
        rua: rua || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        telefone: telefone || null,
        email: email || null,
        fotoFachadaUrl: fotoFachadaUrl || null,
        responsavelNome: responsavelNome || null,
        responsavelEmail: responsavelEmail || null,
        responsavelTelefone: responsavelTelefone || null,
        active: true
      });

      await companyRepository.save(company);

      // Criar usuário administrador da empresa se fornecido
      if (adminEmail && adminPassword) {
        const existingUser = await userRepository.findOne({ where: { email: adminEmail } });
        if (existingUser) {
          return res.status(400).json({ error: 'Admin email already registered' });
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const adminUser = userRepository.create({
          email: adminEmail,
          password: hashedPassword,
          role: UserRole.ADMIN,
          isMaster: false,
          companyId: company.id
        });

        await userRepository.save(adminUser);
      }

      return res.status(201).json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      return res.status(500).json({ error: 'Failed to create company' });
    }
  }

  // Atualizar empresa
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        nomeFantasia, razaoSocial, cnpj, identificador, codLoja, apelido, active,
        cep, rua, numero, complemento, bairro, cidade, estado,
        telefone, email,
        responsavelNome, responsavelEmail, responsavelTelefone,
        fotoFachadaUrl
      } = req.body;

      const company = await companyRepository.findOne({ where: { id } });
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // CNPJ duplicado permitido - filiais podem ter mesmo CNPJ da matriz

      // Atualizar dados básicos
      if (nomeFantasia !== undefined) company.nomeFantasia = nomeFantasia;
      if (razaoSocial !== undefined) company.razaoSocial = razaoSocial;
      if (cnpj !== undefined) company.cnpj = cnpj;
      if (identificador !== undefined) company.identificador = identificador || null;

      // Tratar codLoja - converter para número ou null
      if (codLoja !== undefined) {
        if (codLoja === null || codLoja === '' || codLoja === 'null') {
          company.codLoja = null;
        } else {
          const parsed = parseInt(String(codLoja), 10);
          company.codLoja = isNaN(parsed) ? null : parsed;
        }
      }

      // Tratar apelido - string vazia vira null
      if (apelido !== undefined) {
        company.apelido = apelido && apelido.trim() !== '' ? apelido.trim() : null;
      }

      if (typeof active === 'boolean') company.active = active;
      if (telefone !== undefined) company.telefone = telefone;
      if (email !== undefined) company.email = email;

      // Atualizar endereço
      if (cep !== undefined) company.cep = cep;
      if (rua !== undefined) company.rua = rua;
      if (numero !== undefined) company.numero = numero;
      if (complemento !== undefined) company.complemento = complemento;
      if (bairro !== undefined) company.bairro = bairro;
      if (cidade !== undefined) company.cidade = cidade;
      if (estado !== undefined) company.estado = estado;

      // Atualizar responsável
      if (responsavelNome !== undefined) company.responsavelNome = responsavelNome;
      if (responsavelEmail !== undefined) company.responsavelEmail = responsavelEmail;
      if (responsavelTelefone !== undefined) company.responsavelTelefone = responsavelTelefone;

      // Foto da fachada da loja
      if (fotoFachadaUrl !== undefined) {
        company.fotoFachadaUrl = fotoFachadaUrl || null;
      }

      await companyRepository.save(company);

      return res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      return res.status(500).json({ error: 'Failed to update company' });
    }
  }

  // Deletar empresa (apenas master)
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const company = await companyRepository.findOne({
        where: { id }
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Verificar se há usuários vinculados
      const usersCount = await userRepository.count({ where: { companyId: id } });
      if (usersCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete company with active users. Please remove all users first.'
        });
      }

      await companyRepository.remove(company);

      return res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Error deleting company:', error);
      return res.status(500).json({ error: 'Failed to delete company' });
    }
  }

  // Buscar empresa do usuário logado
  async getMyCompany(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      console.log('🔍 getMyCompany - userId:', userId);

      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['company']
      });

      console.log('🔍 getMyCompany - user:', user ? { id: user.id, companyId: user.companyId, hasCompany: !!user.company } : null);

      if (!user) {
        console.log('❌ getMyCompany - User not found');
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.company) {
        console.log('❌ getMyCompany - No company loaded. companyId:', user.companyId);

        // Tentar buscar a empresa diretamente
        if (user.companyId) {
          const company = await companyRepository.findOne({ where: { id: user.companyId } });
          console.log('🔍 getMyCompany - Buscou empresa diretamente:', company ? { id: company.id, nome: company.nomeFantasia } : null);

          if (company) {
            return res.json(company);
          }
        }

        // Usuário MASTER não tem empresa vinculada - busca a primeira empresa disponível
        if (user.isMaster) {
          console.log('ℹ️  getMyCompany - Usuário MASTER sem empresa vinculada, buscando primeira empresa...');
          const companies = await companyRepository.find({
            order: { createdAt: 'ASC' },
            take: 1
          });
          const firstCompany = companies.length > 0 ? companies[0] : null;

          if (firstCompany) {
            console.log('✅ getMyCompany - Primeira empresa encontrada para MASTER:', { id: firstCompany.id, nome: firstCompany.nomeFantasia });
            return res.json(firstCompany);
          }

          console.log('ℹ️  getMyCompany - Nenhuma empresa cadastrada no sistema');
          return res.json(null);
        }

        return res.status(404).json({ error: 'No company associated with this user' });
      }

      console.log('✅ getMyCompany - Company found:', { id: user.company.id, nome: user.company.nomeFantasia });
      return res.json(user.company);
    } catch (error) {
      console.error('❌ Error fetching user company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
  }

  // Atualizar empresa do usuário logado (apenas admin da empresa ou master)
  async updateMyCompany(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      console.log('\n📥 updateMyCompany - Body recebido:', JSON.stringify(req.body, null, 2));

      const {
        nomeFantasia, razaoSocial, cnpj, identificador, codLoja, apelido,
        cep, rua, numero, complemento, bairro, cidade, estado,
        telefone, email,
        responsavelNome, responsavelEmail, responsavelTelefone,
        fotoFachadaUrl
      } = req.body;

      console.log('📥 updateMyCompany - codLoja:', codLoja, 'apelido:', apelido);

      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['company']
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let company: Company | null = user.company;

      // Se usuário é MASTER e não tem empresa vinculada, busca a primeira empresa
      if (!company && user.isMaster) {
        const companies = await companyRepository.find({
          order: { createdAt: 'ASC' },
          take: 1
        });
        company = companies.length > 0 ? companies[0] : null;
      }

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Verificar se usuário é admin da empresa ou master
      if (user.role !== UserRole.ADMIN && !user.isMaster) {
        return res.status(403).json({ error: 'Only company admin can update company info' });
      }

      // CNPJ duplicado permitido - filiais podem ter mesmo CNPJ da matriz

      console.log('📥 updateMyCompany - Empresa ANTES:', { codLoja: company.codLoja, apelido: company.apelido });

      // Atualizar dados básicos
      if (nomeFantasia !== undefined) company.nomeFantasia = nomeFantasia;
      if (razaoSocial !== undefined) company.razaoSocial = razaoSocial;
      if (cnpj !== undefined) company.cnpj = cnpj;
      if (identificador !== undefined) company.identificador = identificador || null;

      // Tratar codLoja - converter para número ou null
      if (codLoja !== undefined) {
        if (codLoja === null || codLoja === '' || codLoja === 'null') {
          company.codLoja = null;
        } else {
          const parsed = parseInt(String(codLoja), 10);
          company.codLoja = isNaN(parsed) ? null : parsed;
        }
      }

      // Tratar apelido - string vazia vira null
      if (apelido !== undefined) {
        company.apelido = apelido && apelido.trim() !== '' ? apelido.trim() : null;
      }

      if (telefone !== undefined) company.telefone = telefone;
      if (email !== undefined) company.email = email;

      console.log('📥 updateMyCompany - Empresa DEPOIS:', { codLoja: company.codLoja, apelido: company.apelido });

      // Atualizar endereço
      if (cep !== undefined) company.cep = cep;
      if (rua !== undefined) company.rua = rua;
      if (numero !== undefined) company.numero = numero;
      if (complemento !== undefined) company.complemento = complemento;
      if (bairro !== undefined) company.bairro = bairro;
      if (cidade !== undefined) company.cidade = cidade;
      if (estado !== undefined) company.estado = estado;

      // Atualizar responsável
      if (responsavelNome !== undefined) company.responsavelNome = responsavelNome;
      if (responsavelEmail !== undefined) company.responsavelEmail = responsavelEmail;
      if (responsavelTelefone !== undefined) company.responsavelTelefone = responsavelTelefone;

      // Foto da fachada da loja
      if (fotoFachadaUrl !== undefined) {
        company.fotoFachadaUrl = fotoFachadaUrl || null;
      }

      await companyRepository.save(company);

      return res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      return res.status(500).json({ error: 'Failed to update company' });
    }
  }
}
