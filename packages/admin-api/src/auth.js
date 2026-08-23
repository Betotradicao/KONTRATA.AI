const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const SEGREDO = process.env.JWT_SECRET;
if (!SEGREDO) {
  // Sem segredo, qualquer um forja um token e entra. Melhor nao subir.
  console.error('[auth] JWT_SECRET nao definido — abortando');
  process.exit(1);
}

const DURACAO = '12h';

const gerarToken = (u) =>
  jwt.sign(
    { id: u.id, usuario: u.usuario, nome: u.nome, master: !!u.master },
    SEGREDO,
    { expiresIn: DURACAO }
  );

/**
 * Middleware: só o usuário master passa.
 * Confere no BANCO, não no token — se o master for rebaixado, o token que ele
 * já tinha na mão pararia de valer só quando expirasse.
 */
async function exigirMaster(req, res, next) {
  const { rows } = await query('SELECT master FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows[0]?.master) {
    return res.status(403).json({ erro: 'Só o usuário master pode fazer isso' });
  }
  next();
}

/** Middleware: exige token valido no header Authorization: Bearer <token>. */
function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    const dados = jwt.verify(token, SEGREDO);
    // ⚠️ CRITICO: os dois tipos de token são assinados com o MESMO segredo.
    // Sem esta linha, o token da área de treinamento (que vai pra qualquer
    // cliente) abriria o painel interno inteiro.
    if (dados.escopo === 'treinamento') {
      return res.status(403).json({ erro: 'Acesso não permitido' });
    }
    req.usuario = dados;
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  }
}

/** Confere pelo campo USUARIO (não e-mail). Maiúscula/minúscula não importa. */
async function conferirSenha(usuario, senha) {
  const { rows } = await query(
    `SELECT id, nome, usuario, email, senha_hash, precisa_trocar_senha, ativo, master
     FROM usuarios WHERE lower(usuario) = lower($1)`,
    [String(usuario || '').trim()]
  );
  const u = rows[0];
  // Mesma resposta pra "não existe" e "senha errada": não entregamos de graça
  // quais usuários têm conta no painel.
  if (!u || !u.ativo) return null;
  const ok = await bcrypt.compare(String(senha || ''), u.senha_hash);
  return ok ? u : null;
}

const hashDeSenha = (senha) => bcrypt.hash(String(senha), 10);

/**
 * Token da AREA DE TREINAMENTO (cliente), separado do token da equipe.
 * `escopo: 'treinamento'` garante que ele nao serve pra abrir o painel interno
 * — sem isso, um acesso de cliente viraria acesso administrativo.
 */
const gerarTokenTreinamento = (a) =>
  jwt.sign({ id: a.id, usuario: a.usuario, escopo: 'treinamento' }, SEGREDO, { expiresIn: '30d' });

module.exports = {
  gerarToken,
  gerarTokenTreinamento,
  exigirLogin,
  exigirMaster,
  conferirSenha,
  hashDeSenha,
};
