const PAINEL_THUMBNAIL_URL = 'https://i.postimg.cc/jqvvgNnM/screenshot-288.png?v=20260327-1';
const CADASTRO_THUMBNAIL_URL = 'https://i.postimg.cc/jqvvgNnM/screenshot-288.png?v=20260327-1';
const CADASTRO_MODAL_ID = 'modal_cadastro';
const CADASTRO_BUTTON_ID = 'abrir_cadastro';
const CADASTRO_APROVAR_PREFIX = 'aprovar_cadastro_';
const CADASTRO_RECUSAR_PREFIX = 'recusar_cadastro_';
const PAINEL_CADASTRO_CANAL_ID = process.env.PAINEL_CADASTRO_CANAL_ID || '';
const CANAL_LOG_CADASTRO_ID = process.env.CANAL_LOG_CADASTRO_ID || '1489437048220946442';
const PAINEL_PRINCIPAL_CANAL_ID = process.env.PAINEL_PRINCIPAL_CANAL_ID || '1487117541838163978';
const CANAL_APROVACAO_LAVAGEM_ID = process.env.CANAL_APROVACAO_LAVAGEM_ID || '1487109511306149918';
const CANAL_REGISTRO_LAVAGEM_ID = process.env.CANAL_REGISTRO_LAVAGEM_ID || '1487109544780763256';
const LAVAGEM_MODAL_PREFIX = 'modal_lavagem_';
const LAVAGEM_APROVAR_PREFIX = 'aprovar_lavagem_';
const LAVAGEM_RECUSAR_PREFIX = 'recusar_lavagem_';
const ADMIN_PARCERIA_CADASTRAR_BUTTON_ID = 'admin_parceria_cadastrar';
const ADMIN_PARCERIA_LISTAR_BUTTON_ID = 'admin_parceria_listar';
const ADMIN_PARCERIA_REMOVER_BUTTON_ID = 'admin_parceria_remover';
const ADMIN_PARCERIA_CADASTRAR_MODAL_ID = 'admin_parceria_cadastrar_modal';
const ADMIN_PARCERIA_REMOVER_MODAL_ID = 'admin_parceria_remover_modal';
const ADMIN_BANCO_ADICIONAR_BUTTON_ID = 'admin_banco_adicionar';
const ADMIN_BANCO_RETIRAR_BUTTON_ID = 'admin_banco_retirar';
const ADMIN_BANCO_RESETAR_BUTTON_ID = 'admin_banco_resetar';
const ADMIN_BANCO_RESETAR_CONFIRMAR_BUTTON_ID = 'admin_banco_resetar_confirmar';
const ADMIN_BANCO_RESETAR_CANCELAR_BUTTON_ID = 'admin_banco_resetar_cancelar';
const ADMIN_BANCO_ADICIONAR_MODAL_ID = 'admin_banco_adicionar_modal';
const ADMIN_BANCO_RETIRAR_MODAL_ID = 'admin_banco_retirar_modal';
const PAINEL_ADMINISTRATIVO_CANAL_ID = process.env.PAINEL_ADMINISTRATIVO_CANAL_ID || '';
const CANAL_LOG_BANCO_ID = process.env.CANAL_LOG_BANCO_ID || '1492532694914039962';
const ACAO_SELECT_RESULTADO_PREFIX = 'acao_resultado_';
const ACAO_ENTRAR_PREFIX = 'acao_entrar_';
const ACAO_SAIR_PREFIX = 'acao_sair_';
const ACAO_COMANDO_PREFIX = 'acao_comando_';
const ACAO_FINALIZAR_PREFIX = 'acao_finalizar_';
const PAINEL_ACOES_CANAL_ID = process.env.PAINEL_ACOES_CANAL_ID || '1487176112860696686';
const CANAL_LOG_ACOES_ID = process.env.CANAL_LOG_ACOES_ID || '1487176260437409863';

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
    "McDonald's",
    'Navio Porto',
    'Píer',
    'Planet',
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
    'Prefeitura',
  ],
  grande: ['Banco Central', 'Banco Paleto', 'Madeireira', 'Nióbio', 'Porto'],
};

module.exports = {
  ACAO_COMANDO_PREFIX,
  ACAO_ENTRAR_PREFIX,
  ACAO_FINALIZAR_PREFIX,
  ACAO_SAIR_PREFIX,
  ACAO_SELECT_RESULTADO_PREFIX,
  ACOES_DISPONIVEIS,
  ADMIN_BANCO_ADICIONAR_BUTTON_ID,
  ADMIN_BANCO_ADICIONAR_MODAL_ID,
  ADMIN_BANCO_RESETAR_BUTTON_ID,
  ADMIN_BANCO_RESETAR_CANCELAR_BUTTON_ID,
  ADMIN_BANCO_RESETAR_CONFIRMAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_BUTTON_ID,
  ADMIN_BANCO_RETIRAR_MODAL_ID,
  ADMIN_PARCERIA_CADASTRAR_BUTTON_ID,
  ADMIN_PARCERIA_CADASTRAR_MODAL_ID,
  ADMIN_PARCERIA_LISTAR_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_BUTTON_ID,
  ADMIN_PARCERIA_REMOVER_MODAL_ID,
  CADASTRO_APROVAR_PREFIX,
  CADASTRO_BUTTON_ID,
  CADASTRO_MODAL_ID,
  CADASTRO_RECUSAR_PREFIX,
  CADASTRO_THUMBNAIL_URL,
  CANAL_LOG_CADASTRO_ID,
  CANAL_APROVACAO_LAVAGEM_ID,
  CANAL_LOG_BANCO_ID,
  CANAL_LOG_ACOES_ID,
  CANAL_REGISTRO_LAVAGEM_ID,
  LAVAGEM_APROVAR_PREFIX,
  LAVAGEM_MODAL_PREFIX,
  LAVAGEM_RECUSAR_PREFIX,
  PAINEL_ADMINISTRATIVO_CANAL_ID,
  PAINEL_ACOES_CANAL_ID,
  PAINEL_CADASTRO_CANAL_ID,
  PAINEL_PRINCIPAL_CANAL_ID,
  PAINEL_THUMBNAIL_URL,
};
