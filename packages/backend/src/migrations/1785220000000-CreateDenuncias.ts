import { MigrationInterface, QueryRunner } from 'typeorm';

// Canal de denuncia anonima (Lei 14.457/22 + NR-1 atualizada).
// Colaborador acessa via link publico /denuncia/<empresa_id> ou QR Code,
// preenche tipo + descricao. Pode ser anonima ou identificada.
// Admin acompanha pelo painel em Analise NR-1 > aba Canal de Denuncia.
export class CreateDenuncias1785220000000 implements MigrationInterface {
  name = 'CreateDenuncias1785220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS denuncias (
        id SERIAL PRIMARY KEY,
        empresa_id UUID NOT NULL,
        protocolo VARCHAR(20) UNIQUE NOT NULL,
        tipo VARCHAR(60) NOT NULL,
        categoria VARCHAR(40) NOT NULL,
        descricao TEXT NOT NULL,
        local TEXT,
        data_ocorrido DATE,
        anonima BOOLEAN NOT NULL DEFAULT true,
        autor_nome VARCHAR(200),
        autor_contato VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'nova',
        prioridade VARCHAR(10) NOT NULL DEFAULT 'media',
        anotacoes_internas TEXT,
        responsavel_id UUID NULL,
        resolucao TEXT,
        resolvida_em TIMESTAMP NULL,
        ip_origem VARCHAR(60),
        user_agent TEXT,
        criada_em TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizada_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_denuncias_empresa ON denuncias(empresa_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_denuncias_criada ON denuncias(criada_em DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS denuncias`);
  }
}
