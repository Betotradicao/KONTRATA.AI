import { MigrationInterface, QueryRunner } from 'typeorm';

// Tamanho e tipo de uniforme do colaborador (tela de cadastro > Dados Pessoais).
export class AddUniformeColaborador1785420000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS tamanho_uniforme varchar(10)`);
    await queryRunner.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS tipo_uniforme varchar(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS tamanho_uniforme`);
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS tipo_uniforme`);
  }
}
