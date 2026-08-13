import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PADRAO DE ENCARTE — arte de divulgacao de vaga por cargo.
 *
 * O RH sobe UMA arte de fundo (com os quadrantes em branco) por cargo e posiciona
 * as caixas de texto por cima, arrastando. Depois, ao abrir uma vaga daquele cargo,
 * o sistema preenche as caixas com os dados que a vaga JA tem (salario, jornada,
 * experiencia, requisitos) e exporta a imagem pronta pro feed.
 *
 * ⚠️ Por que as coordenadas ficam em PORCENTAGEM (0-100) e nao em pixel:
 * a mesma arte precisa exportar em 1080x1350 (feed 4:5), 1080x1080 (1:1) e
 * 1080x1920 (story) sem reposicionar nada. Em pixel, trocar o tamanho de saida
 * quebraria todo o layout.
 */
export class CreateRhEncarteModelos1787000000000 implements MigrationInterface {
  name = 'CreateRhEncarteModelos1787000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS rh_encarte_modelos (
        id                SERIAL PRIMARY KEY,
        cargo_id          INTEGER NULL,
        nome              VARCHAR(255) NOT NULL,
        imagem_url        TEXT NULL,
        imagem_largura    INTEGER NULL,
        imagem_altura     INTEGER NULL,
        preset_export     VARCHAR(20) NOT NULL DEFAULT 'feed_4_5',
        campos            JSONB NOT NULL DEFAULT '[]'::jsonb,
        padrao            BOOLEAN NOT NULL DEFAULT false,
        ativo             BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Um modelo por cargo (decisao do usuario). O modelo com cargo_id NULL e o
    // curinga: vale pros cargos que ainda nao tem arte propria.
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_rh_encarte_modelos_cargo
      ON rh_encarte_modelos (cargo_id) WHERE cargo_id IS NOT NULL
    `);
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_rh_encarte_modelos_padrao
      ON rh_encarte_modelos ((cargo_id IS NULL)) WHERE cargo_id IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS ux_rh_encarte_modelos_padrao`);
    await q.query(`DROP INDEX IF EXISTS ux_rh_encarte_modelos_cargo`);
    await q.query(`DROP TABLE IF EXISTS rh_encarte_modelos`);
  }
}
