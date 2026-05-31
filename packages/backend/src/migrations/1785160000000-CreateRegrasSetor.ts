import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Regras de cobertura por setor — base do motor de gerar escala automatica
 * com IA (Operations Research / OR-Tools).
 *
 * Cada setor (rh_departamentos) de cada empresa (rh_empresas) tem:
 *   - rotacao_padrao: '5x2', '6x1', etc. (a maioria dos colabs segue isso)
 *   - dias_pico: array de dias da semana com movimento alto (jsonb)
 *   - cobertura_minima: matriz dia_da_semana × turno → minimo de pessoas (jsonb)
 *   - horario_pico_inicio/fim: faixa do dia com cobertura extra
 *   - funcionamento_inicio/fim: horario de funcionamento da loja/setor
 *   - custo_hora_extra: R$/h (75% acima do normal por padrao CLT)
 *
 * Usado em 2 momentos:
 *   1. Validacao: ao salvar uma celula manual, conta gente nesse turno/dia
 *      e avisa se ficou abaixo do minimo.
 *   2. Geracao automatica (Phase 3): o solver le essas regras como
 *      restricoes do problema de otimizacao.
 */
export class CreateRegrasSetor1785160000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_regras_setor (
        id SERIAL PRIMARY KEY,
        empresa_id UUID NULL REFERENCES rh_empresas(id) ON DELETE CASCADE,
        departamento_id INT NOT NULL REFERENCES rh_departamentos(id) ON DELETE CASCADE,
        rotacao_padrao VARCHAR(20) DEFAULT '6x1',
        dias_pico JSONB DEFAULT '[]'::jsonb,
        cobertura_minima JSONB DEFAULT '{}'::jsonb,
        horario_pico_inicio TIME NULL,
        horario_pico_fim TIME NULL,
        funcionamento_inicio TIME DEFAULT '07:00',
        funcionamento_fim TIME DEFAULT '22:00',
        custo_hora_extra NUMERIC(8,2) NULL,
        observacoes TEXT NULL,
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (empresa_id, departamento_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_regras_setor_empresa ON rh_escala_regras_setor(empresa_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_regras_setor_depto ON rh_escala_regras_setor(departamento_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_regras_setor`);
  }
}
