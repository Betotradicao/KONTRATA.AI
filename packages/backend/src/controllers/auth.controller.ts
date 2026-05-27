import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { Employee } from '../entities/Employee';
import { EmployeePermissionsService } from '../services/employee-permissions.service';
import { isPasswordStrong, PASSWORD_POLICY_ERROR } from '../utils/password-policy';

export class AuthController {
  static async me(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['company']
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          type: 'admin',
          role: user.role,
          isMaster: user.isMaster,
          company: user.company ? {
            id: user.company.id,
            nomeFantasia: user.company.nomeFantasia,
            razaoSocial: user.company.razaoSocial,
            cnpj: user.company.cnpj
          } : null
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { name, username, email, currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Atualizar nome
      if (name) user.name = name;

      // Atualizar username (verificar se não está em uso)
      if (username && username !== user.username) {
        const existingUser = await userRepository.findOne({ where: { username } });
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: 'Username already in use' });
        }
        user.username = username;
      }

      // Atualizar email (verificar se não está em uso)
      if (email && email !== user.email) {
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: 'Email already in use' });
        }
        user.email = email;
      }

      // Atualizar senha se fornecida
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to change password' });
        }

        const isValidPassword = await user.validatePassword(currentPassword);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        if (!isPasswordStrong(newPassword)) {
          return res.status(400).json({ error: PASSWORD_POLICY_ERROR });
        }

        user.password = await bcrypt.hash(newPassword, 10);
      }

      await userRepository.save(user);

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          isMaster: user.isMaster
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Master reseta a senha de um usuario ADMIN (gerencial) sem precisar da senha antiga do admin.
  // Validacao: quem chama PRECISA estar logado como master E informar a PROPRIA senha master.
  // Nunca altera o registro do master, apenas o registro do admin alvo.
  static async masterResetAdminPassword(req: Request, res: Response) {
    try {
      const callerId = (req as any).user?.id;
      const callerIsMaster = (req as any).user?.isMaster || (req as any).user?.role === UserRole.MASTER;

      if (!callerId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (!callerIsMaster) {
        return res.status(403).json({ error: 'Apenas o usuario master pode executar esta operacao' });
      }

      const { masterPassword, newAdminPassword, adminUserId, companyId } = req.body || {};

      if (!masterPassword || !newAdminPassword) {
        return res.status(400).json({ error: 'masterPassword e newAdminPassword sao obrigatorios' });
      }

      if (typeof newAdminPassword !== 'string' || newAdminPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha do admin deve ter no minimo 6 caracteres' });
      }

      const userRepository = AppDataSource.getRepository(User);

      const masterUser = await userRepository.findOne({ where: { id: callerId } });
      if (!masterUser || !masterUser.isMaster) {
        return res.status(403).json({ error: 'Usuario master nao encontrado' });
      }

      const isMasterPasswordValid = await masterUser.validatePassword(masterPassword);
      if (!isMasterPasswordValid) {
        return res.status(401).json({ error: 'Senha master incorreta' });
      }

      // Descobrir o admin alvo: prioriza adminUserId explicito, depois companyId, depois a propria company do master.
      let targetAdmin: User | null = null;

      if (adminUserId) {
        targetAdmin = await userRepository.findOne({ where: { id: adminUserId } });
        if (!targetAdmin) {
          return res.status(404).json({ error: 'Usuario admin alvo nao encontrado' });
        }
        if (targetAdmin.isMaster) {
          return res.status(400).json({ error: 'Nao e permitido alterar a senha do usuario master por este endpoint' });
        }
        if (targetAdmin.role !== UserRole.ADMIN) {
          return res.status(400).json({ error: 'O usuario alvo deve ter role admin' });
        }
      } else {
        const targetCompanyId = companyId || masterUser.companyId;
        if (!targetCompanyId) {
          return res.status(400).json({ error: 'companyId obrigatorio quando o master nao possui empresa associada' });
        }
        targetAdmin = await userRepository.findOne({
          where: { companyId: targetCompanyId, role: UserRole.ADMIN, isMaster: false }
        });
        if (!targetAdmin) {
          return res.status(404).json({ error: 'Nenhum usuario admin encontrado para essa empresa' });
        }
      }

      // Garantia adicional de que NUNCA sobrescreve o master (mesmo por bug de dados).
      if (targetAdmin.id === masterUser.id) {
        return res.status(400).json({ error: 'Operacao bloqueada: alvo coincide com o proprio master' });
      }

      targetAdmin.password = await bcrypt.hash(newAdminPassword, 10);
      await userRepository.save(targetAdmin);

      console.log('🔑 Master resetou senha do admin:', {
        masterId: masterUser.id,
        adminId: targetAdmin.id,
        adminEmail: targetAdmin.email,
        companyId: targetAdmin.companyId
      });

      return res.json({
        message: 'Senha do admin redefinida com sucesso',
        admin: {
          id: targetAdmin.id,
          email: targetAdmin.email,
          username: targetAdmin.username,
          name: targetAdmin.name,
          companyId: targetAdmin.companyId
        }
      });
    } catch (error) {
      console.error('Master reset admin password error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Lista os usuarios admin (gerencial) das empresas — apenas para o master escolher qual resetar.
  static async listAdminUsers(req: Request, res: Response) {
    try {
      const callerIsMaster = (req as any).user?.isMaster || (req as any).user?.role === UserRole.MASTER;
      if (!callerIsMaster) {
        return res.status(403).json({ error: 'Apenas o usuario master pode listar admins' });
      }

      const userRepository = AppDataSource.getRepository(User);
      const admins = await userRepository.find({
        where: { role: UserRole.ADMIN, isMaster: false },
        relations: ['company']
      });

      return res.json({
        admins: admins.map(a => ({
          id: a.id,
          email: a.email,
          username: a.username,
          name: a.name,
          companyId: a.companyId,
          company: a.company ? {
            id: a.company.id,
            nomeFantasia: a.company.nomeFantasia,
            razaoSocial: a.company.razaoSocial
          } : null
        }))
      });
    } catch (error) {
      console.error('List admins error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ============================================================
  // LINK DE PRIMEIRO ACESSO (admin setup)
  // Master gera token unico (72h, single-use) que o cliente abre
  // numa URL publica e define email/usuario/senha do proprio admin.
  // ============================================================

  static async gerarLinkSetupAdmin(req: Request, res: Response) {
    try {
      const callerIsMaster = (req as any).user?.isMaster || (req as any).user?.role === UserRole.MASTER;
      if (!callerIsMaster) return res.status(403).json({ error: 'Apenas o usuario master' });

      const { adminUserId } = req.body;
      if (!adminUserId) return res.status(400).json({ error: 'adminUserId e obrigatorio' });

      const userRepo = AppDataSource.getRepository(User);
      const targetAdmin = await userRepo.findOne({ where: { id: adminUserId }, relations: ['company'] });
      if (!targetAdmin) return res.status(404).json({ error: 'Admin nao encontrado' });
      if (targetAdmin.isMaster) return res.status(400).json({ error: 'Nao e permitido gerar link pra master' });

      // Invalida tokens antigos do mesmo admin que ainda nao foram usados
      await AppDataSource.query(
        `UPDATE admin_setup_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
        [adminUserId]
      );

      // Cria novo token (gen_random_uuid via default + retorna o valor)
      const callerId = (req as any).user?.id || null;
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
      const inserted = await AppDataSource.query(
        `INSERT INTO admin_setup_tokens (user_id, created_by_user_id, expires_at)
         VALUES ($1, $2, $3) RETURNING token, expires_at`,
        [adminUserId, callerId, expiresAt]
      );
      const tokenRow = inserted[0];

      // URL publica (frontend monta com host atual no front; aqui retornamos so o token + path)
      return res.json({
        token: tokenRow.token,
        expires_at: tokenRow.expires_at,
        path: `/admin-setup/${tokenRow.token}`,
        admin: {
          id: targetAdmin.id,
          name: targetAdmin.name,
          email: targetAdmin.email,
          username: targetAdmin.username,
          company: targetAdmin.company ? {
            nomeFantasia: targetAdmin.company.nomeFantasia,
            razaoSocial: targetAdmin.company.razaoSocial,
          } : null,
        },
      });
    } catch (err) {
      console.error('gerarLinkSetupAdmin error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async validarTokenSetupAdmin(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const rows = await AppDataSource.query(
        `SELECT t.*, u.name AS user_name, u.email AS user_email, u.username AS user_username,
                c.nome_fantasia, c.razao_social
         FROM admin_setup_tokens t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE t.token = $1`,
        [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Link invalido' });
      const t = rows[0];
      if (t.used_at) return res.status(410).json({ error: 'Este link ja foi utilizado' });
      if (new Date(t.expires_at) < new Date()) return res.status(410).json({ error: 'Este link expirou' });

      return res.json({
        valid: true,
        empresa: {
          nomeFantasia: t.nome_fantasia,
          razaoSocial: t.razao_social,
        },
        admin: {
          name: t.user_name,
          email: t.user_email,
          username: t.user_username,
        },
        expiresAt: t.expires_at,
      });
    } catch (err) {
      console.error('validarTokenSetupAdmin error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async consumirTokenSetupAdmin(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { email, username, password, name, aceites, dpo } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, usuario e senha sao obrigatorios' });
      }
      if (!isPasswordStrong(password)) {
        return res.status(400).json({ error: PASSWORD_POLICY_ERROR });
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) {
        return res.status(400).json({ error: 'Usuario deve ter ao menos 3 caracteres (letras, numeros, _ ou -)' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalido' });
      }

      // LGPD: 3 aceites obrigatorios (termos_uso, politica_privacidade, dpa)
      const TIPOS_OBRIGATORIOS = ['termos_uso', 'politica_privacidade', 'dpa'];
      if (!Array.isArray(aceites) || !TIPOS_OBRIGATORIOS.every(t => aceites.find((a: any) => a?.tipo === t))) {
        return res.status(400).json({ error: 'É obrigatorio aceitar os 3 termos LGPD (Termos de Uso, Política de Privacidade e DPA)' });
      }

      // DPO obrigatorio (Encarregado de Dados da empresa cliente)
      if (!dpo || !dpo.nome?.trim() || !dpo.email?.trim() || !dpo.telefone?.trim()) {
        return res.status(400).json({ error: 'Informe nome, email e telefone do DPO (Encarregado de Dados) da empresa' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dpo.email)) {
        return res.status(400).json({ error: 'Email do DPO invalido' });
      }

      const rows = await AppDataSource.query(
        `SELECT * FROM admin_setup_tokens WHERE token = $1`, [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Link invalido' });
      const t = rows[0];
      if (t.used_at) return res.status(410).json({ error: 'Este link ja foi utilizado' });
      if (new Date(t.expires_at) < new Date()) return res.status(410).json({ error: 'Este link expirou' });

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: t.user_id } });
      if (!user) return res.status(404).json({ error: 'Admin nao encontrado' });
      if (user.isMaster) return res.status(400).json({ error: 'Operacao nao permitida pra master' });

      // Garantir unicidade de email e username (excluindo o proprio user)
      const emailDup = await userRepo.findOne({ where: { email } });
      if (emailDup && emailDup.id !== user.id) return res.status(409).json({ error: 'Email ja em uso' });
      const userDup = await userRepo.findOne({ where: { username } });
      if (userDup && userDup.id !== user.id) return res.status(409).json({ error: 'Usuario ja em uso' });

      user.email = email;
      user.username = username;
      user.password = await bcrypt.hash(password, 10);
      if (name && name.trim()) user.name = name.trim();
      await userRepo.save(user);

      // Registra os 3 aceites LGPD vinculados a este admin (audit trail)
      const ipHeader = req.headers['x-forwarded-for'];
      const ip = (Array.isArray(ipHeader) ? ipHeader[0] : (typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : null))
        || req.ip || req.socket?.remoteAddress || '';
      const ua = (req.headers['user-agent'] as string) || '';
      const crypto = require('crypto');
      for (const aceite of aceites) {
        if (!aceite?.tipo || !aceite?.versao) continue;
        // Revoga aceite anterior do mesmo tipo+titular (so o ultimo vale como ativo)
        await AppDataSource.query(
          `UPDATE lgpd_consentimentos
             SET revogado_em = NOW(), motivo_revogacao = 'Substituido por novo aceite'
           WHERE tipo = $1 AND titular_tipo = 'usuario' AND titular_id = $2 AND revogado_em IS NULL`,
          [aceite.tipo, String(user.id)]
        );
        const hash = crypto.createHash('sha256')
          .update(`${aceite.tipo}|${aceite.versao}|usuario|${user.id}|${ip}|${Date.now()}`, 'utf8')
          .digest('hex');
        await AppDataSource.query(
          `INSERT INTO lgpd_consentimentos
             (tipo, versao, hash_conteudo, titular_tipo, titular_id, titular_nome, titular_email, ip, user_agent, observacoes)
           VALUES ($1, $2, $3, 'usuario', $4, $5, $6, $7, $8, 'Aceito durante setup de primeiro acesso (admin)')`,
          [aceite.tipo, aceite.versao, hash, String(user.id), user.name, user.email, ip, ua]
        );
      }

      // Salva DPO em lgpd_configuracoes (1 registro global por tenant)
      await AppDataSource.query(
        `INSERT INTO lgpd_configuracoes (id, dpo_nome, dpo_email, dpo_telefone, retencao_curriculos_meses, retencao_logs_meses, retencao_gravacoes_dias, atualizado_em)
         VALUES (1, $1, $2, $3, 12, 12, 30, NOW())
         ON CONFLICT (id) DO UPDATE SET
           dpo_nome = EXCLUDED.dpo_nome,
           dpo_email = EXCLUDED.dpo_email,
           dpo_telefone = EXCLUDED.dpo_telefone,
           atualizado_em = NOW()`,
        [dpo.nome.trim(), dpo.email.trim(), dpo.telefone.trim()]
      );

      // Marca token como usado (desativa o link)
      await AppDataSource.query(
        `UPDATE admin_setup_tokens SET used_at = NOW() WHERE token = $1`, [token]
      );

      return res.json({ success: true, message: 'Acesso configurado com sucesso. Faça login pra continuar.' });
    } catch (err) {
      console.error('consumirTokenSetupAdmin error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      console.log('🔐 Tentativa de login:', { email, origin: req.headers.origin });

      if (!email || !password) {
        console.log('❌ Login falhou: campos vazios');
        return res.status(400).json({ error: 'Email/username and password are required' });
      }

      // Try to find user by email OR username (admin users)
      const userRepository = AppDataSource.getRepository(User);
      let user = await userRepository.findOne({
        where: { email },
        relations: ['company']
      });

      // Se não encontrou por email, tenta por username
      if (!user) {
        user = await userRepository.findOne({
          where: { username: email }, // O campo 'email' do form pode ser username
          relations: ['company']
        });
      }

      if (user) {
        console.log('✅ Usuário admin encontrado:', user.email);
        const isValidPassword = await user.validatePassword(password);
        if (isValidPassword) {
          console.log('✅ Login admin bem-sucedido!');
          const token = jwt.sign(
            {
              id: user.id,
              email: user.email,
              username: user.username,
              name: user.name,
              type: 'admin',
              role: user.role,
              isMaster: user.isMaster,
              companyId: user.companyId
            },
            process.env.JWT_SECRET || 'development-secret',
            { expiresIn: '24h' }
          );

          return res.json({
            message: 'Login successful',
            token,
            user: {
              id: user.id,
              email: user.email,
              type: 'admin',
              role: user.role,
              isMaster: user.isMaster,
              company: user.company ? {
                id: user.company.id,
                nomeFantasia: user.company.nomeFantasia,
                razaoSocial: user.company.razaoSocial,
                cnpj: user.company.cnpj
              } : null
            }
          });
        }
        // FALLTHROUGH: master existe mas senha nao bate. Pode ser que o
        // username/email tambem exista em employees com senha diferente
        // (colaborador criado via setup). Continua pra tentar employee
        // antes de desistir com Invalid credentials.
        console.log('⚠️  Senha invalida pra master — tentando employee como fallback');
      }

      // If not found as user, try to find as employee by username
      const employeeRepository = AppDataSource.getRepository(Employee);
      const employee = await employeeRepository.findOne({
        where: { username: email },
        relations: ['sector']
      });

      if (!employee) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if employee is active
      if (!employee.active) {
        return res.status(401).json({ error: 'Employee account is inactive' });
      }

      // Validate password
      if (!employee.password) {
        return res.status(401).json({ error: 'Cadastro ainda nao finalizado. Use o link de cadastro recebido.' });
      }
      const isValidPassword = await bcrypt.compare(password, employee.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Buscar permissões do colaborador
      const permissions = await EmployeePermissionsService.getPermissions(employee.id);

      const token = jwt.sign(
        { id: employee.id, username: employee.username, type: 'employee', role_kontrata: employee.role_kontrata },
        process.env.JWT_SECRET || 'development-secret',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: employee.id,
          name: employee.name,
          username: employee.username,
          avatar: employee.avatar,
          role_kontrata: employee.role_kontrata,
          sector: employee.sector ? {
            id: employee.sector.id,
            name: employee.sector.name,
            color_hash: employee.sector.color_hash
          } : null,
          function_description: employee.function_description,
          first_access: employee.first_access,
          barcode: employee.barcode,
          type: 'employee',
          permissions // Incluir permissões no response
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}