import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Atualiza o doc "Carta de Próprio Punho" (fase 3) para o formato de 2 FOLHAS:
 *   - Folha 1: versão EM BRANCO (espaços) — pro colaborador escrever de próprio punho.
 *   - Folha 2: ESPELHO PREENCHIDO com os dados do colaborador (data escolhida, cidade,
 *     empresa, nome, CTPS, cargo, admissão) — só pra servir de base/modelo. Cabeçalho
 *     em destaque amarelo "MODELO DE PREENCHIMENTO — APENAS PARA MODELAGEM".
 *
 * Quebra de página via token $QUEBRA_PAGINA$ (tratado no front em buildConteudoHtml).
 * Folha 2 usa: $CIDADE$ $DATA_AVISO$ $EMPRESA_NOME$ $NOME$ $CTPS$ $SERIE_CTPS$
 *              $CARGO$ $ADMISSAO$ $DATA_AVISO_BR$ (data escolhida no modal Gerar).
 */
export class CartaProprioPunhoEspelho1785820000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hl = 'display:block;text-align:center;background:#ffff00;color:#000;font-weight:bold;padding:6px 8px;border:1px solid #e0c000';
    const conteudo = `(DEVE SER ESCRITA DE PRÓPRIO PUNHO)




____________________________________, ______ de __________________ de __________.




AO
________________________________________________________




Prezados,

Por motivos pessoais, eu ________________________________________________________, CTPS nº ____________ / ________ – ______, venho por meio desta apresentar meu pedido de demissão do cargo que ocupo nesta empresa desde ______/______/__________. Informo que estarei cumprindo o aviso prévio, a partir de ______/______/__________.

Sem mais.




________________________________________________________
(assinatura do empregado)

$QUEBRA_PAGINA$

<span style="${hl}">MODELO DE PREENCHIMENTO — APENAS PARA MODELAGEM</span>




$CIDADE$, $DATA_AVISO$.




AO
$EMPRESA_NOME$




Prezados,

Por motivos pessoais, eu $NOME$, CTPS nº $CTPS$ / $SERIE_CTPS$, venho por meio desta apresentar meu pedido de demissão do cargo de $CARGO$ que ocupo nesta empresa desde $ADMISSAO$. Informo que estarei cumprindo o aviso prévio, a partir de $DATA_AVISO_BR$.

Sem mais.




________________________________________________________
$NOME$
(assinatura do empregado)`;

    await queryRunner.query(
      `UPDATE rh_docs_padronizados SET conteudo = $1 WHERE nome = 'Carta de Próprio Punho'`,
      [conteudo]
    );
  }

  public async down(): Promise<void> {
    // sem rollback do texto (a migration de seed original cuida da versão base)
  }
}
