import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona suporte a recuperação de senha pra employees (colaboradores
 * que têm acesso ao sistema, como o BETO admin do Guibox).
 *
 * Antes: só usuarios da tabela `users` (admin master) tinha "Esqueci senha"
 * funcionando. Employees não conseguiam recuperar.
 *
 * Depois: employees com `email_recuperacao` cadastrado podem solicitar
 * reset, recebem token pelo email configurado, e redefinem senha.
 */
export class AddResetPasswordToEmployees1784846000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255)
    `);
    await queryRunner.query(`
      ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_reset_token
      ON employees(reset_password_token)
      WHERE reset_password_token IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_employees_reset_token`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS reset_password_expires`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS reset_password_token`);
  }
}
