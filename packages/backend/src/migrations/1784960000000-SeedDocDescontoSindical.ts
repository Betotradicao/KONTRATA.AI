import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Desconto Sindical" (RH).
 *
 * Modelo de Autorização de Desconto de Contribuição Sindical, nos termos
 * da CLT (Lei 13.467/2017). Documento PROTEGIDO (padrão do sistema, não
 * pode ser excluído), igual ao "Autorização de Uso de Imagem".
 *
 * Usa as variáveis $VARIAVEL$ substituídas pelos dados do colaborador na
 * geração (ver docs-padronizados.controller.ts):
 *   $NOME$ $CPF$ $CTPS$ $SERIE_CTPS$ $CARGO$ $ADMISSAO$
 *   $EMPRESA_NOME$ $EMPRESA_CNPJ$ $EMPRESA_ENDERECO$ $CIDADE$ $ESTADO$ $DATA_EXTENSO$
 *
 * Depende da tabela rh_docs_padronizados (migration 1784854000000).
 */
export class SeedDocDescontoSindical1784960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudoDescontoSindical = `Nome Empregado: $NOME$
CTPS: $CTPS$        Série: $SERIE_CTPS$
CPF: $CPF$
Função: $CARGO$
Admissão: $ADMISSAO$
Empresa: $EMPRESA_NOME$
CNPJ/CEI: $EMPRESA_CNPJ$
Endereço: $EMPRESA_ENDERECO$
Cidade: $CIDADE$        UF: $ESTADO$

Nos termos dos artigos 545, 578, 579 e 582 da CLT (Lei nº 13.467/2017), declaro a seguinte opção quanto ao desconto da Contribuição Sindical:

(   ) Autorizo            (   ) Não autorizo

esta empresa a proceder o desconto em folha de pagamento da Contribuição Sindical Anual, destinada ao sindicato que representa minha categoria econômica ou profissional.

$CIDADE$, $DATA_EXTENSO$.


_______________________________
$NOME$
Assinatura`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido)
       SELECT 'Desconto Sindical'::text,
              'Autoriza (ou não) o desconto da Contribuição Sindical Anual em folha de pagamento, nos termos da CLT.'::text,
              'Autorização de Desconto de Contribuição Sindical'::text,
              $1::text,
              2,
              true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Desconto Sindical')`,
      [conteudoDescontoSindical]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Desconto Sindical'`
    );
  }
}
