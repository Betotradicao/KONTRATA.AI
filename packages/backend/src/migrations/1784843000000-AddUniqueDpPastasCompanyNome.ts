import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona UNIQUE constraint (company_id, nome) em dp_pastas.
 *
 * O controller usa INSERT ... ON CONFLICT (company_id, nome) DO UPDATE
 * pra criar/atualizar pastas, mas a constraint estava faltando em
 * bancos antigos — causava erro "no unique or exclusion constraint
 * matching the ON CONFLICT specification" e bloqueava a criação de
 * pastas pelo usuário.
 */
export class AddUniqueDpPastasCompanyNome1784843000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(`
      SELECT 1 FROM pg_constraint
      WHERE conname = 'dp_pastas_company_nome_unique'
    `);
    if (exists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE dp_pastas
        ADD CONSTRAINT dp_pastas_company_nome_unique UNIQUE (company_id, nome)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dp_pastas DROP CONSTRAINT IF EXISTS dp_pastas_company_nome_unique`
    );
  }
}
