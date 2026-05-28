import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Autorização de Compras via Senha" (RH).
 *
 * Termo em que o colaborador declara ciência e aceita as condições de
 * compras via senha no convênio com a empresa (prazos, multa, sigilo
 * da senha). Documento PROTEGIDO (padrão do sistema, não pode ser
 * excluído).
 *
 * Variáveis usadas (resolvidas em docs-padronizados.controller.ts):
 *   $NOME$ $CPF$
 *   $EMPRESA_NOME$ $EMPRESA_ENDERECO$ $EMPRESA_BAIRRO$ $EMPRESA_CEP$
 *   $CIDADE$ $ESTADO$ $DATA_EXTENSO$
 *
 * Depende da tabela rh_docs_padronizados (migration 1784854000000).
 */
export class SeedDocAutorizacaoComprasSenha1784980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudoComprasSenha = `$EMPRESA_NOME$
LOJA: $EMPRESA_ENDERECO$
BAIRRO: $EMPRESA_BAIRRO$
CEP: $EMPRESA_CEP$ - $CIDADE$/$ESTADO$


Termo de Ciência e Aceitação


Nome: $NOME$
CPF: $CPF$


DECLARO ESTAR RECEBENDO O TERMO DE COMPRAS, QUE ESTOU CIENTE DO PRAZO, QUE AO EFETUAR A COMPRA CONFIRMO MINHA TITULARIDADE MEDIANTE SENHA, A QUAL É CADASTRADA NA ABERTURA DO BENEFÍCIO. ESTOU CIENTE DE QUE A SENHA É SIGILOSA E DE USO PRÓPRIO E PESSOAL.

Estou ciente que o PAGAMENTO deverá ser feito até o dia 10 (DEZ) de todo mês e que, em caso de ATRASO, SERÁ ACRESCIDO o valor de 15% de multa sobre o valor total. Após 20 dias de atraso, o valor será descontado em holerite e o colaborador terá o convênio suspenso por tempo indeterminado.

Obs: O Convênio deverá ser pago somente em:
- Cartão de débito
- Pix

A % de multa poderá ser alterada pela empresa a qualquer momento, conforme necessidade, e o colaborador deverá ser comunicado com antecedência.

Em caso do colaborador desejar mudar de senha, o termo abaixo deverá ser preenchido.


$CIDADE$, $DATA_EXTENSO$.


Assinatura X _______________________________
$NOME$`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido)
       SELECT 'Autorização de Compras via Senha'::text,
              'Termo em que o colaborador declara ciência e aceita as condições de compras via senha no convênio com a empresa (prazos, multa, sigilo da senha).'::text,
              'Termo de Autorização de Compras via Senha'::text,
              $1::text,
              4,
              true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Autorização de Compras via Senha')`,
      [conteudoComprasSenha]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Autorização de Compras via Senha'`
    );
  }
}
