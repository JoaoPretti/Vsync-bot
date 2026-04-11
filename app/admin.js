const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
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
  ADMIN_BANCO_ADICIONAR_BUTTON_ID,
  ADMIN_BANCO_ADICIONAR_MODAL_ID,
  ADMIN_BANCO_RETIRAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_MODAL_ID,
  ADMIN_PARCERIA_CADASTRAR_BUTTON_ID,
  ADMIN_PARCERIA_CADASTRAR_MODAL_ID,
  ADMIN_PARCERIA_LISTAR_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_MODAL_ID,
  CADASTRO_THUMBNAIL_URL,
} = require('../config/constants');

function criarBotao(customId, label, emoji, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(emoji)
    .setDisabled(disabled);
}

function criarTexto(content) {
  return new TextDisplayBuilder().setContent(content);
}

function criarThumbnail() {
  return new ThumbnailBuilder().setURL(CADASTRO_THUMBNAIL_URL).setDescription('VSYNC');
}

function criarModalBanco(customId, title) {
  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade')
    .setLabel('Quantidade')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(12)
    .setPlaceholder('Ex.: 1500000');

  const motivoInput = new TextInputBuilder()
    .setCustomId('motivo')
    .setLabel('Motivo')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(120)
    .setPlaceholder('Ex.: Aporte semanal');

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(quantidadeInput),
      new ActionRowBuilder().addComponents(motivoInput)
    );
}

function criarPainelAdministrativo(saldoBanco = null) {
  const textoSaldo =
    saldoBanco == null ? 'Saldo atual indisponivel no momento.' : `Saldo atual: **${saldoBanco}**`;

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(
            [
              '## Painel Administrativo para gerentes e donos',
              'As opcoes abaixo sao de carater de gestao, entao tome cuidado para somente a gerencia ter acesso a esta sala.',
            ].join('\n')
          )
        )
        .setThumbnailAccessory(criarThumbnail())
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      criarTexto(
        [
          '## Gestao de Parcerias',
          '',
          '- Gerencie os grupos parceiros disponiveis no fluxo de lavagem parceria.',
          '- Cadastre novas opcoes para aparecer na selecao da lavagem.',
          '- Liste os grupos atuais e remova nomes que nao devem mais ser usados.',
        ].join('\n')
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        criarBotao(ADMIN_PARCERIA_LISTAR_BUTTON_ID, 'Listar Parcerias', '🔄'),
        criarBotao(ADMIN_PARCERIA_CADASTRAR_BUTTON_ID, 'Registrar Parceria', '➕'),
        criarBotao(ADMIN_PARCERIA_REMOVER_BUTTON_ID, 'Remover Parceria', '➖')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      criarTexto(
        [
          '## Registro Bancario',
          '',
          '- Registre entradas e retiradas do caixa da faccao.',
          '- Tudo o que for adicionado entra no saldo e tudo o que for retirado sai do saldo.',
          `- ${textoSaldo}`,
        ].join('\n')
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        criarBotao(ADMIN_BANCO_ADICIONAR_BUTTON_ID, 'Valor Adicionado', '💰'),
        criarBotao(ADMIN_BANCO_RETIRAR_BUTTON_ID, 'Valor Retirado', '🏧')
      )
    );

  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

function criarModalCadastrarParceria() {
  const nomeInput = new TextInputBuilder()
    .setCustomId('nome')
    .setLabel('Nome da parceria')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setPlaceholder('Ex.: Grupo Norte');

  return new ModalBuilder()
    .setCustomId(ADMIN_PARCERIA_CADASTRAR_MODAL_ID)
    .setTitle('Registrar Parceria')
    .addComponents(new ActionRowBuilder().addComponents(nomeInput));
}

function criarModalRemoverParceria() {
  const nomeInput = new TextInputBuilder()
    .setCustomId('nome')
    .setLabel('Nome da parceria')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setPlaceholder('Ex.: Grupo Norte');

  return new ModalBuilder()
    .setCustomId(ADMIN_PARCERIA_REMOVER_MODAL_ID)
    .setTitle('Remover Parceria')
    .addComponents(new ActionRowBuilder().addComponents(nomeInput));
}

function criarModalBancoAdicionar() {
  return criarModalBanco(ADMIN_BANCO_ADICIONAR_MODAL_ID, 'Valor Adicionado');
}

function criarModalBancoRetirar() {
  return criarModalBanco(ADMIN_BANCO_RETIRAR_MODAL_ID, 'Valor Retirado');
}

function montarPayloadLogRegistroBancario({
  tipo,
  quantidade,
  motivo,
  criadoEm,
  usuarioId,
  saldoAtual,
}) {
  const titulo = tipo === 'adicao' ? 'Valor Adicionado' : 'Valor Retirado';
  const descricao =
    tipo === 'adicao'
      ? 'Entrada registrada no caixa da faccao.'
      : 'Saida registrada no caixa da faccao.';
  const cor = tipo === 'adicao' ? 0x57f287 : 0xed4245;

  const container = new ContainerBuilder()
    .setAccentColor(cor)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          criarTexto(['## Registro bancario', `${titulo} registrado com sucesso.`].join('\n'))
        )
        .setThumbnailAccessory(criarThumbnail())
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      criarTexto(
        [
          descricao,
          '',
          `**Quantidade:** ${quantidade}`,
          `**Motivo:** ${motivo}`,
          `**Data:** ${criadoEm}`,
          `**Registrado por:** <@${usuarioId}>`,
          `**Saldo atual:** ${saldoAtual}`,
        ].join('\n')
      )
    );

  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

module.exports = {
  criarModalBancoAdicionar,
  criarModalBancoRetirar,
  criarModalCadastrarParceria,
  criarModalRemoverParceria,
  criarPainelAdministrativo,
  montarPayloadLogRegistroBancario,
};
