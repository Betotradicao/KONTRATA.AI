import { MigrationInterface, QueryRunner } from 'typeorm';

// Adiciona slug do tipo de vaga (CLT, Menor Aprendiz, Estagiario...) escolhido
// no modal de criar/editar vaga. Referencia a tabela curriculo_tipos_vaga
// (slug = chave logica, nome amigavel renderizado no badge).
export class AddTipoVagaSlugRhVagas1785270000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_vagas
        ADD COLUMN IF NOT EXISTS tipo_vaga_slug VARCHAR(40) NULL
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_vagas DROP COLUMN IF EXISTS tipo_vaga_slug`);
  }
}
