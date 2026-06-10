import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona DOCS DEMISSAO como 9a pasta obrigatoria (protegida=true) de cada
 * colaborador. Garante existencia em todos os ativos com ordem=9.
 *
 * Idempotente: ON CONFLICT atualiza ordem/protegida pra o valor correto.
 */
export class AddDocsDemissaoPastaObrigatoria1785290000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cria a pasta DOCS DEMISSAO pra cada colaborador ativo (ordem 9, protegida)
    await queryRunner.query(
      `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
       SELECT c.id, 'DOCS DEMISSÃO'::text, 9::int, true
       FROM rh_colaboradores c
       WHERE c.status = 'ativo'
       ON CONFLICT (colaborador_id, nome) DO UPDATE SET
         protegida = true,
         ordem = EXCLUDED.ordem`
    );

    // Padroniza variacoes existentes (sem acento, minuscula, etc.) pro nome canonico
    await queryRunner.query(
      `UPDATE rh_documento_pastas
         SET protegida = true, ordem = 9
       WHERE UPPER(TRANSLATE(TRIM(nome), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) = 'DOCS DEMISSAO'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down: tira a protecao (mantem dados que ja foram subidos)
    await queryRunner.query(
      `UPDATE rh_documento_pastas
         SET protegida = false
       WHERE nome = 'DOCS DEMISSÃO'`
    );
  }
}
