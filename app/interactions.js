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
  ADMIN_BANCO_ADICIONAR_BUTTON_ID,
  ADMIN_BANCO_ADICIONAR_MODAL_ID,
  ADMIN_BANCO_RESETAR_BUTTON_ID,
  ADMIN_BANCO_RESETAR_CANCELAR_BUTTON_ID,
  ADMIN_BANCO_RESETAR_CONFIRMAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_MODAL_ID,
  ADMIN_PARCERIA_CADASTRAR_BUTTON_ID,
  ADMIN_PARCERIA_CADASTRAR_MODAL_ID,
  ADMIN_PARCERIA_LISTAR_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_MODAL_ID,
  CADASTRO_APROVAR_PREFIX,
  CADASTRO_BUTTON_ID,
  CADASTRO_MODAL_ID,
  CADASTRO_RECUSAR_PREFIX,
  LAVAGEM_APROVAR_PREFIX,
  LAVAGEM_MODAL_PREFIX,
  LAVAGEM_RECUSAR_PREFIX,
  PAINEL_THUMBNAIL_URL,
  PAINEL_ACOES_CANAL_ID,
} = require('../config/constants');

function truncarTexto(texto, limite = 1900) {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 3)}...`;
}

function usuarioPodeGerenciarPainelAdministrativo(interaction) {
  const cargoGerenciaId = process.env.CARGO_GERENCIA_ID || '';

  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    (cargoGerenciaId && interaction.member?.roles?.cache?.has(cargoGerenciaId))
  );
}

async function responderListaGruposParceiros(interaction, listarGruposParceiros) {
  const grupos = await listarGruposParceiros();

  if (!grupos.length) {
    return interaction.reply({
      content: 'Nenhum grupo parceiro cadastrado até o momento.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const linhas = grupos.map((grupo) => `- ${grupo.nome}`).join('\n');

  return interaction.reply({
    content: truncarTexto(`Grupos parceiros cadastrados:\n${linhas}`),
    flags: MessageFlags.Ephemeral,
  });
}

async function registrarGrupoParceiro(interaction, nome, context) {
  const {
    buscarGrupoParceiroPorNomeNormalizado,
    normalizarNomeGrupoParceiro,
    salvarGrupoParceiro,
  } = context;
  const nomeLimpo = nome.trim();
  const nomeNormalizado = normalizarNomeGrupoParceiro(nomeLimpo);

  if (!nomeNormalizado || nomeLimpo.length < 2) {
    return interaction.reply({
      content: 'Informe um nome de grupo parceiro válido.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const grupoExistente = await buscarGrupoParceiroPorNomeNormalizado(nomeNormalizado);

  if (grupoExistente) {
    return interaction.reply({
      content: `O grupo parceiro **${grupoExistente.nome}** já está cadastrado.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const grupo = await salvarGrupoParceiro({
    nome: nomeLimpo,
    nomeNormalizado,
    criadoPorId: interaction.user.id,
    criadoPorTag: interaction.user.tag,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  });

  return interaction.reply({
    content: `Grupo parceiro **${grupo.nome}** cadastrado com sucesso.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function removerGrupoParceiroPorNome(interaction, nome, context) {
  const {
    buscarGrupoParceiroPorNomeNormalizado,
    normalizarNomeGrupoParceiro,
    removerGrupoParceiro,
  } = context;
  const grupo = await buscarGrupoParceiroPorNomeNormalizado(
    normalizarNomeGrupoParceiro(nome.trim())
  );

  if (!grupo) {
    return interaction.reply({
      content: 'Não encontrei um grupo parceiro com esse nome.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await removerGrupoParceiro(grupo.id);

  return interaction.reply({
    content: `Grupo parceiro **${grupo.nome}** removido com sucesso.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function registrarMovimentacaoBanco(interaction, tipo, context) {
  const {
    buscarSaldoBanco,
    enviarLogRegistroBancario,
    formatarMoeda,
    publicarOuAtualizarPainelAdministrativo,
    salvarRegistroBancario,
  } = context;
  const quantidadeTexto = interaction.fields.getTextInputValue('quantidade').trim();
  const motivo = interaction.fields.getTextInputValue('motivo').trim();
  const quantidade = Number(quantidadeTexto);

  if (!/^\d+$/.test(quantidadeTexto) || quantidade <= 0) {
    return interaction.reply({
      content: 'A quantidade deve ser um numero inteiro maior que zero.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!motivo || motivo.length < 3) {
    return interaction.reply({
      content: 'Informe um motivo valido para o registro bancario.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (tipo === 'retirada') {
    const saldoAtual = await buscarSaldoBanco();

    if (quantidade > saldoAtual) {
      return interaction.reply({
        content: `Nao e possivel retirar esse valor porque o saldo atual e ${formatarMoeda(saldoAtual)}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const criadoEm = new Date();

  const registro = await salvarRegistroBancario({
    tipo,
    quantidade,
    motivo,
    usuarioId: interaction.user.id,
    usuarioTag: interaction.user.tag,
    criadoEm,
  });

  const saldoAtual = await buscarSaldoBanco();

  await enviarLogRegistroBancario({
    tipo,
    quantidade: registro.quantidade,
    motivo: registro.motivo,
    criadoEm: criadoEm.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    usuarioId: registro.usuario_id,
    saldoAtual,
  });

  if (interaction.channel) {
    await publicarOuAtualizarPainelAdministrativo(interaction.channel).catch(() => null);
  }

  return interaction.editReply({
    content:
      tipo === 'adicao'
        ? 'Valor adicionado registrado com sucesso.'
        : 'Valor retirado registrado com sucesso.',
  });
}

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
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarPayloadRelatorioSemanal(relatorios, semanaReferencia, totalGeral) {
  const descricao = relatorios
    .map((relatorio) => `- <@${relatorio.usuario_id}>: **${relatorio.total_itens}**`)
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
        [
          '**Resumo da central**',
          `**Semana de referência:** ${semanaReferencia}`,
          `**Total geral:** ${totalGeral}`,
          descricao.slice(0, 3600),
        ].join('\n')
      )
    );

  return {
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
    embeds: [],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [container],
  };
}

async function processarComando(interaction, context) {
  const {
    client,
    aplicarCadastroUsuario,
    buscarCadastroPorUsuario,
    buscarGrupoParceiroPorNomeNormalizado,
    buscarRelatorioSemanalGlobalMaisRecente,
    buscarResumoSemanalGlobal,
    criarPainel,
    listarGruposParceiros,
    normalizarNomeGrupoParceiro,
    publicarOuAtualizarPainelAdministrativo,
    publicarOuAtualizarPainelAcoes,
    publicarOuAtualizarPainelCadastro,
    processarRelatorioSemanal,
    removerGrupoParceiro,
    resolverUrlImagem,
    salvarGrupoParceiro,
    salvarRegistroBanco,
  } = context;

  if (interaction.commandName === 'painel_acoes') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: 'Você não tem permissão para publicar o painel de ações.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await publicarOuAtualizarPainelAcoes();

    return interaction.reply({
      content: `Painel de ações sincronizado no canal <#${PAINEL_ACOES_CANAL_ID}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.commandName === 'painel_cadastro') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: 'Você não tem permissão para publicar o painel de cadastro.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await publicarOuAtualizarPainelCadastro();

    return interaction.reply({
      content: `Painel de cadastro sincronizado no canal <#${process.env.PAINEL_CADASTRO_CANAL_ID}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.commandName === 'painel_administrativo') {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para publicar o painel administrativo.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await publicarOuAtualizarPainelAdministrativo(interaction.channel);

    return interaction.reply({
      content: `Painel administrativo sincronizado no canal <#${interaction.channelId}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.commandName === 'editar_cadastro') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'Você não tem permissão para editar cadastros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const usuario = interaction.options.getUser('usuario', true);
    const nomeBruto = interaction.options.getString('nome', true);
    const personagemId = interaction.options.getString('id', true).trim();
    const cadastroAtual = await buscarCadastroPorUsuario(usuario.id);

    if (!cadastroAtual) {
      return interaction.reply({
        content: 'Esse usuário ainda não possui cadastro.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
      embeds: painel.embeds,
      components: painel.components,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.commandName === 'registrar_grupo_parceiro') {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para cadastrar grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return registrarGrupoParceiro(interaction, interaction.options.getString('nome', true), {
      buscarGrupoParceiroPorNomeNormalizado,
      normalizarNomeGrupoParceiro,
      salvarGrupoParceiro,
    });
  }

  if (interaction.commandName === 'remover_grupo_parceiro') {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para remover grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return removerGrupoParceiroPorNome(interaction, interaction.options.getString('nome', true), {
      buscarGrupoParceiroPorNomeNormalizado,
      normalizarNomeGrupoParceiro,
      removerGrupoParceiro,
    });
  }

  if (interaction.commandName === 'listar_grupos_parceiros') {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para listar grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return responderListaGruposParceiros(interaction, listarGruposParceiros);
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
        flags: MessageFlags.Ephemeral,
      });
    }

    if (link && !/^https?:\/\//i.test(link)) {
      return interaction.reply({
        content: 'O link informado para a imagem precisa começar com http:// ou https://.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const imagem = foto?.url || link || null;

    if (!imagem) {
      return interaction.reply({
        content:
          'Envie uma imagem no campo de foto ou informe um link de imagem para registrar o farm.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const canal = await client.channels.fetch(process.env.CANAL_REGISTROS_ID);

    if (!canal) {
      return interaction.reply({
        content: 'Não encontrei o canal de registros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      canal.type !== ChannelType.GuildText &&
      canal.type !== ChannelType.PublicThread &&
      canal.type !== ChannelType.PrivateThread
    ) {
      return interaction.reply({
        content: 'O canal configurado não é um canal de texto válido.',
        flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.commandName === 'relatorio_semanal') {
    const { semanaReferencia, relatorios } = await buscarRelatorioSemanalGlobalMaisRecente();

    if (!relatorios.length) {
      return interaction.reply({
        content: 'Nenhum relatório semanal fechado foi encontrado ainda.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const totalGeral = relatorios.reduce((acc, relatorio) => acc + relatorio.total_itens, 0);

    return interaction.reply(
      criarPayloadRelatorioSemanal(relatorios, semanaReferencia, totalGeral)
    );
  }

  if (interaction.commandName === 'relatorio_global') {
    const dados = await buscarResumoSemanalGlobal();

    if (!dados.length) {
      return interaction.reply({
        content: 'Nenhum farm registrado ainda.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const totalGeral = dados.reduce((acc, user) => acc + user.total, 0);

    return interaction.reply(criarPayloadRelatorioGlobal(dados, totalGeral));
  }

  if (interaction.commandName === 'testar_relatorio') {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para executar o relatório manualmente.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await processarRelatorioSemanal();

    return interaction.reply({
      content: 'Relatório semanal executado manualmente para teste.',
      flags: MessageFlags.Ephemeral,
    });
  }

  return null;
}

async function processarModal(interaction, context) {
  const {
    buscarSaldoBanco,
    buscarGrupoParceiroPorId,
    buscarGrupoParceiroPorNomeNormalizado,
    client,
    enviarLogRegistroBancario,
    formatarMoeda,
    montarPayloadRascunhoAcao,
    normalizarNomeGrupoParceiro,
    obterRascunhoAcao,
    processarCadastro,
    processarModalLavagem,
    publicarOuAtualizarPainelAdministrativo,
    removerGrupoParceiro,
    salvarRegistroBancario,
    salvarGrupoParceiro,
  } = context;

  if (interaction.customId === CADASTRO_MODAL_ID) {
    return processarCadastro(interaction, client);
  }

  if (interaction.customId === ADMIN_PARCERIA_CADASTRAR_MODAL_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para cadastrar grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return registrarGrupoParceiro(interaction, interaction.fields.getTextInputValue('nome'), {
      buscarGrupoParceiroPorNomeNormalizado,
      normalizarNomeGrupoParceiro,
      salvarGrupoParceiro,
    });
  }

  if (interaction.customId === ADMIN_PARCERIA_REMOVER_MODAL_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para remover grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return removerGrupoParceiroPorNome(interaction, interaction.fields.getTextInputValue('nome'), {
      buscarGrupoParceiroPorNomeNormalizado,
      normalizarNomeGrupoParceiro,
      removerGrupoParceiro,
    });
  }

  if (interaction.customId === ADMIN_BANCO_ADICIONAR_MODAL_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para registrar valores no banco.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return registrarMovimentacaoBanco(interaction, 'adicao', {
      buscarSaldoBanco,
      enviarLogRegistroBancario,
      formatarMoeda,
      publicarOuAtualizarPainelAdministrativo,
      salvarRegistroBancario,
    });
  }

  if (interaction.customId === ADMIN_BANCO_RETIRAR_MODAL_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para registrar retiradas no banco.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return registrarMovimentacaoBanco(interaction, 'retirada', {
      buscarSaldoBanco,
      enviarLogRegistroBancario,
      formatarMoeda,
      publicarOuAtualizarPainelAdministrativo,
      salvarRegistroBancario,
    });
  }

  if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}parceria`) {
    return processarModalLavagem(interaction, 'parceria', client);
  }

  if (interaction.customId.startsWith(`${LAVAGEM_MODAL_PREFIX}parceria_`)) {
    const grupoId = Number(interaction.customId.slice(`${LAVAGEM_MODAL_PREFIX}parceria_`.length));
    const grupoParceiro = await buscarGrupoParceiroPorId(grupoId);

    if (!grupoParceiro) {
      return interaction.reply({
        content: 'O grupo parceiro selecionado não está mais disponível.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return processarModalLavagem(interaction, 'parceria', client, grupoParceiro);
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
        flags: MessageFlags.Ephemeral,
      });
    }

    const quantidadeParticipantesTexto = interaction.fields
      .getTextInputValue('quantidade_participantes')
      .trim();
    const dinheiroTexto = interaction.fields.getTextInputValue('dinheiro').trim();

    if (!/^\d+$/.test(quantidadeParticipantesTexto) || Number(quantidadeParticipantesTexto) <= 0) {
      return interaction.reply({
        content: 'A quantidade de participantes deve ser um número inteiro maior que zero.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!/^\d+$/.test(dinheiroTexto) || Number(dinheiroTexto) <= 0) {
      return interaction.reply({
        content: 'O valor em dinheiro deve ser um número inteiro maior que zero.',
        flags: MessageFlags.Ephemeral,
      });
    }

    rascunho.quantidadeParticipantes = Number(quantidadeParticipantesTexto);
    rascunho.dinheiro = Number(dinheiroTexto);

    return interaction.update(
      montarPayloadRascunhoAcao(rascunho, formatarMoeda, {
        aviso: 'Detalhes atualizados. Revise o painel abaixo para concluir a criação da ação.',
      })
    );
  }

  return null;
}

async function processarBotao(interaction, context) {
  const {
    aprovarOuRecusarCadastro,
    buscarSaldoBanco,
    client,
    criarModalBancoAdicionar,
    criarModalBancoRetirar,
    criarModalCadastrarParceria,
    formatarMoeda,
    buscarAcaoPorId,
    buscarRegistrosFarmPorUsuario,
    criarModalCadastro,
    criarModalDetalhesRascunhoAcao,
    criarModalLavagem,
    criarModalRemoverParceria,
    criarRascunhoAcao,
    enviarLogResetBanco,
    finalizarAcao,
    finalizarLavagem,
    listarGruposParceiros,
    montarPayloadConfirmacaoResetBanco,
    montarPayloadSelecaoGrupoParceiro,
    montarPayloadRascunhoAcao,
    obterRascunhoAcao,
    removerParticipanteAcao,
    removerRascunhoAcao,
    renderizarMensagemAcao,
    publicarOuAtualizarPainelAdministrativo,
    rascunhoAcaoEstaPronto,
    resetarSaldoBanco,
    salvarAcao,
    atualizarCampoAcao,
    adicionarParticipanteAcao,
  } = context;

  if (interaction.customId === CADASTRO_BUTTON_ID) {
    return interaction.showModal(criarModalCadastro());
  }

  if (interaction.customId === ADMIN_BANCO_ADICIONAR_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para registrar valores no banco.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.showModal(criarModalBancoAdicionar());
  }

  if (interaction.customId === ADMIN_BANCO_RETIRAR_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para registrar retiradas no banco.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.showModal(criarModalBancoRetirar());
  }

  if (interaction.customId === ADMIN_BANCO_RESETAR_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para resetar o saldo do banco.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const saldoAtual = await buscarSaldoBanco();

    if (saldoAtual <= 0) {
      return interaction.reply({
        content: 'O saldo do registro bancário já está zerado.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply(montarPayloadConfirmacaoResetBanco(formatarMoeda(saldoAtual)));
  }

  if (interaction.customId === ADMIN_BANCO_RESETAR_CANCELAR_BUTTON_ID) {
    return interaction.update({
      content: 'Reset do saldo cancelado.',
      components: [],
      embeds: [],
    });
  }

  if (interaction.customId === ADMIN_BANCO_RESETAR_CONFIRMAR_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para resetar o saldo do banco.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const saldoAnterior = await buscarSaldoBanco();

    if (saldoAnterior <= 0) {
      return interaction.update({
        content: 'O saldo do registro bancário já estava zerado.',
        components: [],
        embeds: [],
      });
    }

    await resetarSaldoBanco();

    await enviarLogResetBanco({
      criadoEm: new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      saldoAnterior,
      usuarioId: interaction.user.id,
    });

    if (interaction.channel) {
      await publicarOuAtualizarPainelAdministrativo(interaction.channel).catch(() => null);
    }

    return interaction.update({
      content: 'Saldo do registro bancário resetado com sucesso.',
      components: [],
      embeds: [],
    });
  }

  if (interaction.customId === ADMIN_PARCERIA_CADASTRAR_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para cadastrar grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.showModal(criarModalCadastrarParceria());
  }

  if (interaction.customId === ADMIN_PARCERIA_LISTAR_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para listar grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return responderListaGruposParceiros(interaction, listarGruposParceiros);
  }

  if (interaction.customId === ADMIN_PARCERIA_REMOVER_BUTTON_ID) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para remover grupos parceiros.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.showModal(criarModalRemoverParceria());
  }

  if (interaction.customId.startsWith(CADASTRO_APROVAR_PREFIX)) {
    const solicitacaoId = Number(interaction.customId.slice(CADASTRO_APROVAR_PREFIX.length));
    return aprovarOuRecusarCadastro(interaction, solicitacaoId, 'aprovar');
  }

  if (interaction.customId.startsWith(CADASTRO_RECUSAR_PREFIX)) {
    const solicitacaoId = Number(interaction.customId.slice(CADASTRO_RECUSAR_PREFIX.length));
    return aprovarOuRecusarCadastro(interaction, solicitacaoId, 'recusar');
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
    const grupos = await listarGruposParceiros();

    if (!grupos.length) {
      return interaction.reply({
        content:
          'Nenhum grupo parceiro foi cadastrado ainda. Peça para um administrador usar /registrar_grupo_parceiro.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (grupos.length > 25) {
      return interaction.reply({
        content:
          'Existem mais de 25 grupos parceiros cadastrados. Reduza a lista antes de usar a seleção de parceria.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply(montarPayloadSelecaoGrupoParceiro(grupos));
  }

  if (interaction.customId === 'lavagem_pista') {
    return interaction.showModal(criarModalLavagem('pista'));
  }

  if (interaction.customId.startsWith(LAVAGEM_APROVAR_PREFIX)) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para aprovar lavagens.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const lavagemId = Number(interaction.customId.slice(LAVAGEM_APROVAR_PREFIX.length));
    return finalizarLavagem(interaction, lavagemId, 'aprovar', client);
  }

  if (interaction.customId.startsWith(LAVAGEM_RECUSAR_PREFIX)) {
    if (!usuarioPodeGerenciarPainelAdministrativo(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para recusar lavagens.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const lavagemId = Number(interaction.customId.slice(LAVAGEM_RECUSAR_PREFIX.length));
    return finalizarLavagem(interaction, lavagemId, 'recusar', client);
  }

  if (interaction.customId.startsWith(ACAO_ENTRAR_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_ENTRAR_PREFIX.length));
    await adicionarParticipanteAcao(acaoId, interaction.user);
    await renderizarMensagemAcao(interaction, acaoId);
    return interaction.reply({
      content: 'Você entrou na ação.',
      flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.customId.startsWith(ACAO_COMANDO_PREFIX)) {
    const acaoId = Number(interaction.customId.slice(ACAO_COMANDO_PREFIX.length));
    await adicionarParticipanteAcao(acaoId, interaction.user);
    await atualizarCampoAcao(acaoId, 'comando_texto', `<@${interaction.user.id}>`);
    await renderizarMensagemAcao(interaction, acaoId);
    return interaction.reply({
      content: 'Você assumiu o comando da ação.',
      flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!rascunhoAcaoEstaPronto(rascunho)) {
      return interaction.reply({
        content:
          'Defina a ação, o tipo, a quantidade de participantes e o dinheiro antes de criar.',
        flags: MessageFlags.Ephemeral,
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

    await renderizarMensagemAcao(interaction, acao.id);
    removerRascunhoAcao(token);
    await interaction.update({
      content: 'Ação publicada com sucesso.',
      embeds: [],
      components: [],
    });
    await interaction.deleteReply().catch(() => null);
    return null;
  }

  if (interaction.customId === 'farm' || interaction.customId === 'painel_farm') {
    const registros = await buscarRegistrosFarmPorUsuario(interaction.user.id);

    if (!registros.length) {
      return interaction.reply({
        content: 'Você ainda não possui farms registrados.',
        flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });
  }

  return null;
}

async function processarSelect(interaction, context) {
  const {
    formatarMoeda,
    atualizarCampoAcao,
    buscarGrupoParceiroPorId,
    criarModalLavagem,
    LAVAGEM_PARCEIRO_SELECT_ID,
    montarPayloadRascunhoAcao,
    obterRascunhoAcao,
    renderizarMensagemAcao,
  } = context;

  if (interaction.customId === LAVAGEM_PARCEIRO_SELECT_ID) {
    const grupoId = Number(interaction.values[0]);
    const grupoParceiro = await buscarGrupoParceiroPorId(grupoId);

    if (!grupoParceiro) {
      return interaction.reply({
        content: 'O grupo parceiro selecionado não está mais disponível.',
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.showModal(criarModalLavagem('parceria', grupoParceiro));
  }

  if (interaction.customId.startsWith(context.ACAO_RASCUNHO_NOME_PREFIX)) {
    const token = interaction.customId.slice(context.ACAO_RASCUNHO_NOME_PREFIX.length);
    const rascunho = obterRascunhoAcao(token, interaction.user.id);
    const nomeAcao = interaction.values[0];

    if (!rascunho) {
      return interaction.reply({
        content: 'Esse rascunho de ação expirou ou não pertence a você.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (nomeAcao === 'indisponivel') {
      return interaction.reply({
        content: 'Cadastre ações em ACOES_DISPONIVEIS antes de usar esta lista.',
        flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  return null;
}

module.exports = {
  processarInteracao,
};
