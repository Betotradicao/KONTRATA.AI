import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona dia_folga_fixa_2 em rh_escala_templates pra suportar rotacoes
 * com 2 dias fixos de folga semanal (caso da 5x2 — geralmente sab + dom).
 *
 * Quando tipo_folga = 'FIXA' e tipo_rotacao = '5x2', o algoritmo de
 * pre-preencher considera TANTO dia_folga_fixa QUANTO dia_folga_fixa_2
 * como folgas.
 */
export class AddDiaFolgaFixa21785150000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_templates
      ADD COLUMN IF NOT EXISTS dia_folga_fixa_2 INT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_templates
      DROP COLUMN IF EXISTS dia_folga_fixa_2
    `);
  }
}
