import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria sistema de template centralizado de pastas e subpastas padronizadas
 * pra documentacao dos colaboradores.
 *
 * Antes: as 9 pastas obrigatorias eram chumbadas em migrations e qualquer
 * mudanca pedia codigo novo. Subpastas eram criadas manualmente por
 * colaborador na tela de Documentacao.
 *
 * Depois: RH gerencia tudo em Configuracoes RH -> Documentacao Padronizada.
 *   - rh_documento_pastas_template: pastas que entram pra todo colab novo
 *   - rh_documento_subpastas_template: subpastas de cada pasta template
 * Ao cadastrar colaborador novo, o backend copia template -> rh_documento_pastas
 * e rh_documento_subpastas pra ele.
 *
 * Idempotente — se ja existir, mantem.
 */
export class CreateDocumentoPastasTemplate1785300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_pastas_template (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(120) NOT NULL UNIQUE,
        ordem INTEGER NOT NULL DEFAULT 0,
        obrigatoria BOOLEAN NOT NULL DEFAULT true,
        protegida BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_subpastas_template (
        id SERIAL PRIMARY KEY,
        pasta_template_id INTEGER NOT NULL REFERENCES rh_documento_pastas_template(id) ON DELETE CASCADE,
        nome VARCHAR(120) NOT NULL,
        ordem INTEGER NOT NULL DEFAULT 0,
        obrigatoria BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (pasta_template_id, nome)
      )
    `);

    // Popula as 9 pastas obrigatorias atuais (protegidas, nao podem ser excluidas
    // pelo usuario — soh editar/desmarcar obrigatoriedade).
    const PASTAS_FIXAS = [
      { nome: 'DOCS CONTRATAÇÃO', ordem: 1 },
      { nome: 'HOLERITES',        ordem: 2 },
      { nome: 'ESPELHO DE PONTO', ordem: 3 },
      { nome: 'FÉRIAS',           ordem: 4 },
      { nome: 'ATESTADO',         ordem: 5 },
      { nome: 'ADVERTÊNCIAS',     ordem: 6 },
      { nome: 'TREINAMENTOS',     ordem: 7 },
      { nome: 'ABERTURA DE CAT',  ordem: 8 },
      { nome: 'DOCS DEMISSÃO',    ordem: 9 },
    ];
    for (const p of PASTAS_FIXAS) {
      await queryRunner.query(
        `INSERT INTO rh_documento_pastas_template (nome, ordem, obrigatoria, protegida)
         VALUES ($1, $2, true, true)
         ON CONFLICT (nome) DO UPDATE SET ordem = EXCLUDED.ordem, protegida = true`,
        [p.nome, p.ordem]
      );
    }

    // Popula subpastas conhecidas (as mais comuns do Tradicao) dentro de DOCS CONTRATACAO.
    // RH pode adicionar/remover dps via UI.
    const subpastasContrat = [
      'AUTORIZAÇÃO DE IMAGEM',
      'CONTRIBUIÇÃO SINDICAL',
      'REGISTRO EMPREGADO',
      'REGULAMENTO INTERNO',
      'TERMO ACEITE CONVÊNIO',
      'TERMO BANCO DE HORAS',
      'TERMO LGPT',
      'UNIFORMES E EPIS',
      'VALE TRANSPORTE',
      'CONTRATO DE TRABALHO',
    ];
    const [pastaContratacao] = await queryRunner.query(
      `SELECT id FROM rh_documento_pastas_template WHERE nome = 'DOCS CONTRATAÇÃO' LIMIT 1`
    );
    if (pastaContratacao) {
      for (let i = 0; i < subpastasContrat.length; i++) {
        await queryRunner.query(
          `INSERT INTO rh_documento_subpastas_template (pasta_template_id, nome, ordem, obrigatoria)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (pasta_template_id, nome) DO NOTHING`,
          [pastaContratacao.id, subpastasContrat[i], i + 1]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documento_subpastas_template`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documento_pastas_template`);
  }
}
