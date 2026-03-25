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

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* =========================
   FUNÇÕES DO BANCO
========================= */

async function salvarRegistroBanco(dados) {
  await db.query(
    `
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
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
    ]
  );
}

async function buscarRegistrosFarmPorUsuario(usuarioId) {
  const result = await db.query(
    `
      SELECT *
      FROM registros
      WHERE usuario_id = $1
        AND tipo = 'farm'
      ORDER BY id DESC
    `,
    [usuarioId]
  );

  return result.rows;
}

async function buscarTotalFarmPorUsuario(usuarioId) {
  const result = await db.query(
    `
      SELECT COALESCE(SUM(quantidade), 0) AS total
      FROM registros
      WHERE usuario_id = $1
        AND tipo = 'farm'
    `,
    [usuarioId]
  );

  return Number(result.rows[0]?.total || 0);
}

async function buscarUsuariosComFarm() {
  const result = await db.query(`
    SELECT DISTINCT usuario_id, usuario_tag
    FROM registros
    WHERE tipo = 'farm'
  `);

  return result.rows;
}

async function resetarFarmUsuario(usuarioId) {
  await db.query(
    `
      DELETE FROM registros
      WHERE usuario_id = $1
        AND tipo = 'farm'
    `,
    [usuarioId]
  );
}

async function salvarRelatorioSemanal(usuarioId, usuarioTag, semanaReferencia, totalItens) {
  await db.query(
    `
      INSERT INTO relatorios_semanais (
        usuario_id,
        usuario_tag,
        semana_referencia,
        total_itens,
        criado_em
      ) VALUES ($1,$2,$3,$4,$5)
    `,
    [
      usuarioId,
      usuarioTag,
      semanaReferencia,
      totalItens,
      new Date()
    ]
  );
}

async function buscarRelatoriosUsuario(usuarioId) {
  const result = await db.query(
    `
      SELECT *
      FROM relatorios_semanais
      WHERE usuario_id = $1
      ORDER BY criado_em DESC
      LIMIT 52
    `,
    [usuarioId]
  );

  return result.rows;
}

async function manterUltimos52RelatoriosPorUsuario(usuarioId) {
  await db.query(
    `
      DELETE FROM relatorios_semanais
      WHERE usuario_id = $1
        AND id NOT IN (
          SELECT id
          FROM relatorios_semanais
          WHERE usuario_id = $2
          ORDER BY criado_em DESC
          LIMIT 52
        )
    `,
    [usuarioId, usuarioId]
  );
}

async function buscarResumoSemanalGlobal() {
  const result = await db.query(`
    SELECT usuario_tag, usuario_id, SUM(quantidade) AS total
    FROM registros
    WHERE tipo = 'farm'
    GROUP BY usuario_tag, usuario_id
    ORDER BY total DESC
  `);

  return result.rows.map(row => ({
    usuario_tag: row.usuario_tag,
    usuario_id: row.usuario_id,
    total: Number(row.total || 0)
  }));
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

async function processarRelatorioSemanal() {
  const usuarios = await buscarUsuariosComFarm();
  const semana = gerarSemanaReferencia();

  for (const usuario of usuarios) {
    const total = await buscarTotalFarmPorUsuario(usuario.usuario_id);

    if (!total || total <= 0) {
      continue;
    }

    await salvarRelatorioSemanal(
      usuario.usuario_id,
      usuario.usuario_tag,
      semana,
      total
    );

    await manterUltimos52RelatoriosPorUsuario(usuario.usuario_id);
    await resetarFarmUsuario(usuario.usuario_id);
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
    .setDescription([
      'Selecione abaixo as opções disponíveis.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '**🎯 Meta de Farm**',
      'Verifique como está o andamento do seu farm semanal.',
      '',
      '**💰 Registro**',
      'Notifique suas lavagens e peça para a gerência aprovar sua lavagem.',
      '',
      '**📦 Registro de Baú**',
      'Abra o painel do baú para registrar retirada e entrada.'
    ].join('\n'))
    .setThumbnail('https://i.imgur.com/0TeacfY.png')
    .setFooter({ text: 'VSYNC • Painel Central' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('farm')
      .setLabel('Verifique seu Farm')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📑')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lavagem_parceria')
      .setLabel('Lavagem Parceria')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💲'),
    new ButtonBuilder()
      .setCustomId('lavagem_pista')
      .setLabel('Lavagem Pista')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('💲')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ver_todos_itens')
      .setLabel('Ver todos itens')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId('abrir_bau')
      .setLabel('Abrir Painel do Baú')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📦')
  );

  return {
    embed,
    components: [row1, row2, row3]
  };
}

function criarPainelBau() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('📦 Painel do Baú')
    .setDescription([
      'Selecione a ação desejada abaixo.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '🔫 **Armamento e Munições**',
      '🧰 **Itens de Roubo**',
      '🌿 **Drogas**',
      '🎒 **Itens Pessoais**'
    ].join('\n'))
    .setFooter({ text: 'VSYNC • Painel do Baú' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('menu_retirar_bau')
      .setLabel('Retirar')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖'),
    new ButtonBuilder()
      .setCustomId('menu_adicionar_bau')
      .setLabel('Adicionar')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('voltar_painel')
      .setLabel('Voltar')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );

  return {
    embed,
    components: [row1, row2]
  };
}

function criarMenuRetirarBau() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('➖ Retirar do Baú')
    .setDescription('Selecione a categoria que deseja retirar.')
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_retirar_bau')
      .setPlaceholder('Escolha uma categoria')
      .addOptions(
        {
          label: 'Armamento e Munições',
          value: 'retirar_armamento',
          description: 'Registrar retirada de armamento'
        },
        {
          label: 'Itens de Roubo',
          value: 'retirar_roubo',
          description: 'Registrar retirada de itens de roubo'
        },
        {
          label: 'Drogas',
          value: 'retirar_drogas',
          description: 'Registrar retirada de drogas'
        },
        {
          label: 'Itens Pessoais',
          value: 'retirar_pessoais',
          description: 'Registrar retirada de itens pessoais'
        }
      )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_bau')
      .setLabel('Voltar ao Baú')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );

  return {
    embed,
    components: [row1, row2]
  };
}

async function startBot() {
  try {
    await testarConexaoBanco();
    await initDatabase();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

function criarMenuAdicionarBau() {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('➕ Adicionar ao Baú')
    .setDescription('Selecione a categoria que deseja adicionar.')
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_adicionar_bau')
      .setPlaceholder('Escolha uma categoria')
      .addOptions(
        {
          label: 'Armamento e Munições',
          value: 'adicionar_armamento',
          description: 'Registrar entrada de armamento'
        },
        {
          label: 'Itens de Roubo',
          value: 'adicionar_roubo',
          description: 'Registrar entrada de itens de roubo'
        },
        {
          label: 'Drogas',
          value: 'adicionar_drogas',
          description: 'Registrar entrada de drogas'
        },
        {
          label: 'Itens Pessoais',
          value: 'adicionar_pessoais',
          description: 'Registrar entrada de itens pessoais'
        }
      )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('abrir_bau')
      .setLabel('Voltar ao Baú')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
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
    async () => {
      try {
        await processarRelatorioSemanal();
      } catch (error) {
        console.error('Erro ao processar cron semanal:', error);
      }
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

        await salvarRegistroBanco({
          tipo: 'farm',
          usuarioTag: interaction.user.tag,
          usuarioId: interaction.user.id,
          item,
          quantidade,
          imagem,
          categoria: 'farm',
          status: 'registrado',
          criadoEm: new Date()
        });

        return interaction.reply({
          content: '✅ Farm registrado com sucesso.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'relatorio_semanal') {
        const relatorios = await buscarRelatoriosUsuario(interaction.user.id);

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

      if (interaction.commandName === 'relatorio_global') {
        const dados = await buscarResumoSemanalGlobal();

        if (!dados.length) {
          return interaction.reply({
            content: 'Nenhum farm registrado ainda.',
            ephemeral: true
          });
        }

        const descricao = dados
          .map(user => `👤 <@${user.usuario_id}>: **${user.total}**`)
          .join('\n');

        const totalGeral = dados.reduce((acc, user) => acc + user.total, 0);

        const embed = new EmbedBuilder()
          .setTitle('📊 Relatório Global da Semana')
          .setDescription(descricao)
          .addFields({
            name: 'Total Geral',
            value: String(totalGeral),
            inline: false
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'testar_relatorio') {
        await processarRelatorioSemanal();

        return interaction.reply({
          content: '✅ Relatório semanal executado manualmente para teste.',
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'farm' || interaction.customId === 'painel_farm') {
        const registros = await buscarRegistrosFarmPorUsuario(interaction.user.id);

        if (!registros.length) {
          return interaction.reply({
            content: 'Você ainda não possui farms registrados.',
            ephemeral: true
          });
        }

        const agrupado = {};

        for (const registro of registros) {
          const item = registro.item || 'Sem item';
          const quantidade = Number(registro.quantidade || 0);

          if (!agrupado[item]) {
            agrupado[item] = 0;
          }

          agrupado[item] += quantidade;
        }

        const descricao = Object.entries(agrupado)
          .map(([item, total]) => `📦 **${item}**: \`${total}\``)
          .join('\n');

        const totalQuantidade = Object.values(agrupado)
          .reduce((acc, val) => acc + Number(val), 0);

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

      if (interaction.customId === 'abrir_bau') {
        const painelBau = criarPainelBau();

        return interaction.reply({
          embeds: [painelBau.embed],
          components: painelBau.components,
          ephemeral: true
        });
      }

      if (interaction.customId === 'voltar_painel') {
        const painel = criarPainel();

        return interaction.reply({
          embeds: [painel.embed],
          components: painel.components,
          ephemeral: true
        });
      }

      if (interaction.customId === 'menu_retirar_bau') {
        const menu = criarMenuRetirarBau();

        return interaction.reply({
          embeds: [menu.embed],
          components: menu.components,
          ephemeral: true
        });
      }

      if (interaction.customId === 'menu_adicionar_bau') {
        const menu = criarMenuAdicionarBau();

        return interaction.reply({
          embeds: [menu.embed],
          components: menu.components,
          ephemeral: true
        });
      }

      if (
        interaction.customId === 'lavagem_parceria' ||
        interaction.customId === 'lavagem_pista' ||
        interaction.customId === 'ver_todos_itens'
      ) {
        return interaction.reply({
          content: 'Essa função ainda será implementada.',
          ephemeral: true
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const acao = interaction.values[0];

      if (
        interaction.customId === 'select_retirar_bau' ||
        interaction.customId === 'select_adicionar_bau'
      ) {
        await salvarRegistroBanco({
          tipo: 'acao_bau',
          usuarioTag: interaction.user.tag,
          usuarioId: interaction.user.id,
          acao,
          categoria: 'bau',
          status: 'pendente',
          criadoEm: new Date()
        });

        return interaction.reply({
          content: `✅ Ação registrada: ${acao}`,
          ephemeral: true
        });
      }
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

/* =========================
   INICIALIZAÇÃO
========================= */
async function testarConexaoBanco() {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Banco conectado com sucesso:', result.rows[0]);
  } catch (error) {
    console.error('❌ Erro ao conectar no banco:', error);
    throw error;
  }
}

async function startBot() {
  try {
    await initDatabase();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

async function startBot() {
  try {
    console.log('1. Iniciando bot...');
    
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
    console.error('❌ Erro ao iniciar o bot:', error);
    process.exit(1);
  }
}

startBot();