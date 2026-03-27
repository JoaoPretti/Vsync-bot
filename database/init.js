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

  console.log('INIT 4 - criando tabela lavagens');
  await db.query(`
    CREATE TABLE IF NOT EXISTS lavagens (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      usuario_tag TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      grupo TEXT NOT NULL,
      personagem_id TEXT NOT NULL,
      taxa_percentual INTEGER NOT NULL,
      valor_faccao INTEGER NOT NULL,
      valor_cliente INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      aprovado_por_id TEXT,
      aprovado_por_tag TEXT,
      recusado_por_id TEXT,
      recusado_por_tag TEXT,
      mensagem_aprovacao_id TEXT,
      canal_aprovacao_id TEXT,
      criado_em TIMESTAMP NOT NULL,
      atualizado_em TIMESTAMP NOT NULL
    )
  `);

  console.log('INIT 5 - criando tabela acoes');
  await db.query(`
    CREATE TABLE IF NOT EXISTS acoes (
      id SERIAL PRIMARY KEY,
      tamanho TEXT NOT NULL,
      nome_acao TEXT,
      comando_texto TEXT,
      quantidade_participantes INTEGER NOT NULL,
      tipo_acao TEXT,
      resultado TEXT,
      dinheiro INTEGER NOT NULL,
      criador_id TEXT NOT NULL,
      criador_tag TEXT NOT NULL,
      canal_id TEXT NOT NULL,
      mensagem_id TEXT,
      status TEXT NOT NULL DEFAULT 'em_andamento',
      iniciado_em TIMESTAMP NOT NULL,
      finalizado_em TIMESTAMP
    )
  `);

  // Migração para instalações anteriores em que `comando_texto` era obrigatório.
  await db.query(`
    ALTER TABLE acoes
    ALTER COLUMN comando_texto DROP NOT NULL
  `);

  console.log('INIT 6 - criando tabela acao_participantes');
  await db.query(`
    CREATE TABLE IF NOT EXISTS acao_participantes (
      id SERIAL PRIMARY KEY,
      acao_id INTEGER NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL,
      usuario_tag TEXT NOT NULL,
      criado_em TIMESTAMP NOT NULL,
      UNIQUE (acao_id, usuario_id)
    )
  `);

  console.log('INIT 7 - banco inicializado');
}

module.exports = initDatabase;
