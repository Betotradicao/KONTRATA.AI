import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expande rh_treinamentos pra suportar:
 *   - Loja/Empresa (empresa_id → rh_empresas) — permite agrupar treinamentos
 *     por loja na visão calendário e filtrar relatórios.
 *   - Tipo de local (local_tipo: 'INTERNO' | 'EXTERNO') — substitui o campo
 *     `local` texto livre por uma classificação. A coluna `local` continua
 *     existindo (descrição textual: "Sala de treinamento", "SENAC", etc).
 *   - Horários (hora_inicio TIME, hora_fim TIME) — pra calendário precisar
 *     da hora do dia, não só da data.
 */
export class ExpandRhTreinamentos1785080000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // rh_empresas.id é UUID — empresa_id precisa ser do mesmo tipo (FK não
    // implementável se os tipos divergem).
    await queryRunner.query(`
      ALTER TABLE rh_treinamentos
      ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES rh_empresas(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS local_tipo VARCHAR(10) NULL,
      ADD COLUMN IF NOT EXISTS hora_inicio TIME NULL,
      ADD COLUMN IF NOT EXISTS hora_fim TIME NULL
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_treinamentos_empresa ON rh_treinamentos(empresa_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_treinamentos_data_inicio ON rh_treinamentos(data_inicio)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_treinamentos_data_inicio`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_treinamentos_empresa`);
    await queryRunner.query(`
      ALTER TABLE rh_treinamentos
      DROP COLUMN IF EXISTS hora_fim,
      DROP COLUMN IF EXISTS hora_inicio,
      DROP COLUMN IF EXISTS local_tipo,
      DROP COLUMN IF EXISTS empresa_id
    `);
  }
}
