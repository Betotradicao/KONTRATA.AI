import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Importação de holerites em PDF (lote da contabilidade) — 11/10/2026.
 *
 * Decisão do Beto: os holerites NÃO saem do nosso gerador ainda; vêm em um PDF
 * único da contabilidade (1 página por pessoa, às vezes 2 quando estoura). O RH
 * importa, o sistema fatia e sugere de quem é cada página (CPF impresso), o RH
 * confere/classifica o tipo e publica (pasta HOLERITES + Portal + WhatsApp).
 *
 * - rh_tipos_holerite: lista editável em Configurações de RH (Pagamento,
 *   Adiantamento, Férias, 13º). `palavras_chave` casa com o título do PDF pra
 *   sugerir o tipo automaticamente.
 * - rh_holerite_lotes: cada PDF importado.
 * - rh_holerite_lote_itens: cada documento fatiado (1..n páginas) com o que foi
 *   detectado e o que o RH confirmou. Só vira rh_documentos/aceite ao publicar.
 * - rh_documento_aceites.tipo_holerite_id: qual tipo foi publicado.
 */
export class CreateHoleriteImportacao1787700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_tipos_holerite (
        id             SERIAL PRIMARY KEY,
        nome           VARCHAR(100) NOT NULL,
        descricao      TEXT,
        palavras_chave TEXT,
        ativo          BOOLEAN NOT NULL DEFAULT true,
        ordem          INT NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const tipos = [
      ['PAGAMENTO',    'Recibo mensal de pagamento de salário',  'pagamento de salario,pagamento de salário,recibo de pagamento', 1],
      ['ADIANTAMENTO', 'Adiantamento salarial (vale)',           'adiantamento', 2],
      ['FÉRIAS',       'Recibo de férias',                       'ferias,férias', 3],
      ['13º SALÁRIO',  '13º salário (1ª e 2ª parcela)',          '13,decimo terceiro,décimo terceiro,gratificacao natalina,gratificação natalina', 4],
    ];
    for (const [nome, descricao, kw, ordem] of tipos) {
      await queryRunner.query(
        `INSERT INTO rh_tipos_holerite (nome, descricao, palavras_chave, ordem)
         SELECT $1::varchar, $2::text, $3::text, $4::int WHERE NOT EXISTS (SELECT 1 FROM rh_tipos_holerite WHERE nome = $1::varchar)`,
        [nome, descricao, kw, ordem]
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_holerite_lotes (
        id                   SERIAL PRIMARY KEY,
        nome_arquivo         VARCHAR(255) NOT NULL,
        arquivo_url          TEXT,
        total_paginas        INT NOT NULL DEFAULT 0,
        total_itens          INT NOT NULL DEFAULT 0,
        competencia_sugerida VARCHAR(7),
        status               VARCHAR(20) NOT NULL DEFAULT 'classificando',
        criado_por           VARCHAR(255),
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_holerite_lote_itens (
        id                  SERIAL PRIMARY KEY,
        lote_id             INT NOT NULL REFERENCES rh_holerite_lotes(id) ON DELETE CASCADE,
        ordem               INT NOT NULL DEFAULT 0,
        paginas             INT[] NOT NULL DEFAULT '{}',
        arquivo_url         TEXT NOT NULL,
        tamanho_bytes       INT,
        titulo_detectado    VARCHAR(255),
        cpf_detectado       VARCHAR(14),
        matricula_detectada VARCHAR(50),
        nome_detectado      VARCHAR(255),
        periodo_detectado   VARCHAR(20),
        colaborador_id      INT REFERENCES rh_colaboradores(id) ON DELETE SET NULL,
        tipo_id             INT REFERENCES rh_tipos_holerite(id) ON DELETE SET NULL,
        competencia         VARCHAR(7),
        confianca           VARCHAR(10) NOT NULL DEFAULT 'nenhuma',
        status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
        aceite_id           INT REFERENCES rh_documento_aceites(id) ON DELETE SET NULL,
        publicado_em        TIMESTAMPTZ,
        erro                TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_holerite_itens_lote ON rh_holerite_lote_itens(lote_id, ordem)`);

    await queryRunner.query(`ALTER TABLE rh_documento_aceites ADD COLUMN IF NOT EXISTS tipo_holerite_id INT REFERENCES rh_tipos_holerite(id) ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_documento_aceites DROP COLUMN IF EXISTS tipo_holerite_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_holerite_lote_itens`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_holerite_lotes`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_tipos_holerite`);
  }
}
