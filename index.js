require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType
} = require('discord.js');

const db = require('./database/db');
const initDatabase = require('./database/init');

initDatabase();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function salvarRegistroBanco(dados) {
  const stmt = db.prepare(`
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
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
  );
}

function listarUltimosRegistros(limite = 10) {
  const stmt = db.prepare(`
    SELECT * FROM registros
    ORDER BY id DESC
    LIMIT ?
  `);

  return stmt.all(limite);
}

function criarPainel() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('🪪 Painel para Membros')
    .setDescription('Selecione abaixo as opções')
    .addFields(
      { name: '🎯 Meta de Farm', value: 'Verifique seu farm semanal' },
      { name: '💰 Registro', value: 'Registrar lavagens' },
      { name: '📦 Registro de Baú', value: 'Controle de itens do baú' }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('farm').setLabel('Ver Farm').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lavagem').setLabel('Lavagem').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('acoes_bau')
      .setPlaceholder('Ações do baú')
      .addOptions(
        { label: 'Retirar', value: 'retirar' },
        { label: 'Adicionar', value: 'adicionar' }
      )
  );

  return { embed, components: [row1, row2] };
}

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'painel') {
      const painel = criarPainel();
      return interaction.reply({
        embeds: [painel.embed],
        components: painel.components,
        ephemeral: true
      });
    }

    if (interaction.commandName === 'registrar') {
      const item = interaction.options.getString('item');
      const quantidade = interaction.options.getInteger('quantidade');
      const foto = interaction.options.getAttachment('foto');
      const link = interaction.options.getString('link');

      const imagem = foto?.url || link;

      const canal = await client.channels.fetch(process.env.CANAL_REGISTROS_ID);

      const embed = new EmbedBuilder()
        .setTitle('📦 Novo registro')
        .addFields(
          { name: 'Item', value: item },
          { name: 'Quantidade', value: String(quantidade) },
          { name: 'Usuário', value: interaction.user.tag }
        )
        .setTimestamp();

      if (imagem) embed.setImage(imagem);

      await canal.send({ embeds: [embed] });

      salvarRegistroBanco({
        tipo: 'registro_item',
        usuarioTag: interaction.user.tag,
        usuarioId: interaction.user.id,
        item,
        quantidade,
        imagem: imagem || null,
        status: 'pendente',
        criadoEm: new Date().toISOString()
      });

      return interaction.reply({
        content: '✅ Registrado com sucesso',
        ephemeral: true
      });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'farm') {
      return interaction.reply({ content: '📊 Sistema de farm', ephemeral: true });
    }

    if (interaction.customId === 'lavagem') {
      return interaction.reply({ content: '💰 Sistema de lavagem', ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu()) {
    const acao = interaction.values[0];

salvarRegistroBanco({
  tipo: 'acao_bau',
  usuarioTag: interaction.user.tag,
  usuarioId: interaction.user.id,
  acao,
  categoria: 'bau',
  status: 'pendente',
  criadoEm: new Date().toISOString()
});

return interaction.reply({
  content: `✅ Ação registrada: ${acao}`,
  ephemeral: true
});
  }
});

client.login(process.env.DISCORD_TOKEN);