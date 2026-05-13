import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCodLojaToSectorsAndHortFrutBoxes1780900000000 implements MigrationInterface {
  name = 'AddCodLojaToSectorsAndHortFrutBoxes1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sectors" ADD COLUMN IF NOT EXISTS "cod_loja" integer
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "UQ_sectors_name";
        ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "sectors_name_key";
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_sectors_name";
      DROP INDEX IF EXISTS "sectors_name_key";
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sectors_name_cod_loja"
      ON "sectors" ("name", COALESCE("cod_loja", 0))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sectors_name_cod_loja"`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP COLUMN IF EXISTS "cod_loja"`);
  }
}
