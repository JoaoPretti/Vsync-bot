const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
} = require('discord.js');

const {
  CADASTRO_BUTTON_ID,
  CADASTRO_MODAL_ID,
  CADASTRO_THUMBNAIL_URL,
} = require('../config/constants');
const {
  buscarCadastroPorPersonagemId,
  buscarCadastroPorUsuario,
  salvarOuAtualizarCadastro,
  validarCadastroExistenteUsuario,
} = require('../repositories');
const { capitalizarNomePersonagem, gerarNomeCanalCadastro } = require('../utils');

async function validarPersonagemIdDisponivel(personagemId, discordUserId) {
  const cadastroExistente = await buscarCadastroPorPersonagemId(personagemId);

  if (cadastroExistente && cadastroExistente.discord_user_id !== discordUserId) {
    return cadastroExistente;
  }

  return null;
}

function criarModalCadastro() {
  const modal = new ModalBuilder().setCustomId(CADASTRO_MODAL_ID).setTitle('Cadastro VSYNC');

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
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CADASTRO_BUTTON_ID)
      .setLabel('Iniciar cadastro')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🪪')
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              '## Central de cadastro',
              'Inicie seu registro e acompanhe todo o processo em um canal privado.',
            ].join('\n')
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(CADASTRO_THUMBNAIL_URL).setDescription('VSYNC')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '**Fluxo de cadastro**',
          '- Clique no botao abaixo para abrir o formulario.',
          '- Um canal privado sera criado apenas para voce e a gerencia.',
          '- Use esse canal para tirar duvidas, resolver pendencias e registrar seu farm.',
        ].join('\n')
      )
    )
    .addActionRowComponents(row);

  return {
    identificador: 'painel_cadastro_v2',
    content: null,
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
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
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: membro.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  if (cargoGerenciaId) {
    permissionOverwrites.push({
      id: cargoGerenciaId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  if (canal) {
    const canalEditData = {
      name: nomeCanal,
      permissionOverwrites,
      topic: `Cadastro de ${nomeFormatado} | ${personagemId}`,
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
    permissionOverwrites,
  };

  if (categoriaId) {
    canalCreateData.parent = categoriaId;
  }

  return guild.channels.create(canalCreateData);
}

async function aplicarCadastroUsuario(guild, user, nomeBruto, personagemId, opcoes = {}) {
  const { permitirEdicao = false } = opcoes;
  const nomeFormatado = capitalizarNomePersonagem(nomeBruto);

  if (!nomeFormatado || nomeFormatado.length < 3) {
    throw new Error('Informe um nome de personagem valido.');
  }

  if (!/^\d+$/.test(personagemId)) {
    throw new Error('O ID do personagem deve conter apenas numeros.');
  }

  await validarCadastroExistenteUsuario(user.id, { permitirEdicao });

  const conflitoCadastro = await validarPersonagemIdDisponivel(personagemId, user.id);

  if (conflitoCadastro) {
    throw new Error(`O ID ${personagemId} ja esta cadastrado para outro usuario.`);
  }

  const membro = await guild.members.fetch(user.id);
  const apelido = `${nomeFormatado} | ${personagemId}`;
  const canal = await criarOuAtualizarCanalCadastro(guild, membro, nomeFormatado, personagemId);

  await membro.setNickname(apelido).catch((error) => {
    console.error(`Nao foi possivel alterar o apelido de ${user.tag}:`, error);
  });

  if (process.env.CARGO_CADASTRADO_ID) {
    await membro.roles.add(process.env.CARGO_CADASTRADO_ID).catch((error) => {
      console.error(`Falha ao adicionar cargo de cadastro para ${user.tag}:`, error);
    });
  }

  await salvarOuAtualizarCadastro({
    discordUserId: user.id,
    discordTag: user.tag,
    guildId: guild.id,
    personagemNome: nomeBruto.trim(),
    personagemNomeFormatado: nomeFormatado,
    personagemId,
    nicknameAplicado: apelido,
    canalId: canal.id,
    canalNome: canal.name,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });

  return {
    nomeFormatado,
    personagemId,
    apelido,
    canal,
  };
}

async function enviarMensagemCanalCadastro(
  canal,
  usuarioId,
  nomeFormatado,
  personagemId,
  {
    titulo = 'Cadastro Recebido',
    descricaoFinal = 'Use este canal para falar com a gerencia, tirar duvidas e acompanhar seu processo.',
  } = {}
) {
  const embedCanal = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(titulo)
    .setDescription(
      [
        `Bem-vindo, <@${usuarioId}>.`,
        '',
        `**Personagem:** ${nomeFormatado}`,
        `**ID:** ${personagemId}`,
        '',
        descricaoFinal,
      ].join('\n')
    )
    .setTimestamp();

  await canal.send({ content: `<@${usuarioId}>`, embeds: [embedCanal] });
}

async function processarCadastro(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'Esse cadastro so pode ser feito dentro do servidor.',
      ephemeral: true,
    });
  }

  const nomeBruto = interaction.fields.getTextInputValue('personagem_nome');
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();

  await interaction.deferReply({ ephemeral: true });

  let resultadoCadastro;

  try {
    resultadoCadastro = await aplicarCadastroUsuario(
      interaction.guild,
      interaction.user,
      nomeBruto,
      personagemId,
      { permitirEdicao: false }
    );
  } catch (error) {
    return interaction.editReply({
      content: error.message || 'Nao foi possivel concluir o cadastro.',
    });
  }

  await enviarMensagemCanalCadastro(
    resultadoCadastro.canal,
    interaction.user.id,
    resultadoCadastro.nomeFormatado,
    resultadoCadastro.personagemId
  );

  return interaction.editReply({
    content: `Cadastro concluido com sucesso. Seu canal foi criado em <#${resultadoCadastro.canal.id}>.`,
  });
}

module.exports = {
  aplicarCadastroUsuario,
  criarModalCadastro,
  criarOuAtualizarCanalCadastro,
  criarPainelCadastro,
  enviarMensagemCanalCadastro,
  processarCadastro,
  validarPersonagemIdDisponivel,
};
