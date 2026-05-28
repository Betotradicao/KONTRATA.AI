import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Termo de Recebimento do Regulamento Interno" (RH).
 *
 * Termo em que o colaborador acusa recebimento do Regulamento Interno da
 * empresa e se compromete a cumpri-lo. Documento PROTEGIDO (padrão do
 * sistema, não pode ser excluído).
 *
 * Variáveis usadas (resolvidas em docs-padronizados.controller.ts):
 *   $NOME$ $CPF$ $CTPS$ $ADMISSAO$
 *   $EMPRESA_NOME$ $EMPRESA_CNPJ$ $EMPRESA_ENDERECO$ $EMPRESA_BAIRRO$
 *   $EMPRESA_CEP$ $CIDADE$ $ESTADO$ $DATA_EXTENSO$
 *
 * Depende da tabela rh_docs_padronizados (migration 1784854000000).
 */
export class SeedDocRegulamentoInterno1784970000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudoRegulamentoInterno = `DA EMPRESA: $EMPRESA_NOME$ - CNPJ $EMPRESA_CNPJ$
ENDEREÇO: $EMPRESA_ENDERECO$
BAIRRO: $EMPRESA_BAIRRO$ - CEP: $EMPRESA_CEP$ - $CIDADE$/$ESTADO$

NOME DO EMPREGADO: $NOME$
CPF: $CPF$
NÚMERO DA CARTEIRA DE TRABALHO: $CTPS$
ADMISSÃO EM: $ADMISSAO$

Acuso recebimento do "Regulamento Interno" que está na revisão 01. Vou ler e cumprir todas as normas e regulamentos aqui contidos e todos os demais da empresa.

Estou ciente que é necessário trabalhar com segurança, cumprindo e obedecendo às suas normas, regulamentos e padrões.

Se eu não cumprir com as normas, regulamentos e padrões da empresa posso ser penalizado, inclusive com demissão.

$CIDADE$, $DATA_EXTENSO$.


_______________________________
$NOME$
(assinatura do empregado)`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido)
       SELECT 'Regulamento Interno'::text,
              'Termo em que o colaborador acusa recebimento do Regulamento Interno da empresa e se compromete a cumpri-lo.'::text,
              'Termo de Recebimento do Regulamento Interno'::text,
              $1::text,
              3,
              true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Regulamento Interno')`,
      [conteudoRegulamentoInterno]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Regulamento Interno'`
    );
  }
}
