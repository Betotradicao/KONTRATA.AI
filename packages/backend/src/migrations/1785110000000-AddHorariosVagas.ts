import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona 4 horarios em rh_vagas:
 *   - hora_entrada
 *   - hora_almoco_ini / hora_almoco_fim
 *   - hora_saida
 *
 * Quando o RH cadastra uma vaga e escolhe a jornada, ele pode tambem
 * preencher os horarios especificos daquela vaga (alem dos turnos
 * disponiveis ja existentes). Isso aparece pro candidato saber exatamente
 * em que horario ele iria trabalhar se for contratado.
 */
export class AddHorariosVagas1785110000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_vagas
      ADD COLUMN IF NOT EXISTS hora_entrada TIME NULL,
      ADD COLUMN IF NOT EXISTS hora_almoco_ini TIME NULL,
      ADD COLUMN IF NOT EXISTS hora_almoco_fim TIME NULL,
      ADD COLUMN IF NOT EXISTS hora_saida TIME NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_vagas
      DROP COLUMN IF EXISTS hora_saida,
      DROP COLUMN IF EXISTS hora_almoco_fim,
      DROP COLUMN IF EXISTS hora_almoco_ini,
      DROP COLUMN IF EXISTS hora_entrada
    `);
  }
}
