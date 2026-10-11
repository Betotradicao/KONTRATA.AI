import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Após a ciência, a versão ASSINADA (holerite + comprovante de ciência) é gravada como
 * novo arquivo na pasta HOLERITES do colaborador. O original fica — é ele que o SHA-256
 * do comprovante confere.
 */
export class AddDocumentoAssinadoAceite1788000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_documento_aceites ADD COLUMN IF NOT EXISTS documento_assinado_id INT REFERENCES rh_documentos(id) ON DELETE SET NULL`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_documento_aceites DROP COLUMN IF EXISTS documento_assinado_id`);
  }
}
