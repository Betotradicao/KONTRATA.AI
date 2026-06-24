import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento "Carta de Próprio Punho" (RH, fase 3 — DOCS DEMISSIONAIS).
 *
 * Pedido de demissão do COLABORADOR, escrito de próprio punho. Diferente dos
 * outros docs, NÃO tem nada automatizado: é só o logo da empresa (injetado pelo
 * motor de geração) + os espaços em branco pro colaborador preencher à mão.
 * Por isso o conteúdo NÃO usa variáveis ($NOME$ etc.) — são linhas pra escrever.
 *
 * NÃO protegido: o cliente pode ajustar o texto na tela de Configurações RH.
 */
export class SeedDocCartaProprioPunho1785810000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudo = `(DEVE SER ESCRITA DE PRÓPRIO PUNHO)




____________________________________, ______ de __________________ de __________.




AO
________________________________________________________




Prezados,

Por motivos pessoais, eu ________________________________________________________, CTPS nº ____________ / ________ – ______, venho por meio desta apresentar meu pedido de demissão do cargo que ocupo nesta empresa desde ______/______/__________. Informo que estarei cumprindo o aviso prévio, a partir de ______/______/__________.

Sem mais.




________________________________________________________
(assinatura do empregado)`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido, fase)
       SELECT 'Carta de Próprio Punho'::text,
              'Pedido de demissão do colaborador, escrito de próprio punho. Sem preenchimento automático — apenas o logo da empresa e os espaços em branco pra preencher à mão.'::text,
              'Carta de Próprio Punho'::text,
              $1::text,
              2,
              false,
              3
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Carta de Próprio Punho')`,
      [conteudo]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Carta de Próprio Punho'`
    );
  }
}
