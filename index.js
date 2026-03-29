require('dotenv').config();

const cron = require('node-cron');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');

const db = require('./database/db');
const initDatabase = require('./database/init');

// `?v=` ajuda a evitar cache antigo da thumbnail no Discord/CDN.
const PAINEL_THUMBNAIL_URL = 'https://i.postimg.cc/jqvvgNnM/screenshot-288.png?v=20260327-1';
const CADASTRO_THUMBNAIL_URL = 'https://i.postimg.cc/jqvvgNnM/screenshot-288.png?v=20260327-1';
const CADASTRO_BANNER_URL = 'attachment://solicite_cadastro.png';
const CADASTRO_MODAL_ID = 'modal_cadastro';
const CADASTRO_BUTTON_ID = 'abrir_cadastro';
const CADASTRO_IMAGE_PATH = 'C:\\Users\\Pc\\Desktop\\Projeto Vsync\\solicite_cadastro.png';
const PAINEL_PRINCIPAL_CANAL_ID = process.env.PAINEL_PRINCIPAL_CANAL_ID || '1487117541838163978';
const CANAL_APROVACAO_LAVAGEM_ID = process.env.CANAL_APROVACAO_LAVAGEM_ID || '1487109511306149918';
const CANAL_REGISTRO_LAVAGEM_ID = process.env.CANAL_REGISTRO_LAVAGEM_ID || '1487109544780763256';
const LAVAGEM_MODAL_PREFIX = 'modal_lavagem_';
const LAVAGEM_APROVAR_PREFIX = 'aprovar_lavagem_';
const LAVAGEM_RECUSAR_PREFIX = 'recusar_lavagem_';
const ACOES_PAINEL_IMAGE_PATH = 'C:\\Users\\Pc\\Desktop\\Projeto Vsync\\Painel_Ações.png';
const ACOES_PAINEL_BANNER_URL = 'attachment://painel_acoes.png';
const ACAO_MODAL_PREFIX = 'modal_acao_';
const ACAO_SELECT_NOME_PREFIX = 'acao_nome_';
const ACAO_SELECT_TIPO_PREFIX = 'acao_tipo_';
const ACAO_SELECT_RESULTADO_PREFIX = 'acao_resultado_';
const ACAO_ENTRAR_PREFIX = 'acao_entrar_';
const ACAO_SAIR_PREFIX = 'acao_sair_';
const ACAO_COMANDO_PREFIX = 'acao_comando_';
const ACAO_FINALIZAR_PREFIX = 'acao_finalizar_';
const PAINEL_ACOES_CANAL_ID = process.env.PAINEL_ACOES_CANAL_ID || '1487176112860696686';
const CANAL_LOG_ACOES_ID = process.env.CANAL_LOG_ACOES_ID || '1487176260437409863';

// Edite esta estrutura para cadastrar as ações disponíveis em cada categoria.
const ACOES_DISPONIVEIS = {
  pequena: [
    'Aeroporto Trevor',
    'Ammunation Porto',
    'Ammunation Praça',
    'Antena',
    'Auditório',
    'Bebidas Samir',
    'Campo de Golf',
    'Comedy',
    'Estábulo',
    'Fast Food',
    'Hiper Mercado',
    'Igreja',
    'Lanchonete - Spitroasters',
    'Lava Jato',
    'Lojinha Banco Central',
    'Lojinha China',
    'Lojinha Grapeseed',
    'Lojinha Groove',
    'Lojinha Praia',
    'Lojinha Prefeitura',
    'Lojinha Barragem',
    'Lojinha Sandy',
    'McDonald\'s',
    'Navio Porto',
    'Píer',
    'Planet'
  ],
  media: [
    'Açougue',
    'Anfiteatro',
    'BobCat',
    'Container',
    'Estacionamento Marrom',
    'Fleeca Chaves',
    'Fleeca Life Invader',
    'Fleeca Praia',
    'Fleeca Rota 68',
    'Fleeca Shopping',
    'Galinheiro',
    'Hotel Rosa',
    'Joalheria',
    'Mergulhador',
    'Mazebank',
    'Pelados',
    'Prefeitura'
  ],
  grande: [
    'Banco Central',
    'Banco Paleto',
    'Madeireira',
    'Nióbio',
    'Porto'
  ]
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember, Partials.User]
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

async function salvarOuAtualizarCadastro(dados) {
  await db.query(
    `
      INSERT INTO cadastros (
        discord_user_id,
        discord_tag,
        guild_id,
        personagem_nome,
        personagem_nome_formatado,
        personagem_id,
        nickname_aplicado,
        canal_id,
        canal_nome,
        criado_em,
        atualizado_em
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (discord_user_id)
      DO UPDATE SET
        discord_tag = EXCLUDED.discord_tag,
        guild_id = EXCLUDED.guild_id,
        personagem_nome = EXCLUDED.personagem_nome,
        personagem_nome_formatado = EXCLUDED.personagem_nome_formatado,
        personagem_id = EXCLUDED.personagem_id,
        nickname_aplicado = EXCLUDED.nickname_aplicado,
        canal_id = EXCLUDED.canal_id,
        canal_nome = EXCLUDED.canal_nome,
        atualizado_em = EXCLUDED.atualizado_em
    `,
    [
      dados.discordUserId,
      dados.discordTag,
      dados.guildId,
      dados.personagemNome,
      dados.personagemNomeFormatado,
      dados.personagemId,
      dados.nicknameAplicado,
      dados.canalId,
      dados.canalNome,
      dados.criadoEm,
      dados.atualizadoEm
    ]
  );
}

async function buscarCadastroPorUsuario(discordUserId) {
  const result = await db.query(
    `
      SELECT *
      FROM cadastros
      WHERE discord_user_id = $1
      LIMIT 1
    `,
    [discordUserId]
  );

  return result.rows[0] || null;
}

async function validarCadastroExistenteUsuario(discordUserId, { permitirEdicao = false } = {}) {
  const cadastroExistente = await buscarCadastroPorUsuario(discordUserId);

  if (cadastroExistente && !permitirEdicao) {
    throw new Error(
      'Você já possui um cadastro ativo. Para alterar seus dados, solicite a um administrador o uso do comando de edição.'
    );
  }

  return cadastroExistente;
}

async function buscarCadastroPorPersonagemId(personagemId) {
  const result = await db.query(
    `
      SELECT *
      FROM cadastros
      WHERE personagem_id = $1
      LIMIT 1
    `,
    [personagemId]
  );

  return result.rows[0] || null;
}

async function salvarAcao(dados) {
  const result = await db.query(
    `
      INSERT INTO acoes (
        tamanho,
        nome_acao,
        comando_texto,
        quantidade_participantes,
        tipo_acao,
        resultado,
        dinheiro,
        criador_id,
        criador_tag,
        canal_id,
        mensagem_id,
        status,
        iniciado_em,
        finalizado_em
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
    [
      dados.tamanho,
      dados.nomeAcao || null,
      dados.comandoTexto,
      dados.quantidadeParticipantes,
      dados.tipoAcao || null,
      dados.resultado || null,
      dados.dinheiro,
      dados.criadorId,
      dados.criadorTag,
      dados.canalId,
      dados.mensagemId || null,
      dados.status || 'em_andamento',
      dados.iniciadoEm,
      dados.finalizadoEm || null
    ]
  );

  return result.rows[0];
}

async function atualizarMensagemAcao(acaoId, mensagemId) {
  const result = await db.query(
    `
      UPDATE acoes
      SET mensagem_id = $1
      WHERE id = $2
      RETURNING *
    `,
    [mensagemId, acaoId]
  );

  return result.rows[0] || null;
}

async function buscarAcaoPorId(acaoId) {
  const result = await db.query(
    `
      SELECT *
      FROM acoes
      WHERE id = $1
      LIMIT 1
    `,
    [acaoId]
  );

  return result.rows[0] || null;
}

async function atualizarCampoAcao(acaoId, campo, valor) {
  const camposPermitidos = new Set(['nome_acao', 'comando_texto', 'tipo_acao', 'resultado', 'status', 'finalizado_em']);

  if (!camposPermitidos.has(campo)) {
    throw new Error('Campo de ação não permitido.');
  }

  const result = await db.query(
    `
      UPDATE acoes
      SET ${campo} = $1
      WHERE id = $2
      RETURNING *
    `,
    [valor, acaoId]
  );

  return result.rows[0] || null;
}

async function adicionarParticipanteAcao(acaoId, usuario) {
  await db.query(
    `
      INSERT INTO acao_participantes (
        acao_id,
        usuario_id,
        usuario_tag,
        criado_em
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (acao_id, usuario_id) DO NOTHING
    `,
    [acaoId, usuario.id, usuario.tag, new Date()]
  );
}

async function removerParticipanteAcao(acaoId, usuarioId) {
  await db.query(
    `
      DELETE FROM acao_participantes
      WHERE acao_id = $1
        AND usuario_id = $2
    `,
    [acaoId, usuarioId]
  );
}

async function buscarParticipantesAcao(acaoId) {
  const result = await db.query(
    `
      SELECT usuario_id, usuario_tag
      FROM acao_participantes
      WHERE acao_id = $1
      ORDER BY criado_em ASC
    `,
    [acaoId]
  );

  return result.rows;
}

async function salvarLavagem(dados) {
  const result = await db.query(
    `
      INSERT INTO lavagens (
        tipo,
        usuario_tag,
        usuario_id,
        quantidade,
        grupo,
        personagem_id,
        taxa_percentual,
        valor_faccao,
        valor_cliente,
        status,
        mensagem_aprovacao_id,
        canal_aprovacao_id,
        criado_em,
        atualizado_em
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
    [
      dados.tipo,
      dados.usuarioTag,
      dados.usuarioId,
      dados.quantidade,
      dados.grupo,
      dados.personagemId,
      dados.taxaPercentual,
      dados.valorFaccao,
      dados.valorCliente,
      dados.status,
      dados.mensagemAprovacaoId || null,
      dados.canalAprovacaoId || null,
      dados.criadoEm,
      dados.atualizadoEm
    ]
  );

  return result.rows[0];
}

async function atualizarMensagemAprovacaoLavagem(lavagemId, mensagemId, canalId) {
  await db.query(
    `
      UPDATE lavagens
      SET mensagem_aprovacao_id = $1,
          canal_aprovacao_id = $2,
          atualizado_em = $3
      WHERE id = $4
    `,
    [mensagemId, canalId, new Date(), lavagemId]
  );
}

async function buscarLavagemPorId(lavagemId) {
  const result = await db.query(
    `
      SELECT *
      FROM lavagens
      WHERE id = $1
      LIMIT 1
    `,
    [lavagemId]
  );

  return result.rows[0] || null;
}

async function aprovarLavagem(lavagemId, aprovador) {
  const result = await db.query(
    `
      UPDATE lavagens
      SET status = 'aprovada',
          aprovado_por_id = $1,
          aprovado_por_tag = $2,
          atualizado_em = $3
      WHERE id = $4
        AND status = 'pendente'
      RETURNING *
    `,
    [aprovador.id, aprovador.tag, new Date(), lavagemId]
  );

  return result.rows[0] || null;
}

async function removerDadosUsuarioDoBanco(usuarioId) {
  await db.query('BEGIN');

  try {
    await db.query(
      `
        DELETE FROM lavagens
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    await db.query(
      `
        DELETE FROM relatorios_semanais
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    await db.query(
      `
        DELETE FROM registros
        WHERE usuario_id = $1
      `,
      [usuarioId]
    );

    await db.query(
      `
        DELETE FROM cadastros
        WHERE discord_user_id = $1
      `,
      [usuarioId]
    );

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function apagarCanalPrivadoCadastro(canalId) {
  if (!canalId) {
    return false;
  }

  const canal = await client.channels.fetch(canalId).catch(() => null);

  if (!canal) {
    return false;
  }

  await canal.delete('Usuário saiu do servidor').catch(error => {
    throw error;
  });

  return true;
}

async function moverCanalPrivadoParaCategoriaSaida(guild, canalId) {
  const categoriaSaidaId = process.env.CATEGORIA_SAIDA_CADASTRO_ID || null;

  if (!canalId || !categoriaSaidaId) {
    return false;
  }

  const canal = await guild.channels.fetch(canalId).catch(() => null);

  if (!canal) {
    return false;
  }

  await canal.edit({
    parent: categoriaSaidaId
  });

  return true;
}

async function recusarLavagem(lavagemId, recusador) {
  const result = await db.query(
    `
      DELETE FROM lavagens
      WHERE id = $1
        AND status = 'pendente'
      RETURNING *
    `,
    [lavagemId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    ...result.rows[0],
    recusado_por_id: recusador.id,
    recusado_por_tag: recusador.tag,
    status: 'recusada'
  };
}

function normalizarEspacos(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

function capitalizarNomePersonagem(nome) {
  return normalizarEspacos(nome)
    .split(' ')
    .filter(Boolean)
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

function sanitizarNomeCanal(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function gerarNomeCanalCadastro(nomeFormatado, personagemId) {
  return `${sanitizarNomeCanal(nomeFormatado)}-${personagemId}`.slice(0, 100);
}

async function validarPersonagemIdDisponivel(personagemId, discordUserId) {
  const cadastroExistente = await buscarCadastroPorPersonagemId(personagemId);

  if (cadastroExistente && cadastroExistente.discord_user_id !== discordUserId) {
    return cadastroExistente;
  }

  return null;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(valor || 0));
}

function normalizarTextoComandoAcao(texto) {
  const valor = normalizarEspacos(texto);
  const mencao = valor.match(/^<@!?(\d+)>$/);

  if (mencao) {
    return `<@${mencao[1]}>`;
  }

  if (/^\d+$/.test(valor)) {
    return `<@${valor}>`;
  }

  return valor;
}

function obterLabelTamanhoAcao(tamanho) {
  if (tamanho === 'pequena') return 'Ação Pequena';
  if (tamanho === 'media') return 'Ação Média';
  return 'Ação Grande';
}

function criarModalAcao(tamanho) {
  const modal = new ModalBuilder()
    .setCustomId(`${ACAO_MODAL_PREFIX}${tamanho}`)
    .setTitle(obterLabelTamanhoAcao(tamanho));

  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade_participantes')
    .setLabel('Quantidade de participantes')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(3)
    .setPlaceholder('Ex.: 8');

  const dinheiroInput = new TextInputBuilder()
    .setCustomId('dinheiro')
    .setLabel('Dinheiro')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(12)
    .setPlaceholder('Ex.: 1125000');

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidadeInput),
    new ActionRowBuilder().addComponents(dinheiroInput)
  );

  return modal;
}

function obterArquivosPainelAcoes() {
  if (!fs.existsSync(ACOES_PAINEL_IMAGE_PATH)) {
    return [];
  }

  return [new AttachmentBuilder(ACOES_PAINEL_IMAGE_PATH, { name: 'painel_acoes.png' })];
}

function criarPainelAcoes() {
  const possuiBannerLocal = fs.existsSync(ACOES_PAINEL_IMAGE_PATH);
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Criar Relatório de Ação')
    .setDescription([
      'Este canal é destinado ao **registro de ações blipadas**.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '• Selecione o tipo de ação realizada no menu abaixo.',
      '• Informe se a ação é no tiro, fuga ou arma branca.',
      '• Solicite que todos os membros participantes confirmem sua participação.',
      '• As informações serão registradas para fins de controle, estatística e histórico.',
      '',
      '📌 Utilize este recurso sempre que houver qualquer tipo de ação blipada em andamento.'
    ].join('\n'))
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
    components: [row]
  };
}

async function publicarOuAtualizarPainelAcoes() {
  if (!PAINEL_ACOES_CANAL_ID) {
    return;
  }

  const painel = criarPainelAcoes();
  const arquivos = obterArquivosPainelAcoes();
  const canal = await client.channels.fetch(PAINEL_ACOES_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel de ações não encontrado ou inválido.');
    return;
  }

  const mensagens = await canal.messages.fetch({ limit: 20 });
  const mensagemExistente = mensagens.find(message =>
    message.author.id === client.user.id &&
    message.embeds.some(embed => embed.title === painel.embed.data.title)
  );

  const payload = {
    embeds: [painel.embed],
    components: painel.components,
    files: arquivos
  };

  if (mensagemExistente) {
    await mensagemExistente.edit({
      embeds: [painel.embed],
      components: painel.components
    });
    return;
  }

  await canal.send(payload);
}

function criarSelectAcoesDisponiveis(acaoId, tamanho, desabilitado = false) {
  const opcoes = (ACOES_DISPONIVEIS[tamanho] || []).slice(0, 25).map(acao => ({
    label: acao.slice(0, 100),
    value: acao
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_SELECT_NOME_PREFIX}${acaoId}`)
      .setPlaceholder('Escolha a ação')
      .setDisabled(desabilitado || opcoes.length === 0)
      .addOptions(opcoes.length ? opcoes : [{ label: 'Cadastre ações em ACOES_DISPONIVEIS', value: 'indisponivel' }])
  );
}

function criarSelectTipoAcao(acaoId, desabilitado = false) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${ACAO_SELECT_TIPO_PREFIX}${acaoId}`)
      .setPlaceholder('Escolha o tipo da ação')
      .setDisabled(desabilitado)
      .addOptions(
        { label: 'Tiro', value: 'Tiro' },
        { label: 'Fuga', value: 'Fuga' },
        { label: 'Arma Branca', value: 'Arma Branca' }
      )
  );
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

function criarEmbedAcao(acao, participantes) {
  const listaParticipantes = participantes.length
    ? participantes.map(participante => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado ainda.';

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(acao.nome_acao || `${obterLabelTamanhoAcao(acao.tamanho)} em andamento`)
    .setDescription([
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
      listaParticipantes
    ].join('\n'))
    .setFooter({ text: `Ação #${acao.id}` })
    .setTimestamp();
}

function criarEmbedLogAcao(acao, participantes) {
  const totalParticipantes = participantes.length || 1;
  const valorPorPessoa = Math.floor(Number(acao.dinheiro || 0) / totalParticipantes);
  const listaParticipantes = participantes.length
    ? participantes.map(participante => `<@${participante.usuario_id}>`).join('\n')
    : 'Nenhum participante confirmado.';

  return new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(acao.nome_acao || obterLabelTamanhoAcao(acao.tamanho))
    .setDescription([
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
      `**Finalizada:** <t:${Math.floor(new Date(acao.finalizado_em || new Date()).getTime() / 1000)}:f>`
    ].join('\n'))
    .setFooter({ text: `Ação #${acao.id}` })
    .setTimestamp(new Date(acao.finalizado_em || new Date()));
}

async function renderizarMensagemAcao(interactionOrChannel, acaoId, desabilitado = false) {
  const acao = await buscarAcaoPorId(acaoId);

  if (!acao) {
    return null;
  }

  const participantes = await buscarParticipantesAcao(acaoId);
  const payload = {
    embeds: [criarEmbedAcao(acao, participantes)],
    components: [
      criarSelectAcoesDisponiveis(acaoId, acao.tamanho, desabilitado),
      criarSelectTipoAcao(acaoId, desabilitado),
      criarSelectResultadoAcao(acaoId, desabilitado),
      criarBotoesAcao(acaoId, desabilitado)
    ]
  };

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

async function processarModalAcao(interaction, tamanho) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'Essa ação só pode ser criada dentro do servidor.',
      ephemeral: true
    });
  }

  const quantidadeParticipantesTexto = interaction.fields.getTextInputValue('quantidade_participantes').trim();
  const dinheiroTexto = interaction.fields.getTextInputValue('dinheiro').trim();

  if (!/^\d+$/.test(quantidadeParticipantesTexto) || Number(quantidadeParticipantesTexto) <= 0) {
    return interaction.reply({
      content: 'A quantidade de participantes deve ser um número inteiro maior que zero.',
      ephemeral: true
    });
  }

  if (!/^\d+$/.test(dinheiroTexto) || Number(dinheiroTexto) <= 0) {
    return interaction.reply({
      content: 'O valor em dinheiro deve ser um número inteiro maior que zero.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const acao = await salvarAcao({
    tamanho,
    comandoTexto: null,
    quantidadeParticipantes: Number(quantidadeParticipantesTexto),
    dinheiro: Number(dinheiroTexto),
    criadorId: interaction.user.id,
    criadorTag: interaction.user.tag,
    canalId: interaction.channelId,
    status: 'em_andamento',
    iniciadoEm: new Date()
  });

  const mensagem = await renderizarMensagemAcao(interaction, acao.id);

  return interaction.editReply({
    content: `Ação criada com sucesso em ${mensagem ? `<#${interaction.channelId}>` : 'este canal'}.`
  });
}

async function finalizarAcao(interaction, acaoId) {
  const acao = await buscarAcaoPorId(acaoId);

  if (!acao) {
    return interaction.reply({
      content: 'Não encontrei essa ação.',
      ephemeral: true
    });
  }

  const participantes = await buscarParticipantesAcao(acaoId);

  if (!acao.nome_acao || !acao.tipo_acao || !acao.resultado) {
    return interaction.reply({
      content: 'Defina a ação, o tipo e o resultado antes de finalizar.',
      ephemeral: true
    });
  }

  if (!acao.comando_texto) {
    return interaction.reply({
      content: 'É necessário que alguém assuma o comando da ação antes de finalizar.',
      ephemeral: true
    });
  }

  if (!participantes.length) {
    return interaction.reply({
      content: 'É necessário ter ao menos um participante confirmado para finalizar.',
      ephemeral: true
    });
  }

  const acaoFinalizada = await atualizarCampoAcao(acaoId, 'status', 'finalizada');
  await atualizarCampoAcao(acaoId, 'finalizado_em', new Date());
  const acaoAtualizada = await buscarAcaoPorId(acaoId);

  const canalLog = await client.channels.fetch(CANAL_LOG_ACOES_ID).catch(() => null);

  if (!canalLog || canalLog.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: 'Não encontrei o canal de log de ações configurado.',
      ephemeral: true
    });
  }

  await renderizarMensagemAcao(interaction, acaoId, true);
  await canalLog.send({
    embeds: [criarEmbedLogAcao(acaoAtualizada || acaoFinalizada, participantes)]
  });

  if (acao.mensagem_id) {
    const canalOrigem = await client.channels.fetch(acao.canal_id).catch(() => null);

    if (canalOrigem && 'messages' in canalOrigem) {
      const mensagemAcao = await canalOrigem.messages.fetch(acao.mensagem_id).catch(() => null);

      if (mensagemAcao) {
        await mensagemAcao.delete().catch(error => {
          console.error(`Não foi possível apagar a mensagem da ação #${acaoId}:`, error);
        });
      }
    }
  }

  return interaction.reply({
    content: 'Ação finalizada e log registrado com sucesso.',
    ephemeral: true
  });
}

function obterConfigLavagem(tipo) {
  if (tipo === 'parceria') {
    return {
      tipo,
      titulo: 'Lavagem Parceria',
      taxaPercentual: 20,
      cor: 0x2f3136
    };
  }

  return {
    tipo: 'pista',
    titulo: 'Lavagem Pista',
    taxaPercentual: 30,
    cor: 0x2f3136
  };
}

function calcularValoresLavagem(quantidade, taxaPercentual) {
  const valorTotal = Number(quantidade);
  const valorFaccao = Math.floor((valorTotal * taxaPercentual) / 100);
  const valorCliente = valorTotal - valorFaccao;

  return {
    valorTotal,
    valorFaccao,
    valorCliente
  };
}

function criarModalLavagem(tipo) {
  const config = obterConfigLavagem(tipo);
  const modal = new ModalBuilder()
    .setCustomId(`${LAVAGEM_MODAL_PREFIX}${config.tipo}`)
    .setTitle(config.titulo);

  const quantidadeInput = new TextInputBuilder()
    .setCustomId('quantidade')
    .setLabel('Quantidade para lavar')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: 1000000')
    .setMaxLength(12);

  const grupoInput = new TextInputBuilder()
    .setCustomId('grupo')
    .setLabel('Grupo')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: Grupo Norte')
    .setMaxLength(60);

  const personagemIdInput = new TextInputBuilder()
    .setCustomId('personagem_id')
    .setLabel('ID do personagem que está lavando')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex.: 6001')
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quantidadeInput),
    new ActionRowBuilder().addComponents(grupoInput),
    new ActionRowBuilder().addComponents(personagemIdInput)
  );

  return modal;
}

function criarEmbedAprovacaoLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(`Aprovação Pendente • ${config.titulo}`)
    .setDescription('Avalie a solicitação abaixo.')
    .addFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Taxa da Facção', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.criado_em));
}

function criarBotoesAprovacaoLavagem(lavagemId, desabilitado = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${LAVAGEM_APROVAR_PREFIX}${lavagemId}`)
        .setLabel('Aprovar')
        .setStyle(ButtonStyle.Success)
        .setDisabled(desabilitado),
      new ButtonBuilder()
        .setCustomId(`${LAVAGEM_RECUSAR_PREFIX}${lavagemId}`)
        .setLabel('Recusar')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(desabilitado)
    )
  ];
}

function criarEmbedRegistroLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(config.titulo)
    .setDescription('Lavagem aprovada e contabilizada com sucesso.')
    .addFields(
      { name: 'Solicitante', value: `<@${lavagem.usuario_id}>`, inline: false },
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'ID do Personagem', value: lavagem.personagem_id, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Taxa da Facção', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_tag || 'Não informado', inline: true }
    )
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.atualizado_em || lavagem.criado_em));
}

function criarEmbedAprovacaoLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(`Aprovação Pendente • ${config.titulo}`)
    .setDescription('Avalie a solicitação abaixo.')
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Status', value: 'Pendente', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.criado_em));
}

function criarEmbedRegistroLavagem(lavagem) {
  const config = obterConfigLavagem(lavagem.tipo);

  return new EmbedBuilder()
    .setColor(config.cor)
    .setTitle(config.titulo)
    .setDescription('Lavagem aprovada e contabilizada com sucesso.')
    .setFields(
      { name: 'Grupo', value: lavagem.grupo, inline: true },
      { name: 'Valor Total', value: formatarMoeda(lavagem.quantidade), inline: true },
      { name: 'Valor do Cliente', value: formatarMoeda(lavagem.valor_cliente), inline: true },
      { name: 'Valor da Facção', value: formatarMoeda(lavagem.valor_faccao), inline: true },
      { name: 'Taxa', value: `${lavagem.taxa_percentual}%`, inline: true },
      { name: 'Usuário', value: `<@${lavagem.usuario_id}>`, inline: true },
      { name: 'Passaporte', value: lavagem.personagem_id, inline: true },
      { name: 'Aprovado por', value: lavagem.aprovado_por_id ? `<@${lavagem.aprovado_por_id}>` : 'Não informado', inline: true }
    )
    .setFooter({ text: `Lavagem #${lavagem.id}` })
    .setTimestamp(new Date(lavagem.atualizado_em || lavagem.criado_em));
}

async function processarModalLavagem(interaction, tipo) {
  const config = obterConfigLavagem(tipo);
  const quantidadeTexto = interaction.fields.getTextInputValue('quantidade').trim();
  const grupo = normalizarEspacos(interaction.fields.getTextInputValue('grupo'));
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();

  if (!/^\d+$/.test(quantidadeTexto)) {
    return interaction.reply({
      content: 'A quantidade para lavar deve conter apenas números inteiros.',
      ephemeral: true
    });
  }

  if (!/^\d+$/.test(personagemId)) {
    return interaction.reply({
      content: 'O ID do personagem deve conter apenas números.',
      ephemeral: true
    });
  }

  if (!grupo || grupo.length < 2) {
    return interaction.reply({
      content: 'Informe um grupo válido.',
      ephemeral: true
    });
  }

  const quantidade = Number(quantidadeTexto);

  if (quantidade <= 0) {
    return interaction.reply({
      content: 'A quantidade para lavar deve ser maior que zero.',
      ephemeral: true
    });
  }

  const valores = calcularValoresLavagem(quantidade, config.taxaPercentual);
  await interaction.deferReply({ ephemeral: true });

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
    atualizadoEm: new Date()
  });

  const canalAprovacao = await client.channels.fetch(CANAL_APROVACAO_LAVAGEM_ID).catch(() => null);

  if (!canalAprovacao || canalAprovacao.type !== ChannelType.GuildText) {
    throw new Error('Canal de aprovação de lavagem não encontrado ou inválido.');
  }

  const mensagemAprovacao = await canalAprovacao.send({
    embeds: [criarEmbedAprovacaoLavagem(lavagem)],
    components: criarBotoesAprovacaoLavagem(lavagem.id)
  });

  await atualizarMensagemAprovacaoLavagem(lavagem.id, mensagemAprovacao.id, canalAprovacao.id);

  return interaction.editReply({
    content: `${config.titulo} enviada para aprovação com sucesso.`
  });
}

async function finalizarLavagem(interaction, lavagemId, acao) {
  const lavagem = await buscarLavagemPorId(lavagemId);

  if (!lavagem) {
    return interaction.reply({
      content: 'Não encontrei essa solicitação de lavagem.',
      ephemeral: true
    });
  }

  if (lavagem.status !== 'pendente') {
    return interaction.reply({
      content: `Essa lavagem já foi ${lavagem.status}.`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const lavagemAtualizada = acao === 'aprovar'
    ? await aprovarLavagem(lavagemId, interaction.user)
    : await recusarLavagem(lavagemId, interaction.user);

  if (!lavagemAtualizada) {
    return interaction.editReply({
      content: 'Essa lavagem já foi processada por outra pessoa.'
    });
  }

  const embedAtualizado = criarEmbedAprovacaoLavagem(lavagemAtualizada)
    .setDescription(
      acao === 'aprovar'
        ? `Solicitação aprovada por <@${interaction.user.id}>.`
        : `Solicitação recusada por <@${interaction.user.id}>.`
    )
    .spliceFields(7, 1, {
      name: 'Status',
      value: acao === 'aprovar' ? 'Aprovada' : 'Recusada',
      inline: true
    });

  await interaction.message.edit({
    embeds: [embedAtualizado],
    components: criarBotoesAprovacaoLavagem(lavagemId, true)
  });

  if (acao === 'aprovar') {
    const canalRegistro = await client.channels.fetch(CANAL_REGISTRO_LAVAGEM_ID).catch(() => null);

    if (!canalRegistro || canalRegistro.type !== ChannelType.GuildText) {
      throw new Error('Canal de registro de lavagem não encontrado ou inválido.');
    }

    await canalRegistro.send({
      embeds: [criarEmbedRegistroLavagem(lavagemAtualizada)]
    });
  }

  return interaction.editReply({
    content: acao === 'aprovar'
      ? 'Lavagem aprovada e registrada com sucesso.'
      : 'Lavagem recusada com sucesso.'
  });
}

function criarModalCadastro() {
  const modal = new ModalBuilder()
    .setCustomId(CADASTRO_MODAL_ID)
    .setTitle('Cadastro VSYNC');

  const nomeInput = new TextInputBuilder()
    .setCustomId('personagem_nome')
    .setLabel('Nome do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setPlaceholder('Ex.: Caruso Scofield');

  const idInput = new TextInputBuilder()
    .setCustomId('personagem_id')
    .setLabel('ID do personagem')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10)
    .setPlaceholder('Ex.: 6001');

  modal.addComponents(
    new ActionRowBuilder().addComponents(nomeInput),
    new ActionRowBuilder().addComponents(idInput)
  );

  return modal;
}

function criarPainelCadastro() {
  const possuiBannerLocal = fs.existsSync(CADASTRO_IMAGE_PATH);
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Registro no Discord')
    .setDescription([
      'Faça seu registro corretamente e aguarde a aprovação da gerência.',
      '',
      '━━━━━━━━━━━━━━━━━━',
      '**Registro Facção**',
      '',
      '• Clique nas opções abaixo para fazer seu registro dentro do Discord.',
      '• Um canal privado exclusivo será criado só para você e a gerência.',
      '• Nesse canal você poderá tirar dúvidas, resolver pendências e registrar farm.'
    ].join('\n'))
    .setThumbnail(CADASTRO_THUMBNAIL_URL)
    .setFooter({ text: 'VSYNC • Painel de Cadastro' })
    .setTimestamp();

  if (possuiBannerLocal) {
    embed.setImage(CADASTRO_BANNER_URL);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CADASTRO_BUTTON_ID)
      .setLabel('Registro no Discord')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🪪')
  );

  return {
    embed,
    components: [row]
  };
}

function obterArquivosPainelCadastro() {
  if (!fs.existsSync(CADASTRO_IMAGE_PATH)) {
    return [];
  }

  return [new AttachmentBuilder(CADASTRO_IMAGE_PATH)];
}

async function criarOuAtualizarCanalCadastro(guild, membro, nomeFormatado, personagemId) {
  const categoriaId = process.env.CATEGORIA_CADASTRO_ID || null;
  const cargoGerenciaId = process.env.CARGO_GERENCIA_ID || null;
  const nomeCanal = gerarNomeCanalCadastro(nomeFormatado, personagemId);
  const cadastroExistente = await buscarCadastroPorUsuario(membro.id);
  let canal = null;

  if (cadastroExistente?.canal_id) {
    canal = await guild.channels.fetch(cadastroExistente.canal_id).catch(() => null);
  }

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: membro.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (cargoGerenciaId) {
    permissionOverwrites.push({
      id: cargoGerenciaId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  if (canal) {
    const canalEditData = {
      name: nomeCanal,
      permissionOverwrites,
      topic: `Cadastro de ${nomeFormatado} | ${personagemId}`
    };

    if (categoriaId) {
      canalEditData.parent = categoriaId;
    }

    await canal.edit(canalEditData);

    return canal;
  }

  const canalCreateData = {
    name: nomeCanal,
    type: ChannelType.GuildText,
    topic: `Cadastro de ${nomeFormatado} | ${personagemId}`,
    permissionOverwrites
  };

  if (categoriaId) {
    canalCreateData.parent = categoriaId;
  }

  return guild.channels.create(canalCreateData);
}

async function aplicarCadastroUsuario(guild, user, nomeBruto, personagemId, opcoes = {}) {
  const { permitirEdicao = false } = opcoes;
  const nomeFormatado = capitalizarNomePersonagem(nomeBruto);

  if (!nomeFormatado || nomeFormatado.length < 3) {
    throw new Error('Informe um nome de personagem válido.');
  }

  if (!/^\d+$/.test(personagemId)) {
    throw new Error('O ID do personagem deve conter apenas números.');
  }

  await validarCadastroExistenteUsuario(user.id, { permitirEdicao });

  const conflitoCadastro = await validarPersonagemIdDisponivel(personagemId, user.id);

  if (conflitoCadastro) {
    throw new Error(`O ID ${personagemId} já está cadastrado para outro usuário.`);
  }

  const membro = await guild.members.fetch(user.id);
  const apelido = `${nomeFormatado} | ${personagemId}`;
  const canal = await criarOuAtualizarCanalCadastro(guild, membro, nomeFormatado, personagemId);

  await membro.setNickname(apelido).catch(error => {
    console.error(`Não foi possível alterar o apelido de ${user.tag}:`, error);
  });

  if (process.env.CARGO_CADASTRADO_ID) {
    await membro.roles.add(process.env.CARGO_CADASTRADO_ID).catch(error => {
      console.error(`Falha ao adicionar cargo de cadastro para ${user.tag}:`, error);
    });
  }

  await salvarOuAtualizarCadastro({
    discordUserId: user.id,
    discordTag: user.tag,
    guildId: guild.id,
    personagemNome: nomeBruto.trim(),
    personagemNomeFormatado: nomeFormatado,
    personagemId,
    nicknameAplicado: apelido,
    canalId: canal.id,
    canalNome: canal.name,
    criadoEm: new Date(),
    atualizadoEm: new Date()
  });

  return {
    nomeFormatado,
    personagemId,
    apelido,
    canal
  };
}

async function enviarMensagemCanalCadastro(
  canal,
  usuarioId,
  nomeFormatado,
  personagemId,
  {
    titulo = 'Cadastro Recebido',
    descricaoFinal = 'Use este canal para falar com a gerência, tirar dúvidas e acompanhar seu processo.'
  } = {}
) {
  const embedCanal = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(titulo)
    .setDescription([
      `Bem-vindo, <@${usuarioId}>.`,
      '',
      `**Personagem:** ${nomeFormatado}`,
      `**ID:** ${personagemId}`,
      '',
      descricaoFinal
    ].join('\n'))
    .setTimestamp();

  await canal.send({ content: `<@${usuarioId}>`, embeds: [embedCanal] });
}

async function processarCadastro(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'Esse cadastro só pode ser feito dentro do servidor.',
      ephemeral: true
    });
  }

  const nomeBruto = interaction.fields.getTextInputValue('personagem_nome');
  const personagemId = interaction.fields.getTextInputValue('personagem_id').trim();

  await interaction.deferReply({ ephemeral: true });

  let resultadoCadastro;

  try {
    resultadoCadastro = await aplicarCadastroUsuario(
      interaction.guild,
      interaction.user,
      nomeBruto,
      personagemId,
      { permitirEdicao: false }
    );
  } catch (error) {
    return interaction.editReply({
      content: error.message || 'Não foi possível concluir o cadastro.'
    });
  }

  await enviarMensagemCanalCadastro(
    resultadoCadastro.canal,
    interaction.user.id,
    resultadoCadastro.nomeFormatado,
    resultadoCadastro.personagemId
  );

  return interaction.editReply({
    content: `Cadastro concluído com sucesso. Seu canal foi criado em <#${resultadoCadastro.canal.id}>.`
  });
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
      'Notifique suas lavagens e peça para a gerência aprovar sua lavagem.'
    ].join('\n'))
    .setThumbnail(PAINEL_THUMBNAIL_URL)
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

  return {
    embed,
    components: [row1, row2]
  };
}

async function publicarOuAtualizarPainelPrincipal() {
  if (!PAINEL_PRINCIPAL_CANAL_ID) {
    return;
  }

  const painel = criarPainel();
  const canal = await client.channels.fetch(PAINEL_PRINCIPAL_CANAL_ID).catch(() => null);

  if (!canal || canal.type !== ChannelType.GuildText) {
    console.error('Canal do painel principal nÃ£o encontrado ou invÃ¡lido.');
    return;
  }

  const mensagens = await canal.messages.fetch({ limit: 20 });
  const mensagemExistente = mensagens.find(message =>
    message.author.id === client.user.id &&
    message.embeds.some(embed => embed.title === painel.embed.data.title)
  );

  if (mensagemExistente) {
    await mensagemExistente.edit({
      embeds: [painel.embed],
      components: painel.components
    });
    return;
  }

  await canal.send({
    embeds: [painel.embed],
    components: painel.components
  });
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

/* =========================
   BOT READY
========================= */

console.log('Evento ready foi registrado.');

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  console.log('[startup] Intents ativos: Guilds, GuildMembers');
});

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

  publicarOuAtualizarPainelPrincipal().catch(error => {
    console.error('Erro ao publicar o painel principal persistente:', error);
  });

  publicarOuAtualizarPainelAcoes().catch(error => {
    console.error('Erro ao publicar o painel de ações persistente:', error);
  });
});

client.on('guildMemberRemove', async member => {
  try {
    console.log(`[guildMemberRemove] Saída detectada: ${member.user.tag} (${member.id})`);

    const cadastroUsuario = await buscarCadastroPorUsuario(member.id);

    if (cadastroUsuario) {
      console.log(
        `[guildMemberRemove] Cadastro encontrado para ${member.user.tag} (${member.id}). Canal privado: ${cadastroUsuario.canal_id || 'nenhum'}`
      );

      if (cadastroUsuario.canal_id) {
        const canalMovido = await moverCanalPrivadoParaCategoriaSaida(member.guild, cadastroUsuario.canal_id).catch(error => {
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
      }
    } else {
      console.log(`[guildMemberRemove] Nenhum cadastro encontrado para ${member.user.tag} (${member.id}).`);
    }
  } catch (error) {
    console.error(`[guildMemberRemove] Erro ao processar saída de ${member.user.tag} (${member.id}):`, error);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    console.log(`[guildMemberAdd] Entrada detectada: ${member.user.tag} (${member.id})`);

    const cadastroUsuario = await buscarCadastroPorUsuario(member.id);

    if (!cadastroUsuario) {
      console.log(`[guildMemberAdd] Nenhum cadastro encontrado para ${member.user.tag} (${member.id}).`);
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
        descricaoFinal: 'Seu cadastro anterior foi localizado no banco de dados e seu canal privado foi reativado automaticamente.'
      }
    );

    console.log(
      `[guildMemberAdd] Cadastro reativado com sucesso para ${member.user.tag} (${member.id}) no canal ${resultadoCadastro.canal.id}.`
    );
  } catch (error) {
    console.error(`[guildMemberAdd] Erro ao reativar cadastro de ${member.user.tag} (${member.id}):`, error);
  }
});

/* =========================
   INTERAÇÕES
========================= */

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel_acoes') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({
            content: 'Você não tem permissão para publicar o painel de ações.',
            ephemeral: true
          });
        }
        await publicarOuAtualizarPainelAcoes();

        return interaction.reply({
          content: `Painel de ações sincronizado no canal <#${PAINEL_ACOES_CANAL_ID}>.`,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'painel_cadastro') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({
            content: 'Você não tem permissão para publicar o painel de cadastro.',
            ephemeral: true
          });
        }

        const painelCadastro = criarPainelCadastro();
        const arquivos = obterArquivosPainelCadastro();

        await interaction.channel.send({
          embeds: [painelCadastro.embed],
          components: painelCadastro.components,
          files: arquivos
        });

        return interaction.reply({
          content: 'Painel de cadastro publicado neste canal.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'editar_cadastro') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: 'Você não tem permissão para editar cadastros.',
            ephemeral: true
          });
        }

        const usuario = interaction.options.getUser('usuario', true);
        const nomeBruto = interaction.options.getString('nome', true);
        const personagemId = interaction.options.getString('id', true).trim();
        const cadastroAtual = await buscarCadastroPorUsuario(usuario.id);

        if (!cadastroAtual) {
          return interaction.reply({
            content: 'Esse usuário ainda não possui cadastro.',
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        let resultadoCadastro;

        try {
          resultadoCadastro = await aplicarCadastroUsuario(
            interaction.guild,
            usuario,
            nomeBruto,
            personagemId,
            { permitirEdicao: true }
          );
        } catch (error) {
          return interaction.editReply({
            content: error.message || 'Não foi possível editar o cadastro.'
          });
        }

        return interaction.editReply({
          content: `Cadastro de <@${usuario.id}> atualizado para ${resultadoCadastro.nomeFormatado} | ${resultadoCadastro.personagemId}. Canal: <#${resultadoCadastro.canal.id}>`
        });
      }

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
        const cadastroUsuario = await buscarCadastroPorUsuario(interaction.user.id);

        if (foto && foto.contentType && !foto.contentType.startsWith('image/')) {
          return interaction.reply({
            content: 'O arquivo enviado em foto precisa ser uma imagem válida.',
            ephemeral: true
          });
        }

        if (link && !/^https?:\/\//i.test(link)) {
          return interaction.reply({
            content: 'O link informado para a imagem precisa começar com http:// ou https://.',
            ephemeral: true
          });
        }

        const imagem = foto?.url || link || null;

        if (!imagem) {
          return interaction.reply({
            content: 'Envie uma imagem no campo de foto ou informe um link de imagem para registrar o farm.',
            ephemeral: true
          });
        }

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

        if (cadastroUsuario?.canal_id) {
          const canalPrivado = await client.channels.fetch(cadastroUsuario.canal_id).catch(() => null);

          if (
            canalPrivado &&
            (
              canalPrivado.type === ChannelType.GuildText ||
              canalPrivado.type === ChannelType.PublicThread ||
              canalPrivado.type === ChannelType.PrivateThread
            )
          ) {
            await canalPrivado.send({ embeds: [embed] }).catch(error => {
              console.error(`Falha ao enviar registro de farm para o canal privado de ${interaction.user.tag}:`, error);
            });
          }
        }

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

    if (interaction.isModalSubmit()) {
      if (interaction.customId === CADASTRO_MODAL_ID) {
        return processarCadastro(interaction);
      }

      if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}parceria`) {
        return processarModalLavagem(interaction, 'parceria');
      }

      if (interaction.customId === `${LAVAGEM_MODAL_PREFIX}pista`) {
        return processarModalLavagem(interaction, 'pista');
      }

      if (interaction.customId === `${ACAO_MODAL_PREFIX}pequena`) {
        return processarModalAcao(interaction, 'pequena');
      }

      if (interaction.customId === `${ACAO_MODAL_PREFIX}media`) {
        return processarModalAcao(interaction, 'media');
      }

      if (interaction.customId === `${ACAO_MODAL_PREFIX}grande`) {
        return processarModalAcao(interaction, 'grande');
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === CADASTRO_BUTTON_ID) {
        return interaction.showModal(criarModalCadastro());
      }

      if (interaction.customId === 'acao_pequena') {
        return interaction.showModal(criarModalAcao('pequena'));
      }

      if (interaction.customId === 'acao_media') {
        return interaction.showModal(criarModalAcao('media'));
      }

      if (interaction.customId === 'acao_grande') {
        return interaction.showModal(criarModalAcao('grande'));
      }

      if (interaction.customId === 'lavagem_parceria') {
        return interaction.showModal(criarModalLavagem('parceria'));
      }

      if (interaction.customId === 'lavagem_pista') {
        return interaction.showModal(criarModalLavagem('pista'));
      }

      if (interaction.customId.startsWith(LAVAGEM_APROVAR_PREFIX)) {
        const lavagemId = Number(interaction.customId.slice(LAVAGEM_APROVAR_PREFIX.length));
        return finalizarLavagem(interaction, lavagemId, 'aprovar');
      }

      if (interaction.customId.startsWith(LAVAGEM_RECUSAR_PREFIX)) {
        const lavagemId = Number(interaction.customId.slice(LAVAGEM_RECUSAR_PREFIX.length));
        return finalizarLavagem(interaction, lavagemId, 'recusar');
      }

      if (interaction.customId.startsWith(ACAO_ENTRAR_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_ENTRAR_PREFIX.length));
        await adicionarParticipanteAcao(acaoId, interaction.user);
        await renderizarMensagemAcao(interaction, acaoId);
        return interaction.reply({
          content: 'Você entrou na ação.',
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith(ACAO_SAIR_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_SAIR_PREFIX.length));
        await removerParticipanteAcao(acaoId, interaction.user.id);
        await renderizarMensagemAcao(interaction, acaoId);
        return interaction.reply({
          content: 'Você saiu da ação.',
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith(ACAO_COMANDO_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_COMANDO_PREFIX.length));
        await adicionarParticipanteAcao(acaoId, interaction.user);
        await atualizarCampoAcao(acaoId, 'comando_texto', `<@${interaction.user.id}>`);
        await renderizarMensagemAcao(interaction, acaoId);
        return interaction.reply({
          content: 'Você assumiu o comando da ação.',
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith(ACAO_FINALIZAR_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_FINALIZAR_PREFIX.length));
        return finalizarAcao(interaction, acaoId);
      }

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

    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith(ACAO_SELECT_NOME_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_SELECT_NOME_PREFIX.length));
        const nomeAcao = interaction.values[0];

        if (nomeAcao !== 'indisponivel') {
          await atualizarCampoAcao(acaoId, 'nome_acao', nomeAcao);
          await renderizarMensagemAcao(interaction, acaoId);
        }

        return interaction.reply({
          content: nomeAcao === 'indisponivel'
            ? 'Cadastre ações em ACOES_DISPONIVEIS antes de usar esta lista.'
            : `Ação definida como ${nomeAcao}.`,
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith(ACAO_SELECT_TIPO_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_SELECT_TIPO_PREFIX.length));
        const tipoAcao = interaction.values[0];
        await atualizarCampoAcao(acaoId, 'tipo_acao', tipoAcao);
        await renderizarMensagemAcao(interaction, acaoId);
        return interaction.reply({
          content: `Tipo da ação definido como ${tipoAcao}.`,
          ephemeral: true
        });
      }

      if (interaction.customId.startsWith(ACAO_SELECT_RESULTADO_PREFIX)) {
        const acaoId = Number(interaction.customId.slice(ACAO_SELECT_RESULTADO_PREFIX.length));
        const resultado = interaction.values[0];
        await atualizarCampoAcao(acaoId, 'resultado', resultado);
        await renderizarMensagemAcao(interaction, acaoId);
        return interaction.reply({
          content: `Resultado definido como ${resultado}.`,
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
