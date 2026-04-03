function validarEnvObrigatorias() {
  const obrigatorias = ['DISCORD_TOKEN', 'DATABASE_URL', 'CANAL_APROVACAO_CADASTRO_ID'];
  const faltando = obrigatorias.filter((nome) => !process.env[nome]?.trim());

  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}`);
  }
}

module.exports = {
  validarEnvObrigatorias,
};
