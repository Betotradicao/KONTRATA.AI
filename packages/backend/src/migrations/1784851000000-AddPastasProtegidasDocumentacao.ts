import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o conceito de "pasta protegida" em rh_documento_pastas e
 * garante que TODO colaborador ativo tenha as 6 pastas obrigatorias
 * do sistema, marcadas como `protegida=true` (nao podem ser deletadas
 * nem renomeadas pelo usuario).
 *
 * Pastas obrigatorias:
 *   1. ATESTADO
 *   2. DOCS CONTRATACAO
 *   3. FERIAS
 *   4. HOLERITES
 *   5. TREINAMENTOS
 *   6. ADVERTENCIAS
 *
 * Em colaboradores novos, essas pastas sao criadas automaticamente
 * pelo hook do controller de criar colaborador (afterCreate).
 */
const PASTAS_OBRIGATORIAS = [
  { nome: 'ATESTADO',         ordem: 1 },
  { nome: 'DOCS CONTRATAÇÃO', ordem: 2 },
  { nome: 'FÉRIAS',           ordem: 3 },
  { nome: 'HOLERITES',        ordem: 4 },
  { nome: 'TREINAMENTOS',     ordem: 5 },
  { nome: 'ADVERTÊNCIAS',     ordem: 6 },
];

export class AddPastasProtegidasDocumentacao1784851000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Coluna `protegida`
    await queryRunner.query(`
      ALTER TABLE rh_documento_pastas
      ADD COLUMN IF NOT EXISTS protegida BOOLEAN NOT NULL DEFAULT false
    `);

    // Pra cada colaborador ATIVO, garante as 6 pastas obrigatorias
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

    // Tambem marca como protegida QUALQUER pasta existente cujo nome bata
    // com a lista (case-insensitive), pra pegar variações em colaboradores
    // que ja tinham as pastas criadas manualmente com nome equivalente.
    for (const p of PASTAS_OBRIGATORIAS) {
      await queryRunner.query(
        `UPDATE rh_documento_pastas
         SET protegida = true, ordem = $2::int
         WHERE UPPER(TRIM(nome)) = UPPER(TRIM($1::text))`,
        [p.nome, p.ordem]
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao remove dados — pastas continuam, apenas perdem protecao
  }
}
