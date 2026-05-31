import { MigrationInterface, QueryRunner } from 'typeorm';

// "Vault" do Agente de Escala - notas estilo Obsidian que o agente
// consulta antes de responder e onde voce salva fatos aprendidos
// (colaboradores, setores, regras, padroes).
export class CreateRhEscalaMemoria1785180000000 implements MigrationInterface {
  name = 'CreateRhEscalaMemoria1785180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_memoria (
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

    // Slug unico por empresa (NULL=global). Postgres trata NULL como distinto,
    // entao usamos COALESCE com sentinela pra forcar unicidade tbm em globais.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_rh_escala_memoria_slug
      ON rh_escala_memoria (COALESCE(empresa_id::text, ''), slug)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_escala_memoria_tipo
      ON rh_escala_memoria (tipo)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_escala_memoria_tags
      ON rh_escala_memoria USING GIN (tags)
    `);

    // Indice full-text em portugues pra busca por conteudo/titulo
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_escala_memoria_fts
      ON rh_escala_memoria USING GIN (
        to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo,''))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_escala_memoria_fts`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_escala_memoria_tags`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_escala_memoria_tipo`);
    await queryRunner.query(`DROP INDEX IF EXISTS uniq_rh_escala_memoria_slug`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_memoria`);
  }
}
