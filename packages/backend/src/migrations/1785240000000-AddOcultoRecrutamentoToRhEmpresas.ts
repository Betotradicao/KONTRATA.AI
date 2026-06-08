import { MigrationInterface, QueryRunner } from 'typeorm';

// Flag pra esconder a empresa/loja da pagina publica de candidatura.
// Quando true, a loja NAO aparece em "Pra qual loja voce quer se candidatar?".
// Util pra empresas que existem so como pasta de documentos (sem vaga real).
export class AddOcultoRecrutamentoToRhEmpresas1785240000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_empresas
        ADD COLUMN IF NOT EXISTS oculto_recrutamento BOOLEAN NOT NULL DEFAULT false
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_empresas DROP COLUMN IF EXISTS oculto_recrutamento`);
  }
}
