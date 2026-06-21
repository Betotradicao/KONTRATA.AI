import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contrato de Trabalho montado cláusula a cláusula POR FUNÇÃO (cargo).
 *
 * - rh_contrato_clausulas: cláusulas vinculadas a um cargo (cargo_id). Cada cargo
 *   tem seu próprio conjunto ordenado. As 14 cláusulas padrão ficam numa
 *   biblioteca no controller (constante) que o RH "Acrescenta" ao cargo.
 * - Seed: documento "Contrato de Trabalho" em rh_docs_padronizados (fase 2,
 *   primeiro da lista). Corpo fixo com $VARIÁVEIS$ + $CLAUSULAS$ (substituído
 *   pelas cláusulas do cargo do colaborador no momento de gerar) + assinaturas.
 */
export class CreateContratoClausulas1785700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_contrato_clausulas (
        id SERIAL PRIMARY KEY,
        cargo_id INT NOT NULL,
        titulo VARCHAR(255) NOT NULL DEFAULT '',
        conteudo TEXT NOT NULL,
        ordem INT NOT NULL DEFAULT 0,
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_contrato_clausulas_cargo ON rh_contrato_clausulas(cargo_id, ordem)`);

    const corpo = `CONTRATO DE TRABALHO A TÍTULO DE EXPERIÊNCIA

Entre a empresa $EMPRESA_NOME$, com sede em $CIDADE$, à $EMPRESA_ENDERECO$, CEP $EMPRESA_CEP$, doravante designada simplesmente EMPREGADORA, e $NOME$, portador(a) da Carteira Profissional de Trabalho Nº $CTPS$ série $SERIE_CTPS$, denominado(a) EMPREGADO(A), é celebrado o presente CONTRATO DE EXPERIÊNCIA, com vigência a partir da data de início da prestação de serviços, de acordo com as condições a seguir especificadas:

Fica o(a) EMPREGADO(A) admitido(a) no quadro de funcionários da EMPREGADORA para exercer a função de: $CARGO$, mediante a remuneração acordada entre as partes no valor de R$ $SALARIO$.

$CLAUSULAS$

E por estarem de pleno acordo, as partes contratantes assinam o presente Contrato de Experiência em duas vias, ficando a primeira em poder da EMPREGADORA e a segunda com o(a) EMPREGADO(A), que dela dará o competente recibo.

$CIDADE$, $DATA_EXTENSO$.


_______________________________          _______________________________
   Assinatura do(a) EMPREGADO(A)              Assinatura da EMPREGADORA


_______________________________
Assinatura do responsável quando o(a) EMPREGADO(A) for menor de idade.`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ordem, fase, protegido)
       SELECT 'Contrato de Trabalho'::text,
              'Contrato de experiência montado por função: corpo fixo + cláusulas configuradas por cargo. Ao gerar, escolha o colaborador e a data de início.'::text,
              'Contrato de Trabalho a Título de Experiência'::text,
              $1::text,
              0, 2, true
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = 'Contrato de Trabalho')`,
      [corpo]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_contrato_clausulas`);
    await queryRunner.query(`DELETE FROM rh_docs_padronizados WHERE nome = 'Contrato de Trabalho'`);
  }
}
