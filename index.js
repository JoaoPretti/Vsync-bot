require('dotenv').config();
const db = require('./database/db');

async function main() {
  console.log('🚀 Iniciando teste...');

  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ CONECTADO:', result.rows[0]);
  } catch (error) {
    console.error('❌ ERRO:', error);
  }
}

main();