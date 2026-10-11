import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Portal do Colaborador — MVP holerite digital com ciência (11/10/2026).
 *
 * - rh_colaborador_acessos: login do colaborador no portal (CPF + senha). 1:1 com
 *   rh_colaboradores. A 1ª senha nasce por link de primeiro acesso (setup_token),
 *   igual ao /cadastro/:token dos usuários do painel.
 * - rh_documento_aceites: 1 registro por documento publicado pro colaborador
 *   (hoje só HOLERITE). Guarda hash SHA-256 do PDF + quem/quando/IP/user-agent da
 *   ciência — é a trilha que dá validade ao recibo digital (CLT 464 § único,
 *   MP 2.200-2 art. 10 §2º). Ver obsidian-vault/modulos/portal-colaborador.md.
 * - rh_documento_aceite_eventos: trilha de auditoria (publicado, whats enviado/
 *   falhou, visualizado, aceito, reenviado).
 * - Seed do Doc Padronizado "Termo de Adesão ao Meio Eletrônico" (fase 1) +
 *   subpasta em DOCS CONTRATAÇÃO: pré-requisito jurídico pro aceite digital valer.
 */
export class CreatePortalColaborador1787600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_colaborador_acessos (
        id              SERIAL PRIMARY KEY,
        colaborador_id  INT NOT NULL UNIQUE REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        senha_hash      TEXT,
        setup_token     VARCHAR(64) UNIQUE,
        setup_expira_em TIMESTAMPTZ,
        setup_usado_em  TIMESTAMPTZ,
        ultimo_login    TIMESTAMPTZ,
        tentativas      INT NOT NULL DEFAULT 0,
        bloqueado_ate   TIMESTAMPTZ,
        ativo           BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_aceites (
        id                 SERIAL PRIMARY KEY,
        documento_id       INT REFERENCES rh_documentos(id) ON DELETE SET NULL,
        colaborador_id     INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        tipo               VARCHAR(30) NOT NULL DEFAULT 'HOLERITE',
        competencia        VARCHAR(7),
        hash_sha256        VARCHAR(64) NOT NULL,
        status             VARCHAR(20) NOT NULL DEFAULT 'pendente',
        enviado_em         TIMESTAMPTZ,
        enviado_para       VARCHAR(30),
        visualizado_em     TIMESTAMPTZ,
        aceito_em          TIMESTAMPTZ,
        aceite_ip          VARCHAR(45),
        aceite_user_agent  TEXT,
        aceite_metodo      VARCHAR(30),
        publicado_por      VARCHAR(255),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_doc_aceites_colab ON rh_documento_aceites(colaborador_id, tipo, competencia)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_doc_aceites_status ON rh_documento_aceites(status)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_aceite_eventos (
        id          SERIAL PRIMARY KEY,
        aceite_id   INT NOT NULL REFERENCES rh_documento_aceites(id) ON DELETE CASCADE,
        evento      VARCHAR(30) NOT NULL,
        ip          VARCHAR(45),
        user_agent  TEXT,
        detalhe     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_doc_aceite_eventos_aceite ON rh_documento_aceite_eventos(aceite_id)`);

    // Subpasta do termo dentro de DOCS CONTRATAÇÃO (template → replicado pra cada colaborador novo)
    const [pastaContratacao] = await queryRunner.query(
      `SELECT id FROM rh_documento_pastas_template WHERE nome = 'DOCS CONTRATAÇÃO' LIMIT 1`
    );
    if (pastaContratacao) {
      await queryRunner.query(
        `INSERT INTO rh_documento_subpastas_template (pasta_template_id, nome, ordem, obrigatoria)
         VALUES ($1, 'TERMO MEIO ELETRÔNICO', 11, true)
         ON CONFLICT (pasta_template_id, nome) DO NOTHING`,
        [pastaContratacao.id]
      );
    }

    const conteudo = `TERMO DE ADESÃO AO MEIO ELETRÔNICO


Empresa: $EMPRESA_NOME$
CNPJ: $EMPRESA_CNPJ$


Colaborador(a): $NOME$
CPF: $CPF$        Matrícula: $MATRICULA$
Cargo/Função: $CARGO$        Data de admissão: $ADMISSAO$


Pelo presente instrumento, o(a) COLABORADOR(A) acima identificado(a) declara que:

1. CONCORDA em receber, consultar e dar ciência, por meio eletrônico, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020, dos documentos relacionados ao seu contrato de trabalho, em especial: recibos de pagamento de salário (holerites), espelhos de ponto, comunicados, avisos, advertências, regulamentos e políticas internas.

2. ACEITA que o acesso ao Portal do Colaborador se dará mediante login pessoal e intransferível (CPF e senha de sua exclusiva escolha e guarda), comprometendo-se a não compartilhá-lo com terceiros e a comunicar imediatamente ao RH qualquer suspeita de uso indevido.

3. RECONHECE que o registro eletrônico de acesso e ciência gerado pelo sistema — contendo data, hora, endereço IP, identificação do dispositivo e o código de verificação (hash SHA-256) do documento — constitui prova de recebimento e ciência do respectivo documento, com a mesma validade da assinatura manuscrita, nos termos da legislação acima citada e do art. 464, parágrafo único, da CLT.

4. ESTÁ CIENTE de que o número de telefone celular informado ao RH será utilizado para o envio das notificações e documentos pelo aplicativo WhatsApp, e que deve manter esse cadastro atualizado.

5. PODERÁ, a qualquer tempo, solicitar ao RH a via impressa de qualquer documento, bem como a revogação desta adesão, hipótese em que a entrega passará a ser feita em papel.

Este termo integra o contrato de trabalho e permanece válido durante toda a vigência do vínculo empregatício.


$CIDADE$ / $ESTADO$, $DATA_EXTENSO$.


___________________________________________
$NOME$
CPF: $CPF$
(Colaborador(a))


___________________________________________
$EMPRESA_NOME$
(Responsável pelo Recursos Humanos)`;

    await queryRunner.query(
      `INSERT INTO rh_docs_padronizados (nome, descricao, titulo, conteudo, ativo, protegido, ordem, fase)
       SELECT $1, $2, $3, $4, true, true, 95, 1
       WHERE NOT EXISTS (SELECT 1 FROM rh_docs_padronizados WHERE nome = $1)`,
      [
        'Termo de Adesão ao Meio Eletrônico',
        'Autoriza a entrega e a ciência de holerites e documentos pelo Portal do Colaborador (MP 2.200-2 art. 10 §2º). Assinar na admissão.',
        'TERMO DE ADESÃO AO MEIO ELETRÔNICO',
        conteudo,
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documento_aceite_eventos`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_documento_aceites`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_colaborador_acessos`);
    await queryRunner.query(`DELETE FROM rh_docs_padronizados WHERE nome = 'Termo de Adesão ao Meio Eletrônico'`);
  }
}
