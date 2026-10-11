import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Faz o atendente parecer gente: simula "digitando..." e espera alguns
 * segundos antes de mandar cada mensagem.
 *
 * Resposta instantânea entrega que é robô. Um par de segundos com o
 * "digitando..." aparecendo muda completamente a percepção de quem recebe.
 */
export class AddAtendenteDigitando1787500000000 implements MigrationInterface {
  name = 'AddAtendenteDigitando1787500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE atendente_config ADD COLUMN IF NOT EXISTS simular_digitando BOOLEAN NOT NULL DEFAULT true`);
    await q.query(`ALTER TABLE atendente_config ADD COLUMN IF NOT EXISTS segundos_espera INTEGER NOT NULL DEFAULT 2`);
    // A mensagem de "não entendi" foi removida a pedido: o silêncio dentro do
    // intervalo já é o comportamento desejado, e a mensagem virava eco chato.
    await q.query(`UPDATE atendente_config SET mensagem_nao_entendi = NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE atendente_config DROP COLUMN IF EXISTS simular_digitando`);
    await q.query(`ALTER TABLE atendente_config DROP COLUMN IF EXISTS segundos_espera`);
  }
}
