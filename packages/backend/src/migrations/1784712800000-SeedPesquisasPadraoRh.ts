import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DESATIVADO em 2026-05-26.
 *
 * Anteriormente criava 7 templates genericos (Clima Organizacional, eNPS,
 * Avaliacao de Lideranca, Onboarding 30/60/90, Pesquisa de Desligamento,
 * Avaliacao de Treinamento, Avaliacao 360) — mas estavam duplicando com
 * o seed do tradicao e poluindo a tela dos clientes novos.
 *
 * Hoje novos clientes recebem APENAS as 7 pesquisas do tradicao via
 * 1784842000000-SeedPesquisasClimaPadrao.ts. Clientes existentes que ja
 * receberam esses templates continuam com eles (migrations nao removem
 * dados em rollback).
 */
export class SeedPesquisasPadraoRh1784712800000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
