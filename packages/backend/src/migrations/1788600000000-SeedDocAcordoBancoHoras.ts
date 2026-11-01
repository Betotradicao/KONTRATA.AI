import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Acordo Individual de Banco de Horas" (RH, fase 2 —
 * DOCS 2ª FASE CONTRATAÇÃO). Texto-base enviado pelo Beto (modelo da Tradição,
 * 01/11/2026), com os dados fixos da Tradição trocados por variáveis — assim vale
 * pra qualquer cliente/loja: pega a empresa vinculada ao colaborador.
 *
 * NÃO protegido: o cliente pode ajustar o texto (ex.: jornada semanal) em
 * Configurações RH → Documentos Padronizados.
 *
 * Variáveis (resolvidas em docs-padronizados.controller.ts):
 *   $EMPRESA_RAZAO$ $EMPRESA_CNPJ$ $EMPRESA_ENDERECO$ $EMPRESA_BAIRRO$ $CIDADE$ $ESTADO$
 *   $NOME$ $CPF$ $CTPS$ $SERIE_CTPS$ $ADMISSAO$ $DATA_EXTENSO$
 */
export class SeedDocAcordoBancoHoras1788600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudo = `ACORDO INDIVIDUAL DE BANCO DE HORAS


Pelo presente instrumento, $EMPRESA_RAZAO$, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o número $EMPRESA_CNPJ$, estabelecida à $EMPRESA_ENDERECO$, Bairro $EMPRESA_BAIRRO$, município de $CIDADE$, estado de $ESTADO$, e $NOME$, portador(a) da CTPS nº $CTPS$, Série $SERIE_CTPS$, com contrato individual de trabalho firmado em $ADMISSAO$, nos termos do artigo 59 e parágrafos da CLT, acordam o seguinte:

Cláusula Primeira – Fica convencionado, conforme disposto no artigo 59, § 5º, da CLT, que o horário normal de trabalho na empresa é o seguinte: 44 (quarenta e quatro) horas semanais, com escala móvel.

Cláusula Segunda – A jornada diária normal de trabalho do(a) empregado(a) acordante poderá ser prorrogada até o limite máximo de 10 (dez) horas diárias, com o objetivo de compensação de horas não trabalhadas em outros dias, especialmente aos sábados.

Cláusula Terceira – O(A) empregado(a) aceita e se obriga a fazer sua prestação de serviço em horário noturno ou diurno, em qualquer turno, segundo as necessidades da empresa, observados os preceitos legais.

Cláusula Quarta – Fica, a partir desta data, dispensado o acréscimo de salário, formando-se um banco de horas para compensação, com a correspondente diminuição da carga horária em outros dias, respeitados os limites previstos em lei.

Cláusula Quinta – O excesso de horas em um dia será compensado pela correspondente diminuição em outro dia, de maneira que não exceda, no período máximo de 6 (seis) meses, a soma das jornadas semanais de trabalho previstas, nem seja ultrapassado o limite máximo de 10 (dez) horas diárias, observadas as disposições legais.

Parágrafo Primeiro – A empresa comunicará o(a) empregado(a) com 72 (setenta e duas) horas de antecedência sobre o dia da compensação.

Parágrafo Segundo – É assegurado a todo(a) empregado(a) livre acesso ao documento de controle de horas trabalhadas, podendo verificar todas as informações necessárias sobre o sistema de banco de horas ora implantado, bem como o saldo de horas existente a seu favor.

Cláusula Sexta – Não ocorrendo a compensação das horas na forma estabelecida nas Cláusulas Terceira e Quinta, as mesmas serão remuneradas como extras, com os acréscimos legais.

Cláusula Sétima – O presente acordo vigorará pelo período de 6 (seis) meses, renovando-se automaticamente por períodos subsequentes de 6 (seis) meses, não havendo manifestação das partes em contrário antes do seu término.

E, por estarem assim de comum acordo, as partes assinam o presente instrumento em duas vias de igual teor.


$CIDADE$ / $ESTADO$, $DATA_EXTENSO$.


___________________________________________
$EMPRESA_RAZAO$
CNPJ: $EMPRESA_CNPJ$


___________________________________________
$NOME$
CPF: $CPF$`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido, fase)
       SELECT 'Acordo Individual de Banco de Horas'::text,
              'Acordo de compensação de jornada (art. 59 da CLT): banco de horas de 6 meses, até 10h/dia, aviso de 72h. Preenche empresa e colaborador automaticamente.'::text,
              'Acordo Individual de Banco de Horas'::text,
              $1::text,
              5,
              false,
              2
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Acordo Individual de Banco de Horas')`,
      [conteudo]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM rh_docs_padronizados WHERE nome = 'Acordo Individual de Banco de Horas'`);
  }
}
