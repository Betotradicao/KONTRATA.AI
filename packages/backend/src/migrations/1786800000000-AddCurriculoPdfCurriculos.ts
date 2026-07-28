import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PDF do curriculo anexado pelo proprio candidato.
 *
 * Depois de enviar o formulario, a tela de sucesso pergunta se ele quer deixar
 * TAMBEM o curriculo em PDF (o dele, feito em casa). O upload acontece DEPOIS do
 * INSERT do curriculo, por isso a coluna e nullable e preenchida por um segundo
 * request (POST /curriculos/publico/upload-pdf) — nao vem no payload do envio.
 *
 * curriculo_pdf_nome guarda o nome ORIGINAL do arquivo so pra exibir/baixar
 * bonitinho no Banco de Curriculos (a URL do MinIO tem nome randomico).
 */
export class AddCurriculoPdfCurriculos1786800000000 implements MigrationInterface {
  name = 'AddCurriculoPdfCurriculos1786800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE curriculos ADD COLUMN IF NOT EXISTS curriculo_pdf_url text`);
    await q.query(`ALTER TABLE curriculos ADD COLUMN IF NOT EXISTS curriculo_pdf_nome varchar(255)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE curriculos DROP COLUMN IF EXISTS curriculo_pdf_url`);
    await q.query(`ALTER TABLE curriculos DROP COLUMN IF EXISTS curriculo_pdf_nome`);
  }
}
