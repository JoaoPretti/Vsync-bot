const fs = require('fs');
const path = require('path');
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

const config = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const arquivo = path.join(__dirname, 'registros.json');

function salvarRegistro(dados) {
  let registros = [];
  if (fs.existsSync(arquivo)) {
    registros = JSON.parse(fs.readFileSync(arquivo, 'utf8') || '[]');
  }
  registros.push(dados);
  fs.writeFileSync(arquivo, JSON.stringify(registros, null, 2));
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

      const canal = await client.channels.fetch(config.canalRegistrosId);

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

      salvarRegistro({
        item,
        quantidade,
        usuario: interaction.user.tag,
        imagem,
        data: new Date()
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
    return interaction.reply({
      content: `Ação escolhida: ${interaction.values[0]}`,
      ephemeral: true
    });
  }
});

client.login(config.token);