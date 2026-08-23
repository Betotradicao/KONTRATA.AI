/**
 * Cria (ou reseta) um usuário do painel interno com SENHA TEMPORÁRIA aleatória.
 *
 *   node scripts/criar-usuario.js "Nome da Pessoa" email@dominio.com
 *
 * A senha é gerada aqui, mostrada UMA vez no terminal e gravada só como hash.
 * A conta nasce com `precisa_trocar_senha = true`: a pessoa entra com a
 * temporária e o painel obriga a trocar antes de usar qualquer coisa.
 *
 * POR QUE ASSIM: senha nunca deve trafegar por chat, e-mail ou ficar no
 * código. Assim ninguém — nem quem criou a conta — fica sabendo a senha final.
 */
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, migrar, pool } = require('../src/db');

// Sem caracteres ambíguos (0/O, 1/l/I) — a pessoa vai digitar isso à mão.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const senhaTemporaria = (tam = 14) =>
  Array.from(crypto.randomBytes(tam))
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join('');

(async () => {
  const [nome, email] = process.argv.slice(2);
  if (!nome || !email) {
    console.error('Uso: node scripts/criar-usuario.js "Nome" email@dominio.com');
    process.exit(1);
  }

  try {
    await migrar();
    const senha = senhaTemporaria();
    const hash = await bcrypt.hash(senha, 10);

    await query(
      `INSERT INTO usuarios (nome, email, senha_hash, precisa_trocar_senha)
       VALUES ($1, lower($2), $3, true)
       ON CONFLICT (email) DO UPDATE
         SET nome = EXCLUDED.nome,
             senha_hash = EXCLUDED.senha_hash,
             precisa_trocar_senha = true,
             ativo = true`,
      [nome, email, hash]
    );

    console.log('');
    console.log('  Conta pronta em https://kontrataai.com.br/admin');
    console.log('  ------------------------------------------------');
    console.log(`  Nome:            ${nome}`);
    console.log(`  E-mail:          ${email.toLowerCase()}`);
    console.log(`  Senha TEMPORARIA: ${senha}`);
    console.log('  ------------------------------------------------');
    console.log('  Sera pedida a troca no primeiro acesso.');
    console.log('');
  } catch (e) {
    console.error('Erro:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
