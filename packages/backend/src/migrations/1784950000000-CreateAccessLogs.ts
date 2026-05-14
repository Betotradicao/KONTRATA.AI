import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccessLogs1784950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID,
        user_type VARCHAR(20),
        user_name VARCHAR(255),
        method VARCHAR(10) NOT NULL,
        path TEXT NOT NULL,
        status_code INT,
        ip VARCHAR(45),
        user_agent TEXT,
        body_meta JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_method ON access_logs(method)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS access_logs`);
  }
}
