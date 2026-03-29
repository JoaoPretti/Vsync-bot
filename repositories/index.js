const db = require('../database/db');

async function salvarRegistroBanco(dados) {
  await db.query(
    `
      INSERT INTO registros (
        tipo,
        usuario_tag,
        usuario_id,
        item,
        quantidade,
        imagem,
        acao,
        categoria,
        status,
        criado_em
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      dados.tipo,
      dados.usuarioTag,
      dados.usuarioId,
      dados.item || null,
      dados.quantidade ?? null,
      dados.imagem || null,
      dados.acao || null,
      dados.categoria || null,
      dados.status || 'pendente',
      dados.criadoEm,
    ]
  );
}

async function buscarRegistrosFarmPorUsuario(usuarioId) {
  const result = await db.query(
    `
      SELECT *
      FROM registros
      WHERE usuario_id = $1
        AND tipo = 'farm'
      ORDER BY id DESC
    `,
    [usuarioId]
  );

  return result.rows;
}

async function buscarTotalFarmPorUsuario(usuarioId) {
  const result = await db.query(
    `
      SELECT COALESCE(SUM(quantidade), 0) AS total
      FROM registros
      WHERE usuario_id = $1
        AND tipo = 'farm'
    `,
    [usuarioId]
  );

  return Number(result.rows[0]?.total || 0);
}

async function buscarUsuariosComFarm() {
  const result = await db.query(`
    SELECT DISTINCT usuario_id, usuario_tag
    FROM registros
    WHERE tipo = 'farm'
  `);

  return result.rows;
}

async function resetarFarmUsuario(usuarioId) {
  await db.query(
    `
      DELETE FROM registros
      WHERE usuario_id = $1
        AND tipo = 'farm'
    `,
    [usuarioId]
  );
}

async function salvarRelatorioSemanal(usuarioId, usuarioTag, semanaReferencia, totalItens) {
  await db.query(
    `
      INSERT INTO relatorios_semanais (
        usuario_id,
        usuario_tag,
        semana_referencia,
        total_itens,
        criado_em
      ) VALUES ($1,$2,$3,$4,$5)
    `,
    [usuarioId, usuarioTag, semanaReferencia, totalItens, new Date()]
  );
}

async function buscarRelatoriosUsuario(usuarioId) {
  const result = await db.query(
    `
      SELECT *
      FROM relatorios_semanais
      WHERE usuario_id = $1
      ORDER BY criado_em DESC
      LIMIT 52
    `,
    [usuarioId]
  );

  return result.rows;
}

async function manterUltimos52RelatoriosPorUsuario(usuarioId) {
  await db.query(
    `
      DELETE FROM relatorios_semanais
      WHERE usuario_id = $1
        AND id NOT IN (
          SELECT id
          FROM relatorios_semanais
          WHERE usuario_id = $2
          ORDER BY criado_em DESC
          LIMIT 52
        )
    `,
    [usuarioId, usuarioId]
  );
}

async function buscarResumoSemanalGlobal() {
  const result = await db.query(`
    SELECT usuario_tag, usuario_id, SUM(quantidade) AS total
    FROM registros
    WHERE tipo = 'farm'
    GROUP BY usuario_tag, usuario_id
    ORDER BY total DESC
  `);

  return result.rows.map((row) => ({
    usuario_tag: row.usuario_tag,
    usuario_id: row.usuario_id,
    total: Number(row.total || 0),
  }));
}

async function salvarOuAtualizarCadastro(dados) {
  await db.query(
    `
      INSERT INTO cadastros (
        discord_user_id,
        discord_tag,
        guild_id,
        personagem_nome,
        personagem_nome_formatado,
        personagem_id,
        nickname_aplicado,
        canal_id,
        canal_nome,
        criado_em,
        atualizado_em
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (discord_user_id)
      DO UPDATE SET
        discord_tag = EXCLUDED.discord_tag,
        guild_id = EXCLUDED.guild_id,
        personagem_nome = EXCLUDED.personagem_nome,
        personagem_nome_formatado = EXCLUDED.personagem_nome_formatado,
        personagem_id = EXCLUDED.personagem_id,
        nickname_aplicado = EXCLUDED.nickname_aplicado,
        canal_id = EXCLUDED.canal_id,
        canal_nome = EXCLUDED.canal_nome,
        atualizado_em = EXCLUDED.atualizado_em
    `,
    [
      dados.discordUserId,
      dados.discordTag,
      dados.guildId,
      dados.personagemNome,
      dados.personagemNomeFormatado,
      dados.personagemId,
      dados.nicknameAplicado,
      dados.canalId,
      dados.canalNome,
      dados.criadoEm,
      dados.atualizadoEm,
    ]
  );
}

async function buscarCadastroPorUsuario(discordUserId) {
  const result = await db.query(
    `
      SELECT *
      FROM cadastros
      WHERE discord_user_id = $1
      LIMIT 1
    `,
    [discordUserId]
  );

  return result.rows[0] || null;
}

async function validarCadastroExistenteUsuario(discordUserId, { permitirEdicao = false } = {}) {
  const cadastroExistente = await buscarCadastroPorUsuario(discordUserId);

  if (cadastroExistente && !permitirEdicao) {
    throw new Error(
      'Você já possui um cadastro ativo. Para alterar seus dados, solicite a um administrador o uso do comando de edição.'
    );
  }

  return cadastroExistente;
}

async function buscarCadastroPorPersonagemId(personagemId) {
  const result = await db.query(
    `
      SELECT *
      FROM cadastros
      WHERE personagem_id = $1
      LIMIT 1
    `,
    [personagemId]
  );

  return result.rows[0] || null;
}

async function salvarAcao(dados) {
  const result = await db.query(
    `
      INSERT INTO acoes (
        tamanho,
        nome_acao,
        comando_texto,
        quantidade_participantes,
        tipo_acao,
        resultado,
        dinheiro,
        criador_id,
        criador_tag,
        canal_id,
        mensagem_id,
        status,
        iniciado_em,
        finalizado_em
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
    [
      dados.tamanho,
      dados.nomeAcao || null,
      dados.comandoTexto,
      dados.quantidadeParticipantes,
      dados.tipoAcao || null,
      dados.resultado || null,
      dados.dinheiro,
      dados.criadorId,
      dados.criadorTag,
      dados.canalId,
      dados.mensagemId || null,
      dados.status || 'em_andamento',
      dados.iniciadoEm,
      dados.finalizadoEm || null,
    ]
  );

  return result.rows[0];
}

async function atualizarMensagemAcao(acaoId, mensagemId) {
  const result = await db.query(
    `
      UPDATE acoes
      SET mensagem_id = $1
      WHERE id = $2
      RETURNING *
    `,
    [mensagemId, acaoId]
  );

  return result.rows[0] || null;
}

async function buscarAcaoPorId(acaoId) {
  const result = await db.query(
    `
      SELECT *
      FROM acoes
      WHERE id = $1
      LIMIT 1
    `,
    [acaoId]
  );

  return result.rows[0] || null;
}

async function atualizarCampoAcao(acaoId, campo, valor) {
  const camposPermitidos = new Set([
    'nome_acao',
    'comando_texto',
    'tipo_acao',
    'resultado',
    'status',
    'finalizado_em',
  ]);

  if (!camposPermitidos.has(campo)) {
    throw new Error('Campo de ação não permitido.');
  }

  const result = await db.query(
    `
      UPDATE acoes
      SET ${campo} = $1
      WHERE id = $2
      RETURNING *
    `,
    [valor, acaoId]
  );

  return result.rows[0] || null;
}

async function adicionarParticipanteAcao(acaoId, usuario) {
  await db.query(
    `
      INSERT INTO acao_participantes (
        acao_id,
        usuario_id,
        usuario_tag,
        criado_em
      ) VALUES ($1,$2,$3,$4)
      ON CONFLICT (acao_id, usuario_id) DO NOTHING
    `,
    [acaoId, usuario.id, usuario.tag, new Date()]
  );
}

async function removerParticipanteAcao(acaoId, usuarioId) {
  await db.query(
    `
      DELETE FROM acao_participantes
      WHERE acao_id = $1
        AND usuario_id = $2
    `,
    [acaoId, usuarioId]
  );
}

async function buscarParticipantesAcao(acaoId) {
  const result = await db.query(
    `
      SELECT usuario_id, usuario_tag
      FROM acao_participantes
      WHERE acao_id = $1
      ORDER BY criado_em ASC
    `,
    [acaoId]
  );

  return result.rows;
}

async function salvarLavagem(dados) {
  const result = await db.query(
    `
      INSERT INTO lavagens (
        tipo,
        usuario_tag,
        usuario_id,
        quantidade,
        grupo,
        personagem_id,
        taxa_percentual,
        valor_faccao,
        valor_cliente,
        status,
        mensagem_aprovacao_id,
        canal_aprovacao_id,
        criado_em,
        atualizado_em
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
    [
      dados.tipo,
      dados.usuarioTag,
      dados.usuarioId,
      dados.quantidade,
      dados.grupo,
      dados.personagemId,
      dados.taxaPercentual,
      dados.valorFaccao,
      dados.valorCliente,
      dados.status,
      dados.mensagemAprovacaoId || null,
      dados.canalAprovacaoId || null,
      dados.criadoEm,
      dados.atualizadoEm,
    ]
  );

  return result.rows[0];
}

async function atualizarMensagemAprovacaoLavagem(lavagemId, mensagemId, canalId) {
  await db.query(
    `
      UPDATE lavagens
      SET mensagem_aprovacao_id = $1,
          canal_aprovacao_id = $2,
          atualizado_em = $3
      WHERE id = $4
    `,
    [mensagemId, canalId, new Date(), lavagemId]
  );
}

async function buscarLavagemPorId(lavagemId) {
  const result = await db.query(
    `
      SELECT *
      FROM lavagens
      WHERE id = $1
      LIMIT 1
    `,
    [lavagemId]
  );

  return result.rows[0] || null;
}

async function aprovarLavagem(lavagemId, aprovador) {
  const result = await db.query(
    `
      UPDATE lavagens
      SET status = 'aprovada',
          aprovado_por_id = $1,
          aprovado_por_tag = $2,
          atualizado_em = $3
      WHERE id = $4
        AND status = 'pendente'
      RETURNING *
    `,
    [aprovador.id, aprovador.tag, new Date(), lavagemId]
  );

  return result.rows[0] || null;
}

async function removerDadosUsuarioDoBanco(usuarioId) {
  await db.query('BEGIN');

  try {
    await db.query(
      `
        DELETE FROM lavagens
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    await db.query(
      `
        DELETE FROM relatorios_semanais
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    await db.query(
      `
        DELETE FROM registros
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    await db.query(
      `
        DELETE FROM cadastros
        WHERE discord_user_id = $1
      `,
      [usuarioId]
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function recusarLavagem(lavagemId, recusador) {
  const result = await db.query(
    `
      DELETE FROM lavagens
      WHERE id = $1
        AND status = 'pendente'
      RETURNING *
    `,
    [lavagemId]
  );

  const lavagem = result.rows[0] || null;

  if (!lavagem) {
    return null;
  }

  return {
    ...lavagem,
    status: 'recusada',
    recusado_por_id: recusador.id,
    recusado_por_tag: recusador.tag,
  };
}

module.exports = {
  adicionarParticipanteAcao,
  aprovarLavagem,
  atualizarCampoAcao,
  atualizarMensagemAcao,
  atualizarMensagemAprovacaoLavagem,
  buscarAcaoPorId,
  buscarCadastroPorPersonagemId,
  buscarCadastroPorUsuario,
  buscarLavagemPorId,
  buscarParticipantesAcao,
  buscarRegistrosFarmPorUsuario,
  buscarRelatoriosUsuario,
  buscarResumoSemanalGlobal,
  buscarTotalFarmPorUsuario,
  buscarUsuariosComFarm,
  manterUltimos52RelatoriosPorUsuario,
  recusarLavagem,
  removerDadosUsuarioDoBanco,
  removerParticipanteAcao,
  resetarFarmUsuario,
  salvarAcao,
  salvarLavagem,
  salvarOuAtualizarCadastro,
  salvarRegistroBanco,
  salvarRelatorioSemanal,
  validarCadastroExistenteUsuario,
};
