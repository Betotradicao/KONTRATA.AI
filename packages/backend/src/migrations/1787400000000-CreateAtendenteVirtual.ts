import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ATENDENTE VIRTUAL — menu automático de atendimento no WhatsApp.
 *
 * Escopo deliberadamente pequeno: só menu numerado e respostas. Não tem
 * construtor visual de fluxos, nem blocos de IA, nem aba de conversas — o
 * usuário pediu "só o menu, mas funcionando de verdade".
 *
 * ⚠️ Roda numa instância da Evolution SEPARADA da usada pelos disparos
 * (aniversário, ASO, vagas). Motivo: o atendente precisa RECEBER mensagem via
 * webhook, e ligar webhook no número dos disparos faria o bot responder
 * qualquer pessoa que respondesse um aviso automático.
 */
export class CreateAtendenteVirtual1787400000000 implements MigrationInterface {
  name = 'CreateAtendenteVirtual1787400000000';

  public async up(q: QueryRunner): Promise<void> {
    // Configuração única (uma linha só). Mantida como tabela, e não em
    // `configurations`, porque as opções são uma estrutura grande e aninhada.
    await q.query(`
      CREATE TABLE IF NOT EXISTS atendente_config (
        id                     SERIAL PRIMARY KEY,
        ativo                  BOOLEAN NOT NULL DEFAULT false,
        mensagem_primeira_vez  TEXT NULL,
        mensagem_recorrente    TEXT NULL,
        texto_menu             TEXT NULL,
        -- Horas de silêncio antes de reenviar o menu pro MESMO contato.
        -- 0 = reenvia sempre. Sem isso, cliente mandando "oi", "bom dia",
        -- "tem pão?" leva três menus seguidos.
        intervalo_menu_horas   INTEGER NOT NULL DEFAULT 4,
        -- [{ numero, label, passos: [{ tipo, texto, palavra_chave }] }]
        -- tipo: 'texto' | 'pergunta' | 'atendente' | 'encerrar'
        opcoes                 JSONB NOT NULL DEFAULT '[]'::jsonb,
        -- Mensagem quando o cliente digita algo que não é opção válida
        mensagem_nao_entendi   TEXT NULL,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Onde cada contato parou. Uma linha por telefone.
    await q.query(`
      CREATE TABLE IF NOT EXISTS atendente_sessoes (
        id                  SERIAL PRIMARY KEY,
        telefone            VARCHAR(30) NOT NULL UNIQUE,
        nome                VARCHAR(255) NULL,
        -- Opção em andamento e em que passo dela parou
        opcao_numero        VARCHAR(10) NULL,
        passo_indice        INTEGER NOT NULL DEFAULT 0,
        -- Palavra que o bot está esperando o cliente digitar (passo 'pergunta')
        aguardando_palavra  VARCHAR(255) NULL,
        -- true = já conversou antes (recebe a mensagem de recorrente)
        ja_conversou        BOOLEAN NOT NULL DEFAULT false,
        -- Enquanto true, o bot fica calado: quem responde é gente
        com_atendente       BOOLEAN NOT NULL DEFAULT false,
        ultimo_menu_em      TIMESTAMPTZ NULL,
        ultima_mensagem_em  TIMESTAMPTZ NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_atendente_sessoes_tel ON atendente_sessoes (telefone)`);

    // Log enxuto — sem ele, "o bot não respondeu fulano" vira advinhação.
    await q.query(`
      CREATE TABLE IF NOT EXISTS atendente_mensagens (
        id          SERIAL PRIMARY KEY,
        telefone    VARCHAR(30) NOT NULL,
        direcao     VARCHAR(10) NOT NULL,  -- 'recebida' | 'enviada'
        texto       TEXT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_atendente_msg_tel ON atendente_mensagens (telefone, created_at DESC)`);

    // Linha única de configuração, já com um exemplo utilizável.
    await q.query(`
      INSERT INTO atendente_config (ativo, mensagem_primeira_vez, mensagem_recorrente, texto_menu, mensagem_nao_entendi, intervalo_menu_horas, opcoes)
      SELECT false,
             'Olá! Seja bem-vindo(a) ao nosso atendimento. 👋',
             'Olá novamente! Que bom te ver por aqui. 🙂',
             E'*MENU DE ATENDIMENTO*\\n\\nPor favor, *digite o número* da opção desejada:',
             'Não entendi. Digite o *número* de uma das opções do menu.',
             4,
             '[]'::jsonb
       WHERE NOT EXISTS (SELECT 1 FROM atendente_config)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS atendente_mensagens`);
    await q.query(`DROP TABLE IF EXISTS atendente_sessoes`);
    await q.query(`DROP TABLE IF EXISTS atendente_config`);
  }
}
