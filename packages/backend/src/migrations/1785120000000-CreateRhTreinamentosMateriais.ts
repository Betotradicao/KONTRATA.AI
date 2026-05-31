import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Biblioteca de materiais de treinamento — slides PowerPoint, PDFs, Word,
 * vídeos, planilhas etc. que o RH guarda pra reusar em treinamentos futuros.
 *
 * NÃO é registro de treinamento dado (esse é rh_treinamentos — uso real
 * com colaborador, data, instrutor). Aqui é só o ASSET (arquivo +
 * metadados) ficando guardado pra quem quiser usar depois.
 */
export class CreateRhTreinamentosMateriais1785120000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_treinamentos_materiais (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        tema VARCHAR(255) NULL,
        tags TEXT NULL,
        arquivo_url TEXT NOT NULL,
        arquivo_nome_original VARCHAR(500) NULL,
        mime_type VARCHAR(150) NULL,
        tamanho_bytes BIGINT NULL,
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by TEXT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_treinamentos_materiais_ativo ON rh_treinamentos_materiais(ativo)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_treinamentos_materiais_tema ON rh_treinamentos_materiais(tema)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_treinamentos_materiais`);
  }
}
