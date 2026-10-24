import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Excluir envio de holerite (ex.: PDF errado) SEM apagar o registro (decisão do Beto,
 * 24/10/2026): status 'excluido' + quem/quando/motivo. Os arquivos saem da pasta do
 * colaborador mas a URL fica guardada aqui (excluido_arquivo_url / excluido_assinado_url)
 * pra consulta no filtro "Excluídos" e no dossiê.
 */
export class AddExclusaoPublicacaoHolerite1788300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_documento_aceites
        ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS excluido_por VARCHAR(255),
        ADD COLUMN IF NOT EXISTS motivo_exclusao TEXT,
        ADD COLUMN IF NOT EXISTS status_antes_exclusao VARCHAR(20),
        ADD COLUMN IF NOT EXISTS excluido_arquivo_url TEXT,
        ADD COLUMN IF NOT EXISTS excluido_assinado_url TEXT
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_documento_aceites
        DROP COLUMN IF EXISTS excluido_em, DROP COLUMN IF EXISTS excluido_por, DROP COLUMN IF EXISTS motivo_exclusao,
        DROP COLUMN IF EXISTS status_antes_exclusao, DROP COLUMN IF EXISTS excluido_arquivo_url, DROP COLUMN IF EXISTS excluido_assinado_url
    `);
  }
}
