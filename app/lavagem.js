const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
} = require('discord.js');

const {
  CANAL_APROVACAO_LAVAGEM_ID,
  CANAL_REGISTRO_LAVAGEM_ID,
  LAVAGEM_APROVAR_PREFIX,
  LAVAGEM_MODAL_PREFIX,
  LAVAGEM_RECUSAR_PREFIX,
} = require('../config/constants');
const {
  aprovarLavagem,
  atualizarMensagemAprovacaoLavagem,
  buscarLavagemPorId,
  recusarLavagem,
  salvarLavagem,
} = require('../repositories');
const { formatarMoeda, normalizarEspacos } = require('../utils');

function obterConfigLavagem(tipo) {
  if (tipo === 'parceria') {
    return {
      tipo,
      titulo: 'Lavagem Parceria',
      taxaPercentual: 20,
      cor: 0x2f3136,
    };
  }

  return {
    tipo: 'pista',
    titulo: 'Lavagem Pista',
    taxaPercentual: 30,
    cor: 0x2f3136,
  };
}

function calcularValoresLavagem(quantidade, taxaPercentual) {
  const valorTotal = Number(quantidade);
  const valorFaccao = Math.floor((valorTotal * taxaPercentual) / 100);
  const valorCliente = valorTotal - valorFaccao;

  return {
    valorTotal,
    valorFaccao,
    valorCliente,
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
    ),
  ];
}

function criarContainerAprovacaoLavagem(lavagem, desabilitado = false, descricao = null) {
  const config = obterConfigLavagem(lavagem.tipo);
  const statusTexto =
    lavagem.status === 'pendente'
      ? 'Pendente'
      : lavagem.status === 'aprovada'
        ? 'Aprovada'
        : 'Recusada';

  return new ContainerBuilder()
    .setAccentColor(config.cor)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `## Aprovacao Pendente - ${config.titulo}`,
              descricao || 'Avalie a solicitacao abaixo.',
            ].join('\n')
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL('https://cdn.discordapp.com/embed/avatars/0.png')
            .setDescription('Lavagem')
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Grupo:** ${lavagem.grupo}`,
          `**Valor Total:** ${formatarMoeda(lavagem.quantidade)}`,
          `**Valor do Cliente:** ${formatarMoeda(lavagem.valor_cliente)}`,
          `**Valor da Faccao:** ${formatarMoeda(lavagem.valor_faccao)}`,
          `**Taxa:** ${lavagem.taxa_percentual}%`,
          `**Usuario:** <@${lavagem.usuario_id}>`,
          `**Passaporte:** ${lavagem.personagem_id}`,
          `**Status:** ${statusTexto}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(...criarBotoesAprovacaoLavagem(lavagem.id, desabilitado));
}

function montarPayloadAprovacaoLavagem(lavagem, desabilitado = false, descricao = null) {
  return {
    content: null,
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerAprovacaoLavagem(lavagem, desabilitado, descricao)],
  };
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
      {
        name: 'Aprovado por',
        value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado',
        inline: true,
      }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.atualizado_em || lavagem.criado_em));
}

async function processarModalLavagem(interaction, tipo, client) {
  const config = obterConfigLavagem(tipo);
  const quantidadeTexto = interaction.fields.getTextInputValue('quantidade').trim();
  const grupo = normalizarEspacos(interaction.fields.getTextInputValue('grupo'));
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();

  if (!/^\d+$/.test(quantidadeTexto)) {
    return interaction.reply({
      content: 'A quantidade para lavar deve conter apenas números inteiros.',
      ephemeral: true,
    });
  }

  if (!/^\d+$/.test(personagemId)) {
    return interaction.reply({
      content: 'O ID do personagem deve conter apenas números.',
      ephemeral: true,
    });
  }

  if (!grupo || grupo.length < 2) {
    return interaction.reply({
      content: 'Informe um grupo válido.',
      ephemeral: true,
    });
  }

  const quantidade = Number(quantidadeTexto);

  if (quantidade <= 0) {
    return interaction.reply({
      content: 'A quantidade para lavar deve ser maior que zero.',
      ephemeral: true,
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
    atualizadoEm: new Date(),
  });

  const canalAprovacao = await client.channels.fetch(CANAL_APROVACAO_LAVAGEM_ID).catch(() => null);

  if (!canalAprovacao || canalAprovacao.type !== ChannelType.GuildText) {
    throw new Error('Canal de aprovação de lavagem não encontrado ou inválido.');
  }

  const mensagemAprovacao = await canalAprovacao.send(montarPayloadAprovacaoLavagem(lavagem));

  await atualizarMensagemAprovacaoLavagem(lavagem.id, mensagemAprovacao.id, canalAprovacao.id);

  return interaction.editReply({
    content: `${config.titulo} enviada para aprovação com sucesso.`,
  });
}

async function finalizarLavagem(interaction, lavagemId, acao, client) {
  const lavagem = await buscarLavagemPorId(lavagemId);

  if (!lavagem) {
    return interaction.reply({
      content: 'Nao encontrei essa solicitacao de lavagem.',
      ephemeral: true,
    });
  }

  if (lavagem.status !== 'pendente') {
    return interaction.reply({
      content: `Essa lavagem ja foi ${lavagem.status}.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const lavagemAtualizada =
    acao === 'aprovar'
      ? await aprovarLavagem(lavagemId, interaction.user)
      : await recusarLavagem(lavagemId, interaction.user);

  if (!lavagemAtualizada) {
    return interaction.editReply({
      content: 'Essa lavagem ja foi processada por outra pessoa.',
    });
  }

  await interaction.message.edit(
    montarPayloadAprovacaoLavagem(
      lavagemAtualizada,
      true,
      acao === 'aprovar'
        ? `Solicitacao aprovada por <@${interaction.user.id}>.`
        : `Solicitacao recusada por <@${interaction.user.id}>.`
    )
  );

  if (acao === 'aprovar') {
    const canalRegistro = await client.channels.fetch(CANAL_REGISTRO_LAVAGEM_ID).catch(() => null);

    if (!canalRegistro || canalRegistro.type !== ChannelType.GuildText) {
      throw new Error('Canal de registro de lavagem nao encontrado ou invalido.');
    }

    await canalRegistro.send({
      embeds: [criarEmbedRegistroLavagem(lavagemAtualizada)],
    });
  }

  return interaction.editReply({
    content:
      acao === 'aprovar'
        ? 'Lavagem aprovada e registrada com sucesso.'
        : 'Lavagem recusada com sucesso.',
  });
}

module.exports = {
  calcularValoresLavagem,
  criarBotoesAprovacaoLavagem,
  criarEmbedAprovacaoLavagem,
  criarEmbedRegistroLavagem,
  criarModalLavagem,
  finalizarLavagem,
  obterConfigLavagem,
  processarModalLavagem,
};
