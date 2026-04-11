const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
  ACAO_COMANDO_PREFIX,
  ACAO_ENTRAR_PREFIX,
  ACAO_FINALIZAR_PREFIX,
  ACAO_SAIR_PREFIX,
  ACAO_SELECT_RESULTADO_PREFIX,
  ACOES_DISPONIVEIS,
  CADASTRO_THUMBNAIL_URL,
} = require('../config/constants');

const ACAO_RASCUNHO_NOME_PREFIX = 'acao_rascunho_nome_';
const ACAO_RASCUNHO_TIPO_PREFIX = 'acao_rascunho_tipo_';
const ACAO_RASCUNHO_DETALHES_PREFIX = 'acao_rascunho_detalhes_';
const ACAO_RASCUNHO_CONFIRMAR_PREFIX = 'acao_rascunho_confirmar_';
const ACAO_RASCUNHO_MODAL_PREFIX = 'modal_rascunho_acao_';
const ACAO_RASCUNHO_TTL_MS = 30 * 60 * 1000;
const TIPOS_ACAO = ['Tiro', 'Fuga', 'Arma Branca'];

const rascunhosAcao = new Map();

function obterLabelTamanhoAcao(tamanho) {
  if (tamanho === 'pequena') return 'Ação Pequena';
  if (tamanho === 'media') return 'Ação Média';
  return 'Ação Grande';
}

function criarTokenRascunhoAcao(userId) {
  return `${userId}_${Date.now().toString(36)}`;
}

function limparRascunhosAcaoExpirados() {
  const agora = Date.now();

  for (const [token, rascunho] of rascunhosAcao.entries()) {
    if (agora - rascunho.criadoEmMs > ACAO_RASCUNHO_TTL_MS) {
      rascunhosAcao.delete(token);
    }
  }
}

function obterRascunhoAcao(token, userId) {
  limparRascunhosAcaoExpirados();

  const rascunho = rascunhosAcao.get(token);

  if (!rascunho || rascunho.userId !== userId) {
    return null;
  }

  return rascunho;
}

function criarRascunhoAcao(userId, channelId, tamanho) {
  limparRascunhosAcaoExpirados();

  const token = criarTokenRascunhoAcao(userId);
  const rascunho = {
    token,
    userId,
    channelId,
    tamanho,
    nomeAcao: null,
    tipoAcao: null,
    quantidadeParticipantes: null,
    dinheiro: null,
    criadoEmMs: Date.now(),
  };

  rascunhosAcao.set(token, rascunho);

  return rascunho;
}

function removerRascunhoAcao(token) {
  rascunhosAcao.delete(token);
}

function rascunhoAcaoEstaPronto(rascunho) {
  return Boolean(
    rascunho?.nomeAcao &&
    rascunho?.tipoAcao &&
    Number.isInteger(rascunho?.quantidadeParticipantes) &&
    rascunho.quantidadeParticipantes > 0 &&
    Number.isInteger(rascunho?.dinheiro) &&
    rascunho.dinheiro > 0
  );
}

function criarTexto(content) {
  return new TextDisplayBuilder().setContent(content);
}

function criarSeparador() {
  return new SeparatorBuilder().setDivider(true);
}

function criarThumbnailPadrao() {
  return new ThumbnailBuilder().setURL(CADASTRO_THUMBNAIL_URL).setDescription('VSYNC');
}

function criarContainerBase() {
  return new ContainerBuilder().setAccentColor(0x2f3136);
}

function criarSelectRascunhoAcoes(token, tamanho, valorAtual = null) {
  const opcoes = (ACOES_DISPONIVEIS[tamanho] || []).slice(0, 25).map((acao) => ({
    label: acao.slice(0, 100),
    value: acao,
    default: acao === valorAtual,
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_RASCUNHO_NOME_PREFIX}${token}`)
      .setPlaceholder('Selecione a ação')
      .addOptions(
        opcoes.length
          ? opcoes
          : [{ label: 'Cadastre ações em ACOES_DISPONIVEIS', value: 'indisponivel' }]
      )
      .setDisabled(opcoes.length === 0)
  );
}

function criarSelectRascunhoTipo(token, valorAtual = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_RASCUNHO_TIPO_PREFIX}${token}`)
      .setPlaceholder('Selecione o estilo')
      .addOptions(
        ...TIPOS_ACAO.map((tipo) => ({
          label: tipo,
          value: tipo,
          default: tipo === valorAtual,
        }))
      )
  );
}

function criarBotoesRascunhoAcao(token, pronto = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACAO_RASCUNHO_DETALHES_PREFIX}${token}`)
      .setLabel('Preencher detalhes')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${ACAO_RASCUNHO_CONFIRMAR_PREFIX}${token}`)
      .setLabel('Publicar ação')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!pronto)
  );
}

function criarSelectResultadoAcao(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_SELECT_RESULTADO_PREFIX}${acaoId}`)
      .setPlaceholder('Selecione o resultado')
      .setDisabled(desabilitado)
      .addOptions(
        { label: 'Vitória', value: 'Vitoria' },
        { label: 'Derrota', value: 'Derrota' },
        { label: 'Empate', value: 'Empate' }
      )
  );
}

function criarBotoesAcao(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACAO_COMANDO_PREFIX}${acaoId}`)
      .setLabel('Assumir liderança')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_FINALIZAR_PREFIX}${acaoId}`)
      .setLabel('Encerrar ação')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado)
  );
}

function criarControlesAcaoSecundarios(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACAO_ENTRAR_PREFIX}${acaoId}`)
      .setLabel('Entrar na ação')
      .setStyle(ButtonStyle.Success)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_SAIR_PREFIX}${acaoId}`)
      .setLabel('Sair da ação')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado)
  );
}

function criarBotoesPainelAcoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('acao_pequena')
      .setLabel('Ação pequena')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('acao_media')
      .setLabel('Ação média')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('acao_grande')
      .setLabel('Ação grande')
      .setStyle(ButtonStyle.Secondary)
  );
}

function criarPainelAcoes() {
  const container = criarContainerBase()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            ['## Central de ações', 'Selecione o porte e siga o fluxo da ação neste painel.'].join(
              '\n'
            )
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Fluxo da central**',
          '- Escolha o porte da ação.',
          '- Monte o rascunho com modelo, estilo, equipe e valor.',
          '- Publique e acompanhe tudo no mesmo card.',
        ].join('\n')
      )
    )
    .addActionRowComponents(criarBotoesPainelAcoes());

  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function combinarFlags(...flags) {
  return flags.reduce((total, flag) => total | flag, 0);
}

function criarContainerRascunhoAcao(rascunho, formatarMoeda, aviso = null) {
  const pronto = rascunhoAcaoEstaPronto(rascunho);
  const container = criarContainerBase();

  if (aviso) {
    container
      .addTextDisplayComponents(criarTexto(`> ${aviso}`))
      .addSeparatorComponents(criarSeparador());
  }

  return container
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            [
              '## Central de ações',
              'Preencha o rascunho da ação e publique quando tudo estiver pronto.',
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Resumo da ação**',
          `Modelo: ${obterLabelTamanhoAcao(rascunho.tamanho)}`,
          `Tipo da ação: ${rascunho.nomeAcao || 'Não selecionada'}`,
          `Estilo: ${rascunho.tipoAcao || 'Não selecionado'}`,
          `Participantes: ${rascunho.quantidadeParticipantes ?? 'Não informado'}`,
          `Dinheiro coletado: ${
            rascunho.dinheiro ? formatarMoeda(rascunho.dinheiro) : 'Não informado'
          }`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          `**Andamento da central: ${pronto ? '3/3 - Confirmação' : '2/3 - Configuração'}**`,
          pronto
            ? 'Tudo pronto para publicar. Revise os dados e use o botão final.'
            : 'Use os menus e o botão de detalhes logo abaixo para concluir a configuração.',
          `Criado por: <@${rascunho.userId}>`,
          `Status: ${pronto ? 'Pronto para publicar' : 'Em configuração'}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addActionRowComponents(
      criarSelectRascunhoAcoes(rascunho.token, rascunho.tamanho, rascunho.nomeAcao)
    )
    .addActionRowComponents(criarSelectRascunhoTipo(rascunho.token, rascunho.tipoAcao))
    .addActionRowComponents(criarBotoesRascunhoAcao(rascunho.token, pronto));
}

function montarPayloadRascunhoAcao(rascunho, formatarMoeda, options = {}) {
  const { ephemeral = false, aviso = null } = options;

  return {
    embeds: [],
    flags: ephemeral
      ? combinarFlags(MessageFlags.Ephemeral, MessageFlags.IsComponentsV2)
      : MessageFlags.IsComponentsV2,
    components: [criarContainerRascunhoAcao(rascunho, formatarMoeda, aviso)],
  };
}

function criarModalDetalhesRascunhoAcao(token, rascunho) {
  const modal = new ModalBuilder()
    .setCustomId(`${ACAO_RASCUNHO_MODAL_PREFIX}${token}`)
    .setTitle(`Detalhes - ${obterLabelTamanhoAcao(rascunho.tamanho)}`);

  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade_participantes')
    .setLabel('Quantidade de participantes')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(rascunho.quantidadeParticipantes ? String(rascunho.quantidadeParticipantes) : '')
    .setMaxLength(3)
    .setPlaceholder('Ex.: 8');

  const dinheiroInput = new TextInputBuilder()
    .setCustomId('dinheiro')
    .setLabel('Dinheiro')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(rascunho.dinheiro ? String(rascunho.dinheiro) : '')
    .setMaxLength(12)
    .setPlaceholder('Ex.: 1125000');

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidadeInput),
    new ActionRowBuilder().addComponents(dinheiroInput)
  );

  return modal;
}

function criarContainerMensagemAcao(acao, participantes, formatarMoeda, desabilitado = false) {
  const listaParticipantes = participantes.length
    ? participantes
        .map((participante, index) => `${index + 1}. <@${participante.usuario_id}>`)
        .join('\n')
    : 'Nenhum participante confirmado ainda.';

  const totalAtual = participantes.length;
  const totalEsperado = acao.quantidade_participantes || 0;
  const etapaAtual = acao.resultado ? '3/3 - Finalização' : '2/3 - Participação';

  return criarContainerBase()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            [
              '## Central de ações',
              `Acompanhe ${acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho)} em tempo real nesta central.`,
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Resumo da ação**',
          `Modelo: ${obterLabelTamanhoAcao(acao.tamanho)}`,
          `Tipo da ação: ${acao.nome_acao || 'Não definido'}`,
          `Estilo: ${acao.tipo_acao || 'Não definido'}`,
          `Participantes: ${totalAtual}/${totalEsperado}`,
          `Dinheiro coletado: ${formatarMoeda(acao.dinheiro)}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(criarTexto(['**Equipe confirmada**', listaParticipantes].join('\n')))
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          `**Controle da central: ${etapaAtual}**`,
          `Comando atual: ${acao.comando_texto || 'Ninguém assumiu o comando ainda'}`,
          `Resultado: ${acao.resultado || 'Em andamento'}`,
          `Abertura: <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addActionRowComponents(criarSelectResultadoAcao(acao.id, desabilitado))
    .addActionRowComponents(criarBotoesAcao(acao.id, desabilitado))
    .addActionRowComponents(criarControlesAcaoSecundarios(acao.id, desabilitado));
}

function montarPayloadMensagemAcao(acao, participantes, formatarMoeda, desabilitado = false) {
  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerMensagemAcao(acao, participantes, formatarMoeda, desabilitado)],
  };
}

function montarPayloadRascunhoConcluido(channelId) {
  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [
      criarContainerBase().addTextDisplayComponents(
        criarTexto(
          [
            '## Central de ações',
            'Ação criada com sucesso.',
            `A nova ação foi publicada em ${channelId ? `<#${channelId}>` : 'este canal'}.`,
            'Você pode fechar esta mensagem.',
          ].join('\n')
        )
      ),
    ],
  };
}

function criarContainerLogAcao(acao, participantes, formatarMoeda) {
  const totalParticipantes = participantes.length || 1;
  const valorPorPessoa = Math.floor(Number(acao.dinheiro || 0) / totalParticipantes);
  const listaParticipantes = participantes.length
    ? participantes.map((participante) => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado.';

  return criarContainerBase()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            [
              '## Central de ações',
              `${acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho)} finalizada e registrada com sucesso.`,
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Resumo da central**',
          `**Ação:** ${acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho)}`,
          `**Liderança:** ${acao.comando_texto || 'Não definida'}`,
          `**Estilo:** ${acao.tipo_acao || 'Não definido'}`,
          `**Resultado:** ${acao.resultado || 'Não definido'}`,
          `**Participantes:** ${participantes.length}`,
          `**Valor total:** ${formatarMoeda(acao.dinheiro)}`,
          `**Valor por pessoa:** ${formatarMoeda(valorPorPessoa)}`,
          `**Iniciada em:** <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
          `**Finalizada em:** <t:${Math.floor(
            new Date(acao.finalizado_em || new Date()).getTime() / 1000
          )}:f>`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(criarTexto(['**Equipe registrada**', listaParticipantes].join('\n')));
}

function montarPayloadLogAcao(acao, participantes, formatarMoeda) {
  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerLogAcao(acao, participantes, formatarMoeda)],
  };
}

module.exports = {
  ACAO_RASCUNHO_CONFIRMAR_PREFIX,
  ACAO_RASCUNHO_DETALHES_PREFIX,
  ACAO_RASCUNHO_MODAL_PREFIX,
  ACAO_RASCUNHO_NOME_PREFIX,
  ACAO_RASCUNHO_TIPO_PREFIX,
  criarModalDetalhesRascunhoAcao,
  criarPainelAcoes,
  criarRascunhoAcao,
  montarPayloadLogAcao,
  montarPayloadMensagemAcao,
  montarPayloadRascunhoAcao,
  montarPayloadRascunhoConcluido,
  obterRascunhoAcao,
  rascunhoAcaoEstaPronto,
  removerRascunhoAcao,
};
