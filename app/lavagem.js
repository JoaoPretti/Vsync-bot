const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
} = require('discord.js');

const {
  CADASTRO_THUMBNAIL_URL,
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

const LAVAGEM_PARCEIRO_SELECT_ID = 'lavagem_parceiro_select';

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

function formatarDataHoraBr(data) {
  const valorData = data ? new Date(data) : new Date();

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(valorData);
}

function gerarNotaFiscalLavagem(data) {
  const valorData = data ? new Date(data) : new Date();
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(valorData)
    .reduce((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }

      return acc;
    }, {});

  return `${partes.year}${partes.month}${partes.day}${partes.hour}${partes.minute}${partes.second}`;
}

function normalizarNomeGrupoParceiro(nome) {
  return normalizarEspacos(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function criarThumbnailLavagem() {
  return new ThumbnailBuilder().setURL(CADASTRO_THUMBNAIL_URL).setDescription('VSYNC');
}

function montarPayloadSelecaoGrupoParceiro(grupos) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(LAVAGEM_PARCEIRO_SELECT_ID)
    .setPlaceholder('Selecione o grupo parceiro')
    .addOptions(
      grupos.map((grupo) => ({
        label: grupo.nome.slice(0, 100),
        value: String(grupo.id),
        description: `Usar ${grupo.nome.slice(0, 70)} na lavagem de parceria`,
      }))
    );

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central de lavagem', 'Escolha abaixo qual grupo parceiro sera usado.'].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailLavagem())
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '**Grupos disponiveis**',
          'A lista abaixo mostra apenas os grupos parceiros cadastrados pela administracao.',
        ].join('\n')
      )
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));

  return {
    embeds: [],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarModalLavagem(tipo, grupoParceiro = null) {
  const config = obterConfigLavagem(tipo);
  const modal = new ModalBuilder()
    .setCustomId(
      grupoParceiro
        ? `${LAVAGEM_MODAL_PREFIX}${config.tipo}_${grupoParceiro.id}`
        : `${LAVAGEM_MODAL_PREFIX}${config.tipo}`
    )
    .setTitle(
      grupoParceiro ? `${config.titulo} - ${grupoParceiro.nome.slice(0, 35)}` : config.titulo
    );

  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade')
    .setLabel('Quantidade para lavar')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: 1000000')
    .setMaxLength(12);

  const personagemIdInput = new TextInputBuilder()
    .setCustomId('personagem_id')
    .setLabel('ID do personagem que esta lavando')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: 6001')
    .setMaxLength(10);

  const componentes = [new ActionRowBuilder().addComponents(quantidadeInput)];

  if (!grupoParceiro) {
    const grupoInput = new TextInputBuilder()
      .setCustomId('grupo')
      .setLabel('Grupo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Ex.: Grupo Norte')
      .setMaxLength(60);

    componentes.push(new ActionRowBuilder().addComponents(grupoInput));
  }

  componentes.push(new ActionRowBuilder().addComponents(personagemIdInput));
  modal.addComponents(...componentes);

  return modal;
}

function criarBotoesAprovacaoLavagem(lavagemId, desabilitado = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${LAVAGEM_APROVAR_PREFIX}${lavagemId}`)
        .setLabel('Aprovar solicitacao')
        .setStyle(ButtonStyle.Success)
        .setDisabled(desabilitado),
      new ButtonBuilder()
        .setCustomId(`${LAVAGEM_RECUSAR_PREFIX}${lavagemId}`)
        .setLabel('Recusar solicitacao')
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
              '## Central de lavagem',
              descricao || `Revise a solicitacao de ${config.titulo.toLowerCase()} nesta central.`,
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailLavagem())
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '**Resumo da central**',
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
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerAprovacaoLavagem(lavagem, desabilitado, descricao)],
  };
}

function criarContainerRegistroLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);
  const notaFiscal = gerarNotaFiscalLavagem(lavagem.criado_em || lavagem.atualizado_em);
  const dataHora = formatarDataHoraBr(lavagem.criado_em || lavagem.atualizado_em);
  const subtitulo = config.titulo.replace('Lavagem ', '');

  return new ContainerBuilder()
    .setAccentColor(0x57f287)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central de lavagem', `Lavagem Confirmada - ${subtitulo} | NF ${notaFiscal}`].join(
              '\n'
            )
          )
        )
        .setThumbnailAccessory(criarThumbnailLavagem())
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `Lavagem - ${formatarMoeda(lavagem.quantidade)}`,
          `Taxa de Lavagem: ${lavagem.taxa_percentual}%`,
          '',
          `Valor para faccao - ${formatarMoeda(lavagem.valor_faccao)}`,
          '```',
          `${Number(lavagem.valor_faccao || 0)}`,
          '```',
          '',
          `Valor do cliente - ${formatarMoeda(lavagem.valor_cliente)}`,
          '```',
          `${Number(lavagem.valor_cliente || 0)}`,
          '```',
          `**Grupo:**`,
          `${lavagem.grupo}`,
          `**Total Cliente:**`,
          `${formatarMoeda(lavagem.valor_cliente)}`,
          `**Quem:**`,
          `<@${lavagem.usuario_id}> | ${lavagem.personagem_id}`,
          `**Data e Hora:**`,
          `${dataHora}`,
          `**Nota Fiscal:**`,
          `${notaFiscal}`,
          `**Status:**`,
          `${
            lavagem.aprovado_por_id ? `Confirmado por <@${lavagem.aprovado_por_id}>` : 'Confirmado'
          }`,
        ].join('\n')
      )
    );
}

function montarPayloadRegistroLavagem(lavagem) {
  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerRegistroLavagem(lavagem)],
  };
}

async function processarModalLavagem(interaction, tipo, client, grupoParceiro = null) {
  const config = obterConfigLavagem(tipo);
  const quantidadeTexto = interaction.fields.getTextInputValue('quantidade').trim();
  const grupo = grupoParceiro?.nome
    ? grupoParceiro.nome
    : normalizarEspacos(interaction.fields.getTextInputValue('grupo'));
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();

  if (!/^\d+$/.test(quantidadeTexto)) {
    return interaction.reply({
      content: 'A quantidade para lavar deve conter apenas numeros inteiros.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!/^\d+$/.test(personagemId)) {
    return interaction.reply({
      content: 'O ID do personagem deve conter apenas numeros.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!grupo || grupo.length < 2) {
    return interaction.reply({
      content: 'Informe um grupo valido.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const quantidade = Number(quantidadeTexto);

  if (quantidade <= 0) {
    return interaction.reply({
      content: 'A quantidade para lavar deve ser maior que zero.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const valores = calcularValoresLavagem(quantidade, config.taxaPercentual);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    throw new Error('Canal de aprovacao de lavagem nao encontrado ou invalido.');
  }

  const mensagemAprovacao = await canalAprovacao.send(montarPayloadAprovacaoLavagem(lavagem));

  await atualizarMensagemAprovacaoLavagem(lavagem.id, mensagemAprovacao.id, canalAprovacao.id);

  return interaction.editReply({
    content: `${config.titulo} enviada para aprovacao com sucesso.`,
  });
}

async function finalizarLavagem(interaction, lavagemId, acao, client) {
  const lavagem = await buscarLavagemPorId(lavagemId);

  if (!lavagem) {
    return interaction.reply({
      content: 'Nao encontrei essa solicitacao de lavagem.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (lavagem.status !== 'pendente') {
    return interaction.reply({
      content: `Essa lavagem ja foi ${lavagem.status}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

    await canalRegistro.send(montarPayloadRegistroLavagem(lavagemAtualizada));
  }

  return interaction.editReply({
    content:
      acao === 'aprovar'
        ? 'Lavagem aprovada e registrada com sucesso.'
        : 'Lavagem recusada com sucesso.',
  });
}

module.exports = {
  criarModalLavagem,
  finalizarLavagem,
  LAVAGEM_PARCEIRO_SELECT_ID,
  montarPayloadAprovacaoLavagem,
  montarPayloadSelecaoGrupoParceiro,
  normalizarNomeGrupoParceiro,
  processarModalLavagem,
};
