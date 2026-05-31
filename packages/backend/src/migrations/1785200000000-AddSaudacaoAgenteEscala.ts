import { MigrationInterface, QueryRunner } from 'typeorm';

// Saudacao inicial customizada que o agente exibe no chat (separada da persona tecnica).
// Aceita o placeholder {nome} que sera substituido pelo nome_agente.
export class AddSaudacaoAgenteEscala1785200000000 implements MigrationInterface {
  name = 'AddSaudacaoAgenteEscala1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_agente_config
      ADD COLUMN IF NOT EXISTS saudacao_inicial TEXT NOT NULL DEFAULT 'Oi! 👋 Eu sou a **{nome}**. Posso analisar a cobertura, simular trocas, sugerir ajustes baseado nas suas regras CLT e do setor. Pergunta aí 👇'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_escala_agente_config DROP COLUMN IF EXISTS saudacao_inicial`);
  }
}
