import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acrescenta pausa_inicio e pausa_fim (TIME) em rh_escala_turnos pra
 * representar o intervalo de almoco/pausa do turno de forma mais explicita.
 *
 * Antes: o turno tinha apenas pausa_minutos (duracao) — não dizia QUANDO
 * a pausa acontecia. Agora o usuario informa horario exato de inicio e fim
 * da pausa (ex: 12:30 as 13:30) e a duracao em minutos e calculada
 * automaticamente.
 *
 * pausa_minutos continua existindo (= diff entre pausa_fim e pausa_inicio
 * em minutos) pra retrocompat com leitores ja existentes da escala.
 */
export class AddPausaTurnos1785130000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_turnos
      ADD COLUMN IF NOT EXISTS pausa_inicio TIME NULL,
      ADD COLUMN IF NOT EXISTS pausa_fim TIME NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_turnos
      DROP COLUMN IF EXISTS pausa_fim,
      DROP COLUMN IF EXISTS pausa_inicio
    `);
  }
}
