require('dotenv').config();

const cron = require('node-cron');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  ContainerBuilder,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require('discord.js');

const db = require('./database/db');
const initDatabase = require('./database/init');
const {
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
  obterRascunhoAcao,
  rascunhoAcaoEstaPronto,
  removerRascunhoAcao,
} = require('./app/actions');
const {
  aplicarCadastroUsuario,
  aprovarOuRecusarCadastro,
  criarModalCadastro,
  criarPainelCadastro,
  enviarMensagemCanalCadastro,
  processarCadastro,
} = require('./app/cadastro');
const {
  criarModalBancoAdicionar,
  criarModalBancoRetirar,
  criarModalCadastrarParceria,
  criarModalRemoverParceria,
  criarPainelAdministrativo,
  montarPayloadConfirmacaoResetBanco,
  montarPayloadLogRegistroBancario,
  montarPayloadLogResetBanco,
} = require('./app/admin');
const { processarInteracao } = require('./app/interactions');
const {
  criarModalLavagem,
  finalizarLavagem,
  LAVAGEM_PARCEIRO_SELECT_ID,
  montarPayloadSelecaoGrupoParceiro,
  normalizarNomeGrupoParceiro,
  processarModalLavagem,
} = require('./app/lavagem');
const {
  ADMIN_BANCO_ADICIONAR_BUTTON_ID,
  ADMIN_BANCO_ADICIONAR_MODAL_ID,
  ADMIN_BANCO_RESETAR_BUTTON_ID,
  ADMIN_BANCO_RESETAR_CANCELAR_BUTTON_ID,
  ADMIN_BANCO_RESETAR_CONFIRMAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_MODAL_ID,
  ADMIN_PARCERIA_CADASTRAR_BUTTON_ID,
  ADMIN_PARCERIA_LISTAR_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_BUTTON_ID,
  CANAL_LOG_BANCO_ID,
  CANAL_LOG_ACOES_ID,
  CADASTRO_BUTTON_ID,
  PAINEL_ACOES_CANAL_ID,
  PAINEL_ADMINISTRATIVO_CANAL_ID,
  PAINEL_CADASTRO_CANAL_ID,
  PAINEL_PRINCIPAL_CANAL_ID,
  PAINEL_THUMBNAIL_URL,
} = require('./config/constants');
const { validarEnvObrigatorias } = require('./config/env');
const repositories = require('./repositories');
const utils = require('./utils');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember, Partials.User],
});

function formatarMoeda(valor) {
  return utils.formatarMoeda(valor);
}

function coletarCustomIdsComponentes(componentes = []) {
  const ids = [];

  for (const componente of componentes) {
    if (!componente) {
      continue;
    }

    if (componente.customId) {
      ids.push(componente.customId);
    }

    if (componente.accessory?.customId) {
      ids.push(componente.accessory.customId);
    }

    if (Array.isArray(componente.components) && componente.components.length) {
      ids.push(...coletarCustomIdsComponentes(componente.components));
    }
  }

  return ids;
}

function mensagemPossuiAlgumCustomId(message, customIds) {
  const idsNaMensagem = new Set(coletarCustomIdsComponentes(message.components));
  return customIds.some((customId) => idsNaMensagem.has(customId));
}

async function resolverUrlImagem(urlInformada) {
  return utils.resolverUrlImagem(urlInformada);
}

async function buscarCadastroPorUsuario(discordUserId) {
  return repositories.buscarCadastroPorUsuario(discordUserId);
}

async function buscarRegistrosFarmPorUsuario(usuarioId) {
  return repositories.buscarRegistrosFarmPorUsuario(usuarioId);
}

async function buscarRelatoriosUsuario(usuarioId) {
  return repositories.buscarRelatoriosUsuario(usuarioId);
}

async function buscarRelatorioSemanalGlobalMaisRecente() {
  return repositories.buscarRelatorioSemanalGlobalMaisRecente();
}

async function buscarResumoSemanalGlobal() {
  return repositories.buscarResumoSemanalGlobal();
}

async function listarGruposParceiros() {
  return repositories.listarGruposParceiros();
}

async function buscarSaldoBanco() {
  return repositories.buscarSaldoBanco();
}

async function buscarGrupoParceiroPorId(grupoId) {
  return repositories.buscarGrupoParceiroPorId(grupoId);
}

async function buscarGrupoParceiroPorNomeNormalizado(nomeNormalizado) {
  return repositories.buscarGrupoParceiroPorNomeNormalizado(nomeNormalizado);
}

async function salvarGrupoParceiro(dados) {
  return repositories.salvarGrupoParceiro(dados);
}

async function salvarRegistroBancario(dados) {
  return repositories.salvarRegistroBancario(dados);
}

async function resetarSaldoBanco() {
  return repositories.resetarSaldoBanco();
}

async function removerGrupoParceiro(grupoId) {
  return repositories.removerGrupoParceiro(grupoId);
}

async function salvarRegistroBanco(dados) {
  return repositories.salvarRegistroBanco(dados);
}

async function salvarAcao(dados) {
  return repositories.salvarAcao(dados);
}

async function atualizarMensagemAcao(acaoId, mensagemId) {
  return repositories.atualizarMensagemAcao(acaoId, mensagemId);
}

async function buscarAcaoPorId(acaoId) {
  return repositories.buscarAcaoPorId(acaoId);
}

async function atualizarCampoAcao(acaoId, campo, valor) {
  const camposPermitidos = new Set([
    'comando_texto',
    'finalizado_em',
    'nome_acao',
    'resultado',
    'status',
    'tipo_acao',
  ]);

  if (!camposPermitidos.has(campo)) {
    throw new Error(`Campo não permitido para atualização de ação: ${campo}`);
  }

  return repositories.atualizarCampoAcao(acaoId, campo, valor);
}

async function adicionarParticipanteAcao(acaoId, usuario) {
  return repositories.adicionarParticipanteAcao(acaoId, usuario);
}

async function removerParticipanteAcao(acaoId, usuarioId) {
  return repositories.removerParticipanteAcao(acaoId, usuarioId);
}

async function buscarParticipantesAcao(acaoId) {
  return repositories.buscarParticipantesAcao(acaoId);
}

async function buscarUsuariosComFarm() {
  return repositories.buscarUsuariosComFarm();
}

async function buscarTotalFarmPorUsuario(usuarioId) {
  return repositories.buscarTotalFarmPorUsuario(usuarioId);
}

async function salvarRelatorioSemanal(usuarioId, usuarioTag, semanaReferencia, totalItens) {
  return repositories.salvarRelatorioSemanal(usuarioId, usuarioTag, semanaReferencia, totalItens);
}

async function manterUltimos52RelatoriosPorUsuario(usuarioId) {
  return repositories.manterUltimos52RelatoriosPorUsuario(usuarioId);
}

async function resetarFarmUsuario(usuarioId) {
  return repositories.resetarFarmUsuario(usuarioId);
}

function criarPainel() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('farm')
      .setLabel('Consultar farm')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📑')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lavagem_parceria')
      .setLabel('Registrar lavagem parceria')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💲'),
    new ButtonBuilder()
      .setCustomId('lavagem_pista')
      .setLabel('Registrar lavagem pista')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💲')
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x2f3136)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ['## Central VSYNC', 'Acesse os fluxos principais da facção em um único painel.'].join(
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
          '**Fluxos disponíveis**',
          'Verifique como está o andamento do seu farm semanal.',
          '',
          '**Registros da facção**',
          'Envie pedidos de lavagem e acompanhe a aprovação da gerência.',
        ].join('\n')
      )
    )
    .addActionRowComponents(row1)
    .addActionRowComponents(row2);

  return {
    embeds: [],
    flags: MessageFlags.IsComponentsV2,
    components: [container],
  };
}

async function publicarOuAtualizarPainelPrincipal() {
  if (!PAINEL_PRINCIPAL_CANAL_ID) {
    return;
  }

  const painel = criarPainel();
  const canal = await client.channels.fetch(PAINEL_PRINCIPAL_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel principal não encontrado ou inválido.');
    return;
  }

  const mensagens = await canal.messages.fetch({ limit: 20 });
  const mensagemExistente = mensagens.find(
    (message) =>
      message.author.id === client.user.id &&
      mensagemPossuiAlgumCustomId(message, ['farm', 'lavagem_parceria', 'lavagem_pista'])
  );

  const payload = {
    embeds: painel.embeds,
    flags: painel.flags,
    components: painel.components,
  };

  if (mensagemExistente) {
    await mensagemExistente.edit(payload);
    return;
  }

  await canal.send(payload);
}

async function publicarOuAtualizarPainelAcoes() {
  if (!PAINEL_ACOES_CANAL_ID) {
    return;
  }

  const painel = criarPainelAcoes();
  const canal = await client.channels.fetch(PAINEL_ACOES_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel de ações não encontrado ou inválido.');
    return;
  }

  const mensagens = await canal.messages.fetch({ limit: 20 });
  const mensagemExistente = mensagens.find(
    (message) =>
      message.author.id === client.user.id &&
      mensagemPossuiAlgumCustomId(message, ['acao_pequena', 'acao_media', 'acao_grande'])
  );

  const payload = {
    embeds: painel.embeds,
    flags: painel.flags,
    components: painel.components,
  };

  if (mensagemExistente) {
    await mensagemExistente.edit(payload);
    return;
  }

  await canal.send(payload);
}

async function publicarOuAtualizarPainelCadastro() {
  if (!PAINEL_CADASTRO_CANAL_ID) {
    return;
  }

  const painel = criarPainelCadastro();
  const canal = await client.channels.fetch(PAINEL_CADASTRO_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel de cadastro não encontrado ou inválido.');
    return;
  }

  const mensagens = await canal.messages.fetch({ limit: 100 });
  const mensagemExistente = mensagens.find(
    (message) =>
      message.author.id === client.user.id &&
      mensagemPossuiAlgumCustomId(message, [CADASTRO_BUTTON_ID])
  );

  const payload = {
    embeds: painel.embeds,
    flags: painel.flags,
    components: painel.components,
  };

  if (mensagemExistente) {
    await mensagemExistente.edit(payload);
    return;
  }

  await canal.send(payload);
}

async function publicarOuAtualizarPainelAdministrativo(canal) {
  if (!canal || canal.type !== ChannelType.GuildText) {
    throw new Error('Canal do painel administrativo não encontrado ou inválido.');
  }

  const saldoBanco = formatarMoeda(await buscarSaldoBanco());
  const painel = criarPainelAdministrativo(saldoBanco);
  const mensagens = await canal.messages.fetch({ limit: 30 });
  const mensagensExistentes = mensagens.filter(
    (message) =>
      message.author.id === client.user.id &&
      mensagemPossuiAlgumCustomId(message, [
        ADMIN_BANCO_ADICIONAR_BUTTON_ID,
        ADMIN_BANCO_RESETAR_BUTTON_ID,
        ADMIN_BANCO_RETIRAR_BUTTON_ID,
        ADMIN_PARCERIA_CADASTRAR_BUTTON_ID,
        ADMIN_PARCERIA_LISTAR_BUTTON_ID,
        ADMIN_PARCERIA_REMOVER_BUTTON_ID,
      ])
  );

  const payload = {
    embeds: painel.embeds,
    flags: painel.flags,
    components: painel.components,
  };

  if (mensagensExistentes.size) {
    await Promise.all(
      mensagensExistentes.map((message) =>
        message.edit(payload).catch((error) => {
          console.error(
            `Erro ao atualizar painel administrativo na mensagem ${message.id}:`,
            error
          );
          return null;
        })
      )
    );

    return mensagensExistentes.first() || null;
  }

  return canal.send(payload);
}

async function enviarLogRegistroBancario(dados) {
  const canalLog = await client.channels.fetch(CANAL_LOG_BANCO_ID).catch(() => null);

  if (!canalLog || canalLog.type !== ChannelType.GuildText) {
    throw new Error('Canal de log bancario nao encontrado ou invalido.');
  }

  await canalLog.send(
    montarPayloadLogRegistroBancario({
      ...dados,
      saldoAtual: formatarMoeda(dados.saldoAtual),
      quantidade: formatarMoeda(dados.quantidade),
    })
  );
}

async function enviarLogResetBanco(dados) {
  const canalLog = await client.channels.fetch(CANAL_LOG_BANCO_ID).catch(() => null);

  if (!canalLog || canalLog.type !== ChannelType.GuildText) {
    throw new Error('Canal de log bancario nao encontrado ou invalido.');
  }

  await canalLog.send(
    montarPayloadLogResetBanco({
      ...dados,
      saldoAnterior: formatarMoeda(dados.saldoAnterior),
    })
  );
}

async function publicarOuAtualizarPainelAdministrativoPersistente() {
  if (!PAINEL_ADMINISTRATIVO_CANAL_ID) {
    return;
  }

  const canal = await client.channels.fetch(PAINEL_ADMINISTRATIVO_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel administrativo não encontrado ou inválido.');
    return;
  }

  await publicarOuAtualizarPainelAdministrativo(canal);
}

async function renderizarMensagemAcao(interactionOrChannel, acaoId, desabilitado = false) {
  const acao = await buscarAcaoPorId(acaoId);

  if (!acao) {
    return null;
  }

  const participantes = await buscarParticipantesAcao(acaoId);
  const payload = montarPayloadMensagemAcao(acao, participantes, formatarMoeda, desabilitado);

  if (acao.mensagem_id) {
    const canal = interactionOrChannel.channel || interactionOrChannel;
    const mensagem = await canal.messages.fetch(acao.mensagem_id).catch(() => null);

    if (mensagem) {
      await mensagem.edit(payload);
      return mensagem;
    }
  }

  const canal = interactionOrChannel.channel || interactionOrChannel;
  const mensagem = await canal.send(payload);
  await atualizarMensagemAcao(acaoId, mensagem.id);
  return mensagem;
}

async function finalizarAcao(interaction, acaoId) {
  const acao = await buscarAcaoPorId(acaoId);

  if (!acao) {
    return interaction.reply({
      content: 'Não encontrei essa ação.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const participantes = await buscarParticipantesAcao(acaoId);

  if (!acao.nome_acao || !acao.tipo_acao || !acao.resultado) {
    return interaction.reply({
      content: 'Defina a ação, o tipo e o resultado antes de finalizar.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!acao.comando_texto) {
    return interaction.reply({
      content: 'É necessário que alguém assuma o comando da ação antes de finalizar.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!participantes.length) {
    return interaction.reply({
      content: 'É necessário ter ao menos um participante confirmado para finalizar.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const acaoFinalizada = await atualizarCampoAcao(acaoId, 'status', 'finalizada');
  await atualizarCampoAcao(acaoId, 'finalizado_em', new Date());
  const acaoAtualizada = await buscarAcaoPorId(acaoId);

  const canalLog = await client.channels.fetch(CANAL_LOG_ACOES_ID).catch(() => null);

  if (!canalLog || canalLog.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: 'Não encontrei o canal de log de ações configurado.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await renderizarMensagemAcao(interaction, acaoId, true);
  await canalLog.send(
    montarPayloadLogAcao(acaoAtualizada || acaoFinalizada, participantes, formatarMoeda)
  );

  if (acao.mensagem_id) {
    const canalOrigem = await client.channels.fetch(acao.canal_id).catch(() => null);

    if (canalOrigem && 'messages' in canalOrigem) {
      const mensagemAcao = await canalOrigem.messages.fetch(acao.mensagem_id).catch(() => null);

      if (mensagemAcao) {
        await mensagemAcao.delete().catch((error) => {
          console.error(`Não foi possível apagar a mensagem da ação #${acaoId}:`, error);
        });
      }
    }
  }

  return interaction.reply({
    content: 'Ação finalizada e log registrado com sucesso.',
    flags: MessageFlags.Ephemeral,
  });
}

function gerarSemanaReferencia() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

async function processarRelatorioSemanal() {
  const usuarios = await buscarUsuariosComFarm();
  const semana = gerarSemanaReferencia();

  for (const usuario of usuarios) {
    const total = await buscarTotalFarmPorUsuario(usuario.usuario_id);

    if (!total || total <= 0) {
      continue;
    }

    await salvarRelatorioSemanal(usuario.usuario_id, usuario.usuario_tag, semana, total);
    await manterUltimos52RelatoriosPorUsuario(usuario.usuario_id);
    await resetarFarmUsuario(usuario.usuario_id);
  }

  console.log(`Relatório semanal processado em ${new Date().toISOString()}`);
}

async function moverCanalPrivadoParaCategoriaSaida(guild, canalId) {
  const categoriaSaidaId = process.env.CATEGORIA_SAIDA_CADASTRO_ID || null;

  if (!categoriaSaidaId || !canalId) {
    return false;
  }

  const canal = await guild.channels.fetch(canalId).catch(() => null);

  if (!canal) {
    return false;
  }

  await canal.edit({ parent: categoriaSaidaId });
  return true;
}

client.once('clientReady', () => {
  console.log(`Bot online como ${client.user.tag}`);
  console.log('[startup] Intents ativos: Guilds, GuildMembers');

  cron.schedule(
    '0 0 * * 1',
    async () => {
      try {
        await processarRelatorioSemanal();
      } catch (error) {
        console.error('Erro ao processar cron semanal:', error);
      }
    },
    {
      timezone: 'America/Sao_Paulo',
    }
  );

  publicarOuAtualizarPainelPrincipal().catch((error) => {
    console.error('Erro ao publicar o painel principal persistente:', error);
  });

  publicarOuAtualizarPainelCadastro().catch((error) => {
    console.error('Erro ao publicar o painel de cadastro persistente:', error);
  });

  publicarOuAtualizarPainelAcoes().catch((error) => {
    console.error('Erro ao publicar o painel de ações persistente:', error);
  });

  publicarOuAtualizarPainelAdministrativoPersistente().catch((error) => {
    console.error('Erro ao publicar o painel administrativo persistente:', error);
  });
});

client.on('guildMemberRemove', async (member) => {
  try {
    console.log(`[guildMemberRemove] Saída detectada: ${member.user.tag} (${member.id})`);

    const cadastroUsuario = await buscarCadastroPorUsuario(member.id);

    if (!cadastroUsuario) {
      console.log(
        `[guildMemberRemove] Nenhum cadastro encontrado para ${member.user.tag} (${member.id}).`
      );
      return;
    }

    console.log(
      `[guildMemberRemove] Cadastro encontrado para ${member.user.tag} (${member.id}). Canal privado: ${cadastroUsuario.canal_id || 'nenhum'}`
    );

    if (!cadastroUsuario.canal_id) {
      return;
    }

    const canalMovido = await moverCanalPrivadoParaCategoriaSaida(
      member.guild,
      cadastroUsuario.canal_id
    ).catch((error) => {
      console.error(
        `[guildMemberRemove] Falha ao mover o canal privado ${cadastroUsuario.canal_id} de ${member.user.tag} (${member.id}) para a categoria de saída:`,
        error
      );
      return false;
    });

    if (canalMovido) {
      console.log(
        `[guildMemberRemove] Canal privado ${cadastroUsuario.canal_id} movido para a categoria de saída para ${member.user.tag} (${member.id}).`
      );
    } else {
      console.log(
        `[guildMemberRemove] Canal privado ${cadastroUsuario.canal_id} não encontrado para ${member.user.tag} (${member.id}).`
      );
    }
  } catch (error) {
    console.error(
      `[guildMemberRemove] Erro ao processar saída de ${member.user.tag} (${member.id}):`,
      error
    );
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`[guildMemberAdd] Entrada detectada: ${member.user.tag} (${member.id})`);

    const cadastroUsuario = await buscarCadastroPorUsuario(member.id);

    if (!cadastroUsuario) {
      console.log(
        `[guildMemberAdd] Nenhum cadastro encontrado para ${member.user.tag} (${member.id}).`
      );
      return;
    }

    console.log(
      `[guildMemberAdd] Cadastro encontrado para ${member.user.tag} (${member.id}). Reativando canal ${cadastroUsuario.canal_id || 'não informado'}.`
    );

    const resultadoCadastro = await aplicarCadastroUsuario(
      member.guild,
      member.user,
      cadastroUsuario.personagem_nome || cadastroUsuario.personagem_nome_formatado,
      String(cadastroUsuario.personagem_id),
      { permitirEdicao: true }
    );

    await enviarMensagemCanalCadastro(
      resultadoCadastro.canal,
      member.id,
      resultadoCadastro.nomeFormatado,
      resultadoCadastro.personagemId,
      {
        titulo: 'Cadastro Reativado',
        descricaoFinal:
          'Seu cadastro anterior foi localizado no banco de dados e seu canal privado foi reativado automaticamente.',
      }
    );

    console.log(
      `[guildMemberAdd] Cadastro reativado com sucesso para ${member.user.tag} (${member.id}) no canal ${resultadoCadastro.canal.id}.`
    );
  } catch (error) {
    console.error(
      `[guildMemberAdd] Erro ao reativar cadastro de ${member.user.tag} (${member.id}):`,
      error
    );
  }
});

client.on('interactionCreate', async (interaction) =>
  processarInteracao(interaction, {
    ACAO_RASCUNHO_CONFIRMAR_PREFIX,
    ACAO_RASCUNHO_DETALHES_PREFIX,
    ACAO_RASCUNHO_MODAL_PREFIX,
    ACAO_RASCUNHO_NOME_PREFIX,
    ACAO_RASCUNHO_TIPO_PREFIX,
    ADMIN_BANCO_ADICIONAR_BUTTON_ID,
    ADMIN_BANCO_ADICIONAR_MODAL_ID,
    ADMIN_BANCO_RESETAR_BUTTON_ID,
    ADMIN_BANCO_RESETAR_CANCELAR_BUTTON_ID,
    ADMIN_BANCO_RESETAR_CONFIRMAR_BUTTON_ID,
    ADMIN_BANCO_RETIRAR_BUTTON_ID,
    ADMIN_BANCO_RETIRAR_MODAL_ID,
    adicionarParticipanteAcao,
    aplicarCadastroUsuario,
    aprovarOuRecusarCadastro,
    atualizarCampoAcao,
    buscarAcaoPorId,
    buscarCadastroPorUsuario,
    buscarGrupoParceiroPorId,
    buscarGrupoParceiroPorNomeNormalizado,
    buscarRelatorioSemanalGlobalMaisRecente,
    buscarRegistrosFarmPorUsuario,
    buscarRelatoriosUsuario,
    buscarResumoSemanalGlobal,
    buscarSaldoBanco,
    client,
    criarModalBancoAdicionar,
    criarModalBancoRetirar,
    criarModalCadastrarParceria,
    criarModalCadastro,
    criarModalDetalhesRascunhoAcao,
    criarModalLavagem,
    criarModalRemoverParceria,
    criarPainel,
    criarPainelCadastro,
    criarRascunhoAcao,
    enviarLogResetBanco,
    enviarLogRegistroBancario,
    finalizarAcao,
    finalizarLavagem,
    formatarMoeda,
    LAVAGEM_PARCEIRO_SELECT_ID,
    listarGruposParceiros,
    montarPayloadConfirmacaoResetBanco,
    montarPayloadSelecaoGrupoParceiro,
    montarPayloadRascunhoAcao,
    normalizarNomeGrupoParceiro,
    obterRascunhoAcao,
    processarCadastro,
    processarModalLavagem,
    processarRelatorioSemanal,
    publicarOuAtualizarPainelAdministrativo,
    publicarOuAtualizarPainelAcoes,
    publicarOuAtualizarPainelCadastro,
    rascunhoAcaoEstaPronto,
    removerGrupoParceiro,
    removerParticipanteAcao,
    removerRascunhoAcao,
    renderizarMensagemAcao,
    resetarSaldoBanco,
    resolverUrlImagem,
    salvarAcao,
    salvarGrupoParceiro,
    salvarRegistroBancario,
    salvarRegistroBanco,
  })
);

async function startBot() {
  try {
    console.log('1. Iniciando bot...');

    console.log('1.1 Validando variáveis de ambiente...');
    validarEnvObrigatorias();

    console.log('2. Testando conexão com banco...');
    const teste = await db.query('SELECT NOW() AS agora');
    console.log('3. Banco conectado:', teste.rows[0]);

    console.log('4. Inicializando tabelas...');
    await initDatabase();
    console.log('5. Tabelas inicializadas.');

    console.log('6. Fazendo login no Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('7. Login enviado ao Discord.');
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

startBot();
