import { AppDataSource } from '../config/database';
import { Employee } from '../entities/Employee';
import { Sector } from '../entities/Sector';
import { CreateEmployeeDto } from '../dtos/create-employee.dto';
import { UpdateEmployeeDto } from '../dtos/update-employee.dto';
import { EmployeeResponseDto } from '../dtos/employee-response.dto';
import { minioService } from './minio.service';
import * as bcrypt from 'bcrypt';

export class EmployeesService {
  /**
   * Generate unique barcode with prefix 3122 + timestamp/sequential
   */
  private static async generateBarcode(): Promise<string> {
    const employeeRepository = AppDataSource.getRepository(Employee);
    const prefix = '3122';

    // Use timestamp-based generation
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    let barcode = prefix + timestamp;

    // Check if barcode already exists, if so increment
    let exists = await employeeRepository.findOne({ where: { barcode } });
    let counter = 0;

    while (exists) {
      counter++;
      barcode = prefix + (parseInt(timestamp) + counter).toString();
      exists = await employeeRepository.findOne({ where: { barcode } });
    }

    return barcode;
  }

  /**
   * Find all employees with pagination
   */
  static async findAll(page: number = 1, limit: number = 10, onlyActive: boolean = false, codLoja?: number) {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const skip = (page - 1) * limit;

    // Usar query builder para suportar OR condition (cod_loja = X OR cod_loja IS NULL)
    const queryBuilder = employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.sector', 'sector');

    if (onlyActive) {
      queryBuilder.andWhere('employee.active = :active', { active: true });
    }

    // Se codLoja foi passado, filtrar apenas pela loja selecionada
    if (codLoja) {
      queryBuilder.andWhere('employee.cod_loja = :codLoja', { codLoja });
    }

    queryBuilder
      .orderBy('employee.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [employees, total] = await queryBuilder.getManyAndCount();

    return {
      data: employees.map(emp => new EmployeeResponseDto(emp)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find employee by ID
   */
  static async findById(id: string) {
    const employeeRepository = AppDataSource.getRepository(Employee);
    const employee = await employeeRepository.findOne({
      where: { id },
      relations: ['sector'],
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    return new EmployeeResponseDto(employee);
  }

  /**
   * Create a new employee
   */
  static async create(data: CreateEmployeeDto) {
    const employeeRepository = AppDataSource.getRepository(Employee);
    const sectorRepository = AppDataSource.getRepository(Sector);

    // Check if sector exists
    const sector = await sectorRepository.findOne({ where: { id: data.sector_id } });
    if (!sector) {
      throw new Error('Sector not found');
    }

    // Check if sector is active
    if (!sector.active) {
      throw new Error('Cannot assign employee to inactive sector');
    }

    // Check if username already exists
    const existingEmployee = await employeeRepository.findOne({
      where: { username: data.username },
    });
    if (existingEmployee) {
      throw new Error('Username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Generate unique barcode
    const barcode = await this.generateBarcode();

    const employee = employeeRepository.create({
      name: data.name,
      sector_id: data.sector_id,
      function_description: data.function_description,
      username: data.username,
      password: hashedPassword,
      barcode,
      first_access: true,
      active: true,
      cod_loja: data.cod_loja || null,
      is_conferente: (data as any).is_conferente || false,
      is_cpd: (data as any).is_cpd || false,
      is_financeiro: (data as any).is_financeiro || false,
    });

    const savedEmployee = await employeeRepository.save(employee);

    // Load sector relation
    const employeeWithSector = await employeeRepository.findOne({
      where: { id: savedEmployee.id },
      relations: ['sector'],
    });

    return new EmployeeResponseDto(employeeWithSector!);
  }

  /**
   * Update employee
   */
  static async update(id: string, data: UpdateEmployeeDto) {
    const employeeRepository = AppDataSource.getRepository(Employee);
    const sectorRepository = AppDataSource.getRepository(Sector);

    const employee = await employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Check if new username already exists (excluding current employee)
    if (data.username && data.username !== employee.username) {
      const existingEmployee = await employeeRepository.findOne({
        where: { username: data.username },
      });
      if (existingEmployee) {
        throw new Error('Username already exists');
      }
    }

    // Check if new sector exists and is active
    if (data.sector_id && data.sector_id !== employee.sector_id) {
      const sector = await sectorRepository.findOne({ where: { id: data.sector_id } });
      if (!sector) {
        throw new Error('Sector not found');
      }
      if (!sector.active) {
        throw new Error('Cannot assign employee to inactive sector');
      }
    }

    // Update fields
    if (data.name) employee.name = data.name;
    if (data.sector_id) employee.sector_id = data.sector_id;
    if (data.function_description) employee.function_description = data.function_description;
    if (data.username) employee.username = data.username;
    if (data.role_kontrata) (employee as any).role_kontrata = data.role_kontrata === 'admin' ? 'admin' : 'user';
    if (data.cod_loja !== undefined) employee.cod_loja = data.cod_loja;
    if ((data as any).cod_lojas !== undefined) (employee as any).cod_lojas = (data as any).cod_lojas;
    // Flags de recebimento de NF
    const anyData = data as any;
    if (anyData.is_conferente !== undefined) employee.is_conferente = anyData.is_conferente;
    if (anyData.is_cpd !== undefined) employee.is_cpd = anyData.is_cpd;
    if (anyData.is_financeiro !== undefined) employee.is_financeiro = anyData.is_financeiro;

    const savedEmployee = await employeeRepository.save(employee);

    // Load sector relation
    const employeeWithSector = await employeeRepository.findOne({
      where: { id: savedEmployee.id },
      relations: ['sector'],
    });

    return new EmployeeResponseDto(employeeWithSector!);
  }

  /**
   * Upload or update employee avatar
   */
  static async uploadAvatar(id: string, file: Express.Multer.File) {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const employee = await employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Delete old avatar if exists
    if (employee.avatar) {
      try {
        const oldFileName = minioService.extractFileNameFromUrl(employee.avatar);
        await minioService.deleteFile(oldFileName);
      } catch (error) {
        console.error('Error deleting old avatar:', error);
        // Continue anyway, don't fail the upload
      }
    }

    // Upload new avatar
    const fileName = `avatar-${id}-${Date.now()}.${file.mimetype.split('/')[1]}`;
    const avatarUrl = await minioService.uploadFile(fileName, file.buffer, file.mimetype);

    // Update employee
    employee.avatar = avatarUrl;
    await employeeRepository.save(employee);

    // Load sector relation
    const employeeWithSector = await employeeRepository.findOne({
      where: { id },
      relations: ['sector'],
    });

    return new EmployeeResponseDto(employeeWithSector!);
  }

  /**
   * Toggle employee active status
   */
  static async toggleStatus(id: string) {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const employee = await employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    employee.active = !employee.active;
    await employeeRepository.save(employee);

    // Load sector relation
    const employeeWithSector = await employeeRepository.findOne({
      where: { id },
      relations: ['sector'],
    });

    return new EmployeeResponseDto(employeeWithSector!);
  }

  /**
   * Reset employee password (for first access)
   */
  static async resetPassword(id: string, newPassword: string) {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const employee = await employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    employee.password = hashedPassword;
    employee.first_access = false;

    await employeeRepository.save(employee);

    return { message: 'Password reset successfully' };
  }

  /**
   * Change employee password (employee changes their own password)
   */
  static async changePassword(id: string, currentPassword: string, newPassword: string) {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const employee = await employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Verify current password
    if (!employee.password) {
      throw new Error('Cadastro nao finalizado');
    }
    const isValidPassword = await bcrypt.compare(currentPassword, employee.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    employee.password = hashedPassword;
    employee.first_access = false;

    await employeeRepository.save(employee);

    return { message: 'Password changed successfully' };
  }

  /**
   * Find employee by barcode
   */
  static async findByBarcode(barcode: string): Promise<Employee | null> {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const employee = await employeeRepository.findOne({
      where: { barcode, active: true },
      relations: ['sector'],
    });

    return employee;
  }

  /**
   * Delete employee permanently
   */
  // Soft delete — marca como inativo pra preservar rastreabilidade (LGPD/audit logs)
  static async delete(id: string) {
    const employeeRepository = AppDataSource.getRepository(Employee);

    const employee = await employeeRepository.findOne({ where: { id } });
    if (!employee) {
      throw new Error('Employee not found');
    }

    employee.active = false;
    await employeeRepository.save(employee);

    return { message: 'Employee deactivated successfully' };
  }
}
