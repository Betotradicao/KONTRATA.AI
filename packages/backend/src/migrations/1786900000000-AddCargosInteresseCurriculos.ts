import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cargos de interesse futuro (fora das vagas abertas hoje).
 *
 * Secao "Alem das vagas disponiveis" no formulario publico: o candidato marca
 * areas/cargos que tem interesse mesmo sem ter experiencia neles, pra RH achar
 * no Banco de Curriculos quando abrir vaga futura nessas areas.
 */
export class AddCargosInteresseCurriculos1786900000000 implements MigrationInterface {
  name = 'AddCargosInteresseCurriculos1786900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE curriculos ADD COLUMN IF NOT EXISTS cargos_interesse jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE curriculos DROP COLUMN IF EXISTS cargos_interesse`);
  }
}
