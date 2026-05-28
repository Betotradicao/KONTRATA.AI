import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prazo de Experiência (CLT, art. 445 parágrafo único) permite até 90 dias
 * TOTAL, podendo ser dividido em 2 períodos (contrato inicial + prorrogação).
 *
 * Adiciona dias_inicial e dias_final na tabela rh_prazos_experiencia.
 * Mantém a coluna `dias` legada (soma) pra retrocompatibilidade.
 *
 * Exemplos:
 *   - Inicial 30 / Final 30 (total 60)
 *   - Inicial 15 / Final 75 (total 90)
 *   - Inicial 45 / Final 45 (total 90)
 */
export class AddInicialFinalPrazosExp1785030000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_prazos_experiencia
      ADD COLUMN IF NOT EXISTS dias_inicial INT NULL,
      ADD COLUMN IF NOT EXISTS dias_final INT NULL
    `);
    // Backfill: pros registros existentes, divide o total em 50/50 como default
    // (ex: 60 -> inicial=30 final=30; 45 -> inicial=23 final=22; 90 -> 45/45).
    await queryRunner.query(`
      UPDATE rh_prazos_experiencia
      SET dias_inicial = COALESCE(dias_inicial, FLOOR(dias / 2.0)::int),
          dias_final   = COALESCE(dias_final,   dias - FLOOR(dias / 2.0)::int)
      WHERE dias IS NOT NULL AND (dias_inicial IS NULL OR dias_final IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_prazos_experiencia
      DROP COLUMN IF EXISTS dias_inicial,
      DROP COLUMN IF EXISTS dias_final
    `);
  }
}
