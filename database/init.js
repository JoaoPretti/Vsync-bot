const db = require('./db');

async function initDatabase() {
  console.log('INIT 1 - criando tabela registros');
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

  console.log('INIT 2 - criando tabela relatorios_semanais');
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

  console.log('INIT 3 - criando tabela cadastros');
  await db.query(`
    CREATE TABLE IF NOT EXISTS cadastros (
      id SERIAL PRIMARY KEY,
      discord_user_id TEXT NOT NULL UNIQUE,
      discord_tag TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      personagem_nome TEXT NOT NULL,
      personagem_nome_formatado TEXT NOT NULL,
      personagem_id TEXT NOT NULL,
      nickname_aplicado TEXT NOT NULL,
      canal_id TEXT,
      canal_nome TEXT,
      criado_em TIMESTAMP NOT NULL,
      atualizado_em TIMESTAMP NOT NULL
    )
  `);

  console.log('INIT 4 - banco inicializado');
}

module.exports = initDatabase;
