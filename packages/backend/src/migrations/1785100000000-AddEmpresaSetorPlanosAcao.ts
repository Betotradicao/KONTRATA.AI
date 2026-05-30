import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona empresa_id (UUID) e departamento_id (INT) em rh_nr1_planos_acao
 * pra que o plano de acao seja amarrado a uma loja + setor especifico.
 *
 * O campo setor_alvo (text) continua existindo pra retrocompat — recebe o
 * nome do departamento na hora de salvar. Os campos novos sao normalizados.
 */
export class AddEmpresaSetorPlanosAcao1785100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_nr1_planos_acao
      ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES rh_empresas(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS departamento_id INT NULL REFERENCES rh_departamentos(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_nr1_plano_empresa ON rh_nr1_planos_acao(empresa_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_nr1_plano_depto ON rh_nr1_planos_acao(departamento_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nr1_plano_depto`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_nr1_plano_empresa`);
    await queryRunner.query(`
      ALTER TABLE rh_nr1_planos_acao
      DROP COLUMN IF EXISTS departamento_id,
      DROP COLUMN IF EXISTS empresa_id
    `);
  }
}
