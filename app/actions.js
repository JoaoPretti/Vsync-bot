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
  if (tamanho === 'pequena') return 'Acao Pequena';
  if (tamanho === 'media') return 'Acao Media';
  return 'Acao Grande';
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

function criarBotaoAba(label, style) {
  return new ButtonBuilder()
    .setCustomId(`aba_${label.toLowerCase()}`)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(true);
}

function criarAbasPainelRascunho(pronto = false) {
  return new ActionRowBuilder().addComponents(
    criarBotaoAba('Modelo', ButtonStyle.Secondary),
    criarBotaoAba('Tipo', ButtonStyle.Secondary),
    criarBotaoAba('Equipe', ButtonStyle.Secondary),
    criarBotaoAba('Dinheiro', pronto ? ButtonStyle.Secondary : ButtonStyle.Primary),
    criarBotaoAba('Finalizar', pronto ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

function criarAbasPainelAcao(resultadoDefinido = false) {
  return new ActionRowBuilder().addComponents(
    criarBotaoAba('Modelo', ButtonStyle.Secondary),
    criarBotaoAba('Tipo', ButtonStyle.Secondary),
    criarBotaoAba('Equipe', ButtonStyle.Primary),
    criarBotaoAba('Dinheiro', ButtonStyle.Secondary),
    criarBotaoAba('Finalizar', resultadoDefinido ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
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
      .setPlaceholder('Escolha o tipo de acao')
      .addOptions(
        opcoes.length
          ? opcoes
          : [{ label: 'Cadastre acoes em ACOES_DISPONIVEIS', value: 'indisponivel' }]
      )
      .setDisabled(opcoes.length === 0)
  );
}

function criarSelectRascunhoTipo(token, valorAtual = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_RASCUNHO_TIPO_PREFIX}${token}`)
      .setPlaceholder('Escolha o estilo da acao')
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
      .setLabel('Definir detalhes')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${ACAO_RASCUNHO_CONFIRMAR_PREFIX}${token}`)
      .setLabel('Criar acao')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!pronto)
  );
}

function criarSelectResultadoAcao(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_SELECT_RESULTADO_PREFIX}${acaoId}`)
      .setPlaceholder('Escolha o resultado final')
      .setDisabled(desabilitado)
      .addOptions(
        { label: 'Vitoria', value: 'Vitoria' },
        { label: 'Derrota', value: 'Derrota' },
        { label: 'Empate', value: 'Empate' }
      )
  );
}

function criarBotoesAcao(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACAO_COMANDO_PREFIX}${acaoId}`)
      .setLabel('Assumir comando')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_FINALIZAR_PREFIX}${acaoId}`)
      .setLabel('Finalizar')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado)
  );
}

function criarControlesAcaoSecundarios(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACAO_ENTRAR_PREFIX}${acaoId}`)
      .setLabel('Entrar na equipe')
      .setStyle(ButtonStyle.Success)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_SAIR_PREFIX}${acaoId}`)
      .setLabel('Sair da equipe')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado)
  );
}

function criarBotoesPainelAcoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('acao_pequena')
      .setLabel('Acoes Pequenas')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('acao_media')
      .setLabel('Acoes Medias')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('acao_grande')
      .setLabel('Acoes Grandes')
      .setStyle(ButtonStyle.Secondary)
  );
}

function criarPainelAcoes() {
  const container = criarContainerBase()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            [
              '## Painel de acoes',
              'Crie e acompanhe registros de acoes em um painel interativo.',
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Como funciona**',
          '- Escolha o porte da acao.',
          '- Preencha o rascunho com tipo, estilo, equipe e dinheiro.',
          '- Publique a acao e acompanhe tudo no mesmo card.',
        ].join('\n')
      )
    )
    .addActionRowComponents(criarBotoesPainelAcoes());

  return {
    identificador: 'painel_acoes_v2',
    content: null,
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
              '## Painel interativo de acao',
              'Defina os dados abaixo para publicar a acao com o visual integrado.',
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Resumo atual**',
          `Modelo: ${obterLabelTamanhoAcao(rascunho.tamanho)}`,
          `Tipo da acao: ${rascunho.nomeAcao || 'Nao selecionada'}`,
          `Estilo: ${rascunho.tipoAcao || 'Nao selecionado'}`,
          `Participantes: ${rascunho.quantidadeParticipantes ?? 'Nao informado'}`,
          `Dinheiro coletado: ${
            rascunho.dinheiro ? formatarMoeda(rascunho.dinheiro) : 'Nao informado'
          }`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          `**Etapa atual: ${pronto ? '3/3 - Confirmacao' : '2/3 - Configuracao'}**`,
          pronto
            ? 'Tudo pronto para publicar. Revise os dados e use o botao final.'
            : 'Use os menus e o botao de detalhes logo abaixo para concluir a configuracao.',
          `Criado por: <@${rascunho.userId}>`,
          `Status: ${pronto ? 'Pronto para publicar' : 'Em configuracao'}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addActionRowComponents(criarAbasPainelRascunho(pronto))
    .addActionRowComponents(
      criarSelectRascunhoAcoes(rascunho.token, rascunho.tamanho, rascunho.nomeAcao)
    )
    .addActionRowComponents(criarSelectRascunhoTipo(rascunho.token, rascunho.tipoAcao))
    .addActionRowComponents(criarBotoesRascunhoAcao(rascunho.token, pronto));
}

function montarPayloadRascunhoAcao(rascunho, formatarMoeda, options = {}) {
  const { ephemeral = false, aviso = null } = options;

  return {
    content: null,
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
  const etapaAtual = acao.resultado ? '3/3 - Finalizacao' : '2/3 - Participacao';

  return criarContainerBase()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            [
              '## Painel interativo de acao',
              `Acompanhe a configuracao e o andamento de ${acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho)}.`,
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnailPadrao())
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          '**Resumo atual**',
          `Modelo: ${obterLabelTamanhoAcao(acao.tamanho)}`,
          `Tipo da acao: ${acao.nome_acao || 'Nao definido'}`,
          `Estilo: ${acao.tipo_acao || 'Nao definido'}`,
          `Participantes: ${totalAtual}/${totalEsperado}`,
          `Dinheiro coletado: ${formatarMoeda(acao.dinheiro)}`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(['**Participantes selecionados**', listaParticipantes].join('\n'))
    )
    .addSeparatorComponents(criarSeparador())
    .addTextDisplayComponents(
      criarTexto(
        [
          `**Etapa atual: ${etapaAtual}**`,
          `Comando atual: ${acao.comando_texto || 'Ninguem assumiu o comando ainda'}`,
          `Resultado: ${acao.resultado || 'Em andamento'}`,
          `Abertura: <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
        ].join('\n')
      )
    )
    .addSeparatorComponents(criarSeparador())
    .addActionRowComponents(criarAbasPainelAcao(Boolean(acao.resultado)))
    .addActionRowComponents(criarSelectResultadoAcao(acao.id, desabilitado))
    .addActionRowComponents(criarBotoesAcao(acao.id, desabilitado))
    .addActionRowComponents(criarControlesAcaoSecundarios(acao.id, desabilitado));
}

function montarPayloadMensagemAcao(acao, participantes, formatarMoeda, desabilitado = false) {
  return {
    content: null,
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [criarContainerMensagemAcao(acao, participantes, formatarMoeda, desabilitado)],
  };
}

function montarPayloadRascunhoConcluido(channelId) {
  return {
    content: null,
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [
      criarContainerBase().addTextDisplayComponents(
        criarTexto(
          [
            '## Acao criada com sucesso',
            `A nova acao foi publicada em ${channelId ? `<#${channelId}>` : 'este canal'}.`,
            'Voce pode fechar esta mensagem.',
          ].join('\n')
        )
      ),
    ],
  };
}

function criarEmbedLogAcao(acao, participantes, formatarMoeda) {
  const totalParticipantes = participantes.length || 1;
  const valorPorPessoa = Math.floor(Number(acao.dinheiro || 0) / totalParticipantes);
  const listaParticipantes = participantes.length
    ? participantes.map((participante) => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado.';

  return {
    color: 0x2f3136,
    title: acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho),
    description: [
      `Comando da acao: ${acao.comando_texto || 'Nao definido'}`,
      `Acao iniciada: <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
      '',
      `Qtd. participantes: ${participantes.length}`,
      `Tipo da acao: ${acao.tipo_acao || 'Nao definido'}`,
      `Resultado: ${acao.resultado || 'Nao definido'}`,
      '',
      `Dinheiro: ${formatarMoeda(acao.dinheiro)}`,
      '',
      'Participantes',
      listaParticipantes,
      '',
      `Valor por pessoa: ${formatarMoeda(valorPorPessoa)}`,
      `Finalizada: <t:${Math.floor(new Date(acao.finalizado_em || new Date()).getTime() / 1000)}:f>`,
    ].join('\n'),
    footer: { text: `Acao #${acao.id}` },
    timestamp: new Date(acao.finalizado_em || new Date()).toISOString(),
  };
}

module.exports = {
  ACAO_RASCUNHO_CONFIRMAR_PREFIX,
  ACAO_RASCUNHO_DETALHES_PREFIX,
  ACAO_RASCUNHO_MODAL_PREFIX,
  ACAO_RASCUNHO_NOME_PREFIX,
  ACAO_RASCUNHO_TIPO_PREFIX,
  criarAbasPainelAcao,
  criarBotoesAcao,
  criarControlesAcaoSecundarios,
  criarModalDetalhesRascunhoAcao,
  criarPainelAcoes,
  criarRascunhoAcao,
  criarSelectResultadoAcao,
  criarEmbedLogAcao,
  montarPayloadMensagemAcao,
  montarPayloadRascunhoAcao,
  montarPayloadRascunhoConcluido,
  obterLabelTamanhoAcao,
  obterRascunhoAcao,
  rascunhoAcaoEstaPronto,
  removerRascunhoAcao,
};
