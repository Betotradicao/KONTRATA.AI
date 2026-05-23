import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove as pesquisas "Clima Organizacional" e "Avaliação de Liderança"
 * que viraram redundantes — as perguntas mais úteis delas (reconhecimento,
 * crescimento, carga, equilíbrio, orgulho) foram incorporadas nas 5
 * pesquisas por setor (Açougue, Padaria, Hortifruti, Frente de Caixa,
 * Reposição) que cobrem o mesmo terreno de forma mais granular.
 *
 * Idempotente: usa DELETE com cascade nas FKs (perguntas/rodadas/respostas).
 */
export class RemoveClimaELiderancaRedundantes1784831500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM pesquisa_modelos WHERE nome IN ('Clima Organizacional', 'Avaliação de Liderança')`
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback (seed original ja nao recria essas 2).
  }
}
