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

function criarEmbedRascunhoAcao(rascunho, formatarMoeda) {
  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`Configurar ${obterLabelTamanhoAcao(rascunho.tamanho)}`)
    .setDescription(
      [
        'Defina os dados da ação antes de criar o embed definitivo.',
        '',
        `**Ação:** ${rascunho.nomeAcao || 'Não selecionada'}`,
        `**Tipo:** ${rascunho.tipoAcao || 'Não selecionado'}`,
        `**Qtd. Participantes:** ${rascunho.quantidadeParticipantes ?? 'Não informado'}`,
        `**Dinheiro:** ${rascunho.dinheiro ? formatarMoeda(rascunho.dinheiro) : 'Não informado'}`,
        '',
        rascunhoAcaoEstaPronto(rascunho)
          ? 'Tudo pronto. Clique em "Criar Ação".'
          : 'Selecione a ação, o tipo e informe os detalhes para continuar.',
      ].join('\n')
    )
    .setFooter({ text: `Rascunho ${obterLabelTamanhoAcao(rascunho.tamanho)}` });
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
      .setPlaceholder('Escolha a ação')
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
      .setPlaceholder('Escolha o tipo da ação')
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
      .setLabel('Informar Quantidade e Dinheiro')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${ACAO_RASCUNHO_CONFIRMAR_PREFIX}${token}`)
      .setLabel('Criar Ação')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!pronto)
  );
}

function montarPayloadRascunhoAcao(rascunho, formatarMoeda) {
  return {
    embeds: [criarEmbedRascunhoAcao(rascunho, formatarMoeda)],
    components: [
      criarSelectRascunhoAcoes(rascunho.token, rascunho.tamanho, rascunho.nomeAcao),
      criarSelectRascunhoTipo(rascunho.token, rascunho.tipoAcao),
      criarBotoesRascunhoAcao(rascunho.token, rascunhoAcaoEstaPronto(rascunho)),
    ],
  };
}

function criarModalDetalhesRascunhoAcao(token, rascunho) {
  const modal = new ModalBuilder()
    .setCustomId(`${ACAO_RASCUNHO_MODAL_PREFIX}${token}`)
    .setTitle(`Detalhes • ${obterLabelTamanhoAcao(rascunho.tamanho)}`);

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
    .setTitle('Criar Relatório de Ação')
    .setDescription(
      [
        'Este canal é destinado ao **registro de ações blipadas**.',
        '',
        '━━━━━━━━━━━━━━━━━━',
        '• Selecione o tipo de ação realizada no menu abaixo.',
        '• Informe se a ação é no tiro, fuga ou arma branca.',
        '• Solicite que todos os membros participantes confirmem sua participação.',
        '• As informações serão registradas para fins de controle, estatística e histórico.',
        '',
        '📌 Utilize este recurso sempre que houver qualquer tipo de ação blipada em andamento.',
      ].join('\n')
    )
    .setThumbnail(CADASTRO_THUMBNAIL_URL)
    .setFooter({ text: 'VSYNC • Painel de Ações' })
    .setTimestamp();

  if (possuiBannerLocal) {
    embed.setImage(ACOES_PAINEL_BANNER_URL);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('acao_pequena')
      .setLabel('Ações Pequenas')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏳️'),
    new ButtonBuilder()
      .setCustomId('acao_media')
      .setLabel('Ações Médias')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏳️'),
    new ButtonBuilder()
      .setCustomId('acao_grande')
      .setLabel('Ações Grandes')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏳️')
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
        { label: 'Vitória', value: 'Vitória' },
        { label: 'Derrota', value: 'Derrota' },
        { label: 'Empate', value: 'Empate' }
      )
  );
}

function criarBotoesAcao(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACAO_ENTRAR_PREFIX}${acaoId}`)
      .setLabel('Entrar')
      .setStyle(ButtonStyle.Success)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_SAIR_PREFIX}${acaoId}`)
      .setLabel('Sair')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_COMANDO_PREFIX}${acaoId}`)
      .setLabel('Assumir Comando')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(desabilitado),
    new ButtonBuilder()
      .setCustomId(`${ACAO_FINALIZAR_PREFIX}${acaoId}`)
      .setLabel('Finalizar')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(desabilitado)
  );
}

function criarEmbedAcao(acao, participantes, formatarMoeda) {
  const listaParticipantes = participantes.length
    ? participantes.map((participante) => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado ainda.';

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(acao.nome_acao || `${obterLabelTamanhoAcao(acao.tamanho)} em andamento`)
    .setDescription(
      [
        `**Comando da ação:** ${acao.comando_texto || 'Ninguém assumiu o comando ainda'}`,
        `**Ação iniciada:** <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
        '',
        `**Qtd. Participantes:** ${participantes.length}/${acao.quantidade_participantes}`,
        `**Tipo da Ação:** ${acao.tipo_acao || 'Não definido'}`,
        `**Resultado:** ${acao.resultado || 'Em andamento'}`,
        '',
        `**Dinheiro:** ${formatarMoeda(acao.dinheiro)}`,
        '',
        '**Participantes**',
        listaParticipantes,
      ].join('\n')
    )
    .setFooter({ text: `Ação #${acao.id}` })
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
        `**Comando da ação:** ${acao.comando_texto || 'Não definido'}`,
        `**Ação iniciada:** <t:${Math.floor(new Date(acao.iniciado_em).getTime() / 1000)}:f>`,
        '',
        `**Qtd. Participantes:** ${participantes.length}`,
        `**Tipo da Ação:** ${acao.tipo_acao || 'Não definido'}`,
        `**Resultado:** ${acao.resultado || 'Não definido'}`,
        '',
        `**Dinheiro:** ${formatarMoeda(acao.dinheiro)}`,
        '',
        '**Participantes**',
        listaParticipantes,
        '',
        `**Valor por pessoa:** ${formatarMoeda(valorPorPessoa)}`,
        `**Finalizada:** <t:${Math.floor(new Date(acao.finalizado_em || new Date()).getTime() / 1000)}:f>`,
      ].join('\n')
    )
    .setFooter({ text: `Ação #${acao.id}` })
    .setTimestamp(new Date(acao.finalizado_em || new Date()));
}

module.exports = {
  ACAO_RASCUNHO_CONFIRMAR_PREFIX,
  ACAO_RASCUNHO_DETALHES_PREFIX,
  ACAO_RASCUNHO_MODAL_PREFIX,
  ACAO_RASCUNHO_NOME_PREFIX,
  ACAO_RASCUNHO_TIPO_PREFIX,
  criarBotoesAcao,
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
