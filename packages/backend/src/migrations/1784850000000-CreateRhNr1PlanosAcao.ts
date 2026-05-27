import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Planos de acao NR-1 criados pelo RH a partir do diagnostico farol.
 * Cumpre a exigencia da NR-1 de documentar medidas preventivas/corretivas
 * com responsavel, prazo e monitoramento.
 */
export class CreateRhNr1PlanosAcao1784850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_nr1_planos_acao (
        id SERIAL PRIMARY KEY,
        sugestao_id INT REFERENCES rh_nr1_sugestoes_acao(id) ON DELETE SET NULL,
        dimensao_nr1 VARCHAR(80) NOT NULL,
        titulo TEXT NOT NULL,
        descricao TEXT,
        setor_alvo TEXT,
        rodada_id INT REFERENCES pesquisa_rodadas(id) ON DELETE SET NULL,
        responsavel TEXT,
        prazo_data DATE,
        status VARCHAR(30) NOT NULL DEFAULT 'pendente',
        evidencia_url TEXT,
        observacoes TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        concluido_em TIMESTAMP,
        CONSTRAINT chk_nr1_status CHECK (status IN ('pendente','em_andamento','concluido','cancelado'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_nr1_plano_dim    ON rh_nr1_planos_acao(dimensao_nr1)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_nr1_plano_status ON rh_nr1_planos_acao(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_nr1_plano_prazo  ON rh_nr1_planos_acao(prazo_data)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_nr1_planos_acao`);
  }
}
