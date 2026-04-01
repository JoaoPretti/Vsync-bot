const {
  ChannelType,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require('discord.js');

const {
  ACAO_COMANDO_PREFIX,
  ACAO_ENTRAR_PREFIX,
  ACAO_FINALIZAR_PREFIX,
  ACAO_SAIR_PREFIX,
  ACAO_SELECT_RESULTADO_PREFIX,
  CADASTRO_BUTTON_ID,
  CADASTRO_MODAL_ID,
  LAVAGEM_APROVAR_PREFIX,
  LAVAGEM_MODAL_PREFIX,
  LAVAGEM_RECUSAR_PREFIX,
  PAINEL_THUMBNAIL_URL,
  PAINEL_ACOES_CANAL_ID,
} = require('../config/constants');

function criarPayloadRegistroFarm({ item, quantidade, usuarioId, imagem, imagemEmbed }) {
  const comprovanteUrl = imagemEmbed || imagem;
  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central de farm', 'Registro de farm enviado e contabilizado com sucesso.'].join(
              '\n'
            )
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(PAINEL_THUMBNAIL_URL).setDescription('VSYNC')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '**Resumo da central**',
          `**Item:** ${item}`,
          `**Quantidade:** ${quantidade}`,
          `**Usuário:** <@${usuarioId}>`,
          `**Comprovante:** ${comprovanteUrl ? `[Abrir imagem](${comprovanteUrl})` : 'Não informado'}`,
        ].join('\n')
      )
    );

  if (comprovanteUrl) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setURL(comprovanteUrl)
            .setDescription(`Comprovante de farm enviado por <@${usuarioId}>`)
        )
      );
  }

  return {
    content: null,
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarPayloadRelatorioSemanal(relatorios, usuarioId) {
  const descricao = relatorios
    .map((relatorio) => `- Semana ${relatorio.semana_referencia}: **${relatorio.total_itens}**`)
    .join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central de farm', 'Acompanhe abaixo o seu histórico semanal de registros.'].join(
              '\n'
            )
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(PAINEL_THUMBNAIL_URL).setDescription('VSYNC')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ['**Resumo da central**', `**Usuário:** <@${usuarioId}>`, descricao.slice(0, 3800)].join(
          '\n'
        )
      )
    );

  return {
    content: null,
    embeds: [],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarPayloadRelatorioGlobal(dados, totalGeral) {
  const descricao = dados.map((user) => `- <@${user.usuario_id}>: **${user.total}**`).join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central de farm', 'Confira o consolidado semanal de registros da facção.'].join(
              '\n'
            )
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(PAINEL_THUMBNAIL_URL).setDescription('VSYNC')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ['**Resumo da central**', `**Total geral:** ${totalGeral}`, descricao.slice(0, 3800)].join(
          '\n'
        )
      )
    );

  return {
    content: null,
    embeds: [],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarPayloadResumoFarm(agrupado, registros, usuarioId) {
  const descricao = Object.entries(agrupado)
    .map(([item, total]) => `- **${item}**: \`${total}\``)
    .join('\n');
  const totalQuantidade = Object.values(agrupado).reduce((acc, val) => acc + Number(val), 0);

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central de farm', 'Confira abaixo o resumo atual dos seus registros.'].join('\n')
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(PAINEL_THUMBNAIL_URL).setDescription('VSYNC')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '**Resumo da central**',
          `**Usuário:** <@${usuarioId}>`,
          `**Total de registros:** ${registros.length}`,
          `**Quantidade total:** ${totalQuantidade}`,
          descricao.slice(0, 3600),
        ].join('\n')
      )
    );

  return {
    content: null,
    embeds: [],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [container],
  };
}

async function processarComando(interaction, context) {
  const {
    client,
    criarPainel,
    buscarCadastroPorUsuario,
    aplicarCadastroUsuario,
    buscarRelatoriosUsuario,
    buscarResumoSemanalGlobal,
    salvarRegistroBanco,
    processarRelatorioSemanal,
    resolverUrlImagem,
    publicarOuAtualizarPainelAcoes,
    publicarOuAtualizarPainelCadastro,
  } = context;

  if (interaction.commandName === 'painel_acoes') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: 'Você não tem permissão para publicar o painel de ações.',
        ephemeral: true,
      });
    }

    await publicarOuAtualizarPainelAcoes();

    return interaction.reply({
      content: `Painel de ações sincronizado no canal <#${PAINEL_ACOES_CANAL_ID}>.`,
      ephemeral: true,
    });
  }

  if (interaction.commandName === 'painel_cadastro') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: 'Você não tem permissão para publicar o painel de cadastro.',
        ephemeral: true,
      });
    }

    await publicarOuAtualizarPainelCadastro();

    return interaction.reply({
      content: `Painel de cadastro sincronizado no canal <#${process.env.PAINEL_CADASTRO_CANAL_ID}>.`,
      ephemeral: true,
    });
  }

  if (interaction.commandName === 'editar_cadastro') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Você não tem permissão para editar cadastros.',
        ephemeral: true,
      });
    }

    const usuario = interaction.options.getUser('usuario', true);
    const nomeBruto = interaction.options.getString('nome', true);
    const personagemId = interaction.options.getString('id', true).trim();
    const cadastroAtual = await buscarCadastroPorUsuario(usuario.id);

    if (!cadastroAtual) {
      return interaction.reply({
        content: 'Esse usuário ainda não possui cadastro.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    let resultadoCadastro;

    try {
      resultadoCadastro = await aplicarCadastroUsuario(
        interaction.guild,
        usuario,
        nomeBruto,
        personagemId,
        { permitirEdicao: true }
      );
    } catch (error) {
      return interaction.editReply({
        content: error.message || 'Não foi possível editar o cadastro.',
      });
    }

    return interaction.editReply({
      content: `Cadastro de <@${usuario.id}> atualizado para ${resultadoCadastro.nomeFormatado} | ${resultadoCadastro.personagemId}. Canal: <#${resultadoCadastro.canal.id}>`,
    });
  }

  if (interaction.commandName === 'painel') {
    const painel = criarPainel();
    return interaction.reply({
      embeds: [painel.embed],
      components: painel.components,
      ephemeral: true,
    });
  }

  if (interaction.commandName === 'registrar_farm') {
    const item = interaction.options.getString('item', true);
    const quantidade = interaction.options.getInteger('quantidade', true);
    const foto = interaction.options.getAttachment('foto');
    const link = interaction.options.getString('link');
    const cadastroUsuario = await buscarCadastroPorUsuario(interaction.user.id);

    if (foto && foto.contentType && !foto.contentType.startsWith('image/')) {
      return interaction.reply({
        content: 'O arquivo enviado em foto precisa ser uma imagem válida.',
        ephemeral: true,
      });
    }

    if (link && !/^https?:\/\//i.test(link)) {
      return interaction.reply({
        content: 'O link informado para a imagem precisa começar com http:// ou https://.',
        ephemeral: true,
      });
    }

    const imagem = foto?.url || link || null;

    if (!imagem) {
      return interaction.reply({
        content:
          'Envie uma imagem no campo de foto ou informe um link de imagem para registrar o farm.',
        ephemeral: true,
      });
    }

    const canal = await client.channels.fetch(process.env.CANAL_REGISTROS_ID);

    if (!canal) {
      return interaction.reply({
        content: 'Não encontrei o canal de registros.',
        ephemeral: true,
      });
    }

    if (
      canal.type !== ChannelType.GuildText &&
      canal.type !== ChannelType.PublicThread &&
      canal.type !== ChannelType.PrivateThread
    ) {
      return interaction.reply({
        content: 'O canal configurado não é um canal de texto válido.',
        ephemeral: true,
      });
    }

    const imagemEmbed = foto?.url ? foto.url : await resolverUrlImagem(link);

    const payloadFarm = criarPayloadRegistroFarm({
      item,
      quantidade,
      usuarioId: interaction.user.id,
      imagem,
      imagemEmbed,
    });

    await canal.send(payloadFarm);

    if (cadastroUsuario?.canal_id) {
      const canalPrivado = await client.channels.fetch(cadastroUsuario.canal_id).catch(() => null);

      if (
        canalPrivado &&
        (canalPrivado.type === ChannelType.GuildText ||
          canalPrivado.type === ChannelType.PublicThread ||
          canalPrivado.type === ChannelType.PrivateThread)
      ) {
        await canalPrivado.send(payloadFarm).catch((error) => {
          console.error(
            `Falha ao enviar registro de farm para o canal privado de ${interaction.user.tag}:`,
            error
          );
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
      criadoEm: new Date(),
    });

    return interaction.reply({
      content: 'Farm registrado com sucesso.',
      ephemeral: true,
    });
  }

  if (interaction.commandName === 'relatorio_semanal') {
    const relatorios = await buscarRelatoriosUsuario(interaction.user.id);

    if (!relatorios.length) {
      return interaction.reply({
        content: 'Você não possui relatórios ainda.',
        ephemeral: true,
      });
    }

    return interaction.reply(criarPayloadRelatorioSemanal(relatorios, interaction.user.id));
  }

  if (interaction.commandName === 'relatorio_global') {
    const dados = await buscarResumoSemanalGlobal();

    if (!dados.length) {
      return interaction.reply({
        content: 'Nenhum farm registrado ainda.',
        ephemeral: true,
      });
    }

    const totalGeral = dados.reduce((acc, user) => acc + user.total, 0);

    return interaction.reply(criarPayloadRelatorioGlobal(dados, totalGeral));
  }

  if (interaction.commandName === 'testar_relatorio') {
    await processarRelatorioSemanal();

    return interaction.reply({
      content: 'Relatório semanal executado manualmente para teste.',
      ephemeral: true,
    });
  }

  return null;
}

async function processarModal(interaction, context) {
  const {
    client,
    formatarMoeda,
    processarCadastro,
    processarModalLavagem,
    montarPayloadRascunhoAcao,
    obterRascunhoAcao,
  } = context;

  if (interaction.customId === CADASTRO_MODAL_ID) {
    return processarCadastro(interaction);
  }

  if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}parceria`) {
    return processarModalLavagem(interaction, 'parceria', client);
  }

  if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}pista`) {
    return processarModalLavagem(interaction, 'pista', client);
  }

  if (interaction.customId.startsWith(context.ACAO_RASCUNHO_MODAL_PREFIX)) {
    const token = interaction.customId.slice(context.ACAO_RASCUNHO_MODAL_PREFIX.length);
    const rascunho = obterRascunhoAcao(token, interaction.user.id);

    if (!rascunho) {
      return interaction.reply({
        content: 'Esse rascunho de ação expirou ou não pertence a você.',
        ephemeral: true,
      });
    }

    const quantidadeParticipantesTexto = interaction.fields
      .getTextInputValue('quantidade_participantes')
      .trim();
    const dinheiroTexto = interaction.fields.getTextInputValue('dinheiro').trim();

    if (!/^\d+$/.test(quantidadeParticipantesTexto) || Number(quantidadeParticipantesTexto) <= 0) {
      return interaction.reply({
        content: 'A quantidade de participantes deve ser um número inteiro maior que zero.',
        ephemeral: true,
      });
    }

    if (!/^\d+$/.test(dinheiroTexto) || Number(dinheiroTexto) <= 0) {
      return interaction.reply({
        content: 'O valor em dinheiro deve ser um número inteiro maior que zero.',
        ephemeral: true,
      });
    }

    rascunho.quantidadeParticipantes = Number(quantidadeParticipantesTexto);
    rascunho.dinheiro = Number(dinheiroTexto);

    return interaction.reply(
      montarPayloadRascunhoAcao(rascunho, formatarMoeda, {
        ephemeral: true,
        aviso: 'Detalhes atualizados. Revise o painel abaixo para concluir a criação da ação.',
      })
    );
  }

  return null;
}

async function processarBotao(interaction, context) {
  const {
    client,
    formatarMoeda,
    buscarAcaoPorId,
    buscarRegistrosFarmPorUsuario,
    criarModalCadastro,
    criarModalDetalhesRascunhoAcao,
    criarModalLavagem,
    criarRascunhoAcao,
    finalizarAcao,
    finalizarLavagem,
    montarPayloadRascunhoAcao,
    montarPayloadRascunhoConcluido,
    obterRascunhoAcao,
    removerParticipanteAcao,
    removerRascunhoAcao,
    renderizarMensagemAcao,
    rascunhoAcaoEstaPronto,
    salvarAcao,
    atualizarCampoAcao,
    adicionarParticipanteAcao,
  } = context;

  if (interaction.customId === CADASTRO_BUTTON_ID) {
    return interaction.showModal(criarModalCadastro());
  }

  if (interaction.customId === 'acao_pequena') {
    return interaction.reply(
      montarPayloadRascunhoAcao(
        criarRascunhoAcao(interaction.user.id, interaction.channelId, 'pequena'),
        formatarMoeda,
        { ephemeral: true }
      )
    );
  }

  if (interaction.customId === 'acao_media') {
    return interaction.reply(
      montarPayloadRascunhoAcao(
        criarRascunhoAcao(interaction.user.id, interaction.channelId, 'media'),
        formatarMoeda,
        { ephemeral: true }
      )
    );
  }

  if (interaction.customId === 'acao_grande') {
    return interaction.reply(
      montarPayloadRascunhoAcao(
        criarRascunhoAcao(interaction.user.id, interaction.channelId, 'grande'),
        formatarMoeda,
        { ephemeral: true }
      )
    );
  }

  if (interaction.customId === 'lavagem_parceria') {
    return interaction.showModal(criarModalLavagem('parceria'));
  }

  if (interaction.customId === 'lavagem_pista') {
    return interaction.showModal(criarModalLavagem('pista'));
  }

  if (interaction.customId.startsWith(LAVAGEM_APROVAR_PREFIX)) {
    const lavagemId = Number(interaction.customId.slice(LAVAGEM_APROVAR_PREFIX.length));
    return finalizarLavagem(interaction, lavagemId, 'aprovar', client);
  }

  if (interaction.customId.startsWith(LAVAGEM_RECUSAR_PREFIX)) {
    const lavagemId = Number(interaction.customId.slice(LAVAGEM_RECUSAR_PREFIX.length));
    return finalizarLavagem(interaction, lavagemId, 'recusar', client);
  }

  if (interaction.customId.startsWith(ACAO_ENTRAR_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_ENTRAR_PREFIX.length));
    await adicionarParticipanteAcao(acaoId, interaction.user);
    await renderizarMensagemAcao(interaction, acaoId);
    return interaction.reply({
      content: 'Você entrou na ação.',
      ephemeral: true,
    });
  }

  if (interaction.customId.startsWith(ACAO_SAIR_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_SAIR_PREFIX.length));
    const acao = await buscarAcaoPorId(acaoId);

    await removerParticipanteAcao(acaoId, interaction.user.id);

    if (acao?.comando_texto === `<@${interaction.user.id}>`) {
      await atualizarCampoAcao(acaoId, 'comando_texto', null);
    }

    await renderizarMensagemAcao(interaction, acaoId);
    return interaction.reply({
      content: 'Você saiu da ação.',
      ephemeral: true,
    });
  }

  if (interaction.customId.startsWith(ACAO_COMANDO_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_COMANDO_PREFIX.length));
    await adicionarParticipanteAcao(acaoId, interaction.user);
    await atualizarCampoAcao(acaoId, 'comando_texto', `<@${interaction.user.id}>`);
    await renderizarMensagemAcao(interaction, acaoId);
    return interaction.reply({
      content: 'Você assumiu o comando da ação.',
      ephemeral: true,
    });
  }

  if (interaction.customId.startsWith(ACAO_FINALIZAR_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_FINALIZAR_PREFIX.length));
    return finalizarAcao(interaction, acaoId);
  }

  if (interaction.customId.startsWith(context.ACAO_RASCUNHO_DETALHES_PREFIX)) {
    const token = interaction.customId.slice(context.ACAO_RASCUNHO_DETALHES_PREFIX.length);
    const rascunho = obterRascunhoAcao(token, interaction.user.id);

    if (!rascunho) {
      return interaction.reply({
        content: 'Esse rascunho de ação expirou ou não pertence a você.',
        ephemeral: true,
      });
    }

    return interaction.showModal(criarModalDetalhesRascunhoAcao(token, rascunho));
  }

  if (interaction.customId.startsWith(context.ACAO_RASCUNHO_CONFIRMAR_PREFIX)) {
    const token = interaction.customId.slice(context.ACAO_RASCUNHO_CONFIRMAR_PREFIX.length);
    const rascunho = obterRascunhoAcao(token, interaction.user.id);

    if (!rascunho) {
      return interaction.reply({
        content: 'Esse rascunho de ação expirou ou não pertence a você.',
        ephemeral: true,
      });
    }

    if (!rascunhoAcaoEstaPronto(rascunho)) {
      return interaction.reply({
        content:
          'Defina a ação, o tipo, a quantidade de participantes e o dinheiro antes de criar.',
        ephemeral: true,
      });
    }

    const acao = await salvarAcao({
      tamanho: rascunho.tamanho,
      nomeAcao: rascunho.nomeAcao,
      comandoTexto: null,
      quantidadeParticipantes: rascunho.quantidadeParticipantes,
      tipoAcao: rascunho.tipoAcao,
      resultado: null,
      dinheiro: rascunho.dinheiro,
      criadorId: interaction.user.id,
      criadorTag: interaction.user.tag,
      canalId: interaction.channelId,
      mensagemId: null,
      status: 'em_andamento',
      iniciadoEm: new Date(),
      finalizadoEm: null,
    });

    const mensagem = await renderizarMensagemAcao(interaction, acao.id);
    removerRascunhoAcao(token);

    return interaction.update(
      montarPayloadRascunhoConcluido(mensagem ? interaction.channelId : null)
    );
  }

  if (interaction.customId === 'farm' || interaction.customId === 'painel_farm') {
    const registros = await buscarRegistrosFarmPorUsuario(interaction.user.id);

    if (!registros.length) {
      return interaction.reply({
        content: 'Você ainda não possui farms registrados.',
        ephemeral: true,
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

    return interaction.reply(criarPayloadResumoFarm(agrupado, registros, interaction.user.id));
  }

  if (interaction.customId === 'lavagem') {
    return interaction.reply({
      content: 'Sistema de lavagem',
      ephemeral: true,
    });
  }

  return null;
}

async function processarSelect(interaction, context) {
  const {
    formatarMoeda,
    atualizarCampoAcao,
    montarPayloadRascunhoAcao,
    obterRascunhoAcao,
    renderizarMensagemAcao,
  } = context;

  if (interaction.customId.startsWith(context.ACAO_RASCUNHO_NOME_PREFIX)) {
    const token = interaction.customId.slice(context.ACAO_RASCUNHO_NOME_PREFIX.length);
    const rascunho = obterRascunhoAcao(token, interaction.user.id);
    const nomeAcao = interaction.values[0];

    if (!rascunho) {
      return interaction.reply({
        content: 'Esse rascunho de ação expirou ou não pertence a você.',
        ephemeral: true,
      });
    }

    if (nomeAcao === 'indisponivel') {
      return interaction.reply({
        content: 'Cadastre ações em ACOES_DISPONIVEIS antes de usar esta lista.',
        ephemeral: true,
      });
    }

    rascunho.nomeAcao = nomeAcao;

    return interaction.update(montarPayloadRascunhoAcao(rascunho, formatarMoeda));
  }

  if (interaction.customId.startsWith(context.ACAO_RASCUNHO_TIPO_PREFIX)) {
    const token = interaction.customId.slice(context.ACAO_RASCUNHO_TIPO_PREFIX.length);
    const rascunho = obterRascunhoAcao(token, interaction.user.id);
    const tipoAcao = interaction.values[0];

    if (!rascunho) {
      return interaction.reply({
        content: 'Esse rascunho de ação expirou ou não pertence a você.',
        ephemeral: true,
      });
    }

    rascunho.tipoAcao = tipoAcao;

    return interaction.update(montarPayloadRascunhoAcao(rascunho, formatarMoeda));
  }

  if (interaction.customId.startsWith(ACAO_SELECT_RESULTADO_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_SELECT_RESULTADO_PREFIX.length));
    const resultado = interaction.values[0];
    await atualizarCampoAcao(acaoId, 'resultado', resultado);
    await renderizarMensagemAcao(interaction, acaoId);
    return interaction.reply({
      content: `Resultado definido como ${resultado}.`,
      ephemeral: true,
    });
  }

  return null;
}

async function processarInteracao(interaction, context) {
  try {
    if (interaction.isChatInputCommand()) {
      return processarComando(interaction, context);
    }

    if (interaction.isModalSubmit()) {
      return processarModal(interaction, context);
    }

    if (interaction.isButton()) {
      return processarBotao(interaction, context);
    }

    if (interaction.isStringSelectMenu()) {
      return processarSelect(interaction, context);
    }
  } catch (error) {
    console.error('Erro na interação:', error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: 'Ocorreu um erro ao processar esta ação.',
        ephemeral: true,
      });
    }
  }

  return null;
}

module.exports = {
  processarInteracao,
};
