const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');

const ITENS = [
  { name: 'Água', value: 'agua' },
  { name: 'Hambúrguer', value: 'hamburguer' },
  { name: 'Pizza', value: 'pizza' },
  { name: 'Chocolate', value: 'chocolate' },
  { name: 'Remédio', value: 'remedio' }
];

const commands = [
  new SlashCommandBuilder()
    .setName('registrar')
    .setDescription('Registra um item com quantidade e foto')
    .addStringOption(option =>
      option.setName('item').setDescription('Item').setRequired(true).addChoices(...ITENS)
    )
    .addIntegerOption(option =>
      option.setName('quantidade').setDescription('Quantidade').setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('foto').setDescription('Foto').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('link').setDescription('Link da imagem').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel central')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('Registrando comandos...');
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log('Comandos registrados.');
  } catch (err) {
    console.error(err);
  }
})();