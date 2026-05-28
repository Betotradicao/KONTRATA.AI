import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Advertência" (RH, fase 4 — DOCS ADVERTÊNCIA).
 *
 * Termo formal de advertência por escrito ao colaborador, com motivo selecionado
 * pelo RH no momento da geração (variável $MOTIVO_ADVERTENCIA$, resolvida a
 * partir de rh_motivos_advertencia).
 *
 * Documento PROTEGIDO (padrão do sistema, não pode ser excluído).
 *
 * Variáveis usadas (resolvidas em docs-padronizados.controller.ts):
 *   $NOME$ $MATRICULA$ $CARGO$ $ADMISSAO$
 *   $EMPRESA_NOME$ $EMPRESA_CNPJ$
 *   $CIDADE$ $ESTADO$ $DATA_EXTENSO$
 *   $MOTIVO_ADVERTENCIA$  (preenchida via picker no modal Gerar)
 */
export class SeedDocAdvertencia1785070000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudo = `ADVERTÊNCIA POR ESCRITO


Empresa: $EMPRESA_NOME$
CNPJ: $EMPRESA_CNPJ$


Colaborador(a): $NOME$
Matrícula: $MATRICULA$        Cargo/Função: $CARGO$
Data de admissão: $ADMISSAO$


Prezado(a) Colaborador(a),

Vimos, por meio desta, notificá-lo(a) formalmente de que sua conduta caracteriza falta passível de medida disciplinar, conforme abaixo descrito:

MOTIVO: $MOTIVO_ADVERTENCIA$.

Em razão do exposto, aplicamos a presente ADVERTÊNCIA POR ESCRITO, com fundamento no poder diretivo do empregador (art. 2º da CLT) e no Regulamento Interno da empresa.

Esclarecemos que a reiteração de condutas dessa natureza poderá ensejar a aplicação de medidas disciplinares mais severas, inclusive a rescisão do contrato de trabalho por justa causa, nos termos do art. 482 da Consolidação das Leis do Trabalho (CLT).

Solicitamos que reflita sobre o ocorrido e que adote, a partir desta data, as providências necessárias para o pleno cumprimento de suas obrigações funcionais e das normas internas da empresa.

A assinatura abaixo apenas comprova o recebimento desta advertência e a ciência de seu conteúdo, não implicando concordância com os fatos nela narrados.


$CIDADE$ / $ESTADO$, $DATA_EXTENSO$.


___________________________________________
$EMPRESA_NOME$
(Responsável pelo Recursos Humanos)


___________________________________________
$NOME$
(Colaborador — Ciente em ____/____/______)


Testemunhas:

1) Nome: _______________________________________
   CPF:  _______________________________________
   Assinatura: __________________________________


2) Nome: _______________________________________
   CPF:  _______________________________________
   Assinatura: __________________________________`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido, fase)
       SELECT 'Advertência'::text,
              'Termo formal de advertência por escrito, com motivo/embasamento escolhido pelo RH no momento da geração.'::text,
              'Advertência por Escrito'::text,
              $1::text,
              1,
              true,
              4
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Advertência')`,
      [conteudo]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Advertência'`
    );
  }
}
