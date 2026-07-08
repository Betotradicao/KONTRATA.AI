import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Performance por Setor (Financeiro RH).
 * - rh_performance_setores: vínculo criado pelo RH — "Setor da Loja" (texto livre)
 *   ligado a um "Setor do Colaborador" (rh_departamentos), por loja (cod_loja).
 * - rh_performance_vendas: a venda lançada por mês/ano de cada setor (campo livre).
 *   A qtd de colaboradores e a performance (venda ÷ qtd) são calculadas ao vivo.
 */
export class CreateRhPerformanceSetorTables1786600000000 implements MigrationInterface {
  name = 'CreateRhPerformanceSetorTables1786600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS rh_performance_setores (
        id SERIAL PRIMARY KEY,
        cod_loja INTEGER NOT NULL,
        nome_setor_loja VARCHAR(255) NOT NULL,
        departamento_id INTEGER NULL REFERENCES rh_departamentos(id) ON DELETE SET NULL,
        ordem INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS rh_performance_vendas (
        id SERIAL PRIMARY KEY,
        setor_id INTEGER NOT NULL REFERENCES rh_performance_setores(id) ON DELETE CASCADE,
        ano INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        venda NUMERIC(14,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (setor_id, ano, mes)
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_rh_perf_setores_loja ON rh_performance_setores(cod_loja)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS rh_performance_vendas`);
    await q.query(`DROP TABLE IF EXISTS rh_performance_setores`);
  }
}
