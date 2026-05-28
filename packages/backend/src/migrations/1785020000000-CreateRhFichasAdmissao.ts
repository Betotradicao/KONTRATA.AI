import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabela rh_fichas_admissao — Ficha de Admissão preenchida pelo RH na 1ª fase
 * de contratação, com link público pro candidato completar os dados pessoais
 * (FASE B). Após o candidato preencher, o RH revisa e converte em colaborador.
 *
 * Status:
 *   rascunho               — RH está montando, ainda não enviou
 *   aguardando_candidato   — link enviado, esperando candidato preencher
 *   preenchida             — candidato preencheu, aguardando RH revisar
 *   colaborador_criado     — virou colaborador (vinculado em colaborador_id)
 *   cancelada              — descartada
 *
 * candidato_dados (JSONB) — dados pessoais que o candidato preenche via link
 * público (FASE B): endereço, RG, CPF, dependentes, etc.
 */
export class CreateRhFichasAdmissao1785020000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_fichas_admissao (
        id SERIAL PRIMARY KEY,

        company_id UUID NULL,

        candidato_nome VARCHAR(255) NOT NULL,
        candidato_email VARCHAR(255) NULL,
        candidato_celular VARCHAR(30) NULL,

        data_admissao DATE NULL,
        cargo_id INT NULL,
        departamento_id INT NULL,
        jornada_id INT NULL,
        escala_id INT NULL,
        escala_domingo_id INT NULL,
        regime_trabalho_id INT NULL,
        prazo_experiencia_id INT NULL,
        forma_pagamento_id INT NULL,
        salario NUMERIC(10,2) NULL,

        horario_entrada VARCHAR(10) NULL,
        horario_intervalo VARCHAR(50) NULL,
        horario_saida VARCHAR(10) NULL,

        primeiro_emprego BOOLEAN NOT NULL DEFAULT FALSE,
        contribuicao_sindical BOOLEAN NOT NULL DEFAULT FALSE,
        vale_transporte BOOLEAN NOT NULL DEFAULT FALSE,

        public_token UUID NOT NULL DEFAULT gen_random_uuid(),
        status VARCHAR(40) NOT NULL DEFAULT 'rascunho',

        candidato_dados JSONB NOT NULL DEFAULT '{}'::jsonb,
        colaborador_id INT NULL,

        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_to_candidate_at TIMESTAMP NULL,
        filled_by_candidate_at TIMESTAMP NULL,

        CONSTRAINT uk_rh_fichas_admissao_token UNIQUE(public_token)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_fichas_admissao_status ON rh_fichas_admissao(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_fichas_admissao_company ON rh_fichas_admissao(company_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_fichas_admissao`);
  }
}
