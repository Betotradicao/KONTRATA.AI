import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Entrega de EPIs e Uniformes" (RH).
 *
 * Recibo de entrega, devolução ou troca de uniformes e EPIs. A lista de
 * EPIs é PRÉ-PREENCHIDA com base no cargo do colaborador (campo
 * rh_cargos.epis_epcs_obrigatorios_ids -> catálogo rh_epis_epcs).
 *
 * Documento PROTEGIDO (padrão do sistema, não pode ser excluído).
 *
 * Variáveis usadas (resolvidas em docs-padronizados.controller.ts):
 *   $NOME$ $CPF$ $CARGO$ $MATRICULA$ $ADMISSAO$ $EPIS_TABELA$
 *   $EMPRESA_NOME$ $EMPRESA_CNPJ$ $EMPRESA_ENDERECO$ $EMPRESA_BAIRRO$
 *   $EMPRESA_CEP$ $CIDADE$ $ESTADO$ $DATA_EXTENSO$
 *
 * Depende da tabela rh_docs_padronizados (migration 1784854000000) e do
 * catálogo rh_epis_epcs (migration 1784713000000).
 */
export class SeedDocEntregaEpis1784990000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudoEntregaEpis = `$EMPRESA_NOME$ - CNPJ $EMPRESA_CNPJ$
$EMPRESA_ENDERECO$ - $EMPRESA_BAIRRO$ - CEP $EMPRESA_CEP$ - $CIDADE$/$ESTADO$


IDENTIFICAÇÃO DO FUNCIONÁRIO

Nome: $NOME$
Cargo: $CARGO$
Registro: $MATRICULA$
Data de admissão: $ADMISSAO$


DECLARAÇÃO

Declaro que:

a) Recebi nas datas especificadas abaixo, da empresa $EMPRESA_NOME$, CNPJ nº $EMPRESA_CNPJ$, os EPIs e uniformes adequados discriminados abaixo, aos quais desde já me comprometo a sempre usar na execução de minhas tarefas, zelando pela perfeita guarda e conservação, uso e funcionamento, de acordo com as orientações e treinamentos, assumindo também o compromisso de devolvê-los quando solicitado ou por ocasião da rescisão do meu Contrato de Trabalho.

b) Estou ciente e de pleno acordo que o não cumprimento das condições estabelecidas na letra "a" supra acarretará a aplicação de penas disciplinares.

c) No caso de perda, dano, extravio ou avaria, por negligência minha, dos equipamentos e/ou materiais referidos na letra "a", o respectivo valor será debitado de meu salário, o que desde já autorizo.

d) Comunicarei ao empregador qualquer alteração que os torne impróprios para o uso.


EPIs E UNIFORMES OBRIGATÓRIOS DO CARGO ($CARGO$):
$EPIS_TABELA$


$CIDADE$, $DATA_EXTENSO$.


_______________________________
$NOME$
Assinatura do empregado`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido)
       SELECT 'Entrega de EPIs e Uniformes'::text,
              'Recibo de entrega, devolução ou troca de uniformes e EPIs. A lista de EPIs é pré-preenchida automaticamente conforme o cargo do colaborador.'::text,
              'Recibo de Entrega, Devolução ou Troca de Uniformes e EPIs'::text,
              $1::text,
              5,
              true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Entrega de EPIs e Uniformes')`,
      [conteudoEntregaEpis]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Entrega de EPIs e Uniformes'`
    );
  }
}
