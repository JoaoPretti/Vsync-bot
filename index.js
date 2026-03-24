require('dotenv').config();

const cron = require('node-cron');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType
} = require('discord.js');

const db = require('./database/db');
const initDatabase = require('./database/init');

initDatabase();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* =========================
   FUNÇÕES DO BANCO
========================= */

function salvarRegistroBanco(dados) {
  const stmt = db.prepare(`
    INSERT INTO registros (
      tipo,
      usuario_tag,
      usuario_id,
      item,
      quantidade,
      imagem,
      acao,
      categoria,
      status,
      criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    dados.tipo,
    dados.usuarioTag,
    dados.usuarioId,
    dados.item || null,
    dados.quantidade ?? null,
    dados.imagem || null,
    dados.acao || null,
    dados.categoria || null,
    dados.status || 'pendente',
    dados.criadoEm
  );
}

function buscarRegistrosFarmPorUsuario(usuarioId) {
  const stmt = db.prepare(`
    SELECT *
    FROM registros
    WHERE usuario_id = ?
      AND tipo = 'farm'
    ORDER BY id DESC
  `);

  return stmt.all(usuarioId);
}

function buscarTotalFarmPorUsuario(usuarioId) {
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(quantidade), 0) AS total
    FROM registros
    WHERE usuario_id = ?
      AND tipo = 'farm'
  `);

  return stmt.get(usuarioId).total;
}

function buscarUsuariosComFarm() {
  const stmt = db.prepare(`
    SELECT DISTINCT usuario_id, usuario_tag
    FROM registros
    WHERE tipo = 'farm'
  `);

  return stmt.all();
}

function resetarFarmUsuario(usuarioId) {
  const stmt = db.prepare(`
    DELETE FROM registros
    WHERE usuario_id = ?
      AND tipo = 'farm'
  `);

  stmt.run(usuarioId);
}

function salvarRelatorioSemanal(usuarioId, usuarioTag, semanaReferencia, totalItens) {
  const stmt = db.prepare(`
    INSERT INTO relatorios_semanais (
      usuario_id,
      usuario_tag,
      semana_referencia,
      total_itens,
      criado_em
    ) VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    usuarioId,
    usuarioTag,
    semanaReferencia,
    totalItens,
    new Date().toISOString()
  );
}

function buscarRelatoriosUsuario(usuarioId) {
  const stmt = db.prepare(`
    SELECT *
    FROM relatorios_semanais
    WHERE usuario_id = ?
    ORDER BY criado_em DESC
    LIMIT 52
  `);

  return stmt.all(usuarioId);
}

function manterUltimos52RelatoriosPorUsuario(usuarioId) {
  const stmt = db.prepare(`
    DELETE FROM relatorios_semanais
    WHERE usuario_id = ?
      AND id NOT IN (
        SELECT id
        FROM relatorios_semanais
        WHERE usuario_id = ?
        ORDER BY criado_em DESC
        LIMIT 52
      )
  `);

  stmt.run(usuarioId, usuarioId);
}

/* =========================
   FUNÇÕES DE RELATÓRIO
========================= */

function gerarSemanaReferencia() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function processarRelatorioSemanal() {
  const usuarios = buscarUsuariosComFarm();
  const semana = gerarSemanaReferencia();

  for (const usuario of usuarios) {
    const total = buscarTotalFarmPorUsuario(usuario.usuario_id);

    if (!total || total <= 0) {
      continue;
    }

    salvarRelatorioSemanal(
      usuario.usuario_id,
      usuario.usuario_tag,
      semana,
      total
    );

    manterUltimos52RelatoriosPorUsuario(usuario.usuario_id);
    resetarFarmUsuario(usuario.usuario_id);
  }

  console.log(`✅ Relatório semanal processado em ${new Date().toISOString()}`);
}

/* =========================
   PAINEL
========================= */

function criarPainel() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('🪪 Painel para Membros')
    .setDescription('Selecione abaixo as opções')
    .addFields(
      { name: '🎯 Meta de Farm', value: 'Verifique seu farm semanal' },
      { name: '💰 Registro', value: 'Registrar lavagens' },
      { name: '📦 Registro de Baú', value: 'Controle de itens do baú' }
    )
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('farm')
      .setLabel('Ver Farm')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('lavagem')
      .setLabel('Lavagem')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('acoes_bau')
      .setPlaceholder('Ações do baú')
      .addOptions(
        {
          label: 'Retirar',
          value: 'retirar',
          description: 'Registrar retirada do baú'
        },
        {
          label: 'Adicionar',
          value: 'adicionar',
          description: 'Registrar adição ao baú'
        }
      )
  );

  return {
    embed,
    components: [row1, row2]
  };
}

/* =========================
   BOT READY
========================= */

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);

  cron.schedule(
    '0 0 * * 1',
    () => {
      processarRelatorioSemanal();
    },
    {
      timezone: 'America/Sao_Paulo'
    }
  );
});

/* =========================
   INTERAÇÕES
========================= */

client.on('interactionCreate', async interaction => {
  try {
    /* =========================
       COMANDOS SLASH
    ========================= */
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') {
        const painel = criarPainel();
        return interaction.reply({
          embeds: [painel.embed],
          components: painel.components,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'registrar_farm') {
        const item = interaction.options.getString('item', true);
        const quantidade = interaction.options.getInteger('quantidade', true);
        const foto = interaction.options.getAttachment('foto');
        const link = interaction.options.getString('link');

        const imagem = foto?.url || link || null;

        const canal = await client.channels.fetch(process.env.CANAL_REGISTROS_ID);

        if (!canal) {
          return interaction.reply({
            content: 'Não encontrei o canal de registros.',
            ephemeral: true
          });
        }

        if (
          canal.type !== ChannelType.GuildText &&
          canal.type !== ChannelType.PublicThread &&
          canal.type !== ChannelType.PrivateThread
        ) {
          return interaction.reply({
            content: 'O canal configurado não é um canal de texto válido.',
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📦 Novo registro de farm')
          .addFields(
            { name: 'Item', value: item, inline: true },
            { name: 'Quantidade', value: String(quantidade), inline: true },
            { name: 'Usuário', value: `<@${interaction.user.id}>`, inline: false }
          )
          .setTimestamp();

        if (imagem) {
          embed.setImage(imagem);
        }

        await canal.send({ embeds: [embed] });

        salvarRegistroBanco({
          tipo: 'farm',
          usuarioTag: interaction.user.tag,
          usuarioId: interaction.user.id,
          item,
          quantidade,
          imagem,
          categoria: 'farm',
          status: 'registrado',
          criadoEm: new Date().toISOString()
        });

        return interaction.reply({
          content: '✅ Farm registrado com sucesso.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'relatorio_semanal') {
        const relatorios = buscarRelatoriosUsuario(interaction.user.id);

        if (!relatorios.length) {
          return interaction.reply({
            content: 'Você não possui relatórios ainda.',
            ephemeral: true
          });
        }

        const descricao = relatorios
          .map(r => `📅 **Semana:** ${r.semana_referencia}\n📦 **Total:** ${r.total_itens}`)
          .join('\n\n');

        const embed = new EmbedBuilder()
          .setTitle('📊 Relatório Semanal')
          .setDescription(descricao.slice(0, 4000))
          .addFields({
            name: 'Usuário',
            value: `<@${interaction.user.id}>`,
            inline: false
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'testar_relatorio') {
  processarRelatorioSemanal();

  return interaction.reply({
    content: '✅ Relatório semanal executado manualmente para teste.',
    ephemeral: true
  });
}
    }

    /* =========================
       BOTÕES
    ========================= */
    if (interaction.isButton()) {
      if (interaction.customId === 'farm' || interaction.customId === 'painel_farm') {
        const registros = buscarRegistrosFarmPorUsuario(interaction.user.id);

        if (!registros.length) {
          return interaction.reply({
            content: 'Você ainda não possui farms registrados.',
            ephemeral: true
          });
        }

        const agrupado = {};

        for (const registro of registros) {
          const item = registro.item || 'Sem item';
          const quantidade = registro.quantidade || 0;

          if (!agrupado[item]) {
            agrupado[item] = 0;
          }

          agrupado[item] += quantidade;
        }

        const descricao = Object.entries(agrupado)
          .map(([item, total]) => `📦 **${item}**: \`${total}\``)
          .join('\n');

        const totalQuantidade = Object.values(agrupado)
          .reduce((acc, val) => acc + val, 0);

        const embed = new EmbedBuilder()
          .setTitle('📊 Seu Farm')
          .setDescription(descricao)
          .addFields(
            { name: 'Usuário', value: `<@${interaction.user.id}>`, inline: false },
            { name: 'Total de registros', value: String(registros.length), inline: true },
            { name: 'Quantidade total', value: String(totalQuantidade), inline: true }
          )
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.customId === 'lavagem') {
        return interaction.reply({
          content: '💰 Sistema de lavagem',
          ephemeral: true
        });
      }
    }

    /* =========================
       SELECT MENU
    ========================= */
    if (interaction.isStringSelectMenu()) {
      const acao = interaction.values[0];

      salvarRegistroBanco({
        tipo: 'acao_bau',
        usuarioTag: interaction.user.tag,
        usuarioId: interaction.user.id,
        acao,
        categoria: 'bau',
        status: 'pendente',
        criadoEm: new Date().toISOString()
      });

      return interaction.reply({
        content: `✅ Ação registrada: ${acao}`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Erro na interação:', error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: 'Ocorreu um erro ao processar esta ação.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);