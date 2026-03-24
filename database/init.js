const db = require('./db');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      usuario_tag TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      item TEXT,
      quantidade INTEGER,
      imagem TEXT,
      acao TEXT,
      categoria TEXT,
      status TEXT DEFAULT 'pendente',
      criado_em TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS metas_semanais (
      usuario_id TEXT PRIMARY KEY,
      usuario_tag TEXT NOT NULL,
      meta INTEGER NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS relatorios_semanais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      usuario_tag TEXT NOT NULL,
      semana_referencia TEXT NOT NULL,
      total_itens INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL
    )
  `);
}

module.exports = initDatabase;