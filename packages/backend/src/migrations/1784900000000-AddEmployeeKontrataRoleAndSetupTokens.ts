import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeKontrataRoleAndSetupTokens1784900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Permitir username/password/barcode/sector_id/function_description nulos (preenchidos via setup link)
    await queryRunner.query(`ALTER TABLE employees ALTER COLUMN username DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE employees ALTER COLUMN password DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE employees ALTER COLUMN barcode DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE employees ALTER COLUMN sector_id DROP NOT NULL`);

    // role_kontrata: 'admin' ou 'user'
    await queryRunner.query(`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_kontrata VARCHAR(20) DEFAULT 'user'
    `);

    // email_recuperacao
    await queryRunner.query(`
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_recuperacao VARCHAR(255)
    `);

    // Tokens de setup pra cadastro completo via link
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employee_setup_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_employee_setup_tokens_token ON employee_setup_tokens(token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_employee_setup_tokens_employee ON employee_setup_tokens(employee_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employee_setup_tokens`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS email_recuperacao`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS role_kontrata`);
  }
}
