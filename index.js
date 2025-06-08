
const TelegramBot = require('node-telegram-bot-api');
const Database = require('@replit/database');

// Inicializar banco de dados
const db = new Database();

// Token do bot
const token = '7713545288:AAEpvoL5MHpKHe6b7nTjVp__h30nP3E5AgY';
const bot = new TelegramBot(token, { polling: true });

// Função para carregar entregas do banco
async function carregarEntregas() {
  try {
    const entregas = await db.get('entregas');
    const proximoId = await db.get('proximoId');
    return { 
      entregas: Array.isArray(entregas) ? entregas : [], 
      proximoId: proximoId || 1 
    };
  } catch (error) {
    console.error('Erro ao carregar entregas:', error);
    return { entregas: [], proximoId: 1 };
  }
}

// Função para salvar entregas no banco
async function salvarEntregas(entregas, proximoId) {
  try {
    await db.set('entregas', entregas);
    await db.set('proximoId', proximoId);
  } catch (error) {
    console.error('Erro ao salvar entregas:', error);
  }
}

// Função para criar teclado principal
function criarTecladoPrincipal() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📦 Nova Entrega', callback_data: 'nova_entrega' },
          { text: '📋 Ver Entregas', callback_data: 'ver_entregas' }
        ],
        [
          { text: '📊 Estatísticas', callback_data: 'estatisticas' },
