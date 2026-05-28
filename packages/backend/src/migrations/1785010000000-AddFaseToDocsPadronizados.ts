import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona coluna `fase` em rh_docs_padronizados pra separar os documentos
 * em sub-abas no RH:
 *   1 = "DOCS 1ª FASE CONTRATAÇÃO" (admissão / pré-contratuais)
 *   2 = "DOCS 2ª FASE CONTRATAÇÃO" (pós-contratação — autorização de
 *       imagem, sindical, regulamento, compras via senha, EPIs, vale-
 *       transporte, etc.)
 *
 * Default = 2 pra todos os docs já cadastrados (os seeds atuais são todos
 * pós-contratação).
 */
export class AddFaseToDocsPadronizados1785010000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_docs_padronizados
      ADD COLUMN IF NOT EXISTS fase INT NOT NULL DEFAULT 2
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_docs_padronizados_fase ON rh_docs_padronizados(fase)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_docs_padronizados_fase`);
    await queryRunner.query(`ALTER TABLE rh_docs_padronizados DROP COLUMN IF EXISTS fase`);
  }
}
