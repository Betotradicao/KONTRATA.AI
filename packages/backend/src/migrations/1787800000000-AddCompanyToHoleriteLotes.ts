import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lote de holerites importado pertence a uma empresa/loja (rh_empresas, id UUID).
 * Serve pra filtrar a lista de colaboradores na classificação e pra preferir
 * colaboradores dessa loja quando o CPF/nome casa em mais de um.
 */
export class AddCompanyToHoleriteLotes1787800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_holerite_lotes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES rh_empresas(id) ON DELETE SET NULL`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_holerite_lotes DROP COLUMN IF EXISTS company_id`);
  }
}
