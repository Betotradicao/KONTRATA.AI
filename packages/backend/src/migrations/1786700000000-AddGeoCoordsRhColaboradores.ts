import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coords geocodadas do colaborador (a partir do CEP) — pra calcular a distância
 * casa do colaborador → loja (coluna "Km da Loja" no ranking de desligamentos).
 * Mesmo padrão de curriculos/rh_empresas (ver 1785410000000). geo_cep guarda
 * qual CEP gerou as coords, pra re-geocodar se o CEP mudar.
 */
export class AddGeoCoordsRhColaboradores1786700000000 implements MigrationInterface {
  name = 'AddGeoCoordsRhColaboradores1786700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS latitude double precision`);
    await q.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS longitude double precision`);
    await q.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS geo_cep varchar(9)`);
    await q.query(`ALTER TABLE rh_colaboradores ADD COLUMN IF NOT EXISTS geo_updated_at timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS latitude`);
    await q.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS longitude`);
    await q.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS geo_cep`);
    await q.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS geo_updated_at`);
  }
}
