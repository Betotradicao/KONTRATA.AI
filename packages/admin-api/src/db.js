const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'kontrata_admin',
  max: 10,
});

const query = (texto, params) => pool.query(texto, params);

/**
 * Roda o schema no boot. Todo CREATE e IF NOT EXISTS, entao subir o container
 * de novo nao apaga nem duplica nada.
 */
async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] schema aplicado');
}

module.exports = { pool, query, migrar };
