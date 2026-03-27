require('dotenv').config();

const cron = require('node-cron');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');

const db = require('./database/db');
const initDatabase = require('./database/init');

// `?v=` ajuda a evitar cache antigo da thumbnail no Discord/CDN.
const PAINEL_THUMBNAIL_URL = 'https://i.postimg.cc/jqvvgNnM/screenshot-288.png?v=20260327-1';
const CADASTRO_THUMBNAIL_URL = 'https://i.postimg.cc/jqvvgNnM/screenshot-288.png?v=20260327-1';
const CADASTRO_BANNER_URL = 'attachment://solicite_cadastro.png';
const CADASTRO_MODAL_ID = 'modal_cadastro';
const CADASTRO_BUTTON_ID = 'abrir_cadastro';
const CADASTRO_IMAGE_PATH = 'C:\\Users\\Pc\\Desktop\\Projeto Vsync\\solicite_cadastro.png';
const PAINEL_PRINCIPAL_CANAL_ID = process.env.PAINEL_PRINCIPAL_CANAL_ID || '1487117541838163978';
const CANAL_APROVACAO_LAVAGEM_ID = process.env.CANAL_APROVACAO_LAVAGEM_ID || '1487109511306149918';
const CANAL_REGISTRO_LAVAGEM_ID = process.env.CANAL_REGISTRO_LAVAGEM_ID || '1487109544780763256';
const LAVAGEM_MODAL_PREFIX = 'modal_lavagem_';
const LAVAGEM_APROVAR_PREFIX = 'aprovar_lavagem_';
const LAVAGEM_RECUSAR_PREFIX = 'recusar_lavagem_';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember, Partials.User]
});

/* =========================
   FUNÇÕES DO BANCO
========================= */

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
      dados.criadoEm
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
    [
      usuarioId,
      usuarioTag,
      semanaReferencia,
      totalItens,
      new Date()
    ]
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

  return result.rows.map(row => ({
    usuario_tag: row.usuario_tag,
    usuario_id: row.usuario_id,
    total: Number(row.total || 0)
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
      dados.atualizadoEm
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
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
      dados.atualizadoEm
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

async function apagarCanalPrivadoCadastro(canalId) {
  if (!canalId) {
    return false;
  }

  const canal = await client.channels.fetch(canalId).catch(() => null);

  if (!canal) {
    return false;
  }

  await canal.delete('Usuário saiu do servidor').catch(error => {
    throw error;
  });

  return true;
}

async function moverCanalPrivadoParaCategoriaSaida(guild, canalId) {
  const categoriaSaidaId = process.env.CATEGORIA_SAIDA_CADASTRO_ID || null;

  if (!canalId || !categoriaSaidaId) {
    return false;
  }

  const canal = await guild.channels.fetch(canalId).catch(() => null);

  if (!canal) {
    return false;
  }

  await canal.edit({
    parent: categoriaSaidaId
  });

  return true;
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

  if (!result.rows[0]) {
    return null;
  }

  return {
    ...result.rows[0],
    recusado_por_id: recusador.id,
    recusado_por_tag: recusador.tag,
    status: 'recusada'
  };
}

function normalizarEspacos(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

function capitalizarNomePersonagem(nome) {
  return normalizarEspacos(nome)
    .split(' ')
    .filter(Boolean)
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

function sanitizarNomeCanal(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function gerarNomeCanalCadastro(nomeFormatado, personagemId) {
  return `${sanitizarNomeCanal(nomeFormatado)}-${personagemId}`.slice(0, 100);
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(valor || 0));
}

function obterConfigLavagem(tipo) {
  if (tipo === 'parceria') {
    return {
      tipo,
      titulo: 'Lavagem Parceria',
      taxaPercentual: 20,
      cor: 0x2f3136
    };
  }

  return {
    tipo: 'pista',
    titulo: 'Lavagem Pista',
    taxaPercentual: 30,
    cor: 0x2f3136
  };
}

function calcularValoresLavagem(quantidade, taxaPercentual) {
  const valorTotal = Number(quantidade);
  const valorFaccao = Math.floor((valorTotal * taxaPercentual) / 100);
  const valorCliente = valorTotal - valorFaccao;

  return {
    valorTotal,
    valorFaccao,
    valorCliente
  };
}

function criarModalLavagem(tipo) {
  const config = obterConfigLavagem(tipo);
  const modal = new ModalBuilder()
    .setCustomId(`${LAVAGEM_MODAL_PREFIX}${config.tipo}`)
    .setTitle(config.titulo);

  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade')
    .setLabel('Quantidade para lavar')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: 1000000')
    .setMaxLength(12);

  const grupoInput = new TextInputBuilder()
    .setCustomId('grupo')
    .setLabel('Grupo')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: Grupo Norte')
    .setMaxLength(60);

  const personagemIdInput = new TextInputBuilder()
    .setCustomId('personagem_id')
    .setLabel('ID do personagem que está lavando')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: 6001')
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidadeInput),
    new ActionRowBuilder().addComponents(grupoInput),
    new ActionRowBuilder().addComponents(personagemIdInput)
  );

  return modal;
}

function criarEmbedAprovacaoLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(`Aprovação Pendente • ${config.titulo}`)
    .setDescription('Avalie a solicitação abaixo.')
    .addFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Taxa da Facção', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.criado_em));
}

function criarBotoesAprovacaoLavagem(lavagemId, desabilitado = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${LAVAGEM_APROVAR_PREFIX}${lavagemId}`)
        .setLabel('Aprovar')
        .setStyle(ButtonStyle.Success)
        .setDisabled(desabilitado),
      new ButtonBuilder()
        .setCustomId(`${LAVAGEM_RECUSAR_PREFIX}${lavagemId}`)
        .setLabel('Recusar')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(desabilitado)
    )
  ];
}

function criarEmbedRegistroLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(config.titulo)
    .setDescription('Lavagem aprovada e contabilizada com sucesso.')
    .addFields(
      { name: 'Solicitante', value: `<@${lavagem.usuario_id}>`, inline: false },
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'ID do Personagem', value: lavagem.personagem_id, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Taxa da Facção', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_tag || 'Não informado', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.atualizado_em || lavagem.criado_em));
}

function criarEmbedAprovacaoLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(`Aprovação Pendente • ${config.titulo}`)
    .setDescription('Avalie a solicitação abaixo.')
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.criado_em));
}

function criarEmbedRegistroLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(config.titulo)
    .setDescription('Lavagem aprovada e contabilizada com sucesso.')
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.atualizado_em || lavagem.criado_em));
}

async function processarModalLavagem(interaction, tipo) {
  const config = obterConfigLavagem(tipo);
  const quantidadeTexto = interaction.fields.getTextInputValue('quantidade').trim();
  const grupo = normalizarEspacos(interaction.fields.getTextInputValue('grupo'));
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();

  if (!/^\d+$/.test(quantidadeTexto)) {
    return interaction.reply({
      content: 'A quantidade para lavar deve conter apenas números inteiros.',
      ephemeral: true
    });
  }

  if (!/^\d+$/.test(personagemId)) {
    return interaction.reply({
      content: 'O ID do personagem deve conter apenas números.',
      ephemeral: true
    });
  }

  if (!grupo || grupo.length < 2) {
    return interaction.reply({
      content: 'Informe um grupo válido.',
      ephemeral: true
    });
  }

  const quantidade = Number(quantidadeTexto);

  if (quantidade <= 0) {
    return interaction.reply({
      content: 'A quantidade para lavar deve ser maior que zero.',
      ephemeral: true
    });
  }

  const valores = calcularValoresLavagem(quantidade, config.taxaPercentual);
  await interaction.deferReply({ ephemeral: true });

  const lavagem = await salvarLavagem({
    tipo: config.tipo,
    usuarioTag: interaction.user.tag,
    usuarioId: interaction.user.id,
    quantidade: valores.valorTotal,
    grupo,
    personagemId,
    taxaPercentual: config.taxaPercentual,
    valorFaccao: valores.valorFaccao,
    valorCliente: valores.valorCliente,
    status: 'pendente',
    criadoEm: new Date(),
    atualizadoEm: new Date()
  });

  const canalAprovacao = await client.channels.fetch(CANAL_APROVACAO_LAVAGEM_ID).catch(() => null);

  if (!canalAprovacao || canalAprovacao.type !== ChannelType.GuildText) {
    throw new Error('Canal de aprovação de lavagem não encontrado ou inválido.');
  }

  const mensagemAprovacao = await canalAprovacao.send({
    embeds: [criarEmbedAprovacaoLavagem(lavagem)],
    components: criarBotoesAprovacaoLavagem(lavagem.id)
  });

  await atualizarMensagemAprovacaoLavagem(lavagem.id, mensagemAprovacao.id, canalAprovacao.id);

  return interaction.editReply({
    content: `${config.titulo} enviada para aprovação com sucesso.`
  });
}

async function finalizarLavagem(interaction, lavagemId, acao) {
  const lavagem = await buscarLavagemPorId(lavagemId);

  if (!lavagem) {
    return interaction.reply({
      content: 'Não encontrei essa solicitação de lavagem.',
      ephemeral: true
    });
  }

  if (lavagem.status !== 'pendente') {
    return interaction.reply({
      content: `Essa lavagem já foi ${lavagem.status}.`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const lavagemAtualizada = acao === 'aprovar'
    ? await aprovarLavagem(lavagemId, interaction.user)
    : await recusarLavagem(lavagemId, interaction.user);

  if (!lavagemAtualizada) {
    return interaction.editReply({
      content: 'Essa lavagem já foi processada por outra pessoa.'
    });
  }

  const embedAtualizado = criarEmbedAprovacaoLavagem(lavagemAtualizada)
    .setDescription(
      acao === 'aprovar'
        ? `Solicitação aprovada por <@${interaction.user.id}>.`
        : `Solicitação recusada por <@${interaction.user.id}>.`
    )
    .spliceFields(7, 1, {
      name: 'Status',
      value: acao === 'aprovar' ? 'Aprovada' : 'Recusada',
      inline: true
    });

  await interaction.message.edit({
    embeds: [embedAtualizado],
    components: criarBotoesAprovacaoLavagem(lavagemId, true)
  });

  if (acao === 'aprovar') {
    const canalRegistro = await client.channels.fetch(CANAL_REGISTRO_LAVAGEM_ID).catch(() => null);

    if (!canalRegistro || canalRegistro.type !== ChannelType.GuildText) {
      throw new Error('Canal de registro de lavagem não encontrado ou inválido.');
    }

    await canalRegistro.send({
      embeds: [criarEmbedRegistroLavagem(lavagemAtualizada)]
    });
  }

  return interaction.editReply({
    content: acao === 'aprovar'
      ? 'Lavagem aprovada e registrada com sucesso.'
      : 'Lavagem recusada com sucesso.'
  });
}

function criarModalCadastro() {
  const modal = new ModalBuilder()
    .setCustomId(CADASTRO_MODAL_ID)
    .setTitle('Cadastro VSYNC');

  const nomeInput = new TextInputBuilder()
    .setCustomId('personagem_nome')
    .setLabel('Nome do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setPlaceholder('Ex.: Caruso Scofield');

  const idInput = new TextInputBuilder()
    .setCustomId('personagem_id')
    .setLabel('ID do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10)
    .setPlaceholder('Ex.: 6001');

  modal.addComponents(
    new ActionRowBuilder().addComponents(nomeInput),
    new ActionRowBuilder().addComponents(idInput)
  );

  return modal;
}

function criarPainelCadastro() {
  const possuiBannerLocal = fs.existsSync(CADASTRO_IMAGE_PATH);
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Registro no Discord')
    .setDescription([
      'Faça seu registro corretamente e aguarde a aprovação da gerência.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '**Registro Facção**',
      '',
      '• Clique nas opções abaixo para fazer seu registro dentro do Discord.',
      '• Um canal privado exclusivo será criado só para você e a gerência.',
      '• Nesse canal você poderá tirar dúvidas, resolver pendências e registrar farm.'
    ].join('\n'))
    .setThumbnail(CADASTRO_THUMBNAIL_URL)
    .setFooter({ text: 'VSYNC • Painel de Cadastro' })
    .setTimestamp();

  if (possuiBannerLocal) {
    embed.setImage(CADASTRO_BANNER_URL);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CADASTRO_BUTTON_ID)
      .setLabel('Registro no Discord')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🪪')
  );

  return {
    embed,
    components: [row]
  };
}

function obterArquivosPainelCadastro() {
  if (!fs.existsSync(CADASTRO_IMAGE_PATH)) {
    return [];
  }

  return [new AttachmentBuilder(CADASTRO_IMAGE_PATH)];
}

async function criarOuAtualizarCanalCadastro(guild, membro, nomeFormatado, personagemId) {
  const categoriaId = process.env.CATEGORIA_CADASTRO_ID || null;
  const cargoGerenciaId = process.env.CARGO_GERENCIA_ID || null;
  const nomeCanal = gerarNomeCanalCadastro(nomeFormatado, personagemId);
  const cadastroExistente = await buscarCadastroPorUsuario(membro.id);
  let canal = null;

  if (cadastroExistente?.canal_id) {
    canal = await guild.channels.fetch(cadastroExistente.canal_id).catch(() => null);
  }

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: membro.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (cargoGerenciaId) {
    permissionOverwrites.push({
      id: cargoGerenciaId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  if (canal) {
    const canalEditData = {
      name: nomeCanal,
      permissionOverwrites,
      topic: `Cadastro de ${nomeFormatado} | ${personagemId}`
    };

    if (categoriaId) {
      canalEditData.parent = categoriaId;
    }

    await canal.edit(canalEditData);

    return canal;
  }

  const canalCreateData = {
    name: nomeCanal,
    type: ChannelType.GuildText,
    topic: `Cadastro de ${nomeFormatado} | ${personagemId}`,
    permissionOverwrites
  };

  if (categoriaId) {
    canalCreateData.parent = categoriaId;
  }

  return guild.channels.create(canalCreateData);
}

async function processarCadastro(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'Esse cadastro só pode ser feito dentro do servidor.',
      ephemeral: true
    });
  }

  const nomeBruto = interaction.fields.getTextInputValue('personagem_nome');
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();
  const nomeFormatado = capitalizarNomePersonagem(nomeBruto);

  if (!nomeFormatado || nomeFormatado.length < 3) {
    return interaction.reply({
      content: 'Informe um nome de personagem válido.',
      ephemeral: true
    });
  }

  if (!/^\d+$/.test(personagemId)) {
    return interaction.reply({
      content: 'O ID do personagem deve conter apenas números.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const membro = await guild.members.fetch(interaction.user.id);
  const apelido = `${nomeFormatado} | ${personagemId}`;
  const canal = await criarOuAtualizarCanalCadastro(guild, membro, nomeFormatado, personagemId);

  await membro.setNickname(apelido).catch(error => {
    console.error(`Não foi possível alterar o apelido de ${interaction.user.tag}:`, error);
  });

  if (process.env.CARGO_CADASTRADO_ID) {
    await membro.roles.add(process.env.CARGO_CADASTRADO_ID).catch(error => {
      console.error(`Falha ao adicionar cargo de cadastro para ${interaction.user.tag}:`, error);
    });
  }

  await salvarOuAtualizarCadastro({
    discordUserId: interaction.user.id,
    discordTag: interaction.user.tag,
    guildId: guild.id,
    personagemNome: nomeBruto.trim(),
    personagemNomeFormatado: nomeFormatado,
    personagemId,
    nicknameAplicado: apelido,
    canalId: canal.id,
    canalNome: canal.name,
    criadoEm: new Date(),
    atualizadoEm: new Date()
  });

  const embedCanal = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Cadastro Recebido')
    .setDescription([
      `Bem-vindo, <@${interaction.user.id}>.`,
      '',
      `**Personagem:** ${nomeFormatado}`,
      `**ID:** ${personagemId}`,
      '',
      'Use este canal para falar com a gerência, tirar dúvidas e acompanhar seu processo.'
    ].join('\n'))
    .setTimestamp();

  await canal.send({ content: `<@${interaction.user.id}>`, embeds: [embedCanal] });

  return interaction.editReply({
    content: `Cadastro concluído com sucesso. Seu canal foi criado em <#${canal.id}>.`
  });
}

/* =========================
   FUNÇÕES DE RELATÓRIO
========================= */

function gerarSemanaReferencia() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

async function processarRelatorioSemanal() {
  const usuarios = await buscarUsuariosComFarm();
  const semana = gerarSemanaReferencia();

  for (const usuario of usuarios) {
    const total = await buscarTotalFarmPorUsuario(usuario.usuario_id);

    if (!total || total <= 0) {
      continue;
    }

    await salvarRelatorioSemanal(
      usuario.usuario_id,
      usuario.usuario_tag,
      semana,
      total
    );

    await manterUltimos52RelatoriosPorUsuario(usuario.usuario_id);
    await resetarFarmUsuario(usuario.usuario_id);
  }

  console.log(`✅ Relatório semanal processado em ${new Date().toISOString()}`);
}

/* =========================
   PAINEL
========================= */

function criarPainel() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('🪪 Painel para Membros')
    .setDescription([
      'Selecione abaixo as opções disponíveis.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '**🎯 Meta de Farm**',
      'Verifique como está o andamento do seu farm semanal.',
      '',
      '**💰 Registro**',
      'Notifique suas lavagens e peça para a gerência aprovar sua lavagem.'
    ].join('\n'))
    .setThumbnail(PAINEL_THUMBNAIL_URL)
    .setFooter({ text: 'VSYNC • Painel Central' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('farm')
      .setLabel('Verifique seu Farm')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📑')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lavagem_parceria')
      .setLabel('Lavagem Parceria')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💲'),
    new ButtonBuilder()
      .setCustomId('lavagem_pista')
      .setLabel('Lavagem Pista')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💲')
  );

  return {
    embed,
    components: [row1, row2]
  };
}

async function publicarOuAtualizarPainelPrincipal() {
  if (!PAINEL_PRINCIPAL_CANAL_ID) {
    return;
  }

  const painel = criarPainel();
  const canal = await client.channels.fetch(PAINEL_PRINCIPAL_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel principal nÃ£o encontrado ou invÃ¡lido.');
    return;
  }

  const mensagens = await canal.messages.fetch({ limit: 20 });
  const mensagemExistente = mensagens.find(message =>
    message.author.id === client.user.id &&
    message.embeds.some(embed => embed.title === painel.embed.data.title)
  );

  if (mensagemExistente) {
    await mensagemExistente.edit({
      embeds: [painel.embed],
      components: painel.components
    });
    return;
  }

  await canal.send({
    embeds: [painel.embed],
    components: painel.components
  });
}

async function startBot() {
  try {
    await testarConexaoBanco();
    await initDatabase();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

/* =========================
   BOT READY
========================= */

console.log('Evento ready foi registrado.');

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log('[startup] Intents ativos: Guilds, GuildMembers');
});

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);

  cron.schedule(
    '0 0 * * 1',
    async () => {
      try {
        await processarRelatorioSemanal();
      } catch (error) {
        console.error('Erro ao processar cron semanal:', error);
      }
    },
    {
      timezone: 'America/Sao_Paulo'
    }
  );

  publicarOuAtualizarPainelPrincipal().catch(error => {
    console.error('Erro ao publicar o painel principal persistente:', error);
  });
});

client.on('guildMemberRemove', async member => {
  try {
    console.log(`[guildMemberRemove] Saída detectada: ${member.user.tag} (${member.id})`);

    const cadastroUsuario = await buscarCadastroPorUsuario(member.id);

    if (cadastroUsuario) {
      console.log(
        `[guildMemberRemove] Cadastro encontrado para ${member.user.tag} (${member.id}). Canal privado: ${cadastroUsuario.canal_id || 'nenhum'}`
      );

      if (cadastroUsuario.canal_id) {
        const canalMovido = await moverCanalPrivadoParaCategoriaSaida(member.guild, cadastroUsuario.canal_id).catch(error => {
          console.error(
            `[guildMemberRemove] Falha ao mover o canal privado ${cadastroUsuario.canal_id} de ${member.user.tag} (${member.id}) para a categoria de saída:`,
            error
          );
          return false;
        });

        if (canalMovido) {
          console.log(
            `[guildMemberRemove] Canal privado ${cadastroUsuario.canal_id} movido para a categoria de saída para ${member.user.tag} (${member.id}).`
          );
        } else {
          console.log(
            `[guildMemberRemove] Canal privado ${cadastroUsuario.canal_id} não encontrado para ${member.user.tag} (${member.id}).`
          );
        }
      }
    } else {
      console.log(`[guildMemberRemove] Nenhum cadastro encontrado para ${member.user.tag} (${member.id}).`);
    }
  } catch (error) {
    console.error(`[guildMemberRemove] Erro ao processar saída de ${member.user.tag} (${member.id}):`, error);
  }
});

/* =========================
   INTERAÇÕES
========================= */

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel_cadastro') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({
            content: 'Você não tem permissão para publicar o painel de cadastro.',
            ephemeral: true
          });
        }

        const painelCadastro = criarPainelCadastro();
        const arquivos = obterArquivosPainelCadastro();

        await interaction.channel.send({
          embeds: [painelCadastro.embed],
          components: painelCadastro.components,
          files: arquivos
        });

        return interaction.reply({
          content: 'Painel de cadastro publicado neste canal.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'painel') {
        const painel = criarPainel();
        return interaction.reply({
          embeds: [painel.embed],
          components: painel.components,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'registrar_farm') {
        const item = interaction.options.getString('item', true);
        const quantidade = interaction.options.getInteger('quantidade', true);
        const foto = interaction.options.getAttachment('foto');
        const link = interaction.options.getString('link');
        const cadastroUsuario = await buscarCadastroPorUsuario(interaction.user.id);

        const imagem = foto?.url || link || null;

        const canal = await client.channels.fetch(process.env.CANAL_REGISTROS_ID);

        if (!canal) {
          return interaction.reply({
            content: 'Não encontrei o canal de registros.',
            ephemeral: true
          });
        }

        if (
          canal.type !== ChannelType.GuildText &&
          canal.type !== ChannelType.PublicThread &&
          canal.type !== ChannelType.PrivateThread
        ) {
          return interaction.reply({
            content: 'O canal configurado não é um canal de texto válido.',
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📦 Novo registro de farm')
          .addFields(
            { name: 'Item', value: item, inline: true },
            { name: 'Quantidade', value: String(quantidade), inline: true },
            { name: 'Usuário', value: `<@${interaction.user.id}>`, inline: false }
          )
          .setTimestamp();

        if (imagem) {
          embed.setImage(imagem);
        }

        await canal.send({ embeds: [embed] });

        if (cadastroUsuario?.canal_id) {
          const canalPrivado = await client.channels.fetch(cadastroUsuario.canal_id).catch(() => null);

          if (
            canalPrivado &&
            (
              canalPrivado.type === ChannelType.GuildText ||
              canalPrivado.type === ChannelType.PublicThread ||
              canalPrivado.type === ChannelType.PrivateThread
            )
          ) {
            await canalPrivado.send({ embeds: [embed] }).catch(error => {
              console.error(`Falha ao enviar registro de farm para o canal privado de ${interaction.user.tag}:`, error);
            });
          }
        }

        await salvarRegistroBanco({
          tipo: 'farm',
          usuarioTag: interaction.user.tag,
          usuarioId: interaction.user.id,
          item,
          quantidade,
          imagem,
          categoria: 'farm',
          status: 'registrado',
          criadoEm: new Date()
        });

        return interaction.reply({
          content: '✅ Farm registrado com sucesso.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'relatorio_semanal') {
        const relatorios = await buscarRelatoriosUsuario(interaction.user.id);

        if (!relatorios.length) {
          return interaction.reply({
            content: 'Você não possui relatórios ainda.',
            ephemeral: true
          });
        }

        const descricao = relatorios
          .map(r => `📅 **Semana:** ${r.semana_referencia}\n📦 **Total:** ${r.total_itens}`)
          .join('\n\n');

        const embed = new EmbedBuilder()
          .setTitle('📊 Relatório Semanal')
          .setDescription(descricao.slice(0, 4000))
          .addFields({
            name: 'Usuário',
            value: `<@${interaction.user.id}>`,
            inline: false
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'relatorio_global') {
        const dados = await buscarResumoSemanalGlobal();

        if (!dados.length) {
          return interaction.reply({
            content: 'Nenhum farm registrado ainda.',
            ephemeral: true
          });
        }

        const descricao = dados
          .map(user => `👤 <@${user.usuario_id}>: **${user.total}**`)
          .join('\n');

        const totalGeral = dados.reduce((acc, user) => acc + user.total, 0);

        const embed = new EmbedBuilder()
          .setTitle('📊 Relatório Global da Semana')
          .setDescription(descricao)
          .addFields({
            name: 'Total Geral',
            value: String(totalGeral),
            inline: false
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'testar_relatorio') {
        await processarRelatorioSemanal();

        return interaction.reply({
          content: '✅ Relatório semanal executado manualmente para teste.',
          ephemeral: true
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === CADASTRO_MODAL_ID) {
        return processarCadastro(interaction);
      }

      if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}parceria`) {
        return processarModalLavagem(interaction, 'parceria');
      }

      if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}pista`) {
        return processarModalLavagem(interaction, 'pista');
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === CADASTRO_BUTTON_ID) {
        return interaction.showModal(criarModalCadastro());
      }

      if (interaction.customId === 'lavagem_parceria') {
        return interaction.showModal(criarModalLavagem('parceria'));
      }

      if (interaction.customId === 'lavagem_pista') {
        return interaction.showModal(criarModalLavagem('pista'));
      }

      if (interaction.customId.startsWith(LAVAGEM_APROVAR_PREFIX)) {
        const lavagemId = Number(interaction.customId.slice(LAVAGEM_APROVAR_PREFIX.length));
        return finalizarLavagem(interaction, lavagemId, 'aprovar');
      }

      if (interaction.customId.startsWith(LAVAGEM_RECUSAR_PREFIX)) {
        const lavagemId = Number(interaction.customId.slice(LAVAGEM_RECUSAR_PREFIX.length));
        return finalizarLavagem(interaction, lavagemId, 'recusar');
      }

      if (interaction.customId === 'farm' || interaction.customId === 'painel_farm') {
        const registros = await buscarRegistrosFarmPorUsuario(interaction.user.id);

        if (!registros.length) {
          return interaction.reply({
            content: 'Você ainda não possui farms registrados.',
            ephemeral: true
          });
        }

        const agrupado = {};

        for (const registro of registros) {
          const item = registro.item || 'Sem item';
          const quantidade = Number(registro.quantidade || 0);

          if (!agrupado[item]) {
            agrupado[item] = 0;
          }

          agrupado[item] += quantidade;
        }

        const descricao = Object.entries(agrupado)
          .map(([item, total]) => `📦 **${item}**: \`${total}\``)
          .join('\n');

        const totalQuantidade = Object.values(agrupado)
          .reduce((acc, val) => acc + Number(val), 0);

        const embed = new EmbedBuilder()
          .setTitle('📊 Seu Farm')
          .setDescription(descricao)
          .addFields(
            { name: 'Usuário', value: `<@${interaction.user.id}>`, inline: false },
            { name: 'Total de registros', value: String(registros.length), inline: true },
            { name: 'Quantidade total', value: String(totalQuantidade), inline: true }
          )
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.customId === 'lavagem') {
        return interaction.reply({
          content: '💰 Sistema de lavagem',
          ephemeral: true
        });
      }

    }
  } catch (error) {
    console.error('Erro na interação:', error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: 'Ocorreu um erro ao processar esta ação.',
        ephemeral: true
      });
    }
  }
});

/* =========================
   INICIALIZAÇÃO
========================= */
async function testarConexaoBanco() {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Banco conectado com sucesso:', result.rows[0]);
  } catch (error) {
    console.error('❌ Erro ao conectar no banco:', error);
    throw error;
  }
}

async function startBot() {
  try {
    console.log('1. Iniciando bot...');
    
    console.log('2. Testando conexão com banco...');
    const teste = await db.query('SELECT NOW() AS agora');
    console.log('3. Banco conectado:', teste.rows[0]);

    console.log('4. Inicializando tabelas...');
    await initDatabase();
    console.log('5. Tabelas inicializadas.');

    console.log('6. Fazendo login no Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('7. Login enviado ao Discord.');
  } catch (error) {
    console.error('❌ Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

startBot();
