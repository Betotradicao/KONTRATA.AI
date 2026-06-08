import { MigrationInterface, QueryRunner } from 'typeorm';

// Flag pra dispensar o colaborador da exigencia de ASO obrigatorio.
// Util pra aprendizes / estagiarios — eles nao entram em "Sem ASO" nem
// disparam alerta de vencimento.
export class AddAsoDispensadoColaborador1785260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
        ADD COLUMN IF NOT EXISTS aso_dispensado BOOLEAN NOT NULL DEFAULT false
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS aso_dispensado`);
  }
}
