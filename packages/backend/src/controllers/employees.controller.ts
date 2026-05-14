import { Response, Request } from 'express';
import * as crypto from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { EmployeesService } from '../services/employees.service';
import { EmployeePermissionsService } from '../services/employee-permissions.service';
import { validateCreateEmployee } from '../dtos/create-employee.dto';
import { validateUpdateEmployee } from '../dtos/update-employee.dto';
import { AppDataSource } from '../config/database';
import { Employee } from '../entities/Employee';
import bcrypt from 'bcrypt';

export class EmployeesController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const onlyActive = req.query.active === 'true';
      const codLoja = req.query.codLoja ? parseInt(req.query.codLoja as string) : undefined;

      const result = await EmployeesService.findAll(page, limit, onlyActive, codLoja);

      res.json(result);
    } catch (error) {
      console.error('Get all employees error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const employee = await EmployeesService.findById(id);
      res.json(employee);
    } catch (error: any) {
      console.error('Get employee by ID error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const validation = validateCreateEmployee(req.body);

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const employee = await EmployeesService.create(req.body);
      res.status(201).json(employee);
    } catch (error: any) {
      console.error('Create employee error:', error);

      if (error.message === 'Username already exists') {
        return res.status(409).json({ error: error.message });
      }

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Cannot assign employee to inactive sector') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/employees/generate-link - cria employee parcial + token de setup
  static async generateLink(req: AuthRequest, res: Response) {
    try {
      const { name, function_description, cod_loja, role_kontrata, permissions } = req.body;

      if (!name || !function_description) {
        return res.status(400).json({ errors: ['Nome e Função sao obrigatorios'] });
      }

      const employeeRepo = AppDataSource.getRepository(Employee);
      const employee = employeeRepo.create({
        name: String(name).trim(),
        function_description: String(function_description).trim(),
        cod_loja: cod_loja ?? null,
        role_kontrata: role_kontrata === 'admin' ? 'admin' : 'user',
        sector_id: null as any, // sem setor por enquanto
        username: null,
        password: null,
        barcode: null,
        active: true,
        first_access: true,
      });
      const saved = await employeeRepo.save(employee);

      // Salvar permissões
      if (Array.isArray(permissions) && permissions.length > 0) {
        await EmployeePermissionsService.updatePermissions(saved.id, permissions);
      }

      // Gerar token de setup (32 bytes hex = 64 chars)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 3); // 3 horas

      // Verifica se o user_id existe; se nao, salva como NULL (FK seguro)
      let createdByUserId: string | null = null;
      const rawUserId = (req as any).userId;
      if (rawUserId) {
        const exists = await AppDataSource.query(`SELECT 1 FROM users WHERE id = $1 LIMIT 1`, [rawUserId]);
        if (exists.length > 0) createdByUserId = rawUserId;
      }
      await AppDataSource.query(
        `INSERT INTO employee_setup_tokens (token, employee_id, created_by_user_id, expires_at) VALUES ($1, $2, $3, $4)`,
        [token, saved.id, createdByUserId, expiresAt]
      );

      const protocol = req.protocol;
      const host = req.get('host');
      const linkUrl = `${protocol}://${host?.replace(':3010', ':3006')}/cadastro/${token}`;

      return res.status(201).json({ employee: saved, token, linkUrl, expiresAt });
    } catch (error: any) {
      console.error('Generate employee link error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // GET /api/employees/setup/:token (publico, sem auth)
  static async getBySetupToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const rows = await AppDataSource.query(
        `SELECT t.token, t.expires_at, t.used_at, e.id, e.name, e.function_description, e.role_kontrata
         FROM employee_setup_tokens t
         JOIN employees e ON e.id = t.employee_id
         WHERE t.token = $1`, [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Link inválido' });
      const r = rows[0];
      if (r.used_at) return res.status(410).json({ error: 'Link ja utilizado' });
      if (new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado' });
      return res.json({ employee: { id: r.id, name: r.name, function_description: r.function_description, role_kontrata: r.role_kontrata } });
    } catch (error: any) {
      console.error('Get setup token error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST /api/employees/setup/:token (publico, sem auth)
  static async completeSetup(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { username, password, email_recuperacao } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
      }
      // Politica: 8+ caracteres, maiuscula, minuscula, numero e caractere especial
      const SPECIAL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/;
      if (
        password.length < 8 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/\d/.test(password) ||
        !SPECIAL_REGEX.test(password)
      ) {
        return res.status(400).json({ error: 'Senha deve ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial' });
      }

      const rows = await AppDataSource.query(
        `SELECT * FROM employee_setup_tokens WHERE token = $1`, [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Link inválido' });
      const r = rows[0];
      if (r.used_at) return res.status(410).json({ error: 'Link ja utilizado' });
      if (new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'Link expirado' });

      // Username já existe?
      const employeeRepo = AppDataSource.getRepository(Employee);
      const existing = await employeeRepo.findOne({ where: { username } });
      if (existing) return res.status(409).json({ error: 'Usuário ja existe. Escolha outro.' });

      const employee = await employeeRepo.findOne({ where: { id: r.employee_id } });
      if (!employee) return res.status(404).json({ error: 'Colaborador nao encontrado' });

      employee.username = username;
      employee.password = await bcrypt.hash(password, 10);
      employee.email_recuperacao = email_recuperacao || null;
      employee.first_access = false;
      await employeeRepo.save(employee);

      await AppDataSource.query(
        `UPDATE employee_setup_tokens SET used_at = NOW() WHERE token = $1`, [token]
      );

      return res.json({ success: true, message: 'Cadastro concluído. Você ja pode fazer login.' });
    } catch (error: any) {
      console.error('Complete setup error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const validation = validateUpdateEmployee(req.body);

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      const employee = await EmployeesService.update(id, req.body);
      res.json(employee);
    } catch (error: any) {
      console.error('Update employee error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Username already exists') {
        return res.status(409).json({ error: error.message });
      }

      if (error.message === 'Sector not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Cannot assign employee to inactive sector') {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }

      const employee = await EmployeesService.uploadAvatar(id, req.file);
      res.json(employee);
    } catch (error: any) {
      console.error('Upload avatar error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async toggleStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const employee = await EmployeesService.toggleStatus(id);
      res.json(employee);
    } catch (error: any) {
      console.error('Toggle employee status error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async resetPassword(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const result = await EmployeesService.resetPassword(id, newPassword);
      res.json(result);
    } catch (error: any) {
      console.error('Reset password error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Profile methods for logged-in employee
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can access their profile' });
      }

      const employee = await EmployeesService.findById(req.user.id);
      res.json(employee);
    } catch (error: any) {
      console.error('Get profile error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can update their profile' });
      }

      // Only allow name to be updated
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const employee = await EmployeesService.update(req.user.id, { name: name.trim() });
      res.json(employee);
    } catch (error: any) {
      console.error('Update profile error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfileAvatar(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can update their avatar' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }

      const employee = await EmployeesService.uploadAvatar(req.user.id, req.file);
      res.json(employee);
    } catch (error: any) {
      console.error('Update profile avatar error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async changePassword(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.type !== 'employee') {
        return res.status(403).json({ error: 'Only employees can change their password' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      const result = await EmployeesService.changePassword(req.user.id, currentPassword, newPassword);
      res.json(result);
    } catch (error: any) {
      console.error('Change password error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      if (error.message === 'Current password is incorrect') {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Permissions methods
  static async getPermissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Verificar se employee existe
      await EmployeesService.findById(id);

      const permissions = await EmployeePermissionsService.getPermissions(id);
      res.json(permissions);
    } catch (error: any) {
      console.error('Get employee permissions error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updatePermissions(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Permissions must be an array' });
      }

      // Verificar se employee existe
      await EmployeesService.findById(id);

      const result = await EmployeePermissionsService.updatePermissions(id, permissions);
      res.json(result);
    } catch (error: any) {
      console.error('Update employee permissions error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await EmployeesService.delete(id);
      res.json(result);
    } catch (error: any) {
      console.error('Delete employee error:', error);

      if (error.message === 'Employee not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
