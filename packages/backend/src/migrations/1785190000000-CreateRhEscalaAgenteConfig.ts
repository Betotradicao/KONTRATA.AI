import { MigrationInterface, QueryRunner } from 'typeorm';

// Configuracao da persona/regras do Assistente de Escala (1 linha global).
// Inspirado em rh_recrutador_config (a Helen, da entrevistadora).
export class CreateRhEscalaAgenteConfig1785190000000 implements MigrationInterface {
  name = 'CreateRhEscalaAgenteConfig1785190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_agente_config (
        id SERIAL PRIMARY KEY,
        nome_agente VARCHAR(80) NOT NULL DEFAULT 'Assistente de Escala',
        avatar_emoji VARCHAR(10) NOT NULL DEFAULT '👩‍💼',
        cor_tema VARCHAR(20) NOT NULL DEFAULT 'purple',
        persona_descricao TEXT NOT NULL DEFAULT '',
        tom_comunicacao VARCHAR(40) NOT NULL DEFAULT 'profissional',
        modelo_ia VARCHAR(60) NOT NULL DEFAULT 'gpt-4o-mini',
        max_tokens_resposta INT NOT NULL DEFAULT 1200,
        temperatura NUMERIC(3,2) NOT NULL DEFAULT 0.7,
        timeout_segundos INT NOT NULL DEFAULT 60,
        instrucoes_extras TEXT NOT NULL DEFAULT '',
        usar_vault BOOLEAN NOT NULL DEFAULT true,
        sugerir_memoria BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Seed inicial (linha unica) com a persona default que estava hardcoded
    await queryRunner.query(`
      INSERT INTO rh_escala_agente_config (
        nome_agente, persona_descricao, tom_comunicacao, modelo_ia, instrucoes_extras
      ) VALUES (
        'Assistente de Escala',
        'Especialista em gestao de equipes de supermercado e legislacao trabalhista brasileira (CLT, NR-1). Mais de 15 anos de experiencia em varejo alimentar, com vivencia pratica em escala 6x1, 5x2, alternancia de domingos e feriados. Conhece a fundo as particularidades de cada setor (acougue, padaria, hortifruti, frente de caixa, reposicao, mercearia).',
        'profissional',
        'gpt-4o-mini',
        '## REGRAS POR DEFAULT (siga sempre, EXCETO se o RH pedir explicitamente o contrario)

### CLT
- Interjornada minima de 11h entre turnos
- DSR garantido
- Limite de 44h semanais
- Hora extra so com autorizacao do RH

### NR-1
- Considerar riscos psicossociais (sobrecarga)
- Avisar sobrecarga repetida no mesmo colaborador

### Etica (sempre validas)
- NUNCA escalar alguem em ferias, atestado ou licenca
- NUNCA inventar dados que nao estao no contexto
- Quando faltar informacao, PEDIR ao RH

### Quando o RH pede pra quebrar uma regra
- Pode sugerir cenarios fora do padrao
- Sempre AVISAR: "⚠️ Essa proposta quebra a regra X (motivo)."
- Mostrar o RISCO concreto e uma ALTERNATIVA legal'
      )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_agente_config`);
  }
}
