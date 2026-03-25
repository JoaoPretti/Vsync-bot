const db = require('./db');

async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      usuario_tag TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      item TEXT,
      quantidade INTEGER,
      imagem TEXT,
      acao TEXT,
      categoria TEXT,
      status TEXT DEFAULT 'pendente',
      criado_em TIMESTAMP NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS relatorios_semanais (
      id SERIAL PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      usuario_tag TEXT NOT NULL,
      semana_referencia TEXT NOT NULL,
      total_itens INTEGER NOT NULL,
      criado_em TIMESTAMP NOT NULL
    )
  `);
}

module.exports = initDatabase;