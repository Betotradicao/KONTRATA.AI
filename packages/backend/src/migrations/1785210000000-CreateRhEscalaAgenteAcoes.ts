import { MigrationInterface, QueryRunner } from 'typeorm';

// Log de auditoria das acoes executadas pelo Agente de Escala.
// Cada vez que o agente executa uma function call que muda dados,
// gravamos aqui: quem pediu, que funcao foi chamada, ANTES/DEPOIS (snapshot
// pra desfazer), se exigiu senha e qual o resultado.
export class CreateRhEscalaAgenteAcoes1785210000000 implements MigrationInterface {
  name = 'CreateRhEscalaAgenteAcoes1785210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_agente_acoes (
        id SERIAL PRIMARY KEY,
        usuario_id UUID NULL,
        empresa_id UUID NULL,
        departamento_id INT NULL,
        pergunta TEXT,
        acao VARCHAR(80) NOT NULL,
        parametros JSONB,
        antes JSONB,
        depois JSONB,
        senha_validada BOOLEAN NOT NULL DEFAULT false,
        sucesso BOOLEAN NOT NULL DEFAULT true,
        erro TEXT,
        desfeito BOOLEAN NOT NULL DEFAULT false,
        desfeito_em TIMESTAMP NULL,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_escala_agente_acoes_usuario
      ON rh_escala_agente_acoes (usuario_id, criado_em DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rh_escala_agente_acoes_dept
      ON rh_escala_agente_acoes (empresa_id, departamento_id, criado_em DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_escala_agente_acoes_dept`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_rh_escala_agente_acoes_usuario`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_agente_acoes`);
  }
}
