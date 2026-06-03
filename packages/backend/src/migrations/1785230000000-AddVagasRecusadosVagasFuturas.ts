import { MigrationInterface, QueryRunner } from 'typeorm';

// Adiciona 2 arrays JSONB em rh_vagas: recusados + vagas_futuras.
// Antes: status do candidato dentro da vaga vinha do c.status GLOBAL (curriculo),
//        o que fazia recusar/futuras vazar pra TODAS as vagas onde a candidata aparece.
// Agora: cada vaga tem seu proprio array, status eh 100% LOCAL por vaga.
export class AddVagasRecusadosVagasFuturas1785230000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_vagas
        ADD COLUMN IF NOT EXISTS recusados JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS vagas_futuras JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_vagas DROP COLUMN IF EXISTS recusados, DROP COLUMN IF EXISTS vagas_futuras`);
  }
}
