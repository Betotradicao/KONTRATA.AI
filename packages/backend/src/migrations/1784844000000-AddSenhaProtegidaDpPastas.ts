import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona suporte a "pasta protegida por senha" em dp_pastas.
 *
 * - senha_protegida: boolean indicando se a pasta exige autenticação
 *   pra ser aberta
 * - created_by: FK pro user que criou a pasta. Usado pra validar a
 *   senha de acesso (qualquer master OU o próprio criador, contra a
 *   senha de login atual via bcrypt — não armazenamos cópia)
 */
export class AddSenhaProtegidaDpPastas1784844000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dp_pastas
      ADD COLUMN IF NOT EXISTS senha_protegida BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE dp_pastas
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dp_pastas DROP COLUMN IF EXISTS created_by`);
    await queryRunner.query(`ALTER TABLE dp_pastas DROP COLUMN IF EXISTS senha_protegida`);
  }
}
