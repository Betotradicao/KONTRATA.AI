import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Salário final" ao lado do Salário no cadastro (decisão do Beto, 24/10/2026).
 * Salário = o do registro oficial (CTPS/eSocial). Salário final = o que a empresa
 * de fato paga (inclui valores "sem registro"), só como referência do RH.
 */
export class AddSalarioFinalColaborador1788500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS salario_final NUMERIC(10,2)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS salario_final`);
  }
}
