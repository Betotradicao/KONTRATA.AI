import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Código do WhatsApp passou a ser pedido pra ABRIR o holerite (decisão do Beto,
 * 11/10/2026), não no "Ciente". Validado → libera aquele documento por 30 min; a
 * ciência dentro dessa janela continua registrada como 2 fatores.
 */
export class AddOtpValidadoPortal1788100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaborador_acessos
        ADD COLUMN IF NOT EXISTS otp_validado_aceite_id INT,
        ADD COLUMN IF NOT EXISTS otp_validado_em TIMESTAMPTZ
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaborador_acessos DROP COLUMN IF EXISTS otp_validado_aceite_id, DROP COLUMN IF EXISTS otp_validado_em`);
  }
}
