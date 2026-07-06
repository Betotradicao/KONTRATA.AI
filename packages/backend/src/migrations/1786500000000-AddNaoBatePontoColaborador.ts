import { MigrationInterface, QueryRunner } from 'typeorm';

// Flag "Colaborador não bate ponto" (cargo de confiança / não registra marcações).
// Quando true, o colaborador é EXCLUÍDO dos indicadores de ponto/ausência
// (absenteísmo, faltas, ranking) — senão apareceria como 100% ausente.
export class AddNaoBatePontoColaborador1786500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
        ADD COLUMN IF NOT EXISTS nao_bate_ponto BOOLEAN NOT NULL DEFAULT false
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS nao_bate_ponto`);
  }
}
