import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeCodLojas1785400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS cod_lojas jsonb DEFAULT '[]'::jsonb`);
    // Backfill: quem ja tinha cod_loja unico passa a ter [cod_loja]
    await queryRunner.query(
      `UPDATE employees SET cod_lojas = jsonb_build_array(cod_loja)
       WHERE cod_loja IS NOT NULL AND (cod_lojas IS NULL OR cod_lojas = '[]'::jsonb)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS cod_lojas`);
  }
}
