import { MigrationInterface, QueryRunner } from 'typeorm';
import { CLAUSULAS_PADRAO } from '../data/contrato-clausulas-padrao';

/**
 * Semeia as 14 cláusulas padrão em TODOS os cargos existentes que ainda não têm
 * nenhuma cláusula — pra o RH não precisar preencher cargo a cargo.
 * Cargos novos (criados depois) recebem as 14 via auto-seed (ensureSeed) ao abrir.
 */
export class SeedContratoClausulasTodosCargos1785710000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const cargos: { id: number }[] = await queryRunner.query(`SELECT id FROM rh_cargos`);
    for (const c of cargos) {
      const [{ total }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS total FROM rh_contrato_clausulas WHERE cargo_id = $1`, [c.id]
      );
      if (total > 0) continue; // já tem (ou já foi mexido) — não duplica
      let ordem = 0;
      for (const cl of CLAUSULAS_PADRAO) {
        ordem += 1;
        await queryRunner.query(
          `INSERT INTO rh_contrato_clausulas (cargo_id, titulo, conteudo, ordem) VALUES ($1, $2, $3, $4)`,
          [c.id, cl.titulo, cl.conteudo, ordem]
        );
      }
    }
  }

  public async down(): Promise<void> {
    // sem rollback de dados (seed); a tabela é dropada na migration de criação.
  }
}
