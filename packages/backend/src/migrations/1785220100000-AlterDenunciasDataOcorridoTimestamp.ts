import { MigrationInterface, QueryRunner } from 'typeorm';

// Permite registrar data + hora do ocorrido (antes era so DATE)
export class AlterDenunciasDataOcorridoTimestamp1785220100000 implements MigrationInterface {
  name = 'AlterDenunciasDataOcorridoTimestamp1785220100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE denuncias
        ALTER COLUMN data_ocorrido TYPE TIMESTAMP
        USING data_ocorrido::TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE denuncias
        ALTER COLUMN data_ocorrido TYPE DATE
        USING data_ocorrido::DATE
    `);
  }
}
