import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repara clientes onde a tabela `rh_vagas` foi criada incompleta
 * (sem cargo_id, titulo, status, etc) — caso do novacentral.
 *
 * Todos os ALTER usam IF NOT EXISTS — idempotente, seguro re-rodar.
 */
export class FixRhVagasMissingColumns1784780000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // rh_vagas — colunas que devem existir conforme a entity / controller
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS cargo_id INT`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS departamento_id INT`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS titulo VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS quantidade_vagas INT DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS salario_min DECIMAL(10,2)`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS salario_max DECIMAL(10,2)`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS data_abertura DATE`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS data_fechamento DATE`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Aberta'`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS motivo_fechamento VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS requisitos TEXT`);
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS beneficios TEXT`);

    // FK pra rh_cargos (so cria se nao existe e a tabela cargos existe)
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rh_cargos')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.table_constraints
             WHERE table_name='rh_vagas' AND constraint_name='rh_vagas_cargo_id_fkey'
           )
        THEN
          ALTER TABLE rh_vagas
            ADD CONSTRAINT rh_vagas_cargo_id_fkey
            FOREIGN KEY (cargo_id) REFERENCES rh_cargos(id);
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Migration de reparo — sem rollback (ja era esperado que existissem)
  }
}
