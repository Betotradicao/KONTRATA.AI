import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Atualiza a lista de pastas obrigatorias (protegida=true) de 6 para 8
 * adicionando ESPELHO DE PONTO e ABERTURA DE CAT, e fixa a ordem
 * solicitada pelo cliente.
 *
 * Ordem fixa (todas com protegida=true):
 *   1. DOCS CONTRATAÇÃO
 *   2. HOLERITES
 *   3. ESPELHO DE PONTO
 *   4. FÉRIAS
 *   5. ATESTADO
 *   6. ADVERTÊNCIAS
 *   7. TREINAMENTOS
 *   8. ABERTURA DE CAT
 *
 * Pra cada colaborador ativo, garante existir todas as 8 com a ordem.
 * Pastas customizadas criadas pelo usuario (protegida=false) ficam
 * acima ou intercaladas usando ordem > 100 (reservado pras user-defined).
 */
const PASTAS_OBRIGATORIAS = [
  { nome: 'DOCS CONTRATAÇÃO', ordem: 1 },
  { nome: 'HOLERITES',        ordem: 2 },
  { nome: 'ESPELHO DE PONTO', ordem: 3 },
  { nome: 'FÉRIAS',           ordem: 4 },
  { nome: 'ATESTADO',         ordem: 5 },
  { nome: 'ADVERTÊNCIAS',     ordem: 6 },
  { nome: 'TREINAMENTOS',     ordem: 7 },
  { nome: 'ABERTURA DE CAT',  ordem: 8 },
];

export class AtualizarPastasObrigatorias1784853000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cria as faltantes pra cada colaborador ativo + marca como protegida
    for (const p of PASTAS_OBRIGATORIAS) {
      await queryRunner.query(
        `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
         SELECT c.id, $1::text, $2::int, true
         FROM rh_colaboradores c
         WHERE c.status = 'ativo'
         ON CONFLICT (colaborador_id, nome) DO UPDATE SET
           protegida = true,
           ordem = EXCLUDED.ordem`,
        [p.nome, p.ordem]
      );
    }

    // Tambem padroniza pastas ja existentes com o mesmo nome (case-insensitive)
    // pra ficarem com protegida=true e ordem correta. Pega variacoes tipo
    // "Ferias" (sem acento) que possam existir.
    for (const p of PASTAS_OBRIGATORIAS) {
      const nomeAlt = p.nome
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
        .toUpperCase();
      await queryRunner.query(
        `UPDATE rh_documento_pastas
         SET protegida = true, ordem = $2::int
         WHERE UPPER(TRANSLATE(TRIM(nome), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ', 'AAAAEEEIIIOOOOUUUC')) = $1::text`,
        [nomeAlt, p.ordem]
      );
    }

    // Empurra pastas user-defined pra ordem >= 100 pra nao colidirem
    // com a ordem fixa das obrigatorias (1-8).
    await queryRunner.query(`
      UPDATE rh_documento_pastas
      SET ordem = COALESCE(ordem, 0) + 100
      WHERE protegida = false AND COALESCE(ordem, 0) < 100
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao remove pastas — apenas tira protecao das 2 novas
    // (mantem ESPELHO DE PONTO e ABERTURA DE CAT como pastas comuns)
  }
}
