import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona em rh_apontamento_campos:
 *  - mostra_horas BOOLEAN — coluna deve mostrar input de HORAS (formato 00:00)?
 *
 * Default: FALSE (colunas existentes seguem só com QTD/R$; horas é opt-in).
 */
export class AddMostraHorasRhApontamentoCampos1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'rh_apontamento_campos'
    `);
    if (!tabela || tabela.length === 0) return;

    await queryRunner.query(`
      ALTER TABLE rh_apontamento_campos
      ADD COLUMN IF NOT EXISTS mostra_horas BOOLEAN DEFAULT FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_apontamento_campos
      DROP COLUMN IF EXISTS mostra_horas
    `);
  }
}
