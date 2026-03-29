const db = require('./db');

async function criarIndice(nome, sql) {
  console.log(`INIT IDX - garantindo índice ${nome}`);
  await db.query(sql);
}

async function possuiViolacoes(sql) {
  const result = await db.query(sql);
  return Number(result.rows[0]?.total || 0) > 0;
}

async function constraintExiste(nome) {
  const result = await db.query(
    `
      SELECT 1
      FROM pg_constraint
      WHERE conname = $1
      LIMIT 1
    `,
    [nome]
  );

  return Boolean(result.rows[0]);
}

async function criarCheckConstraintSePossivel({ nome, alterTableSql, validacaoSql, aviso }) {
  if (await constraintExiste(nome)) {
    console.log(`INIT CHECK - constraint ${nome} já existe`);
    return;
  }

  if (await possuiViolacoes(validacaoSql)) {
    console.warn(`INIT CHECK - constraint ${nome} não aplicada: ${aviso}`);
    return;
  }

  console.log(`INIT CHECK - criando constraint ${nome}`);
  await db.query(alterTableSql);
}

async function criarIndiceUnicoSePossivel({ nome, createIndexSql, validacaoSql, aviso }) {
  const indiceExiste = await db.query(
    `
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = $1
      LIMIT 1
    `,
    [nome]
  );

  if (indiceExiste.rows[0]) {
    console.log(`INIT UNIQUE - índice ${nome} já existe`);
    return;
  }

  if (await possuiViolacoes(validacaoSql)) {
    console.warn(`INIT UNIQUE - índice ${nome} não aplicado: ${aviso}`);
    return;
  }

  console.log(`INIT UNIQUE - criando índice ${nome}`);
  await db.query(createIndexSql);
}

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

  console.log('INIT 5.1 - aplicando hardening de constraints e índices');
  await criarIndice(
    'idx_registros_usuario_tipo_criado_em',
    `
      CREATE INDEX IF NOT EXISTS idx_registros_usuario_tipo_criado_em
      ON registros (usuario_id, tipo, criado_em DESC)
    `
  );
  await criarIndice(
    'idx_relatorios_usuario_semana',
    `
      CREATE INDEX IF NOT EXISTS idx_relatorios_usuario_semana
      ON relatorios_semanais (usuario_id, semana_referencia)
    `
  );
  await criarIndice(
    'idx_lavagens_usuario_status',
    `
      CREATE INDEX IF NOT EXISTS idx_lavagens_usuario_status
      ON lavagens (usuario_id, status, criado_em DESC)
    `
  );
  await criarIndice(
    'idx_acoes_status_iniciado_em',
    `
      CREATE INDEX IF NOT EXISTS idx_acoes_status_iniciado_em
      ON acoes (status, iniciado_em DESC)
    `
  );
  await criarIndiceUnicoSePossivel({
    nome: 'ux_cadastros_personagem_id',
    createIndexSql: `
      CREATE UNIQUE INDEX IF NOT EXISTS ux_cadastros_personagem_id
      ON cadastros (personagem_id)
    `,
    validacaoSql: `
      SELECT COUNT(*) AS total
      FROM (
        SELECT personagem_id
        FROM cadastros
        WHERE personagem_id IS NOT NULL
        GROUP BY personagem_id
        HAVING COUNT(*) > 1
      ) duplicados
    `,
    aviso: 'existem personagem_id duplicados em cadastros',
  });
  await criarCheckConstraintSePossivel({
    nome: 'chk_registros_quantidade_positiva',
    alterTableSql: `
      ALTER TABLE registros
      ADD CONSTRAINT chk_registros_quantidade_positiva
      CHECK (quantidade IS NULL OR quantidade > 0)
    `,
    validacaoSql: `
      SELECT COUNT(*) AS total
      FROM registros
      WHERE quantidade IS NOT NULL
        AND quantidade <= 0
    `,
    aviso: 'existem registros com quantidade menor ou igual a zero',
  });
  await criarCheckConstraintSePossivel({
    nome: 'chk_lavagens_valores_positivos',
    alterTableSql: `
      ALTER TABLE lavagens
      ADD CONSTRAINT chk_lavagens_valores_positivos
      CHECK (
        quantidade > 0
        AND taxa_percentual >= 0
        AND taxa_percentual <= 100
        AND valor_faccao >= 0
        AND valor_cliente >= 0
      )
    `,
    validacaoSql: `
      SELECT COUNT(*) AS total
      FROM lavagens
      WHERE quantidade <= 0
         OR taxa_percentual < 0
         OR taxa_percentual > 100
         OR valor_faccao < 0
         OR valor_cliente < 0
    `,
    aviso: 'existem lavagens com quantidade, taxa ou valores inválidos',
  });
  await criarCheckConstraintSePossivel({
    nome: 'chk_acoes_valores_positivos',
    alterTableSql: `
      ALTER TABLE acoes
      ADD CONSTRAINT chk_acoes_valores_positivos
      CHECK (quantidade_participantes > 0 AND dinheiro > 0)
    `,
    validacaoSql: `
      SELECT COUNT(*) AS total
      FROM acoes
      WHERE quantidade_participantes <= 0
         OR dinheiro <= 0
    `,
    aviso: 'existem ações com quantidade_participantes ou dinheiro inválidos',
  });

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
