import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documentos padronizados da empresa (RH). Textos modelo que o cliente
 * pode usar e personalizar — Autorizacao de Imagem, Termo de Sigilo,
 * Acordo de Banco de Horas etc.
 *
 * O conteudo aceita variaveis no formato $VARIAVEL$ que sao substituidas
 * automaticamente pelos dados do colaborador no momento da geracao:
 *   $NOME$            -> nome completo do colaborador
 *   $CPF$             -> CPF formatado
 *   $RG$              -> RG
 *   $CARGO$           -> nome do cargo
 *   $DATA_HOJE$       -> data atual (dd/mm/yyyy)
 *   $DATA_EXTENSO$    -> "24 de julho de 2025"
 *   $EMPRESA_NOME$    -> nome_fantasia da empresa
 *   $EMPRESA_CNPJ$    -> CNPJ da empresa
 *   $CIDADE$          -> cidade da empresa
 *
 * Seed: cria template "Autorizacao de Uso de Imagem" pra todos clientes.
 */
export class CreateDocsPadronizados1784854000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_docs_padronizados (
        id           SERIAL PRIMARY KEY,
        nome         TEXT NOT NULL,
        descricao    TEXT,
        titulo       TEXT NOT NULL,
        conteudo     TEXT NOT NULL,
        ativo        BOOLEAN NOT NULL DEFAULT true,
        protegido    BOOLEAN NOT NULL DEFAULT false,
        ordem        INT NOT NULL DEFAULT 0,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const conteudoAutorizacaoImagem = `Eu, $NOME$, CPF nº $CPF$, abaixo assinado e identificado, autorizo o uso de imagem, som, voz, nome e dados biográficos, pelo $EMPRESA_NOME$.

A presente autorização abrange os usos acima indicados e a edição da imagem para veiculação tanto em Mídia Impressa (livros, catálogos, revista, jornal, entre outros) como também em Mídia Eletrônica (programas de rádio, podcasts, hangouts, canais no Youtube e outros do mesmo tipo, streaming, vídeos e filmes para televisão aberta e/ou fechada e/ou na internet, documentários para cinema ou televisão, entre REDES SOCIAIS E outros), Internet, Banco de Dados informatizado Multimídia, "home video", DVD ("digital video disc"), suportes de computação gráfica em geral e/ou divulgação de pesquisas e relatórios para arquivamento e formação de acervo histórico, sem qualquer ônus que o $EMPRESA_NOME$ ou terceiros, por essa expressamente autorizados, que poderão utilizá-los em todo e qualquer projeto e/ou obra de natureza sociocultural em todo território nacional e no exterior.

Por esta ser a expressão da minha vontade declaro que autorizo o uso acima descrito sem que nada haja a ser reclamado a título de direitos conexos a minha imagem, ou a qualquer outro, e assino a presente autorização.

$CIDADE$, $DATA_EXTENSO$.


_______________________________
$NOME$
Assinatura`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido)
       SELECT 'Autorização de Uso de Imagem'::text,
              'Autoriza o uso de imagem, som, voz e dados biográficos do colaborador para fins de comunicação da empresa.'::text,
              'Autorização de Uso de Imagem, de Som, de Voz, de Nome e Dados Biográficos'::text,
              $1::text,
              1,
              true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Autorização de Uso de Imagem')`,
      [conteudoAutorizacaoImagem]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_docs_padronizados`);
  }
}
