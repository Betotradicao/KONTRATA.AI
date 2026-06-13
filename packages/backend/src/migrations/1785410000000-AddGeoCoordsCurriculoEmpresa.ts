import { MigrationInterface, QueryRunner } from 'typeorm';

// Coordenadas geocodadas (a partir do CEP) pra calcular a distancia
// residencia do candidato -> loja da vaga (coluna "KM Residencia" em RhVagas).
// geo_cep guarda QUAL cep gerou as coords, pra re-geocodar se o cep mudar.
export class AddGeoCoordsCurriculoEmpresa1785410000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tabela of ['curriculos', 'rh_empresas']) {
      await queryRunner.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS latitude double precision`);
      await queryRunner.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS longitude double precision`);
      await queryRunner.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS geo_cep varchar(9)`);
      await queryRunner.query(`ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS geo_updated_at timestamptz`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabela of ['curriculos', 'rh_empresas']) {
      await queryRunner.query(`ALTER TABLE ${tabela} DROP COLUMN IF EXISTS latitude`);
      await queryRunner.query(`ALTER TABLE ${tabela} DROP COLUMN IF EXISTS longitude`);
      await queryRunner.query(`ALTER TABLE ${tabela} DROP COLUMN IF EXISTS geo_cep`);
      await queryRunner.query(`ALTER TABLE ${tabela} DROP COLUMN IF EXISTS geo_updated_at`);
    }
  }
}
