import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do documento padronizado "Opção de Vale-Transporte" (RH).
 *
 * Termo em que o colaborador opta (ou não) pelo recebimento do Vale-Transporte,
 * nos termos do Decreto nº 95.247/87. Documento PROTEGIDO (padrão do sistema,
 * não pode ser excluído). Inclui identificação, opção opto/não opto, cláusulas
 * a-e, residência atual do colaborador e bloco único de assinatura.
 *
 * Variáveis usadas (resolvidas em docs-padronizados.controller.ts):
 *   $NOME$ $MATRICULA$ $CTPS$ $SERIE_CTPS$ $CARGO$ $ADMISSAO$
 *   $ENDERECO$ $COLAB_BAIRRO$ $COLAB_CIDADE$ $COLAB_ESTADO$ $COLAB_CEP$
 *   $EMPRESA_NOME$ $EMPRESA_CNPJ$ $EMPRESA_ENDERECO$ $CIDADE$ $ESTADO$
 *   $DATA_EXTENSO$
 *
 * Depende da tabela rh_docs_padronizados (migration 1784854000000).
 */
export class SeedDocOpcaoValeTransporte1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const conteudoValeTransporte = `Nome: $NOME$
Num Reg: $MATRICULA$        CTPS: $CTPS$ / $SERIE_CTPS$
Função: $CARGO$
Admissão: $ADMISSAO$


(  ) Opto pela utilização do Vale-Transporte
(  ) Não opto pela utilização do Vale-Transporte


Empresa: $EMPRESA_NOME$
CNPJ: $EMPRESA_CNPJ$
Endereço: $EMPRESA_ENDERECO$
Cidade: $CIDADE$        UF: $ESTADO$


Nos termos do artigo 7º do Decreto nº 95.247 de 17 de Novembro de 1987, solicito receber o Vale-Transporte e comprometo-me:

a) a utilizá-lo exclusivamente para meu efetivo deslocamento residência-trabalho e vice-versa;

b) a renovar anualmente ou sempre que ocorrer alteração no meu endereço residencial ou dos serviços e meios de transporte mais adequados ao meu deslocamento residência/trabalho e vice-versa;

c) autorizo o desconto de 6% (seis por cento) do meu salário básico mensal para concorrer ao custeio do Vale-Transporte (conforme o artigo 9º do Decreto nº 95.247/87);

d) declaro estar ciente de que a declaração falsa ou o uso indevido do Vale-Transporte constituem falta grave (conforme o parágrafo 3º do artigo 7º do Decreto nº 95.247/87);

e) declaro que necessito das seguintes quantidades diárias de vale-transporte: _____ de 2ª a 6ª feira, _____ aos sábados e _____ aos domingos.


Minha residência atual:
Endereço: $ENDERECO$        Bairro: $COLAB_BAIRRO$
Cidade: $COLAB_CIDADE$        UF: $COLAB_ESTADO$        CEP: $COLAB_CEP$


$CIDADE$, $DATA_EXTENSO$.


_______________________________            _______________________________
Nome                                       Assinatura

R.G. e Órgão Emissor: _______________________________`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, protegido)
       SELECT 'Opção de Vale-Transporte'::text,
              'Termo em que o colaborador opta (ou não) pelo recebimento do Vale-Transporte, nos termos do Decreto nº 95.247/87.'::text,
              'Termo de Opção de Vale-Transporte'::text,
              $1::text,
              6,
              true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Opção de Vale-Transporte')`,
      [conteudoValeTransporte]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rh_docs_padronizados WHERE nome = 'Opção de Vale-Transporte'`
    );
  }
}
