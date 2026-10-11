import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ciência do holerite com código de 6 dígitos no WhatsApp (assinatura eletrônica
 * AVANÇADA: login CPF+senha + posse do celular). Guarda só o SHA-256 do código.
 * - otp_aceite_id: pra qual documento o código vale (não serve pra outro).
 * - otp_falhou_aceite_id: o envio falhou pra esse documento → libera a ciência
 *   simples (cpf_senha) só pra ele, sem travar o colaborador.
 */
export class AddOtpCienciaPortal1787900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaborador_acessos
        ADD COLUMN IF NOT EXISTS otp_hash VARCHAR(64),
        ADD COLUMN IF NOT EXISTS otp_expira_em TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS otp_tentativas INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS otp_aceite_id INT,
        ADD COLUMN IF NOT EXISTS otp_enviado_em TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS otp_falhou_aceite_id INT
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaborador_acessos
        DROP COLUMN IF EXISTS otp_hash, DROP COLUMN IF EXISTS otp_expira_em, DROP COLUMN IF EXISTS otp_tentativas,
        DROP COLUMN IF EXISTS otp_aceite_id, DROP COLUMN IF EXISTS otp_enviado_em, DROP COLUMN IF EXISTS otp_falhou_aceite_id
    `);
  }
}
