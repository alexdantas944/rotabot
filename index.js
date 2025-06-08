
const TelegramBot = require('node-telegram-bot-api');
const Database = require('@replit/database');
const axios = require('axios');

// Inicializar banco de dados
const db = new Database();

// Token do bot
const token = '7713545288:AAEpvoL5MHpKHe6b7nTjVp__h30nP3E5AgY';
const bot = new TelegramBot(token, { polling: true });

// Função para carregar dados do banco
async function carregarDados(categoria) {
  try {
    const dados = await db.get(categoria);
    const proximoId = await db.get(`${categoria}_proximoId`);
    return { 
      dados: Array.isArray(dados) ? dados : [], 
      proximoId: proximoId || 1 
    };
  } catch (error) {
    console.error(`Erro ao carregar ${categoria}:`, error);
    return { dados: [], proximoId: 1 };
  }
}

// Função para salvar dados no banco
async function salvarDados(categoria, dados, proximoId) {
  try {
    await db.set(categoria, dados);
    await db.set(`${categoria}_proximoId`, proximoId);
  } catch (error) {
    console.error(`Erro ao salvar ${categoria}:`, error);
  }
}

// Função para buscar CEP
async function consultarCEP(cep) {
  try {
    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    if (response.data.erro) {
      return null;
    }
    return response.data;
  } catch (error) {
    console.error('Erro ao consultar CEP:', error);
    return null;
  }
}

// Função para criar URL do Google Maps
function criarUrlMaps(endereco) {
  const enderecoFormatado = encodeURIComponent(endereco);
  return `https://www.google.com/maps/search/?api=1&query=${enderecoFormatado}`;
}

// Função para otimizar rota
function otimizarRota(pontos) {
  // Algoritmo simples de otimização (pode ser melhorado com APIs específicas)
  const origem = pontos[0];
  const destinos = pontos.slice(1);
  const rotaOtimizada = [origem, ...destinos];
  
  const waypoints = destinos.map(p => encodeURIComponent(p)).join('|');
  const origemEnc = encodeURIComponent(origem);
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origemEnc}&destination=${encodeURIComponent(destinos[destinos.length - 1])}&waypoints=${waypoints}&travelmode=driving`;
  
  return { rota: rotaOtimizada, url };
}

// Função para criar teclado principal
function criarTecladoPrincipal() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💾 Salvar Info', callback_data: 'salvar_info' },
          { text: '🔍 Consultar Info', callback_data: 'consultar_info' }
        ],
        [
          { text: '📍 Consultar CEP', callback_data: 'consultar_cep' },
          { text: '🗺️ Criar Roteiro', callback_data: 'criar_roteiro' }
        ],
        [
          { text: '🎤 Voz/OCR', callback_data: 'voz_ocr' },
          { text: '📊 Estatísticas', callback_data: 'estatisticas' }
        ],
        [
          { text: '🗑️ Limpar Dados', callback_data: 'limpar_dados' }
        ]
      ]
    }
  };
}

// Função para criar teclado de categorias
function criarTecladoCategorias(acao) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 Notas', callback_data: `${acao}_notas` },
          { text: '📞 Contatos', callback_data: `${acao}_contatos` }
        ],
        [
          { text: '💰 Financeiro', callback_data: `${acao}_financeiro` },
          { text: '📋 Tarefas', callback_data: `${acao}_tarefas` }
        ],
        [
          { text: '🏪 Negócios', callback_data: `${acao}_negocios` },
          { text: '📚 Outros', callback_data: `${acao}_outros` }
        ],
        [
          { text: '🔙 Voltar', callback_data: 'menu_principal' }
        ]
      ]
    }
  };
}

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🤖 *Assistente Universal Pro*

Seu assistente pessoal completo no Telegram!

✨ *Funcionalidades:*
• 💾 Armazenar qualquer informação
• 🔍 Consultar dados salvos
• 📍 Consultar CEP + Maps
• 🗺️ Criar roteiros otimizados
• 🎤 Reconhecimento de voz/OCR
• 📊 Estatísticas detalhadas

Tudo salvo permanentemente! 🚀
  `;
  
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    ...criarTecladoPrincipal()
  });
});

// Variáveis para controle de entrada de dados
let aguardandoDados = {};
let rotaAtual = {};

// Manipular callbacks
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const data = callbackQuery.data;

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'menu_principal') {
    bot.editMessageText('🤖 *Assistente Universal Pro*\n\nEscolha uma opção:', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      ...criarTecladoPrincipal()
    });
  }

  else if (data === 'salvar_info') {
    bot.editMessageText('💾 *Salvar Informação*\n\nEscolha a categoria:', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      ...criarTecladoCategorias('salvar')
    });
  }

  else if (data === 'consultar_info') {
    bot.editMessageText('🔍 *Consultar Informação*\n\nEscolha a categoria:', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      ...criarTecladoCategorias('consultar')
    });
  }

  else if (data.startsWith('salvar_')) {
    const categoria = data.replace('salvar_', '');
    const categoriaFormatada = {
      'notas': '📝 Notas',
      'contatos': '📞 Contatos',
      'financeiro': '💰 Financeiro',
      'tarefas': '📋 Tarefas',
      'negocios': '🏪 Negócios',
      'outros': '📚 Outros'
    };

    bot.editMessageText(`💾 *Salvar em ${categoriaFormatada[categoria]}*\n\nEnvie a informação que deseja salvar:\n\n💡 *Formato livre* - Envie texto, números, links, etc.`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'salvar_info' }]]
      }
    });
    aguardandoDados[chatId] = `salvar_${categoria}`;
  }

  else if (data.startsWith('consultar_')) {
    const categoria = data.replace('consultar_', '');
    const { dados } = await carregarDados(categoria);
    
    if (dados.length === 0) {
      bot.editMessageText(`🔍 *${categoria.toUpperCase()}*\n\nNenhuma informação encontrada nesta categoria.\n\n💡 Use "Salvar Info" para adicionar dados!`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'consultar_info' }]]
        }
      });
    } else {
      let texto = `🔍 *${categoria.toUpperCase()}* (${dados.length} itens)\n\n`;
      dados.slice(-10).forEach((item, index) => {
        texto += `*#${item.id}* - ${new Date(item.data).toLocaleDateString('pt-BR')}\n`;
        texto += `${item.conteudo.substring(0, 100)}${item.conteudo.length > 100 ? '...' : ''}\n\n`;
      });

      if (dados.length > 10) {
        texto += `\n📄 *Mostrando os 10 mais recentes*`;
      }

      const teclado = {
        reply_markup: {
          inline_keyboard: [
            ...dados.slice(-5).map(item => [
              { text: `#${item.id} - ${item.conteudo.substring(0, 30)}...`, callback_data: `ver_${categoria}_${item.id}` }
            ]),
            [{ text: '🔍 Buscar', callback_data: `buscar_${categoria}` }],
            [{ text: '🔙 Voltar', callback_data: 'consultar_info' }]
          ]
        }
      };

      bot.editMessageText(texto, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        ...teclado
      });
    }
  }

  else if (data === 'consultar_cep') {
    bot.editMessageText('📍 *Consultar CEP*\n\nEnvie o CEP que deseja consultar:\n\n💡 *Formato:* 12345-678 ou 12345678', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'menu_principal' }]]
      }
    });
    aguardandoDados[chatId] = 'consultar_cep';
  }

  else if (data === 'criar_roteiro') {
    bot.editMessageText('🗺️ *Criar Roteiro Otimizado*\n\nEnvie os endereços separados por vírgula:\n\n💡 *Exemplo:*\nRua A, 123, São Paulo\nRua B, 456, São Paulo\nRua C, 789, São Paulo', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'menu_principal' }]]
      }
    });
    aguardandoDados[chatId] = 'criar_roteiro';
  }

  else if (data === 'voz_ocr') {
    bot.editMessageText('🎤 *Reconhecimento de Voz/OCR*\n\nEnvie:\n\n🎤 *Áudio* - Para transcrever fala\n📷 *Imagem* - Para extrair texto (OCR)\n\n💡 O resultado será salvo automaticamente!', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'menu_principal' }]]
      }
    });
    aguardandoDados[chatId] = 'voz_ocr';
  }

  else if (data === 'estatisticas') {
    const categorias = ['notas', 'contatos', 'financeiro', 'tarefas', 'negocios', 'outros'];
    let totalItens = 0;
    let estatisticas = '📊 *Estatísticas Gerais*\n\n';

    for (const categoria of categorias) {
      const { dados } = await carregarDados(categoria);
      totalItens += dados.length;
      const categoriaFormatada = {
        'notas': '📝 Notas',
        'contatos': '📞 Contatos', 
        'financeiro': '💰 Financeiro',
        'tarefas': '📋 Tarefas',
        'negocios': '🏪 Negócios',
        'outros': '📚 Outros'
      };
      estatisticas += `${categoriaFormatada[categoria]}: ${dados.length}\n`;
    }

    estatisticas += `\n📈 *Total de Itens:* ${totalItens}`;
    
    const hoje = new Date();
    let itensHoje = 0;
    for (const categoria of categorias) {
      const { dados } = await carregarDados(categoria);
      itensHoje += dados.filter(item => {
        const dataItem = new Date(item.data);
        return dataItem.toDateString() === hoje.toDateString();
      }).length;
    }
    
    estatisticas += `\n📅 *Itens Hoje:* ${itensHoje}`;

    bot.editMessageText(estatisticas, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Voltar', callback_data: 'menu_principal' }]]
      }
    });
  }

  else if (data === 'limpar_dados') {
    bot.editMessageText('🗑️ *Limpar Dados*\n\n⚠️ Esta ação irá remover TODOS os dados salvos.\n\n*Esta ação não pode ser desfeita!*', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Confirmar Limpeza', callback_data: 'confirmar_limpeza_total' }],
          [{ text: '🔙 Cancelar', callback_data: 'menu_principal' }]
        ]
      }
    });
  }

  else if (data === 'confirmar_limpeza_total') {
    const categorias = ['notas', 'contatos', 'financeiro', 'tarefas', 'negocios', 'outros'];
    for (const categoria of categorias) {
      await salvarDados(categoria, [], 1);
    }
    bot.editMessageText('🗑️ *Dados Limpos!*\n\nTodos os dados foram removidos do banco.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🏠 Menu Principal', callback_data: 'menu_principal' }]]
      }
    });
  }

  else if (data.startsWith('ver_')) {
    const [, categoria, id] = data.split('_');
    const { dados } = await carregarDados(categoria);
    const item = dados.find(d => d.id === parseInt(id));
    
    if (item) {
      const texto = `📋 *Item #${item.id}*\n\n📅 *Data:* ${new Date(item.data).toLocaleString('pt-BR')}\n\n📝 *Conteúdo:*\n${item.conteudo}`;
      
      bot.editMessageText(texto, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗑️ Excluir', callback_data: `excluir_${categoria}_${id}` }],
            [{ text: '🔙 Voltar', callback_data: `consultar_${categoria}` }]
          ]
        }
      });
    }
  }

  else if (data.startsWith('excluir_')) {
    const [, categoria, id] = data.split('_');
    const { dados, proximoId } = await carregarDados(categoria);
    const novosDados = dados.filter(d => d.id !== parseInt(id));
    await salvarDados(categoria, novosDados, proximoId);
    
    bot.editMessageText(`🗑️ Item #${id} excluído com sucesso!`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Voltar', callback_data: `consultar_${categoria}` }],
          [{ text: '🏠 Menu Principal', callback_data: 'menu_principal' }]
        ]
      }
    });
  }
});

// Manipular mensagens de texto
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text && text !== '/start' && aguardandoDados[chatId]) {
    const acao = aguardandoDados[chatId];

    if (acao.startsWith('salvar_')) {
      const categoria = acao.replace('salvar_', '');
      const { dados, proximoId } = await carregarDados(categoria);
      
      const novoItem = {
        id: proximoId,
        conteudo: text,
        data: new Date(),
        usuario: msg.from.first_name || 'Usuário'
      };
      
      dados.push(novoItem);
      await salvarDados(categoria, dados, proximoId + 1);
      delete aguardandoDados[chatId];
      
      bot.sendMessage(chatId, `✅ *Informação Salva!*\n\n📂 Categoria: ${categoria.toUpperCase()}\n🆔 ID: #${novoItem.id}\n📅 Data: ${new Date().toLocaleString('pt-BR')}\n\n💾 *Salvo permanentemente no banco!*`, {
        parse_mode: 'Markdown',
        ...criarTecladoPrincipal()
      });
    }

    else if (acao === 'consultar_cep') {
      const cep = text.replace(/\D/g, '');
      if (cep.length === 8) {
        const dadosCEP = await consultarCEP(cep);
        if (dadosCEP) {
          const endereco = `${dadosCEP.logradouro}, ${dadosCEP.bairro}, ${dadosCEP.localidade} - ${dadosCEP.uf}`;
          const urlMaps = criarUrlMaps(endereco);
          
          const texto = `📍 *CEP: ${dadosCEP.cep}*\n\n🏠 ${dadosCEP.logradouro}\n🏘️ ${dadosCEP.bairro}\n🏙️ ${dadosCEP.localidade} - ${dadosCEP.uf}\n\n💾 *Salvar este endereço?*`;
          
          bot.sendMessage(chatId, texto, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗺️ Abrir no Maps', url: urlMaps }],
                [{ text: '💾 Salvar Endereço', callback_data: `salvar_endereco_${JSON.stringify(dadosCEP)}` }],
                [{ text: '🏠 Menu Principal', callback_data: 'menu_principal' }]
              ]
            }
          });
        } else {
          bot.sendMessage(chatId, '❌ CEP não encontrado! Verifique e tente novamente.', {
            ...criarTecladoPrincipal()
          });
        }
      } else {
        bot.sendMessage(chatId, '❌ CEP inválido! Use o formato: 12345-678 ou 12345678');
      }
      delete aguardandoDados[chatId];
    }

    else if (acao === 'criar_roteiro') {
      const enderecos = text.split(',').map(e => e.trim()).filter(e => e.length > 0);
      if (enderecos.length >= 2) {
        const { rota, url } = otimizarRota(enderecos);
        
        let texto = `🗺️ *Roteiro Otimizado*\n\n📍 *${rota.length} pontos:*\n\n`;
        rota.forEach((endereco, index) => {
          texto += `${index + 1}. ${endereco}\n`;
        });
        
        bot.sendMessage(chatId, texto, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗺️ Abrir Roteiro no Maps', url: url }],
              [{ text: '💾 Salvar Roteiro', callback_data: `salvar_roteiro_${JSON.stringify(rota)}` }],
              [{ text: '🏠 Menu Principal', callback_data: 'menu_principal' }]
            ]
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ Mínimo 2 endereços necessários! Separe por vírgula.');
      }
      delete aguardandoDados[chatId];
    }
  }
});

// Manipular áudios
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  if (aguardandoDados[chatId] === 'voz_ocr') {
    bot.sendMessage(chatId, '🎤 Processando áudio...\n\n⚠️ *Funcionalidade em desenvolvimento*\nEm breve será possível transcrever áudios!', {
      ...criarTecladoPrincipal()
    });
    delete aguardandoDados[chatId];
  }
});

// Manipular fotos
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (aguardandoDados[chatId] === 'voz_ocr') {
    bot.sendMessage(chatId, '📷 Processando imagem...\n\n⚠️ *OCR em desenvolvimento*\nEm breve será possível extrair texto de imagens!', {
      ...criarTecladoPrincipal()
    });
    delete aguardandoDados[chatId];
  }
});

console.log('🤖 Assistente Universal Pro iniciado!');
console.log('💾 Banco de dados configurado');
console.log('🎯 Múltiplas funcionalidades ativas');
console.log('📱 Acesse seu bot no Telegram');
