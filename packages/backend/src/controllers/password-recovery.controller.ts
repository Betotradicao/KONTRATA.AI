import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { emailService } from '../services/email.service';

/**
 * Busca o "destinatario" do reset em users (admin master) OU employees
 * (colaboradores com acesso). Retorna info normalizada ou null.
 */
async function findResetTarget(email: string) {
  // 1. Tenta admin master (tabela users)
  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { email } });
  if (user) {
    return { kind: 'user' as const, id: user.id, name: user.name, email: user.email };
  }

  // 2. Tenta employee por email_recuperacao
  const rows = await AppDataSource.query(
    `SELECT id, name, email_recuperacao FROM employees
     WHERE email_recuperacao = $1 AND active = true
     LIMIT 1`,
    [email]
  );
  if (rows.length > 0) {
    return { kind: 'employee' as const, id: rows[0].id, name: rows[0].name, email: rows[0].email_recuperacao };
  }
  return null;
}

export class PasswordRecoveryController {
  // Solicitar recuperação de senha (admin master OU colaborador)
  static async requestPasswordRecovery(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
      }

      const target = await findResetTarget(email);

      // Por segurança, sempre retornar sucesso mesmo se email não existir
      // (previne enumeração de emails)
      if (!target) {
        return res.json({
          message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação',
          success: true
        });
      }

      // Gerar token de recuperação
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora

      // Salvar token na tabela certa
      if (target.kind === 'user') {
        const userRepository = AppDataSource.getRepository(User);
        const u = await userRepository.findOneByOrFail({ id: target.id });
        u.resetPasswordToken = resetTokenHash;
        u.resetPasswordExpires = resetTokenExpires;
        await userRepository.save(u);
      } else {
        await AppDataSource.query(
          `UPDATE employees SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3`,
          [resetTokenHash, resetTokenExpires, target.id]
        );
      }

      // URL de recuperação (frontend)
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3004'}/reset-password?token=${resetToken}`;

      // Enviar email de recuperação
      const emailSent = await emailService.sendPasswordRecoveryEmail(
        target.email,
        resetUrl,
        target.name || 'Usuário'
      );

      if (emailSent) {
        console.log(`✅ Email de recuperação enviado para: ${target.email} (${target.kind})`);
      } else {
        console.log('\n========================================');
        console.log('📧 RECUPERAÇÃO DE SENHA SOLICITADA');
        console.log('❌ Falha ao enviar email - Link gerado:');
        console.log('========================================');
        console.log(`${target.kind === 'user' ? 'Admin' : 'Colaborador'}: ${target.name} (${target.email})`);
        console.log(`Link de recuperação (válido por 1 hora):`);
        console.log(resetUrl);
        console.log('========================================\n');
      }

      return res.json({
        message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação',
        success: true
      });

    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      return res.status(500).json({ error: 'Erro ao processar solicitação' });
    }
  }

  // Validar token de recuperação (admin master OU colaborador)
  static async validateResetToken(req: Request, res: Response) {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token inválido' });
      }

      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const userRepository = AppDataSource.getRepository(User);

      // 1. Tenta tabela users
      let user: any = await userRepository.findOne({
        where: { resetPasswordToken: resetTokenHash }
      });

      // 2. Se nao achou, tenta employees
      if (!user) {
        const rows = await AppDataSource.query(
          `SELECT id, name, email_recuperacao AS email, reset_password_expires
             FROM employees WHERE reset_password_token = $1 LIMIT 1`,
          [resetTokenHash]
        );
        if (rows.length > 0) {
          user = {
            email: rows[0].email,
            name: rows[0].name,
            resetPasswordExpires: rows[0].reset_password_expires,
          };
        }
      }

      if (!user || !user.resetPasswordExpires) {
        return res.status(400).json({ error: 'Token inválido ou expirado' });
      }

      if (user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ error: 'Token expirado' });
      }

      return res.json({
        valid: true,
        message: 'Token válido',
        email: user.email
      });

    } catch (error) {
      console.error('Erro ao validar token:', error);
      return res.status(500).json({ error: 'Erro ao validar token' });
    }
  }

  // Resetar senha usando token (admin master OU colaborador)
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
      }

      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // 1. Tenta na tabela users (admin master)
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { resetPasswordToken: resetTokenHash }
      });

      if (user) {
        if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
          return res.status(400).json({ error: 'Token expirado. Solicite uma nova recuperação de senha.' });
        }
        user.password = newPasswordHash;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await userRepository.save(user);
        console.log(`✅ Senha redefinida para admin: ${user.email}`);
        return res.json({ message: 'Senha redefinida com sucesso', success: true });
      }

      // 2. Tenta employee
      const empRows = await AppDataSource.query(
        `SELECT id, email_recuperacao, reset_password_expires
           FROM employees WHERE reset_password_token = $1 LIMIT 1`,
        [resetTokenHash]
      );

      if (empRows.length === 0) {
        return res.status(400).json({ error: 'Token inválido ou expirado' });
      }

      const emp = empRows[0];
      if (!emp.reset_password_expires || new Date(emp.reset_password_expires) < new Date()) {
        return res.status(400).json({ error: 'Token expirado. Solicite uma nova recuperação de senha.' });
      }

      await AppDataSource.query(
        `UPDATE employees
            SET password = $1,
                reset_password_token = NULL,
                reset_password_expires = NULL,
                first_access = false,
                updated_at = NOW()
          WHERE id = $2`,
        [newPasswordHash, emp.id]
      );

      console.log(`✅ Senha redefinida para colaborador: ${emp.email_recuperacao}`);
      return res.json({ message: 'Senha redefinida com sucesso', success: true });

    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      return res.status(500).json({ error: 'Erro ao resetar senha' });
    }
  }
}
