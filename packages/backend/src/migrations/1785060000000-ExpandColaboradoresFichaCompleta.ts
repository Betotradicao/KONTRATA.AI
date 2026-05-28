import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alinha rh_colaboradores com TODOS os campos coletados na Ficha de Admissão
 * pelo candidato. Quando o RH clica em "Cadastrar Colaborador", tudo é
 * copiado pra cá — e o modal "Editar Colaborador" precisa permitir editar.
 *
 * Adiciona em rh_colaboradores:
 *   - RG completo: rg_orgao_emissor, rg_uf, rg_emissao
 *   - Naturalidade UF
 *   - Características: raca_cor, tipo_sanguineo, altura, peso, cor_cabelos,
 *     cor_olhos, deficiente
 *   - CTPS: ctps_uf, ctps_emissao
 *   - Título de Eleitor: titulo_zona, titulo_secao, titulo_emissao
 *   - Reservista: reservista, reservista_uf, reservista_emissao
 *   - CNH: cnh, cnh_categoria, cnh_uf, cnh_validade
 *   - Cônjuge: conjuge_nome, conjuge_cpf, conjuge_data_nascimento,
 *     conjuge_data_casamento
 *   - Estrangeiro: pais_nacionalidade, condicao_ingresso_brasil,
 *     data_chegada_brasil, filhos_brasileiros, filhos_brasileiros_qtd,
 *     casado_brasileiro, portaria_naturalizacao, data_naturalizacao
 *
 * Cria rh_colaborador_dependentes (1-N): dependentes do colaborador
 * com certidão de nascimento detalhada + flags IR e Salário-Família.
 */
export class ExpandColaboradoresFichaCompleta1785060000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
        ADD COLUMN IF NOT EXISTS rg_orgao_emissor      VARCHAR(20)  NULL,
        ADD COLUMN IF NOT EXISTS rg_uf                 VARCHAR(2)   NULL,
        ADD COLUMN IF NOT EXISTS rg_emissao            DATE         NULL,

        ADD COLUMN IF NOT EXISTS naturalidade_uf       VARCHAR(2)   NULL,

        ADD COLUMN IF NOT EXISTS raca_cor              VARCHAR(30)  NULL,
        ADD COLUMN IF NOT EXISTS tipo_sanguineo        VARCHAR(5)   NULL,
        ADD COLUMN IF NOT EXISTS altura                VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS peso                  VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS cor_cabelos           VARCHAR(30)  NULL,
        ADD COLUMN IF NOT EXISTS cor_olhos             VARCHAR(30)  NULL,
        ADD COLUMN IF NOT EXISTS deficiente            VARCHAR(30)  NULL,

        ADD COLUMN IF NOT EXISTS ctps_uf               VARCHAR(2)   NULL,
        ADD COLUMN IF NOT EXISTS ctps_emissao          DATE         NULL,

        ADD COLUMN IF NOT EXISTS titulo_zona           VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS titulo_secao          VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS titulo_emissao        DATE         NULL,

        ADD COLUMN IF NOT EXISTS reservista            VARCHAR(50)  NULL,
        ADD COLUMN IF NOT EXISTS reservista_uf         VARCHAR(2)   NULL,
        ADD COLUMN IF NOT EXISTS reservista_emissao    DATE         NULL,

        ADD COLUMN IF NOT EXISTS cnh                   VARCHAR(20)  NULL,
        ADD COLUMN IF NOT EXISTS cnh_categoria         VARCHAR(5)   NULL,
        ADD COLUMN IF NOT EXISTS cnh_uf                VARCHAR(2)   NULL,
        ADD COLUMN IF NOT EXISTS cnh_validade          DATE         NULL,

        ADD COLUMN IF NOT EXISTS conjuge_nome              VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS conjuge_cpf               VARCHAR(14)  NULL,
        ADD COLUMN IF NOT EXISTS conjuge_data_nascimento   DATE         NULL,
        ADD COLUMN IF NOT EXISTS conjuge_data_casamento    DATE         NULL,

        ADD COLUMN IF NOT EXISTS pais_nacionalidade        VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS condicao_ingresso_brasil  VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS data_chegada_brasil       DATE         NULL,
        ADD COLUMN IF NOT EXISTS filhos_brasileiros        BOOLEAN      NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS filhos_brasileiros_qtd    VARCHAR(10)  NULL,
        ADD COLUMN IF NOT EXISTS casado_brasileiro         BOOLEAN      NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS portaria_naturalizacao    VARCHAR(150) NULL,
        ADD COLUMN IF NOT EXISTS data_naturalizacao        DATE         NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_colaborador_dependentes (
        id                 SERIAL PRIMARY KEY,
        colaborador_id     INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        nome               VARCHAR(255) NOT NULL,
        parentesco         VARCHAR(30)  NULL,
        sexo               VARCHAR(2)   NULL,
        cpf                VARCHAR(14)  NULL,
        data_nascimento    DATE         NULL,
        certidao_numero    VARCHAR(100) NULL,
        certidao_data      DATE         NULL,
        certidao_cartorio  VARCHAR(255) NULL,
        certidao_folha     VARCHAR(50)  NULL,
        dependente_ir      BOOLEAN      NOT NULL DEFAULT FALSE,
        dependente_sf      BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_dep_colab ON rh_colaborador_dependentes(colaborador_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_colaborador_dependentes`);
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
        DROP COLUMN IF EXISTS rg_orgao_emissor,
        DROP COLUMN IF EXISTS rg_uf,
        DROP COLUMN IF EXISTS rg_emissao,
        DROP COLUMN IF EXISTS naturalidade_uf,
        DROP COLUMN IF EXISTS raca_cor,
        DROP COLUMN IF EXISTS tipo_sanguineo,
        DROP COLUMN IF EXISTS altura,
        DROP COLUMN IF EXISTS peso,
        DROP COLUMN IF EXISTS cor_cabelos,
        DROP COLUMN IF EXISTS cor_olhos,
        DROP COLUMN IF EXISTS deficiente,
        DROP COLUMN IF EXISTS ctps_uf,
        DROP COLUMN IF EXISTS ctps_emissao,
        DROP COLUMN IF EXISTS titulo_zona,
        DROP COLUMN IF EXISTS titulo_secao,
        DROP COLUMN IF EXISTS titulo_emissao,
        DROP COLUMN IF EXISTS reservista,
        DROP COLUMN IF EXISTS reservista_uf,
        DROP COLUMN IF EXISTS reservista_emissao,
        DROP COLUMN IF EXISTS cnh,
        DROP COLUMN IF EXISTS cnh_categoria,
        DROP COLUMN IF EXISTS cnh_uf,
        DROP COLUMN IF EXISTS cnh_validade,
        DROP COLUMN IF EXISTS conjuge_nome,
        DROP COLUMN IF EXISTS conjuge_cpf,
        DROP COLUMN IF EXISTS conjuge_data_nascimento,
        DROP COLUMN IF EXISTS conjuge_data_casamento,
        DROP COLUMN IF EXISTS pais_nacionalidade,
        DROP COLUMN IF EXISTS condicao_ingresso_brasil,
        DROP COLUMN IF EXISTS data_chegada_brasil,
        DROP COLUMN IF EXISTS filhos_brasileiros,
        DROP COLUMN IF EXISTS filhos_brasileiros_qtd,
        DROP COLUMN IF EXISTS casado_brasileiro,
        DROP COLUMN IF EXISTS portaria_naturalizacao,
        DROP COLUMN IF EXISTS data_naturalizacao
    `);
  }
}
