import { MigrationInterface, QueryRunner } from 'typeorm';

// "Base de Conhecimento" do Agente Compliance — notas/documentos (PDF lido pela
// IA) sobre Sindicato, Acordo Coletivo, Regimento Interno e Aprendizados/Feedback.
// Mesmo formato do vault da Escala, em tabela separada pra não misturar.
export class CreateRhComplianceMemoria1785600000000 implements MigrationInterface {
  name = 'CreateRhComplianceMemoria1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_compliance_memoria (
        id SERIAL PRIMARY KEY,
        empresa_id UUID NULL REFERENCES rh_empresas(id) ON DELETE CASCADE,
        departamento_id INT NULL,
        slug VARCHAR(160) NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        tipo VARCHAR(40) NOT NULL DEFAULT 'outro',
        tags TEXT[] DEFAULT '{}',
        conteudo TEXT NOT NULL DEFAULT '',
        ativo BOOLEAN NOT NULL DEFAULT true,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_rh_compliance_memoria_slug
      ON rh_compliance_memoria (COALESCE(empresa_id::text, ''), slug)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_compliance_memoria_tipo
      ON rh_compliance_memoria (tipo)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_compliance_memoria_tags
      ON rh_compliance_memoria USING GIN (tags)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_compliance_memoria_fts
      ON rh_compliance_memoria USING GIN (
        to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo,''))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_compliance_memoria_fts`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_compliance_memoria_tags`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_compliance_memoria_tipo`);
    await queryRunner.query(`DROP INDEX IF EXISTS uniq_rh_compliance_memoria_slug`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_compliance_memoria`);
  }
}
