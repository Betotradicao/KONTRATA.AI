import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foto obrigatória no 1º acesso ao Portal do Colaborador (decisão do Beto, 24/10/2026).
 * Fica em rh_colaborador_acessos.foto_url; se o cadastro (rh_colaboradores.foto_url)
 * estiver vazio, a foto do portal ocupa esse lugar. Foto que o RH já pôs não é trocada.
 */
export class AddFotoAcessoPortal1788200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaborador_acessos ADD COLUMN IF NOT EXISTS foto_url TEXT`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaborador_acessos DROP COLUMN IF EXISTS foto_url`);
  }
}
