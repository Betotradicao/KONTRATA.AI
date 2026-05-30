import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona departamento_id em pesquisa_rodadas pra segmentar pesquisas de
 * clima (especialmente as de risco psicossocial NR-1) por setor/GES.
 *
 * Cada rodada agora pode ser amarrada a um setor especifico (ex: Acougue,
 * Frente de Caixa, Padaria) pra que a analise seja por Grupo de Exposicao
 * Similar — exigencia pratica do PGR psicossocial.
 *
 * Nullable porque pesquisas globais (clima geral, NPS) seguem sem setor.
 */
export class AddSetorToPesquisaRodadas1785090000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pesquisa_rodadas
      ADD COLUMN IF NOT EXISTS departamento_id INT NULL REFERENCES rh_departamentos(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pesquisa_rodadas_departamento
      ON pesquisa_rodadas(departamento_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_pesquisa_rodadas_departamento`);
    await queryRunner.query(`ALTER TABLE pesquisa_rodadas DROP COLUMN IF EXISTS departamento_id`);
  }
}
