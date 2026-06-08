import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Substitui no template da Advertencia o trecho de placeholders manuais
 * "(Data da(s) ocorrencia(s) ___/___/___  ___/___/___ ___/___/___)" por
 * "(Data da(s) ocorrencia(s): $DATAS_OCORRENCIA$)", que sera preenchido
 * pelo RH no momento de gerar (passo novo no modal Gerar).
 *
 * Tambem adiciona a linha se o template do cliente NAO contem ela ainda
 * (caso ele tenha apagado ou seja seed novo, garantimos que esta no doc).
 *
 * Down: reverte pro texto velho (3 placeholders manuais).
 */
export class AddDatasOcorrenciaAdvertencia1785250000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Substitui qualquer variacao do trecho de datas manuais por placeholder
    //    Regex tolera espacos extras, underscores variados, sem-paren etc.
    await queryRunner.query(`
      UPDATE rh_docs_padronizados
         SET conteudo = regexp_replace(
              conteudo,
              '\\(Data da\\(s\\) ocorr[eê]ncia\\(s\\)[^)]*\\)',
              '(Data da(s) ocorrência(s): $DATAS_OCORRENCIA$)',
              'gi'
             )
       WHERE nome = 'Advertência'
         AND conteudo LIKE '%Data da(s) ocorr%'
         AND conteudo NOT LIKE '%$DATAS_OCORRENCIA$%'
    `);

    // 2) Se o template existe mas NAO tem a linha (cliente removeu OU seed antigo
    //    nao tinha) — injeta logo apos a linha $NOME$ que antecede o "Ciente em".
    await queryRunner.query(`
      UPDATE rh_docs_padronizados
         SET conteudo = replace(
              conteudo,
              E'$NOME$\n(Colaborador',
              E'$NOME$\n(Data da(s) ocorrência(s): $DATAS_OCORRENCIA$)\n(Colaborador'
             )
       WHERE nome = 'Advertência'
         AND conteudo NOT LIKE '%$DATAS_OCORRENCIA$%'
         AND conteudo LIKE '%$NOME$%(Colaborador%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE rh_docs_padronizados
         SET conteudo = replace(
              conteudo,
              '(Data da(s) ocorrência(s): $DATAS_OCORRENCIA$)',
              '(Data da(s) ocorrência(s) ____/____/______  ____/____/______ ____/____/______)'
             )
       WHERE nome = 'Advertência'
    `);
  }
}
