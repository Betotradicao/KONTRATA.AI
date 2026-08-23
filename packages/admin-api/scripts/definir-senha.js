/**
 * Define a senha de um usuário do painel interno.
 *
 *   SENHA='...' node scripts/definir-senha.js email@dominio.com
 *
 * A senha vem por VARIÁVEL DE AMBIENTE de propósito — passar por argumento
 * deixaria ela no histórico do shell e visível pra qualquer um que rodasse
 * `ps` na máquina enquanto o comando executa.
 *
 * Como a senha foi escolhida pela própria pessoa, a conta já fica sem a
 * obrigação de trocar no primeiro acesso.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, migrar, pool } = require('../src/db');

(async () => {
  const email = process.argv[2];
  const senha = process.env.SENHA;

  if (!email || !senha) {
    console.error("Uso: SENHA='...' node scripts/definir-senha.js email@dominio.com");
    process.exit(1);
  }
  if (String(senha).length < 8) {
    console.error('A senha precisa ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  try {
    await migrar();
    const { rowCount } = await query(
      `UPDATE usuarios
       SET senha_hash = $1, precisa_trocar_senha = false, ativo = true
       WHERE lower(email) = lower($2)`,
      [await bcrypt.hash(String(senha), 10), email]
    );
    if (!rowCount) {
      console.error(`Nenhum usuário com o e-mail ${email}. Crie com criar-usuario.js primeiro.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Senha atualizada para ${email}. Já pode entrar em /admin.`);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
