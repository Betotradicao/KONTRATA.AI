import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona suporte a vencimento em documentos do Departamento Pessoal.
 *
 * - dp_subpastas.com_vencimento: flag que indica se o modelo de
 *   documento exige rastreio de vencimento (alvará, ASO, contratos
 *   anuais, etc).
 * - dp_documentos.data_vencimento / data_alerta: datas específicas
 *   por arquivo enviado. Cada arquivo pode ter vencimento próprio.
 */
export class AddVencimentoDpDocumentos1784845000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dp_subpastas
      ADD COLUMN IF NOT EXISTS com_vencimento BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE dp_documentos
      ADD COLUMN IF NOT EXISTS data_vencimento DATE
    `);
    await queryRunner.query(`
      ALTER TABLE dp_documentos
      ADD COLUMN IF NOT EXISTS data_alerta DATE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dp_documentos DROP COLUMN IF EXISTS data_alerta`);
    await queryRunner.query(`ALTER TABLE dp_documentos DROP COLUMN IF EXISTS data_vencimento`);
    await queryRunner.query(`ALTER TABLE dp_subpastas DROP COLUMN IF EXISTS com_vencimento`);
  }
}
