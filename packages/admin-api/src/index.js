require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const bcrypt = require('bcryptjs');
const { query, migrar } = require('./db');
const {
  gerarToken, gerarTokenTreinamento, exigirLogin, exigirMaster, conferirSenha, hashDeSenha,
} = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Atras do nginx: sem isto o rate limit enxerga TODO mundo como um IP so
// (o do proxy) e 10 tentativas erradas travariam o login de todos.
app.set('trust proxy', 1);

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente de novo em 15 minutos.' },
});

// ── Saude ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Publico: vídeos do /treinamento do site ──────────────────────────────
// Sem login de proposito: a pagina publica de treinamento consome isto.
app.get('/api/publico/treinamentos', async (_req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, titulo, descricao, youtube_id FROM treinamentos WHERE ativo = true ORDER BY ordem, id'
    );
    res.json(rows);
  } catch (e) {
    console.error('[treinamentos publico]', e.message);
    res.status(500).json({ erro: 'Erro ao carregar treinamentos' });
  }
});

// ── Publico: planos exibidos em kontrataai.com.br ────────────────────────
// Sem login: e a secao de precos do site que consome.
app.get('/api/publico/planos', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT nome, descricao, valor, recursos, em_breve, destaque, badge, cta, link_pagamento
       FROM planos WHERE no_site = true ORDER BY ordem, id`
    );
    res.json(rows);
  } catch (e) {
    console.error('[planos publico]', e.message);
    res.status(500).json({ erro: 'Erro ao carregar planos' });
  }
});

// ── Publico: login da area de treinamento (cliente) ──────────────────────
// Conferido no SERVIDOR. Antes a senha ficava no JavaScript do site e qualquer
// visitante lia vendo o fonte da pagina.
app.post('/api/publico/treinamento/login', limiteLogin, async (req, res) => {
  const { usuario, senha } = req.body || {};
  try {
    const { rows } = await query(
      `SELECT a.id, a.usuario, a.senha_hash, a.ativo, c.nome AS cliente_nome
       FROM acessos_treinamento a
       LEFT JOIN clientes c ON c.id = a.cliente_id
       WHERE lower(a.usuario) = lower($1)`,
      [String(usuario || '').trim()]
    );
    const a = rows[0];
    // Resposta identica pra usuario inexistente e senha errada.
    if (!a || !a.ativo || !(await bcrypt.compare(String(senha || ''), a.senha_hash))) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
    }
    await query('UPDATE acessos_treinamento SET ultimo_acesso = now() WHERE id = $1', [a.id]);
    res.json({
      token: gerarTokenTreinamento(a),
      cliente: a.cliente_nome || null,
    });
  } catch (e) {
    console.error('[treinamento login]', e.message);
    res.status(500).json({ erro: 'Erro ao entrar' });
  }
});

// ── Login ────────────────────────────────────────────────────────────────
app.post('/api/login', limiteLogin, async (req, res) => {
  const { usuario, senha } = req.body || {};
  try {
    const u = await conferirSenha(usuario, senha);
    if (!u) return res.status(401).json({ erro: 'Usuário ou senha incorretos' });

    await query('UPDATE usuarios SET ultimo_acesso = now() WHERE id = $1', [u.id]);
    res.json({
      token: gerarToken(u),
      usuario: { id: u.id, nome: u.nome, usuario: u.usuario, master: !!u.master },
      precisaTrocarSenha: u.precisa_trocar_senha,
    });
  } catch (e) {
    console.error('[login]', e.message);
    res.status(500).json({ erro: 'Erro ao entrar' });
  }
});

app.get('/api/eu', exigirLogin, async (req, res) => {
  const { rows } = await query(
    'SELECT id, nome, usuario, email, precisa_trocar_senha, master FROM usuarios WHERE id = $1',
    [req.usuario.id]
  );
  if (!rows[0]) return res.status(401).json({ erro: 'Usuário não encontrado' });
  res.json(rows[0]);
});

app.post('/api/trocar-senha', exigirLogin, async (req, res) => {
  const { senhaAtual, senhaNova } = req.body || {};
  if (!senhaNova || String(senhaNova).length < 8) {
    return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 8 caracteres' });
  }
  try {
    const u = await conferirSenha(req.usuario.usuario, senhaAtual);
    if (!u) return res.status(400).json({ erro: 'Senha atual incorreta' });

    await query(
      'UPDATE usuarios SET senha_hash = $1, precisa_trocar_senha = false WHERE id = $2',
      [await hashDeSenha(senhaNova), req.usuario.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[trocar-senha]', e.message);
    res.status(500).json({ erro: 'Erro ao trocar a senha' });
  }
});

// Daqui pra baixo, tudo exige login.
app.use('/api', exigirLogin);

// ── Resumo do topo ───────────────────────────────────────────────────────
app.get('/api/resumo', async (_req, res) => {
  try {
    const [ativos, prospects, receita, aReceber, vencidas] = await Promise.all([
      query("SELECT COUNT(*)::int n FROM clientes WHERE situacao = 'ativo'"),
      query("SELECT COUNT(*)::int n FROM clientes WHERE situacao = 'prospeccao' AND estagio NOT IN ('ganho','perdido')"),
      // Receita = valor do plano MENOS o desconto em R$ de cada um.
      // Somar valor_mensal cru daria um número que ninguém recebe de verdade.
      // GREATEST(...,0) evita receita negativa se alguém digitar desconto
      // maior que a mensalidade.
      query(
        `SELECT COALESCE(SUM(GREATEST(COALESCE(valor_mensal,0) - COALESCE(desconto,0), 0)),0)::float v
         FROM clientes WHERE situacao = 'ativo'`
      ),
      query("SELECT COALESCE(SUM(valor),0)::float v FROM cobrancas WHERE status = 'pendente'"),
      query("SELECT COUNT(*)::int n FROM cobrancas WHERE status = 'pendente' AND vencimento < CURRENT_DATE"),
    ]);
    res.json({
      clientesAtivos: ativos.rows[0].n,
      prospects: prospects.rows[0].n,
      receitaMensal: receita.rows[0].v,
      aReceber: aReceber.rows[0].v,
      cobrancasVencidas: vencidas.rows[0].n,
    });
  } catch (e) {
    console.error('[resumo]', e.message);
    res.status(500).json({ erro: 'Erro ao carregar o resumo' });
  }
});

// ── Clientes (ativos e prospecção na mesma tabela) ───────────────────────
const CAMPOS_CLIENTE = [
  'situacao', 'nome', 'razao_social', 'cnpj', 'subdominio',
  'contato_nome', 'contato_cargo', 'telefone', 'email', 'cidade', 'estado', 'logo_url',
  'plano', 'valor_mensal', 'desconto', 'data_inicio', 'qtd_lojas', 'dia_vencimento',
  'estagio', 'origem', 'proxima_acao', 'data_proxima_acao',
  'teste_inicio', 'teste_dias',
  'asaas_customer_id', 'observacoes',
];

/** Mantém só os campos conhecidos e troca '' por null (datas vazias quebram). */
function limparCliente(corpo) {
  const dados = {};
  for (const c of CAMPOS_CLIENTE) {
    if (corpo[c] !== undefined) dados[c] = corpo[c] === '' ? null : corpo[c];
  }
  return dados;
}

app.get('/api/clientes', async (req, res) => {
  try {
    const { situacao } = req.query;
    const where = situacao ? 'WHERE situacao = $1' : '';
    const params = situacao ? [situacao] : [];
    const { rows } = await query(
      `SELECT * FROM clientes ${where} ORDER BY nome`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error('[clientes]', e.message);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

app.post('/api/clientes', async (req, res) => {
  const dados = limparCliente(req.body || {});
  if (!dados.nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  try {
    const cols = Object.keys(dados);
    const vals = Object.values(dados);
    const marks = cols.map((_, i) => `$${i + 1}`);
    const { rows } = await query(
      `INSERT INTO clientes (${cols.join(',')}) VALUES (${marks.join(',')}) RETURNING *`,
      vals
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[clientes criar]', e.message);
    res.status(500).json({ erro: 'Erro ao criar cliente' });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  const dados = limparCliente(req.body || {});
  const cols = Object.keys(dados);
  if (!cols.length) return res.status(400).json({ erro: 'Nada para atualizar' });
  try {
    const sets = cols.map((c, i) => `${c} = $${i + 1}`);
    const { rows } = await query(
      `UPDATE clientes SET ${sets.join(',')}, updated_at = now()
       WHERE id = $${cols.length + 1} RETURNING *`,
      [...Object.values(dados), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[clientes atualizar]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar cliente' });
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await query('DELETE FROM clientes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[clientes excluir]', e.message);
    res.status(500).json({ erro: 'Erro ao excluir cliente' });
  }
});

// ── Planos ───────────────────────────────────────────────────────────────
app.get('/api/planos', async (_req, res) => {
  const { rows } = await query('SELECT * FROM planos ORDER BY ordem, id');
  res.json(rows);
});

app.post('/api/planos', async (req, res) => {
  const b = req.body || {};
  if (!b.nome?.trim()) return res.status(400).json({ erro: 'Informe o nome do plano' });
  try {
    const { rows } = await query(
      `INSERT INTO planos (nome, descricao, valor, recursos, ordem, ativo,
                           no_site, em_breve, destaque, badge, cta, link_pagamento)
       VALUES ($1,$2,COALESCE($3,0),COALESCE($4,'[]'::jsonb),COALESCE($5,0),COALESCE($6,true),
               COALESCE($7,true),COALESCE($8,false),COALESCE($9,false),$10,$11,$12)
       RETURNING *`,
      [
        b.nome.trim(), b.descricao || null, b.valor,
        JSON.stringify(b.recursos || []), b.ordem, b.ativo,
        b.no_site, b.em_breve, b.destaque,
        b.badge || null, b.cta || null, b.link_pagamento || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Já existe um plano com esse nome' });
    console.error('[planos criar]', e.message);
    res.status(500).json({ erro: 'Erro ao criar plano' });
  }
});

app.put('/api/planos/:id', async (req, res) => {
  const b = req.body || {};
  try {
    const { rows } = await query(
      `UPDATE planos SET
         nome = COALESCE($1, nome), descricao = $2,
         valor = COALESCE($3, valor),
         recursos = COALESCE($4::jsonb, recursos),
         ordem = COALESCE($5, ordem), ativo = COALESCE($6, ativo),
         no_site = COALESCE($8, no_site),
         em_breve = COALESCE($9, em_breve),
         destaque = COALESCE($10, destaque),
         badge = $11, cta = $12, link_pagamento = $13,
         updated_at = now()
       WHERE id = $7 RETURNING *`,
      [
        b.nome || null, b.descricao || null, b.valor,
        b.recursos ? JSON.stringify(b.recursos) : null,
        b.ordem, b.ativo, req.params.id,
        b.no_site, b.em_breve, b.destaque,
        b.badge || null, b.cta || null, b.link_pagamento || null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Plano não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Já existe um plano com esse nome' });
    console.error('[planos atualizar]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar plano' });
  }
});

app.delete('/api/planos/:id', async (req, res) => {
  await query('DELETE FROM planos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Financeiro: grade cliente x mes ──────────────────────────────────────
// Uma linha por cliente ativo, com as cobrancas do ano pedido.
app.get('/api/financeiro/matriz', async (req, res) => {
  const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
  try {
    const { rows } = await query(
      `SELECT c.id, c.nome, c.logo_url, c.dia_vencimento,
              c.valor_mensal, c.desconto,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', co.id, 'competencia', co.competencia, 'status', co.status,
                    'vencimento', co.vencimento, 'pago_em', co.pago_em, 'valor', co.valor
                  ) ORDER BY co.competencia
                ) FILTER (WHERE co.id IS NOT NULL),
                '[]'
              ) AS cobrancas
       FROM clientes c
       LEFT JOIN cobrancas co
              ON co.cliente_id = c.id AND co.competencia LIKE $1
       WHERE c.situacao = 'ativo'
       GROUP BY c.id
       ORDER BY c.nome`,
      [`${ano}-%`]
    );
    res.json({ ano, clientes: rows });
  } catch (e) {
    console.error('[financeiro matriz]', e.message);
    res.status(500).json({ erro: 'Erro ao carregar a grade' });
  }
});

/**
 * Clique numa célula da grade: alterna entre pago e pendente.
 * Cria a cobrança do mês se ainda não existir — assim o usuário não precisa
 * lançar 12 cobranças à mão antes de poder marcar a primeira como paga.
 */
app.post('/api/financeiro/marcar', async (req, res) => {
  const { cliente_id, competencia, status } = req.body || {};
  if (!cliente_id || !/^[0-9]{4}-[0-9]{2}$/.test(String(competencia || ''))) {
    return res.status(400).json({ erro: 'Cliente e competência (AAAA-MM) são obrigatórios' });
  }
  const novoStatus = status === 'pago' ? 'pago' : 'pendente';

  try {
    // ⚠️ query() devolve { rows }, NÃO um array. Fazer `const [cli] = await
    // query(...)` deixa cli undefined e a rota responde 404 em silêncio.
    const { rows: achados } = await query(
      'SELECT valor_mensal, desconto, dia_vencimento FROM clientes WHERE id = $1',
      [cliente_id]
    );
    const cli = achados[0];
    if (!cli) return res.status(404).json({ erro: 'Cliente não encontrado' });

    // Valor cobrado = mensalidade menos o desconto negociado.
    const valor = Math.max(
      (Number(cli.valor_mensal) || 0) - (Number(cli.desconto) || 0),
      0
    );

    // Vencimento = dia do cadastro dentro da competência. Dia 31 em mês de 30
    // cairia no mês seguinte, então limitamos ao último dia do próprio mês.
    const [ano, mes] = String(competencia).split('-').map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dia = Math.min(Number(cli.dia_vencimento) || 10, ultimoDia);
    const vencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const pagoEm = novoStatus === 'pago' ? new Date().toISOString().slice(0, 10) : null;

    const { rows } = await query(
      `INSERT INTO cobrancas (cliente_id, competencia, valor, vencimento, status, pago_em, descricao)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (cliente_id, competencia) DO UPDATE
         SET status = EXCLUDED.status,
             pago_em = EXCLUDED.pago_em,
             -- Mantém o valor já lançado se alguém tiver ajustado à mão
             valor = COALESCE(cobrancas.valor, EXCLUDED.valor),
             vencimento = COALESCE(cobrancas.vencimento, EXCLUDED.vencimento)
       RETURNING *`,
      [cliente_id, competencia, valor, vencimento, novoStatus, pagoEm, 'Mensalidade']
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('[financeiro marcar]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ── Financeiro ───────────────────────────────────────────────────────────
app.get('/api/cobrancas', async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? 'WHERE c.status = $1' : '';
    const params = status ? [status] : [];
    const { rows } = await query(
      `SELECT c.*, cl.nome AS cliente_nome
       FROM cobrancas c
       LEFT JOIN clientes cl ON cl.id = c.cliente_id
       ${where}
       ORDER BY c.vencimento DESC NULLS LAST, c.id DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error('[cobrancas]', e.message);
    res.status(500).json({ erro: 'Erro ao listar cobranças' });
  }
});

app.post('/api/cobrancas', async (req, res) => {
  const b = req.body || {};
  if (!b.valor) return res.status(400).json({ erro: 'Valor é obrigatório' });
  try {
    const { rows } = await query(
      `INSERT INTO cobrancas (cliente_id, competencia, descricao, valor, vencimento, status, forma, link_boleto)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'pendente'),$7,$8) RETURNING *`,
      [
        b.cliente_id || null, b.competencia || null, b.descricao || null,
        b.valor, b.vencimento || null, b.status || null, b.forma || null,
        b.link_boleto || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[cobrancas criar]', e.message);
    res.status(500).json({ erro: 'Erro ao criar cobrança' });
  }
});

app.put('/api/cobrancas/:id', async (req, res) => {
  const b = req.body || {};
  try {
    // Marcar como pago sem informar a data: assume hoje (evita campo em branco
    // no relatorio e o "quando foi pago mesmo?" tres meses depois).
    const pagoEm = b.status === 'pago' ? (b.pago_em || new Date().toISOString().slice(0, 10)) : (b.pago_em || null);
    const { rows } = await query(
      `UPDATE cobrancas SET
         cliente_id = COALESCE($1, cliente_id),
         competencia = $2, descricao = $3, valor = COALESCE($4, valor),
         vencimento = $5, status = COALESCE($6, status), forma = $7,
         link_boleto = $8, pago_em = $9
       WHERE id = $10 RETURNING *`,
      [
        b.cliente_id || null, b.competencia || null, b.descricao || null,
        b.valor || null, b.vencimento || null, b.status || null, b.forma || null,
        b.link_boleto || null, pagoEm, req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Cobrança não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[cobrancas atualizar]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar cobrança' });
  }
});

app.delete('/api/cobrancas/:id', async (req, res) => {
  try {
    await query('DELETE FROM cobrancas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao excluir cobrança' });
  }
});

// ── Treinamentos ─────────────────────────────────────────────────────────
app.get('/api/treinamentos', async (_req, res) => {
  const { rows } = await query('SELECT * FROM treinamentos ORDER BY ordem, id');
  res.json(rows);
});

app.post('/api/treinamentos', async (req, res) => {
  const b = req.body || {};
  if (!b.titulo || !b.youtube_id) {
    return res.status(400).json({ erro: 'Título e ID do vídeo são obrigatórios' });
  }
  const { rows } = await query(
    `INSERT INTO treinamentos (titulo, descricao, youtube_id, ordem, ativo)
     VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,true)) RETURNING *`,
    [b.titulo, b.descricao || null, b.youtube_id, b.ordem, b.ativo]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/treinamentos/:id', async (req, res) => {
  const b = req.body || {};
  const { rows } = await query(
    `UPDATE treinamentos SET titulo = COALESCE($1,titulo), descricao = $2,
       youtube_id = COALESCE($3,youtube_id), ordem = COALESCE($4,ordem),
       ativo = COALESCE($5,ativo)
     WHERE id = $6 RETURNING *`,
    [b.titulo, b.descricao || null, b.youtube_id, b.ordem, b.ativo, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Treinamento não encontrado' });
  res.json(rows[0]);
});

app.delete('/api/treinamentos/:id', async (req, res) => {
  await query('DELETE FROM treinamentos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Usuários do painel (só o master mexe) ────────────────────────────────
app.get('/api/usuarios', exigirMaster, async (_req, res) => {
  const { rows } = await query(
    `SELECT id, nome, usuario, email, ativo, master, ultimo_acesso, precisa_trocar_senha
     FROM usuarios ORDER BY master DESC, nome`
  );
  res.json(rows);
});

app.post('/api/usuarios', exigirMaster, async (req, res) => {
  const { nome, usuario, email, senha, master } = req.body || {};
  if (!nome?.trim() || !usuario?.trim()) {
    return res.status(400).json({ erro: 'Nome e usuário são obrigatórios' });
  }
  if (!senha || String(senha).length < 8) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nome, usuario, email, senha_hash, master, precisa_trocar_senha)
       VALUES ($1, lower($2), $3, $4, COALESCE($5,false), true)
       RETURNING id, nome, usuario, email, ativo, master`,
      [nome.trim(), usuario.trim(), email || null, await hashDeSenha(senha), master]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Esse usuário já existe' });
    console.error('[usuarios criar]', e.message);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

app.put('/api/usuarios/:id', exigirMaster, async (req, res) => {
  const { nome, usuario, email, senha, ativo, master } = req.body || {};
  const id = parseInt(req.params.id, 10);
  try {
    // Trava contra se trancar do lado de fora: o master não pode remover o
    // próprio master nem se desativar — sobraria um painel sem dono.
    if (id === req.usuario.id && (master === false || ativo === false)) {
      return res.status(400).json({ erro: 'Você não pode remover o próprio acesso master' });
    }
    if (senha) {
      if (String(senha).length < 8) {
        return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres' });
      }
      await query(
        'UPDATE usuarios SET senha_hash = $1, precisa_trocar_senha = true WHERE id = $2',
        [await hashDeSenha(senha), id]
      );
    }
    const { rows } = await query(
      `UPDATE usuarios SET
         nome = COALESCE($1, nome),
         usuario = COALESCE(lower($2), usuario),
         email = $3,
         ativo = COALESCE($4, ativo),
         master = COALESCE($5, master)
       WHERE id = $6
       RETURNING id, nome, usuario, email, ativo, master`,
      [nome || null, usuario || null, email || null, ativo, master, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Esse usuário já existe' });
    console.error('[usuarios atualizar]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar usuário' });
  }
});

app.delete('/api/usuarios/:id', exigirMaster, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode excluir a própria conta' });
  }
  await query('DELETE FROM usuarios WHERE id = $1', [id]);
  res.json({ ok: true });
});

// ── Acessos à área de treinamento ────────────────────────────────────────
app.get('/api/acessos-treinamento', async (_req, res) => {
  // senha_hash NUNCA sai daqui.
  const { rows } = await query(
    `SELECT a.id, a.cliente_id, a.usuario, a.ativo, a.ultimo_acesso, c.nome AS cliente_nome
     FROM acessos_treinamento a
     LEFT JOIN clientes c ON c.id = a.cliente_id
     ORDER BY c.nome NULLS LAST, a.usuario`
  );
  res.json(rows);
});

app.post('/api/acessos-treinamento', async (req, res) => {
  const { cliente_id, usuario, senha, ativo } = req.body || {};
  if (!usuario || !String(usuario).trim()) {
    return res.status(400).json({ erro: 'Informe o usuário' });
  }
  if (!senha || String(senha).length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO acessos_treinamento (cliente_id, usuario, senha_hash, ativo)
       VALUES ($1, lower($2), $3, COALESCE($4,true))
       RETURNING id, cliente_id, usuario, ativo`,
      [cliente_id || null, String(usuario).trim(), await hashDeSenha(senha), ativo]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Esse usuário já existe' });
    console.error('[acessos criar]', e.message);
    res.status(500).json({ erro: 'Erro ao criar acesso' });
  }
});

app.put('/api/acessos-treinamento/:id', async (req, res) => {
  const { cliente_id, usuario, senha, ativo } = req.body || {};
  try {
    // Senha em branco = manter a atual. Assim dá pra editar o usuário ou
    // ativar/desativar sem precisar redefinir a senha de quem já usa.
    if (senha) {
      if (String(senha).length < 6) {
        return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres' });
      }
      await query('UPDATE acessos_treinamento SET senha_hash = $1 WHERE id = $2', [
        await hashDeSenha(senha), req.params.id,
      ]);
    }
    const { rows } = await query(
      `UPDATE acessos_treinamento
       SET cliente_id = $1, usuario = COALESCE(lower($2), usuario), ativo = COALESCE($3, ativo)
       WHERE id = $4
       RETURNING id, cliente_id, usuario, ativo`,
      [cliente_id || null, usuario ? String(usuario).trim() : null, ativo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Acesso não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ erro: 'Esse usuário já existe' });
    console.error('[acessos atualizar]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar acesso' });
  }
});

app.delete('/api/acessos-treinamento/:id', async (req, res) => {
  await query('DELETE FROM acessos_treinamento WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Integrações ──────────────────────────────────────────────────────────
app.get('/api/integracoes', async (_req, res) => {
  const { rows } = await query('SELECT chave, valor, secreto FROM integracoes ORDER BY chave');
  // Segredo nunca volta em texto puro: a tela só precisa saber SE está preenchido.
  res.json(
    rows.map((r) => ({
      chave: r.chave,
      secreto: r.secreto,
      preenchido: !!r.valor,
      valor: r.secreto ? null : r.valor,
    }))
  );
});

app.put('/api/integracoes/:chave', async (req, res) => {
  const { valor, secreto } = req.body || {};
  try {
    await query(
      `INSERT INTO integracoes (chave, valor, secreto, atualizado)
       VALUES ($1,$2,COALESCE($3,false),now())
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor,
         secreto = EXCLUDED.secreto, atualizado = now()`,
      [req.params.chave, valor ?? null, secreto]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[integracoes]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar integração' });
  }
});

const PORTA = parseInt(process.env.PORT || '3020', 10);
migrar()
  .then(() => {
    app.listen(PORTA, () => console.log(`[admin-api] ouvindo na porta ${PORTA}`));
  })
  .catch((e) => {
    console.error('[admin-api] falha ao migrar o banco:', e.message);
    process.exit(1);
  });
