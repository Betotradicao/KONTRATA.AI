import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Aviso Prévio do Empregador" (RH, fase 3 — DOCS DEMISSIONAIS).
 *
 * Comunicado formal de rescisão pela empresa. No momento da geração o RH escolhe:
 *   - data de início do aviso  -> $DATA_AVISO$ (por extenso)
 *   - tipo: Indenizado | Trabalhado
 *   - se Trabalhado: redução de 2h/dia OU 7 dias no mês (art. 488 da CLT)
 * Essa frase dinâmica (modalidade + data de cessação das atividades) é montada
 * em docs-padronizados.controller.ts e injetada em $AVISO_PREVIO$.
 *
 * NÃO protegido: o cliente pode ajustar o texto na tela de Configurações RH.
 *
 * Variáveis usadas (resolvidas em docs-padronizados.controller.ts):
 *   $EMPRESA_NOME$ $EMPRESA_CNPJ$ $CIDADE$
 *   $NOME$ $CTPS$ $SERIE_CTPS$
 *   $DATA_AVISO$   (data do aviso, por extenso — escolhida ao gerar)
 *   $AVISO_PREVIO$ (frase indenizado/trabalhado + data de cessação — montada ao gerar)
 */
export class SeedDocAvisoPrevio1785800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudo = `AVISO PRÉVIO DO EMPREGADOR


$EMPRESA_NOME$
CNPJ $EMPRESA_CNPJ$


$CIDADE$, $DATA_AVISO$


Ao Sr(a)       : $NOME$
CTPS Nro/Série : $CTPS$/$SERIE_CTPS$


Pelo presente, comunicamos a V. Sa. que, não mais convindo a esta empresa manter seu contrato de trabalho, vimos por meio deste rescindi-lo, na forma da legislação pertinente.

$AVISO_PREVIO$

Ao término do prazo deste aviso, deverá V. Sa. apresentar-se ao Departamento de Pessoal, para recebimento das importâncias que lhe são devidas e cumprimento das demais formalidades exigidas para cessação do Contrato de Trabalho, apresentando a sua Carteira de Trabalho para as devidas anotações.

Solicitamos a devolução da cópia deste, com o seu ciente.


___________________________________________
$EMPRESA_NOME$


___________________________________________
$NOME$


___________________________________________
Assinatura do Responsável Legal
(quando menor)`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido, fase)
       SELECT 'Aviso Prévio do Empregador'::text,
              'Comunicado formal de rescisão pela empresa. No momento de gerar, escolhe-se data de início, tipo (indenizado/trabalhado) e, se trabalhado, a redução (2h/dia ou 7 dias no mês).'::text,
              'Aviso Prévio do Empregador'::text,
              $1::text,
              1,
              false,
              3
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Aviso Prévio do Empregador')`,
      [conteudo]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Aviso Prévio do Empregador'`
    );
  }
}
