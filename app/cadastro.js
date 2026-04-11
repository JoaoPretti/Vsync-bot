const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
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
  CADASTRO_APROVAR_PREFIX,
  CADASTRO_BUTTON_ID,
  CADASTRO_MODAL_ID,
  CADASTRO_RECUSAR_PREFIX,
  CADASTRO_THUMBNAIL_URL,
  CANAL_LOG_CADASTRO_ID,
} = require('../config/constants');
const {
  aprovarSolicitacaoCadastro,
  atualizarMensagemAprovacaoCadastro,
  buscarCadastroPorPersonagemId,
  buscarCadastroPorUsuario,
  buscarSolicitacaoCadastroPendentePorPersonagemId,
  buscarSolicitacaoCadastroPendentePorUsuario,
  buscarSolicitacaoCadastroPorId,
  recusarSolicitacaoCadastro,
  salvarOuAtualizarCadastro,
  salvarSolicitacaoCadastro,
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

function formatarDataHoraBr(data) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(data ? new Date(data) : new Date());
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
      .setLabel('Abrir cadastro')
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
              'Abra seu registro e acompanhe cada etapa em um canal privado.',
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
          '**Fluxo da central**',
          '- Clique no botão abaixo para abrir o formulário.',
          '- Seu pedido será enviado para aprovação da gerência.',
          '- Após a aprovação, um canal privado será criado para você.',
        ].join('\n')
      )
    )
    .addActionRowComponents(row);

  return {
    identificador: 'painel_cadastro_v2',
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarBotoesAprovacaoCadastro(solicitacaoId, desabilitado = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CADASTRO_APROVAR_PREFIX}${solicitacaoId}`)
        .setLabel('Aprovar cadastro')
        .setStyle(ButtonStyle.Success)
        .setDisabled(desabilitado),
      new ButtonBuilder()
        .setCustomId(`${CADASTRO_RECUSAR_PREFIX}${solicitacaoId}`)
        .setLabel('Recusar cadastro')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(desabilitado)
    ),
  ];
}

function criarContainerSolicitacaoCadastro(solicitacao, desabilitado = false, descricao = null) {
  const statusTexto =
    solicitacao.status === 'pendente'
      ? 'Pendente'
      : solicitacao.status === 'aprovada'
        ? 'Aprovado'
        : 'Recusado';

  return new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              '## Aprovação de cadastro',
              descricao || 'Analise a solicitação abaixo e aprove ou recuse o cadastro.',
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
          `**Usuário:** <@${solicitacao.discord_user_id}>`,
          `**Tag:** ${solicitacao.discord_tag}`,
          `**Personagem:** ${solicitacao.personagem_nome_formatado}`,
          `**ID:** ${solicitacao.personagem_id}`,
          `**Enviado em:** ${formatarDataHoraBr(solicitacao.criado_em)}`,
          `**Status:** ${statusTexto}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(...criarBotoesAprovacaoCadastro(solicitacao.id, desabilitado));
}

function montarPayloadSolicitacaoCadastro(solicitacao, desabilitado = false, descricao = null) {
  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerSolicitacaoCadastro(solicitacao, desabilitado, descricao)],
  };
}

function montarPayloadLogCadastro({
  usuarioId,
  nomeFormatado,
  personagemId,
  canalId,
  canalNome,
  aprovadoPorId,
  aprovadoPorNome,
  aprovadoPorTag,
  cargoId,
  criadoEm,
}) {
  const cargoTexto = cargoId ? `<@&${cargoId}>` : 'Não informado';
  const statusTexto = aprovadoPorTag
    ? `✅ Aprovada por <@${aprovadoPorId}> | ${aprovadoPorTag}`
    : `✅ Aprovada por <@${aprovadoPorId}>`;

  const container = new ContainerBuilder()
    .setAccentColor(0x57f287)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Formulário de Ingresso', `Cadastro aprovado para ${nomeFormatado}.`].join('\n')
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
          `**Nome:** ${nomeFormatado}`,
          '',
          `**ID Cidade:** ${personagemId}`,
          '',
          `**Usuário:** <@${usuarioId}> | ${personagemId}`,
          '',
          `**ID de Discord:** ${usuarioId}`,
          '',
          `**Recrutado por:** ${aprovadoPorNome}`,
          '',
          '**Cargo:**',
          cargoTexto,
          '',
          '**Status:**',
          statusTexto,
          '',
          '**Sala Criada**',
          `Sala # 🗂・${canalNome}・${personagemId} criada`,
          `Canal: <#${canalId}>`,
          '',
          `**Data e Hora:** ${formatarDataHoraBr(criadoEm)}`,
        ].join('\n')
      )
    );

  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

async function enviarLogCadastroAprovado({
  client,
  usuarioId,
  nomeFormatado,
  personagemId,
  canalId,
  canalNome,
  aprovadoPorId,
  aprovadoPorNome,
  aprovadoPorTag,
  cargoId,
  criadoEm,
}) {
  const canalLog = await client.channels.fetch(CANAL_LOG_CADASTRO_ID).catch(() => null);

  if (!canalLog || canalLog.type !== ChannelType.GuildText) {
    throw new Error('Canal de log de cadastro não encontrado ou inválido.');
  }

  await canalLog.send(
    montarPayloadLogCadastro({
      usuarioId,
      nomeFormatado,
      personagemId,
      canalId,
      canalNome,
      aprovadoPorId,
      aprovadoPorNome,
      aprovadoPorTag,
      cargoId,
      criadoEm,
    })
  );
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
    throw new Error('Informe um nome de personagem válido.');
  }

  if (!/^\d+$/.test(personagemId)) {
    throw new Error('O ID do personagem deve conter apenas números.');
  }

  await validarCadastroExistenteUsuario(user.id, { permitirEdicao });

  const conflitoCadastro = await validarPersonagemIdDisponivel(personagemId, user.id);

  if (conflitoCadastro) {
    throw new Error(`O ID ${personagemId} já está cadastrado para outro usuário.`);
  }

  const membro = await guild.members.fetch(user.id);
  const apelido = `${nomeFormatado} | ${personagemId}`;
  const canal = await criarOuAtualizarCanalCadastro(guild, membro, nomeFormatado, personagemId);

  await membro.setNickname(apelido).catch((error) => {
    console.error(`Não foi possível alterar o apelido de ${user.tag}:`, error);
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
    titulo = 'Bem Vindo!',
    descricaoFinal = [
      'Essa é a sua **sala privada**, onde **só você e a gerência** têm acesso.',
      'Aqui é o espaço pra tirar dúvidas, resolver pendências e registrar farm.',
    ].join('\n'),
  } = {}
) {
  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(['## Central de cadastro', titulo].join('\n'))
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(CADASTRO_THUMBNAIL_URL).setDescription('VSYNC')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `Salve <@${usuarioId}> | ${personagemId} 🤜`,
          '',
          descricaoFinal,
          '',
          '🔥 **Importante:**',
          'Faça o registro de farm usando comando aqui na sala',
          '',
          '```',
          '/registrar_farm',
          '```',
        ].join('\n')
      )
    );

  await canal.send({
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  });
}

async function processarCadastro(interaction, client) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'Esse cadastro só pode ser feito dentro do servidor.',
      ephemeral: true,
    });
  }

  const canalAprovacaoId = process.env.CANAL_APROVACAO_CADASTRO_ID || '';

  if (!canalAprovacaoId) {
    return interaction.reply({
      content: 'O canal de aprovação de cadastro ainda não foi configurado.',
      ephemeral: true,
    });
  }

  const nomeBruto = interaction.fields.getTextInputValue('personagem_nome');
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();
  const nomeFormatado = capitalizarNomePersonagem(nomeBruto);

  await interaction.deferReply({ ephemeral: true });

  try {
    if (!nomeFormatado || nomeFormatado.length < 3) {
      throw new Error('Informe um nome de personagem válido.');
    }

    if (!/^\d+$/.test(personagemId)) {
      throw new Error('O ID do personagem deve conter apenas números.');
    }

    await validarCadastroExistenteUsuario(interaction.user.id, { permitirEdicao: false });

    const conflitoCadastro = await validarPersonagemIdDisponivel(personagemId, interaction.user.id);

    if (conflitoCadastro) {
      throw new Error(`O ID ${personagemId} já está cadastrado para outro usuário.`);
    }

    const solicitacaoPendenteUsuario = await buscarSolicitacaoCadastroPendentePorUsuario(
      interaction.user.id
    );

    if (solicitacaoPendenteUsuario) {
      throw new Error('Você já possui uma solicitação de cadastro pendente de aprovação.');
    }

    const solicitacaoPendentePersonagem =
      await buscarSolicitacaoCadastroPendentePorPersonagemId(personagemId);

    if (
      solicitacaoPendentePersonagem &&
      solicitacaoPendentePersonagem.discord_user_id !== interaction.user.id
    ) {
      throw new Error(`O ID ${personagemId} já possui uma solicitação pendente de aprovação.`);
    }

    const canalAprovacao = await client.channels.fetch(canalAprovacaoId).catch(() => null);

    if (!canalAprovacao || canalAprovacao.type !== ChannelType.GuildText) {
      throw new Error('Canal de aprovação de cadastro não encontrado ou inválido.');
    }

    const solicitacao = await salvarSolicitacaoCadastro({
      discordUserId: interaction.user.id,
      discordTag: interaction.user.tag,
      guildId: interaction.guild.id,
      personagemNome: nomeBruto.trim(),
      personagemNomeFormatado: nomeFormatado,
      personagemId,
      status: 'pendente',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });

    const mensagemAprovacao = await canalAprovacao.send(
      montarPayloadSolicitacaoCadastro(solicitacao)
    );

    await atualizarMensagemAprovacaoCadastro(
      solicitacao.id,
      mensagemAprovacao.id,
      canalAprovacao.id
    );

    return interaction.editReply({
      content: 'Cadastro enviado para aprovação da gerência com sucesso.',
    });
  } catch (error) {
    return interaction.editReply({
      content: error.message || 'Não foi possível concluir o cadastro.',
    });
  }
}

function usuarioPodeGerenciarCadastro(interaction) {
  const cargoGerenciaId = process.env.CARGO_GERENCIA_ID || '';

  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    (cargoGerenciaId && interaction.member?.roles?.cache?.has(cargoGerenciaId))
  );
}

async function aprovarOuRecusarCadastro(interaction, solicitacaoId, acao) {
  if (!usuarioPodeGerenciarCadastro(interaction)) {
    return interaction.reply({
      content: 'Você não tem permissão para gerenciar cadastros.',
      ephemeral: true,
    });
  }

  const solicitacao = await buscarSolicitacaoCadastroPorId(solicitacaoId);

  if (!solicitacao) {
    return interaction.reply({
      content: 'Não encontrei essa solicitação de cadastro.',
      ephemeral: true,
    });
  }

  if (solicitacao.status !== 'pendente') {
    return interaction.reply({
      content: `Essa solicitação já foi ${solicitacao.status}.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  if (acao === 'aprovar') {
    const solicitacaoAprovada = await aprovarSolicitacaoCadastro(solicitacaoId, interaction.user);

    if (!solicitacaoAprovada) {
      return interaction.editReply({
        content: 'Essa solicitação já foi processada por outra pessoa.',
      });
    }

    let resultadoCadastro;

    try {
      resultadoCadastro = await aplicarCadastroUsuario(
        interaction.guild,
        { id: solicitacaoAprovada.discord_user_id, tag: solicitacaoAprovada.discord_tag },
        solicitacaoAprovada.personagem_nome,
        String(solicitacaoAprovada.personagem_id),
        { permitirEdicao: false }
      );
    } catch (error) {
      console.error(`Erro ao aplicar cadastro aprovado #${solicitacaoId}:`, error);
      return interaction.editReply({
        content: error.message || 'Não foi possível aplicar o cadastro aprovado.',
      });
    }

    await interaction.message.edit(
      montarPayloadSolicitacaoCadastro(
        solicitacaoAprovada,
        true,
        `Cadastro aprovado por <@${interaction.user.id}> e canal criado em <#${resultadoCadastro.canal.id}>.`
      )
    );

    await enviarMensagemCanalCadastro(
      resultadoCadastro.canal,
      solicitacaoAprovada.discord_user_id,
      resultadoCadastro.nomeFormatado,
      resultadoCadastro.personagemId
    );

    await enviarLogCadastroAprovado({
      client: interaction.client,
      usuarioId: solicitacaoAprovada.discord_user_id,
      nomeFormatado: resultadoCadastro.nomeFormatado,
      personagemId: resultadoCadastro.personagemId,
      canalId: resultadoCadastro.canal.id,
      canalNome: resultadoCadastro.canal.name,
      aprovadoPorId: interaction.user.id,
      aprovadoPorNome: interaction.member?.displayName || interaction.user.username,
      aprovadoPorTag: interaction.user.tag,
      cargoId: process.env.CARGO_CADASTRADO_ID || '',
      criadoEm: new Date(),
    });

    return interaction.editReply({
      content: `Cadastro aprovado com sucesso. Canal criado em <#${resultadoCadastro.canal.id}>.`,
    });
  }

  const solicitacaoRecusada = await recusarSolicitacaoCadastro(solicitacaoId, interaction.user);

  if (!solicitacaoRecusada) {
    return interaction.editReply({
      content: 'Essa solicitação já foi processada por outra pessoa.',
    });
  }

  await interaction.message.edit(
    montarPayloadSolicitacaoCadastro(
      solicitacaoRecusada,
      true,
      `Cadastro recusado por <@${interaction.user.id}>.`
    )
  );

  return interaction.editReply({
    content: 'Cadastro recusado com sucesso.',
  });
}

module.exports = {
  aplicarCadastroUsuario,
  aprovarOuRecusarCadastro,
  criarModalCadastro,
  criarOuAtualizarCanalCadastro,
  criarPainelCadastro,
  enviarLogCadastroAprovado,
  enviarMensagemCanalCadastro,
  montarPayloadSolicitacaoCadastro,
  processarCadastro,
  validarPersonagemIdDisponivel,
};
