import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige tipo de created_by em pesquisa_modelos e pesquisa_rodadas.
 *
 * Bug: created_by era INT, mas o sistema usa UUID pro id do usuario
 * (campo users.id). Ao criar pesquisa logado como master, o INSERT
 * falhava com "invalid input syntax for type integer".
 *
 * Fix: muda created_by pra TEXT (aceita UUID, INT como string, ou NULL).
 * Idempotente: usa USING cast e ignora se ja for TEXT.
 */
export class FixPesquisaCreatedByUuid1784830000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // pesquisa_modelos.created_by
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='pesquisa_modelos' AND column_name='created_by'
            AND data_type='integer'
        ) THEN
          ALTER TABLE pesquisa_modelos ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
        END IF;
      END $$;
    `);

    // pesquisa_rodadas.created_by
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='pesquisa_rodadas' AND column_name='created_by'
            AND data_type='integer'
        ) THEN
          ALTER TABLE pesquisa_rodadas ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
        END IF;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback (TEXT cobre todos os casos do INT).
  }
}
