import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lembrete pros pendentes (decisão do Beto, 24/10/2026): WhatsApp com passo a passo pra
 * quem ainda não abriu o holerite. Manual (botão em lote) e automático (1º após N dias do
 * envio, depois a cada X dias, até um máximo). Config em `configurations`
 * (portal_lembrete_*). Aqui só o controle por publicação.
 */
export class AddLembretesHolerite1788400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_documento_aceites
        ADD COLUMN IF NOT EXISTS lembretes_enviados INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ultimo_lembrete_em TIMESTAMPTZ
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_documento_aceites DROP COLUMN IF EXISTS lembretes_enviados, DROP COLUMN IF EXISTS ultimo_lembrete_em`);
  }
}
