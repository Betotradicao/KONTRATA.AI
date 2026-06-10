import { MigrationInterface, QueryRunner } from 'typeorm';

// Controle de ferias dos colaboradores.
// Cada linha representa UM ciclo (periodo aquisitivo + concessivo + gozo).
// Quando um colaborador faz aniversario de empresa, abre-se um novo
// periodo aquisitivo de 12 meses; ao terminar, abre-se o concessivo de
// 12 meses pra empresa conceder; apos 11 meses do concessivo, se nao
// concedeu, paga em dobro.
export class CreateRhFerias1785280000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_ferias (
        id SERIAL PRIMARY KEY,
        colaborador_id INTEGER NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        periodo_aquisitivo_inicio DATE NOT NULL,
        periodo_aquisitivo_fim DATE NOT NULL,
        periodo_concessivo_inicio DATE NOT NULL,
        periodo_concessivo_fim DATE NOT NULL,
        data_programada DATE NULL,
        data_inicio_gozo DATE NULL,
        data_fim_gozo DATE NULL,
        dias_gozados INTEGER NOT NULL DEFAULT 0,
        abono_pecuniario_dias INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        observacoes TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_ferias_colab ON rh_ferias(colaborador_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_ferias_status ON rh_ferias(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_ferias_concessivo_fim ON rh_ferias(periodo_concessivo_fim)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_ferias`);
  }
}
