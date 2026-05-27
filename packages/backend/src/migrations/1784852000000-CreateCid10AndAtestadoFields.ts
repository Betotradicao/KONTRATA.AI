import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Cria tabela cid10 com os ~12.4 mil codigos CID-10 oficiais do DATASUS
 * (subcategorias). Adiciona tambem campos especificos pra atestados em
 * rh_documentos: nome do medico, CID, periodo (dias ou horas).
 *
 * Fonte: github.com/cleytonferrari/CidDataSus (mirror do CSV oficial DATASUS).
 * Idempotente: cria so se nao existir; importa so se tabela vazia.
 */
export class CreateCid10AndAtestadoFields1784852000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Campos extras em rh_documentos (visiveis na pasta ATESTADO)
    await queryRunner.query(`
      ALTER TABLE rh_documentos
        ADD COLUMN IF NOT EXISTS medico_nome     TEXT,
        ADD COLUMN IF NOT EXISTS cid_codigo      VARCHAR(10),
        ADD COLUMN IF NOT EXISTS cid_descricao   TEXT,
        ADD COLUMN IF NOT EXISTS periodo_tipo    VARCHAR(10),
        ADD COLUMN IF NOT EXISTS periodo_inicio  TIMESTAMP,
        ADD COLUMN IF NOT EXISTS periodo_fim     TIMESTAMP,
        ADD COLUMN IF NOT EXISTS periodo_total   NUMERIC(10,2)
    `);

    // 2) Tabela cid10
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cid10 (
        codigo            VARCHAR(7) PRIMARY KEY,
        codigo_formatado  VARCHAR(8) NOT NULL,
        descricao         TEXT NOT NULL,
        descricao_abrev   TEXT,
        restricao_sexo    CHAR(1),
        causa_obito       BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_cid10_codigo_fmt ON cid10(codigo_formatado)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_cid10_descr_lower ON cid10(LOWER(descricao))`);

    // 3) Le e importa CSV se tabela vazia
    const [{ cnt }] = await queryRunner.query(`SELECT COUNT(*)::int AS cnt FROM cid10`);
    if (cnt > 0) {
      console.log(`[CID10] Ja populado (${cnt} registros). Skip.`);
      return;
    }

    const csvPath = path.join(__dirname, 'data', 'cid10-subcategorias.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn('[CID10] CSV nao encontrado em', csvPath, '— pulando seed (tabela ficara vazia)');
      return;
    }

    const linhas = fs.readFileSync(csvPath, 'utf-8').split('\n').slice(1); // pula header
    console.log(`[CID10] Importando ${linhas.length} linhas...`);

    let importados = 0;
    let buffer: Array<{ codigo: string; codigo_fmt: string; descricao: string; abrev: string; sexo: string | null; obito: boolean }> = [];

    const flush = async () => {
      if (buffer.length === 0) return;
      const values: string[] = [];
      const params: any[] = [];
      let p = 0;
      for (const r of buffer) {
        values.push(`($${++p}, $${++p}, $${++p}, $${++p}, $${++p}, $${++p})`);
        params.push(r.codigo, r.codigo_fmt, r.descricao, r.abrev, r.sexo, r.obito);
      }
      await queryRunner.query(
        `INSERT INTO cid10 (codigo, codigo_formatado, descricao, descricao_abrev, restricao_sexo, causa_obito)
         VALUES ${values.join(',')}
         ON CONFLICT (codigo) DO NOTHING`,
        params
      );
      importados += buffer.length;
      buffer = [];
    };

    for (const linha of linhas) {
      if (!linha.trim()) continue;
      const cols = linha.split(';');
      const codigo = (cols[0] || '').trim();
      if (!codigo) continue;

      // Codigo formatado: A000 -> A00.0, A009 -> A00.9, B95-B97 -> B95-B97 (fica igual se tiver hífen)
      let codigoFmt = codigo;
      if (codigo.length === 4 && /^[A-Z]\d{3}$/.test(codigo)) {
        codigoFmt = codigo.slice(0, 3) + '.' + codigo.slice(3);
      }

      buffer.push({
        codigo,
        codigo_fmt: codigoFmt,
        descricao: (cols[4] || '').trim(),
        abrev: (cols[5] || '').trim(),
        sexo: cols[2]?.trim() || null,
        obito: !!cols[3]?.trim(),
      });

      if (buffer.length >= 500) await flush();
    }
    await flush();
    console.log(`[CID10] ${importados} CIDs importados`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cid10`);
    // Mantem colunas em rh_documentos por seguranca
  }
}
