const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const {
  ACAO_COMANDO_PREFIX,
  ACAO_ENTRAR_PREFIX,
  ACAO_FINALIZAR_PREFIX,
  ACAO_SAIR_PREFIX,
  ACAO_SELECT_RESULTADO_PREFIX,
  ACOES_DISPONIVEIS,
  ACOES_PAINEL_BANNER_URL,
  ACOES_PAINEL_IMAGE_PATH,
  CADASTRO_THUMBNAIL_URL,
} = require('../config/constants');

const ACAO_RASCUNHO_NOME_PREFIX = 'acao_rascunho_nome_';
const ACAO_RASCUNHO_TIPO_PREFIX = 'acao_rascunho_tipo_';
const ACAO_RASCUNHO_DETALHES_PREFIX = 'acao_rascunho_detalhes_';
const ACAO_RASCUNHO_CONFIRMAR_PREFIX = 'acao_rascunho_confirmar_';
const ACAO_RASCUNHO_MODAL_PREFIX = 'modal_rascunho_acao_';
const ACAO_RASCUNHO_TTL_MS = 30 * 60 * 1000;
const TIPOS_ACAO = ['Tiro', 'Fuga', 'Arma Branca'];
const PAINEL_DIVISOR = '------------------------------';

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

function obterResumoRascunhoAcao(rascunho, formatarMoeda) {
  return [
    `Modelo: ${obterLabelTamanhoAcao(rascunho.tamanho)}`,
    `Tipo da acao: ${rascunho.nomeAcao || 'Nao selecionada'}`,
    `Estilo: ${rascunho.tipoAcao || 'Nao selecionado'}`,
    `Participantes: ${rascunho.quantidadeParticipantes ?? 'Nao informado'}`,
    `Dinheiro coletado: ${rascunho.dinheiro ? formatarMoeda(rascunho.dinheiro) : 'Nao informado'}`,
  ];
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

function criarEmbedRascunhoAcao(rascunho, formatarMoeda) {
  const pronto = rascunhoAcaoEstaPronto(rascunho);

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Painel interativo de acao')
    .setDescription(
      [
        '**Resumo atual**',
        ...obterResumoRascunhoAcao(rascunho, formatarMoeda),
        '',
        PAINEL_DIVISOR,
        '',
        `**Etapa atual: ${pronto ? '3/3 - Confirmacao' : '2/3 - Configuracao'}**`,
        pronto
          ? 'Tudo pronto para publicar. Revise as informacoes e clique em "Criar acao".'
          : 'Use os menus abaixo e preencha os detalhes para concluir a configuracao.',
        '',
        PAINEL_DIVISOR,
        '',
        `Criado por: <@${rascunho.userId}>`,
        `Status: ${pronto ? 'Pronto para publicar' : 'Em configuracao'}`,
      ].join('\n')
    )
    .setFooter({ text: `Rascunho ${obterLabelTamanhoAcao(rascunho.tamanho)}` })
    .setTimestamp();
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

function montarPayloadRascunhoAcao(rascunho, formatarMoeda) {
  return {
    embeds: [criarEmbedRascunhoAcao(rascunho, formatarMoeda)],
    components: [
      criarAbasPainelRascunho(rascunhoAcaoEstaPronto(rascunho)),
      criarSelectRascunhoAcoes(rascunho.token, rascunho.tamanho, rascunho.nomeAcao),
      criarSelectRascunhoTipo(rascunho.token, rascunho.tipoAcao),
      criarBotoesRascunhoAcao(rascunho.token, rascunhoAcaoEstaPronto(rascunho)),
    ],
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

function obterArquivosPainelAcoes(fs) {
  if (!fs.existsSync(ACOES_PAINEL_IMAGE_PATH)) {
    return [];
  }

  return [new AttachmentBuilder(ACOES_PAINEL_IMAGE_PATH, { name: 'painel_acoes.png' })];
}

function criarPainelAcoes(fs) {
  const possuiBannerLocal = fs.existsSync(ACOES_PAINEL_IMAGE_PATH);
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Criar relatorio de acao')
    .setDescription(
      [
        'Este canal e destinado ao registro de acoes blipadas.',
        '',
        PAINEL_DIVISOR,
        '',
        'Selecione abaixo o porte da acao.',
        'Depois, complete o painel interativo que sera aberto em seguida.',
        'Os dados ficam organizados para controle, estatistica e historico.',
      ].join('\n')
    )
    .setThumbnail(CADASTRO_THUMBNAIL_URL)
    .setFooter({ text: 'VSYNC - Painel de Acoes' })
    .setTimestamp();

  if (possuiBannerLocal) {
    embed.setImage(ACOES_PAINEL_BANNER_URL);
  }

  const row = new ActionRowBuilder().addComponents(
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

  return {
    embed,
    components: [row],
  };
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

function criarEmbedAcao(acao, participantes, formatarMoeda) {
  const listaParticipantes = participantes.length
    ? participantes.map((participante) => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado ainda.';

  const totalAtual = participantes.length;
  const totalEsperado = acao.quantidade_participantes || 0;
  const etapaAtual = acao.resultado ? '3/3 - Finalizacao' : '2/3 - Participacao';

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Painel interativo de acao')
    .setDescription(
      [
        '**Resumo atual**',
        `Modelo: ${obterLabelTamanhoAcao(acao.tamanho)}`,
        `Tipo da acao: ${acao.nome_acao || 'Nao definido'}`,
        `Estilo: ${acao.tipo_acao || 'Nao definido'}`,
        `Participantes: ${totalAtual}/${totalEsperado}`,
        `Dinheiro coletado: ${formatarMoeda(acao.dinheiro)}`,
        '',
        PAINEL_DIVISOR,
        '',
        '**Participantes selecionados**',
        listaParticipantes,
        '',
        PAINEL_DIVISOR,
        '',
        `**Etapa atual: ${etapaAtual}**`,
        `Comando atual: ${acao.comando_texto || 'Ninguem assumiu o comando ainda'}`,
        `Resultado: ${acao.resultado || 'Em andamento'}`,
        `Abertura: <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
      ].join('\n')
    )
    .setFooter({ text: `Acao #${acao.id}` })
    .setTimestamp();
}

function criarEmbedLogAcao(acao, participantes, formatarMoeda) {
  const totalParticipantes = participantes.length || 1;
  const valorPorPessoa = Math.floor(Number(acao.dinheiro || 0) / totalParticipantes);
  const listaParticipantes = participantes.length
    ? participantes.map((participante) => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado.';

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho))
    .setDescription(
      [
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
      ].join('\n')
    )
    .setFooter({ text: `Acao #${acao.id}` })
    .setTimestamp(new Date(acao.finalizado_em || new Date()));
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
  criarEmbedAcao,
  criarEmbedLogAcao,
  montarPayloadRascunhoAcao,
  obterArquivosPainelAcoes,
  obterLabelTamanhoAcao,
  obterRascunhoAcao,
  rascunhoAcaoEstaPronto,
  removerRascunhoAcao,
};
