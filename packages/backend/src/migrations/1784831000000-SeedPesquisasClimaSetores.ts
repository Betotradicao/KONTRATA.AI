import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DESATIVADO em 2026-05-26.
 *
 * Anteriormente criava 5 pesquisas "Pesquisa de Clima X" (Acougue, Padaria,
 * Hortfruti, Frente de Caixa, Reposicao) com sufixo "Supermercado Tradicao"
 * extraidas dos Google Forms originais. Estava duplicando com o seed
 * 1784842000000-SeedPesquisasClimaPadrao.ts, que ja traz as mesmas 5
 * pesquisas (sem o sufixo de marca).
 *
 * Resultado: clientes novos viam 10 pesquisas (5 com sufixo + 5 sem). Agora
 * recebem apenas as 5 do seed do tradicao. Clientes existentes que ja
 * tinham as versoes com sufixo continuam com elas (migrations nao removem).
 */
export class SeedPesquisasClimaSetores1784831000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
