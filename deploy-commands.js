require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const ITENS = [
  { name: 'Água', value: 'agua' },
  { name: 'Hambúrguer', value: 'hamburguer' },
  { name: 'Pizza', value: 'pizza' },
  { name: 'Chocolate', value: 'chocolate' },
  { name: 'Remédio', value: 'remedio' }
];

const commands = [
  new SlashCommandBuilder()
    .setName('registrar_farm')
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
    .setDescription('Abre o painel central'),

  new SlashCommandBuilder()
    .setName('painel_cadastro')
    .setDescription('Publica o painel persistente de cadastro neste canal'),

  new SlashCommandBuilder()
    .setName('painel_acoes')
    .setDescription('Publica o painel de controle de ações neste canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('editar_cadastro')
    .setDescription('Edita o cadastro de um membro')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('usuario').setDescription('Membro que terá o cadastro editado').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('nome').setDescription('Novo nome do personagem').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('id').setDescription('Novo ID do personagem').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('relatorio_semanal')
    .setDescription('Mostra seus relatórios semanais'),

  new SlashCommandBuilder()
    .setName('testar_relatorio')
    .setDescription('Executa manualmente o relatório semanal para teste'),

  new SlashCommandBuilder()
  .setName('relatorio_global')
  .setDescription('Mostra o relatório geral da semana')
].map(cmd => cmd.toJSON());


const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando comandos...');
    await rest.put(
      Routes.applicationGuildCommands(
  process.env.CLIENT_ID,
  process.env.GUILD_ID
),
      { body: commands }
    );
    console.log('Comandos registrados.');
  } catch (err) {
    console.error(err);
  }
})();
