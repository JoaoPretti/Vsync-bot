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
  ADMIN_PARCERIA_CADASTRAR_BUTTON_ID,
  ADMIN_PARCERIA_CADASTRAR_MODAL_ID,
  ADMIN_PARCERIA_LISTAR_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_MODAL_ID,
  CADASTRO_THUMBNAIL_URL,
  PAINEL_ADMINISTRATIVO_ID,
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

function criarPainelAdministrativo() {
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
          '## Meta semanal',
          '',
          '- Reservado para a central de metas semanais da faccao.',
          '- Esta area fica preparada no painel, mas os controles ainda nao foram implementados.',
        ].join('\n')
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        criarBotao('admin_meta_listar_placeholder', 'Ver Metas', '📈', true),
        criarBotao('admin_meta_atualizar_placeholder', 'Atualizar Meta', '⚙️', true),
        criarBotao('admin_meta_adicionar_placeholder', 'Adicionar Meta', '➕', true),
        criarBotao('admin_meta_remover_placeholder', 'Deletar Meta', '➖', true)
      )
    );

  return {
    identificador: PAINEL_ADMINISTRATIVO_ID,
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

module.exports = {
  criarModalCadastrarParceria,
  criarModalRemoverParceria,
  criarPainelAdministrativo,
};
