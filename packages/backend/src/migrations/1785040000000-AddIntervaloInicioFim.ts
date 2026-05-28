import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quebra o campo horario_intervalo (texto livre tipo "12:00 às 13:00") em
 * dois campos separados com input type=time:
 *   - horario_intervalo_inicio
 *   - horario_intervalo_fim
 *
 * Mantém horario_intervalo legado pra retrocompatibilidade (continua sendo
 * preenchido como "HH:MM às HH:MM" automaticamente pelo backend).
 */
export class AddIntervaloInicioFim1785040000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_fichas_admissao
      ADD COLUMN IF NOT EXISTS horario_intervalo_inicio VARCHAR(10) NULL,
      ADD COLUMN IF NOT EXISTS horario_intervalo_fim    VARCHAR(10) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_fichas_admissao
      DROP COLUMN IF EXISTS horario_intervalo_inicio,
      DROP COLUMN IF EXISTS horario_intervalo_fim
    `);
  }
}
