import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Seed inicial das pesquisas de clima padrão pra novos clientes Kontrata.
 *
 * Inclui 7 modelos prontos extraídos do cliente Tradição (sem nomes
 * pessoais ou referências à marca):
 *  - Pesquisa de Satisfação - Supermercado (cliente externo)
 *  - Pesquisa de Desligamento
 *  - 5 Pesquisas de Clima por setor (Açougue, Padaria, Hortfruti,
 *    Frente de Caixa, Reposição)
 *
 * Idempotente: usa WHERE NOT EXISTS pelo nome do modelo e
 * (modelo_id, ordem) pra perguntas — não duplica se rodar 2x.
 */
export class SeedPesquisasClimaPadrao1784842000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const sqlPath = path.join(__dirname, 'data', 'seed-pesquisas-clima.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Não remove — seed permanece mesmo em rollback
  }
}
