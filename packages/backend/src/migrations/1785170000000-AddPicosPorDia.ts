import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Substitui horario_pico_inicio/fim (faixa única global) por picos_por_dia
 * (jsonb) — cada dia de pico pode ter VÁRIAS faixas de horário.
 *
 * Estrutura do jsonb:
 *   {
 *     "sex": [{ "ini": "16:00", "fim": "21:00" }],
 *     "sab": [{ "ini": "10:00", "fim": "14:00" }, { "ini": "18:00", "fim": "22:00" }],
 *     "dom": [{ "ini": "09:00", "fim": "13:00" }]
 *   }
 *
 * As colunas antigas (horario_pico_inicio/fim) ficam pra retrocompat — null
 * em rows novas, mas o backend não usa mais.
 */
export class AddPicosPorDia1785170000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_regras_setor
      ADD COLUMN IF NOT EXISTS picos_por_dia JSONB DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_regras_setor
      DROP COLUMN IF EXISTS picos_por_dia
    `);
  }
}
