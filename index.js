require('dotenv').config();

const cron = require('node-cron');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
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

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
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
      'Notifique suas lavagens e peça para a gerência aprovar sua lavagem.',
      '',
      '**📦 Registro de Baú**',
      'Abra o painel do baú para registrar retirada e entrada.'
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

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ver_todos_itens')
      .setLabel('Ver todos itens')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('abrir_bau')
      .setLabel('Abrir Painel do Baú')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📦')
  );

  return {
    embed,
    components: [row1, row2, row3]
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

function criarPainelBau() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('📦 Painel do Baú')
    .setDescription([
      'Selecione a ação desejada abaixo.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '🔫 **Armamento e Munições**',
      '🧰 **Itens de Roubo**',
      '🌿 **Drogas**',
      '🎒 **Itens Pessoais**'
    ].join('\n'))
    .setFooter({ text: 'VSYNC • Painel do Baú' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_retirar_bau')
      .setLabel('Retirar')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖'),
    new ButtonBuilder()
      .setCustomId('menu_adicionar_bau')
      .setLabel('Adicionar')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('voltar_painel')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );

  return {
    embed,
    components: [row1, row2]
  };
}

function criarMenuRetirarBau() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('➖ Retirar do Baú')
    .setDescription('Selecione a categoria que deseja retirar.')
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_retirar_bau')
      .setPlaceholder('Escolha uma categoria')
      .addOptions(
        {
          label: 'Armamento e Munições',
          value: 'retirar_armamento',
          description: 'Registrar retirada de armamento'
        },
        {
          label: 'Itens de Roubo',
          value: 'retirar_roubo',
          description: 'Registrar retirada de itens de roubo'
        },
        {
          label: 'Drogas',
          value: 'retirar_drogas',
          description: 'Registrar retirada de drogas'
        },
        {
          label: 'Itens Pessoais',
          value: 'retirar_pessoais',
          description: 'Registrar retirada de itens pessoais'
        }
      )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_bau')
      .setLabel('Voltar ao Baú')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );

  return {
    embed,
    components: [row1, row2]
  };
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

function criarMenuAdicionarBau() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('➕ Adicionar ao Baú')
    .setDescription('Selecione a categoria que deseja adicionar.')
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_adicionar_bau')
      .setPlaceholder('Escolha uma categoria')
      .addOptions(
        {
          label: 'Armamento e Munições',
          value: 'adicionar_armamento',
          description: 'Registrar entrada de armamento'
        },
        {
          label: 'Itens de Roubo',
          value: 'adicionar_roubo',
          description: 'Registrar entrada de itens de roubo'
        },
        {
          label: 'Drogas',
          value: 'adicionar_drogas',
          description: 'Registrar entrada de drogas'
        },
        {
          label: 'Itens Pessoais',
          value: 'adicionar_pessoais',
          description: 'Registrar entrada de itens pessoais'
        }
      )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_bau')
      .setLabel('Voltar ao Baú')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );

  return {
    embed,
    components: [row1, row2]
  };
}

/* =========================
   BOT READY
========================= */

console.log('Evento ready foi registrado.');

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
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
    }

    if (interaction.isButton()) {
      if (interaction.customId === CADASTRO_BUTTON_ID) {
        return interaction.showModal(criarModalCadastro());
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

      if (interaction.customId === 'abrir_bau') {
        const painelBau = criarPainelBau();

        return interaction.reply({
          embeds: [painelBau.embed],
          components: painelBau.components,
          ephemeral: true
        });
      }

      if (interaction.customId === 'voltar_painel') {
        const painel = criarPainel();

        return interaction.reply({
          embeds: [painel.embed],
          components: painel.components,
          ephemeral: true
        });
      }

      if (interaction.customId === 'menu_retirar_bau') {
        const menu = criarMenuRetirarBau();

        return interaction.reply({
          embeds: [menu.embed],
          components: menu.components,
          ephemeral: true
        });
      }

      if (interaction.customId === 'menu_adicionar_bau') {
        const menu = criarMenuAdicionarBau();

        return interaction.reply({
          embeds: [menu.embed],
          components: menu.components,
          ephemeral: true
        });
      }

      if (
        interaction.customId === 'lavagem_parceria' ||
        interaction.customId === 'lavagem_pista' ||
        interaction.customId === 'ver_todos_itens'
      ) {
        return interaction.reply({
          content: 'Essa função ainda será implementada.',
          ephemeral: true
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const acao = interaction.values[0];

      if (
        interaction.customId === 'select_retirar_bau' ||
        interaction.customId === 'select_adicionar_bau'
      ) {
        await salvarRegistroBanco({
          tipo: 'acao_bau',
          usuarioTag: interaction.user.tag,
          usuarioId: interaction.user.id,
          acao,
          categoria: 'bau',
          status: 'pendente',
          criadoEm: new Date()
        });

        return interaction.reply({
          content: `✅ Ação registrada: ${acao}`,
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
