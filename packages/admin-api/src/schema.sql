-- Painel interno do Kontrata (kontrataai.com.br/admin)
-- Banco PRÓPRIO, separado dos bancos dos clientes.

CREATE TABLE IF NOT EXISTS usuarios (
  id                   SERIAL PRIMARY KEY,
  nome                 TEXT NOT NULL,
  -- Login é por USUÁRIO (ex: 'roberto'), não por e-mail. O e-mail fica
  -- opcional, só pra contato/recuperação futura.
  usuario              TEXT,
  email                TEXT UNIQUE,
  senha_hash           TEXT NOT NULL,
  -- Contas nascem com senha temporária. Enquanto isto for true, o login
  -- funciona mas o painel obriga a trocar antes de fazer qualquer coisa.
  precisa_trocar_senha BOOLEAN NOT NULL DEFAULT true,
  ativo                BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajustes para bancos criados antes do login por usuário existir.
-- Rodam sempre; são inofensivos quando já aplicados.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS usuario TEXT;
-- Master = pode criar, editar e bloquear os outros usuários do painel.
-- Os demais entram e usam as abas, mas não mexem em quem tem acesso.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS master BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
-- Índice em lower(): 'ROBERTO' e 'roberto' são o mesmo login.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios (lower(usuario));

-- ── CLIENTES ─────────────────────────────────────────────────────────────
-- Ativos e prospecção moram na MESMA tabela, separados por `situacao`.
-- Motivo: um prospect que fecha vira cliente — sem isso seria preciso copiar
-- o registro de uma tabela pra outra e o histórico se perderia.
CREATE TABLE IF NOT EXISTS clientes (
  id             SERIAL PRIMARY KEY,
  situacao       TEXT NOT NULL DEFAULT 'prospeccao'
                 CHECK (situacao IN ('prospeccao', 'ativo', 'inativo')),

  nome           TEXT NOT NULL,
  razao_social   TEXT,
  cnpj           TEXT,
  -- Subdomínio do sistema dele (ex: 'tradicao' -> tradicao.kontrataai.com.br)
  subdominio     TEXT,

  contato_nome   TEXT,
  contato_cargo  TEXT,
  telefone       TEXT,
  email          TEXT,
  cidade         TEXT,
  estado         TEXT,

  -- Comercial
  plano          TEXT,           -- Recrutamento | Operacional | RH Completo
  valor_mensal   NUMERIC(10,2),
  data_inicio    DATE,
  qtd_lojas      INTEGER,

  -- Funil (só faz sentido em situacao='prospeccao')
  estagio        TEXT DEFAULT 'novo'
                 CHECK (estagio IN ('novo','contato','demo','proposta','ganho','perdido')),
  origem         TEXT,           -- indicação, Instagram, feira...
  proxima_acao   TEXT,
  data_proxima_acao DATE,

  -- Vínculo com o Asaas (usado pelo Financeiro)
  asaas_customer_id TEXT,

  observacoes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_situacao ON clientes(situacao);
CREATE INDEX IF NOT EXISTS idx_clientes_estagio  ON clientes(estagio);

-- ── PLANOS ───────────────────────────────────────────────────────────────
-- Tabela de preços. Ao escolher o plano na ficha do cliente, o valor mensal
-- vem daqui automaticamente (e continua editável, pra caso combinado à parte).
CREATE TABLE IF NOT EXISTS planos (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  descricao  TEXT,
  valor      NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- O que está incluído. Lista de textos, editável no painel.
  recursos   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordem      INTEGER NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS recursos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Preços e recursos do site (kontrataai.com.br). Só entram se a tabela estiver
-- vazia — reiniciar o container não sobrescreve o que o usuário já ajustou.
INSERT INTO planos (nome, descricao, valor, recursos, ordem)
SELECT * FROM (VALUES
  ('Recrutamento', 'Para acabar com o caos da contratação.', 398.00,
   '["Página de vagas com a sua marca","Banco de currículos automático","Triagem automática de candidatos","Currículo em formato de quiz","Suporte direto via WhatsApp"]'::jsonb, 1),
  ('Operacional',  'Recrutamento + gestão do dia a dia da loja.', 697.00,
   '["Tudo do plano Recrutamento, e mais:","Cadastro Geral de Colaboradores","Documentação digital","Escala de Trabalho (6x1, 5x2, 12x36)","Departamento Pessoal","Multi-loja e multi-empresa"]'::jsonb, 2),
  ('RH Completo',  'Para mercados que querem profissionalizar 100% o RH.', 1197.00,
   '["Tudo do plano Operacional, e mais:","Indicadores RH (dashboard ao vivo)","Saúde Ocupacional (ASOs e prazos)","Ponto e Ausências","Controle de Férias","Análise de Absenteísmo","Pesquisa de Clima","Treinamentos","Financeiro RH"]'::jsonb, 3)
) AS novo(nome, descricao, valor, recursos, ordem)
WHERE NOT EXISTS (SELECT 1 FROM planos);

-- Campos que controlam como o plano aparece em kontrataai.com.br.
-- `ativo`    = pode ser atribuído a um cliente aqui no painel (uso interno)
-- `no_site`  = aparece na seção de planos do site
-- `em_breve` = aparece no site com cadeado "Em breve", sem botão de compra
ALTER TABLE planos ADD COLUMN IF NOT EXISTS no_site        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS em_breve       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS destaque       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS badge          TEXT;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS cta            TEXT;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS link_pagamento TEXT;

-- Alinha os 3 planos com o que o site já mostrava hoje.
-- As condições `IS NULL` fazem isso rodar UMA vez: depois que o usuário editar,
-- reiniciar o container não desfaz o que ele mudou.
UPDATE planos SET destaque = true, badge = 'MAIS ESCOLHIDO',
       cta = 'Começar pelo Recrutamento',
       link_pagamento = 'https://www.asaas.com/c/s9y29kncpe5up79j'
 WHERE nome = 'Recrutamento' AND badge IS NULL AND cta IS NULL;

UPDATE planos SET em_breve = true, cta = 'Em breve'
 WHERE nome IN ('Operacional', 'RH Completo') AND cta IS NULL;

-- Dia do mês em que a mensalidade vence (1 a 31). Alimenta a grade do
-- Financeiro: é daqui que sai o "Venc 30" de cada mês.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER;

-- Uma cobrança por cliente por competência. Sem isto, clicar duas vezes na
-- mesma célula da grade criaria linhas duplicadas para o mesmo mês.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_cliente_competencia
  ON cobrancas (cliente_id, competencia);

-- Período de teste / demonstração (usado na aba Prospecção).
-- `teste_dias` é a duração combinada (15, 20, 30, 45...); o quanto falta é
-- calculado na hora, não guardado — número gravado envelheceria sozinho.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS teste_inicio DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS teste_dias   INTEGER;

-- Logotipo do cliente, exibido na lista. É uma URL (o logo já está hospedado
-- no sistema do próprio cliente), então não guardamos arquivo aqui.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Desconto negociado, em REAIS abatidos do valor do plano. 0 = sem desconto.
-- (Já foi percentual; virou R$ a pedido do usuário em 23/08/2026.)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) NOT NULL DEFAULT 0;
-- Alarga a coluna caso o banco tenha nascido com a versão percentual (5,2),
-- que só comportava até 999,99 e estouraria num desconto maior.
ALTER TABLE clientes ALTER COLUMN desconto TYPE NUMERIC(10,2);

-- ── FINANCEIRO ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cobrancas (
  id           SERIAL PRIMARY KEY,
  cliente_id   INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  competencia  TEXT,             -- '2026-08'
  descricao    TEXT,
  valor        NUMERIC(10,2) NOT NULL,
  vencimento   DATE,
  pago_em      DATE,
  status       TEXT NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  forma        TEXT,             -- boleto | pix | cartao
  -- Espelho do Asaas: id da cobrança lá e o link do boleto pro cliente
  asaas_id     TEXT,
  link_boleto  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status  ON cobrancas(status);

-- ── TREINAMENTOS ─────────────────────────────────────────────────────────
-- Alimenta a página pública /treinamento. Hoje os vídeos estão fixos no
-- código do site; com esta tabela o RH publica vídeo novo sem precisar de deploy.
CREATE TABLE IF NOT EXISTS treinamentos (
  id          SERIAL PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  youtube_id  TEXT NOT NULL,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ACESSOS À ÁREA DE TREINAMENTO ────────────────────────────────────────
-- Um usuário/senha por pessoa do cliente. Cadastrado no painel interno.
--
-- ⚠️ Substituiu a senha única que ficava no código do site: aquela viajava
-- dentro do JavaScript e qualquer visitante lia vendo o fonte da página.
-- Aqui a conferência é no SERVIDOR e a senha vira hash bcrypt.
CREATE TABLE IF NOT EXISTS acessos_treinamento (
  id            SERIAL PRIMARY KEY,
  cliente_id    INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  usuario       TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acessos_cliente ON acessos_treinamento(cliente_id);

-- ── INTEGRAÇÕES ──────────────────────────────────────────────────────────
-- Chave/valor. `secreto` marca o que não deve voltar em texto puro pra tela.
CREATE TABLE IF NOT EXISTS integracoes (
  chave      TEXT PRIMARY KEY,
  valor      TEXT,
  secreto    BOOLEAN NOT NULL DEFAULT false,
  atualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);
