import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expande rh_escala_templates pra dar suporte ao motor de "pre-preencher
 * automatico" da escala mensal.
 *
 * Antes: o template tinha apenas tipo_rotacao + padrao_semanal (jsonb).
 * Agora: tipo de folga (FIXA/ROTATIVA), datas de referencia (pra projetar
 * domingos e folgas rotativas a frente), turnos diferentes por tipo de dia
 * (semana / sabado / domingo), e comportamento em feriado.
 *
 * Tudo NULL por padrao — templates existentes continuam funcionando com a
 * logica antiga (padrao_semanal) e podem ser migrados gradualmente.
 */
export class ExpandRhEscalaTemplates1785140000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_templates
        ADD COLUMN IF NOT EXISTS tipo_folga VARCHAR(10) NULL,
        ADD COLUMN IF NOT EXISTS dia_folga_fixa INT NULL,
        ADD COLUMN IF NOT EXISTS data_ref_folga DATE NULL,
        ADD COLUMN IF NOT EXISTS rotacao_domingo VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS data_ref_domingo DATE NULL,
        ADD COLUMN IF NOT EXISTS turno_padrao_id UUID NULL,
        ADD COLUMN IF NOT EXISTS turno_sabado_id UUID NULL,
        ADD COLUMN IF NOT EXISTS turno_domingo_id UUID NULL,
        ADD COLUMN IF NOT EXISTS feriado_comportamento VARCHAR(15) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rh_escala_templates
        ADD CONSTRAINT fk_template_turno_padrao  FOREIGN KEY (turno_padrao_id)  REFERENCES rh_escala_turnos(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_template_turno_sabado  FOREIGN KEY (turno_sabado_id)  REFERENCES rh_escala_turnos(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_template_turno_domingo FOREIGN KEY (turno_domingo_id) REFERENCES rh_escala_turnos(id) ON DELETE SET NULL
    `).catch(() => { /* idempotent — ignora se constraint ja existe */ });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_escala_templates
        DROP CONSTRAINT IF EXISTS fk_template_turno_domingo,
        DROP CONSTRAINT IF EXISTS fk_template_turno_sabado,
        DROP CONSTRAINT IF EXISTS fk_template_turno_padrao
    `);
    await queryRunner.query(`
      ALTER TABLE rh_escala_templates
        DROP COLUMN IF EXISTS feriado_comportamento,
        DROP COLUMN IF EXISTS turno_domingo_id,
        DROP COLUMN IF EXISTS turno_sabado_id,
        DROP COLUMN IF EXISTS turno_padrao_id,
        DROP COLUMN IF EXISTS data_ref_domingo,
        DROP COLUMN IF EXISTS rotacao_domingo,
        DROP COLUMN IF EXISTS data_ref_folga,
        DROP COLUMN IF EXISTS dia_folga_fixa,
        DROP COLUMN IF EXISTS tipo_folga
    `);
  }
}
