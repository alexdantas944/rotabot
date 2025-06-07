class TelegramBotPanel {
    constructor() {
        this.botToken = '7550422055:AAFhlqxuhs599Qc4qbziSyv5GlrcH7gt8fY';
        this.botRunning = this.loadBotState();
        this.autoMessageInterval = null;
        this.users = new Set();
        this.lastUpdateId = 0;
        this.pollingInterval = null;
        this.userSessions = new Map();
        this.conversationFlow = [];
        this.customCommands = new Map();
        this.scheduledMessages = [];
        this.blockedWords = [];
        this.userWarnings = new Map();
        this.bannedUsers = new Set();
        this.sentimentData = { positive: 0, neutral: 0, negative: 0 };
        this.messageHistory = [];
        this.aiEnabled = false;
        this.aiPrompt = '';
        this.language = 'pt';
        this.buttonGroups = new Map();
        this.menuItems = new Map();
        this.processedMessages = new Set(); // Controle de mensagens já processadas
        this.lastMessageTime = new Map(); // Controle de rate limiting por usuário
        this.stats = {
            totalMessages: 0,
            totalUsers: 0,
            todayMessages: 0,
            messagesPerHour: new Array(24).fill(0),
            usersPerDay: new Array(7).fill(0)
        };

        this.initializePanel();
        this.loadConfig();
        this.loadConversationFlow();
        this.loadAdvancedConfig();
        this.loadButtonGroups();
        this.loadMenuItems();
        this.initializeCharts();
        this.startScheduledMessageChecker();
        
        // Auto-start bot if it was running before page refresh
        if (this.botRunning) {
            this.resumeBot();
        }
    }

    initializePanel() {
        // Existing event listeners
        document.getElementById('startBot').addEventListener('click', () => this.startBot());
        document.getElementById('stopBot').addEventListener('click', () => this.stopBot());
        document.getElementById('restartBot').addEventListener('click', () => this.restartBot());
        document.getElementById('saveMessages').addEventListener('click', () => this.saveMessages());
        document.getElementById('enableAutoMessages').addEventListener('click', () => this.enableAutoMessages());
        document.getElementById('disableAutoMessages').addEventListener('click', () => this.disableAutoMessages());
        document.getElementById('sendBroadcast').addEventListener('click', () => this.sendBroadcast());
        document.getElementById('sendToAll').addEventListener('click', () => this.sendImageToAll());
        document.getElementById('sendToUser').addEventListener('click', () => this.sendImageToUser());
        document.getElementById('sendToUser').addEventListener('click', () => {
            const userIdInput = document.getElementById('specificUserId');
            userIdInput.style.display = userIdInput.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('addFlowStep').addEventListener('click', () => this.addFlowStep());
        document.getElementById('saveFlow').addEventListener('click', () => this.saveConversationFlow());
        document.getElementById('resetFlow').addEventListener('click', () => this.resetConversationFlow());
        document.getElementById('clearLogs').addEventListener('click', () => this.clearLogs());

        // New advanced event listeners
        document.getElementById('addCommand').addEventListener('click', () => this.addCustomCommand());
        document.getElementById('scheduleMessage').addEventListener('click', () => this.scheduleMessage());
        document.getElementById('saveFilter').addEventListener('click', () => this.saveContentFilter());
        document.getElementById('saveAI').addEventListener('click', () => this.saveAISettings());
        document.getElementById('createBackup').addEventListener('click', () => this.createBackup());
        document.getElementById('downloadBackup').addEventListener('click', () => this.downloadBackup());
        document.getElementById('restoreBackup').addEventListener('click', () => this.restoreBackup());
        document.getElementById('saveLanguage').addEventListener('click', () => this.saveLanguage());
        document.getElementById('exportLogs').addEventListener('click', () => this.exportLogs());
        
        // Button management event listeners
        document.getElementById('addButton').addEventListener('click', () => this.addButton());
        document.getElementById('createGroup').addEventListener('click', () => this.createButtonGroup());
        document.getElementById('testButtons').addEventListener('click', () => this.testButtons());
        
        // Menu management event listeners
        document.getElementById('addMenuItem').addEventListener('click', () => this.addMenuItem());
        document.getElementById('sendMenuToAll').addEventListener('click', () => this.sendMenuToAll());
        document.getElementById('sendCategoryMenu').addEventListener('click', () => this.sendCategoryMenu());
        document.getElementById('createMenuButtons').addEventListener('click', () => this.createMenuButtons());
        document.getElementById('menuItemImage').addEventListener('change', (e) => this.previewImage(e));
        
        // Category tab event listeners
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.filterMenuByCategory(e.target.dataset.category));
        });

        // Schedule target change
        document.getElementById('scheduleTarget').addEventListener('change', (e) => {
            const userIdInput = document.getElementById('scheduleUserId');
            userIdInput.style.display = e.target.value === 'specific' ? 'block' : 'none';
        });

        // AI confidence slider
        document.getElementById('aiConfidence').addEventListener('input', (e) => {
            document.getElementById('confidenceValue').textContent = e.target.value + '%';
        });

        // Log filter
        document.getElementById('logFilter').addEventListener('change', () => this.filterLogs());

        // Start checking bot status
        this.checkBotStatus();
        setInterval(() => this.checkBotStatus(), 5000);
        setInterval(() => this.updateCharts(), 30000);

        // Load initial stats
        this.updateStats();
    }

    async startBot() {
        this.log('Iniciando bot...', 'info');

        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            const data = await response.json();

            if (!data.ok) {
                throw new Error('Token inválido ou bot não encontrado');
            }

            this.botRunning = true;
            this.saveBotState(true);
            this.updateBotStatus(true);
            this.log(`Bot iniciado: @${data.result.username}`, 'info');
            this.showNotification('Bot iniciado com sucesso!', 'success');

            this.startPolling();
        } catch (error) {
            this.log(`Erro ao iniciar bot: ${error.message}`, 'error');
            this.showNotification('Erro ao iniciar bot', 'error');
        }
    }

    async stopBot() {
        this.log('Parando bot...', 'info');

        this.botRunning = false;
        this.saveBotState(false);
        this.updateBotStatus(false);

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        if (this.autoMessageInterval) {
            clearInterval(this.autoMessageInterval);
            this.autoMessageInterval = null;
        }

        this.log('Bot parado!', 'info');
        this.showNotification('Bot parado!', 'info');
    }

    async restartBot() {
        this.log('Reiniciando bot...', 'info');
        await this.stopBot();
        await this.delay(1000);
        await this.startBot();
    }

    startPolling() {
        if (!this.botRunning) return;

        this.pollingInterval = setInterval(async () => {
            if (!this.botRunning) return;

            try {
                const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`);
                const data = await response.json();

                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        this.lastUpdateId = update.update_id;

                        if (update.message) {
                            this.handleMessage(update.message);
                        }
                        
                        if (update.callback_query) {
                            this.handleCallbackQuery(update.callback_query);
                        }
                    }
                }
            } catch (error) {
                this.log(`Erro no polling: ${error.message}`, 'warning');
            }
        }, 5000);
    }

    handleMessage(message) {
        const userId = message.from.id;
        const username = message.from.username || message.from.first_name;
        const text = message.text || '';
        const messageId = message.message_id;

        // Verificar se a mensagem já foi processada
        const messageKey = `${userId}_${messageId}_${text}`;
        if (this.processedMessages.has(messageKey)) {
            return; // Mensagem já processada
        }
        this.processedMessages.add(messageKey);

        // Limpar mensagens antigas do controle (manter apenas últimas 1000)
        if (this.processedMessages.size > 1000) {
            const oldMessages = Array.from(this.processedMessages).slice(0, 500);
            oldMessages.forEach(msg => this.processedMessages.delete(msg));
        }

        // Rate limiting - evitar spam de mensagens
        const now = Date.now();
        const lastTime = this.lastMessageTime.get(userId) || 0;
        if (now - lastTime < 1000) { // Mínimo 1 segundo entre mensagens
            this.log(`Rate limit aplicado para usuário ${username}`, 'warning');
            return;
        }
        this.lastMessageTime.set(userId, now);

        // Check if user is banned
        if (this.bannedUsers.has(userId)) {
            this.log(`Mensagem de usuário banido ${username} ignorada`, 'warning');
            return;
        }

        // Content filtering
        if (this.checkContentFilter(text, userId)) {
            return; // Message was filtered
        }

        this.users.add(userId);
        this.stats.totalMessages++;
        this.stats.todayMessages++;
        this.stats.totalUsers = this.users.size;

        // Update hourly statistics
        const hour = new Date().getHours();
        this.stats.messagesPerHour[hour]++;

        // Store message for analysis
        this.messageHistory.push({
            userId,
            username,
            text,
            timestamp: new Date(),
            sentiment: this.analyzeSentiment(text)
        });

        // Keep only last 1000 messages
        if (this.messageHistory.length > 1000) {
            this.messageHistory.shift();
        }

        this.log(`Mensagem de ${username} (${userId}): ${text}`, 'info');
        this.processMessage(text, userId);
        this.updateStats();
        this.updateSentimentAnalysis();
    }

    handleCallbackQuery(callbackQuery) {
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;
        const messageId = callbackQuery.message.message_id;

        this.log(`Callback recebido: ${data} de usuário ${userId}`, 'info');

        // Parse callback data
        try {
            const callbackData = JSON.parse(data);
            const { type, group, button } = callbackData;

            if (type === 'button_action' && this.buttonGroups.has(group)) {
                const buttonGroup = this.buttonGroups.get(group);
                const buttonConfig = buttonGroup.buttons.find(b => b.id === button);

                if (buttonConfig) {
                    this.processButtonAction(buttonConfig, userId, messageId);
                }
            }
        } catch (error) {
            this.log(`Erro ao processar callback: ${error.message}`, 'error');
        }

        // Answer callback query
        this.answerCallbackQuery(callbackQuery.id);
    }

    async answerCallbackQuery(callbackQueryId, text = '') {
        try {
            await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    callback_query_id: callbackQueryId,
                    text: text
                })
            });
        } catch (error) {
            this.log(`Erro ao responder callback: ${error.message}`, 'error');
        }
    }

    processButtonAction(buttonConfig, userId, messageId) {
        switch (buttonConfig.responseType) {
            case 'text':
                this.sendMessage(userId, buttonConfig.response);
                break;
            case 'url':
                // URLs são tratadas diretamente pelo Telegram
                break;
            case 'callback':
                this.executeCustomCallback(buttonConfig.response, userId);
                break;
        }

        this.log(`Botão processado: ${buttonConfig.text} para usuário ${userId}`, 'info');
    }

    executeCustomCallback(callbackCode, userId) {
        try {
            // Execute custom callback code safely
            eval(callbackCode);
        } catch (error) {
            this.log(`Erro ao executar callback personalizado: ${error.message}`, 'error');
            this.sendMessage(userId, 'Erro ao processar ação do botão.');
        }
    }

    processMessage(message, userId) {
        // Check for custom commands first
        if (this.customCommands.has(message)) {
            const response = this.customCommands.get(message);
            this.sendMessage(userId, response);
            return;
        }

        // Check if user is in conversation flow
        if (this.userSessions.has(userId)) {
            this.processFlowMessage(message, userId);
            return;
        }

        let response = '';
        let buttons = null;

        switch (message) {
            case '/start':
                response = document.getElementById('welcomeMessage').value;
                buttons = this.getButtonsForCommand('/start');
                if (this.conversationFlow.length > 0) {
                    this.startConversationFlow(userId);
                    return;
                }
                break;
            case '/help':
                response = document.getElementById('helpMessage').value;
                buttons = this.getButtonsForCommand('/help');
                break;
            case '/commands':
                response = this.getCustomCommandsList();
                break;
            case '/menu':
                response = '📋 Menu Principal:';
                buttons = this.getMainMenuButtons();
                break;
            case '/cardapio':
                this.sendFullMenu(userId);
                return;
            case '/bebidas':
                this.sendCategoryMenu('bebidas', userId);
                return;
            case '/principais':
                this.sendCategoryMenu('principais', userId);
                return;
            case '/sobremesas':
                this.sendCategoryMenu('sobremesas', userId);
                return;
            case '/flow':
                if (this.conversationFlow.length > 0) {
                    this.startConversationFlow(userId);
                    return;
                }
                response = 'Nenhum fluxo de conversa configurado.';
                break;
            default:
                // Check if command has associated buttons
                buttons = this.getButtonsForCommand(message);
                
                // Try AI response if enabled
                if (this.aiEnabled && !buttons) {
                    this.generateAIResponse(message, userId);
                    return;
                }
                
                if (!buttons) {
                    response = 'Mensagem recebida! Obrigado por entrar em contato. Digite /help para ver os comandos disponíveis.';
                }
        }

        if (buttons) {
            this.sendMessageWithButtons(userId, response, buttons);
        } else {
            this.sendMessage(userId, response);
        }
    }

    addCustomCommand() {
        const commandName = document.getElementById('commandName').value.trim();
        const commandResponse = document.getElementById('commandResponse').value.trim();

        if (!commandName || !commandResponse) {
            this.showNotification('Preencha o nome e resposta do comando', 'error');
            return;
        }

        const formattedCommand = commandName.startsWith('/') ? commandName : '/' + commandName;

        this.customCommands.set(formattedCommand, commandResponse);
        this.saveCustomCommands();
        this.renderCustomCommands();

        document.getElementById('commandName').value = '';
        document.getElementById('commandResponse').value = '';

        this.log(`Comando personalizado criado: ${formattedCommand}`, 'info');
        this.showNotification('Comando adicionado com sucesso!', 'success');
    }

    renderCustomCommands() {
        const container = document.getElementById('commandsList');
        container.innerHTML = '';

        this.customCommands.forEach((response, command) => {
            const commandDiv = document.createElement('div');
            commandDiv.className = 'command-item';
            commandDiv.innerHTML = `
                <div>
                    <span class="command-name">${command}</span>
                    <p class="command-preview">${response.substring(0, 50)}...</p>
                </div>
                <button onclick="botPanel.removeCustomCommand('${command}')" class="btn btn-danger">Remover</button>
            `;
            container.appendChild(commandDiv);
        });
    }

    removeCustomCommand(command) {
        this.customCommands.delete(command);
        this.saveCustomCommands();
        this.renderCustomCommands();
        this.log(`Comando removido: ${command}`, 'info');
        this.showNotification('Comando removido!', 'info');
    }

    getCustomCommandsList() {
        if (this.customCommands.size === 0) {
            return 'Nenhum comando personalizado configurado.';
        }

        let commandsList = 'Comandos personalizados disponíveis:\n\n';
        this.customCommands.forEach((response, command) => {
            commandsList += `${command} - ${response.substring(0, 30)}...\n`;
        });

        return commandsList;
    }

    scheduleMessage() {
        const scheduleTime = document.getElementById('scheduleTime').value;
        const message = document.getElementById('scheduledMessage').value.trim();
        const target = document.getElementById('scheduleTarget').value;
        const userId = document.getElementById('scheduleUserId').value;

        if (!scheduleTime || !message) {
            this.showNotification('Preencha horário e mensagem', 'error');
            return;
        }

        if (target === 'specific' && !userId) {
            this.showNotification('Digite o ID do usuário', 'error');
            return;
        }

        const scheduledMsg = {
            id: Date.now(),
            time: new Date(scheduleTime),
            message,
            target,
            userId: target === 'specific' ? userId : null,
            sent: false
        };

        this.scheduledMessages.push(scheduledMsg);
        this.saveScheduledMessages();
        this.renderScheduledMessages();

        document.getElementById('scheduleTime').value = '';
        document.getElementById('scheduledMessage').value = '';
        document.getElementById('scheduleUserId').value = '';

        this.log(`Mensagem agendada para ${scheduleTime}`, 'info');
        this.showNotification('Mensagem agendada com sucesso!', 'success');
    }

    renderScheduledMessages() {
        const container = document.getElementById('scheduledList');
        container.innerHTML = '';

        this.scheduledMessages
            .filter(msg => !msg.sent)
            .forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'scheduled-item';
                msgDiv.innerHTML = `
                    <div>
                        <strong>${msg.time.toLocaleString()}</strong>
                        <p>${msg.message.substring(0, 40)}...</p>
                        <small>Target: ${msg.target === 'all' ? 'Todos' : 'Usuário ' + msg.userId}</small>
                    </div>
                    <button onclick="botPanel.removeScheduledMessage(${msg.id})" class="btn btn-danger">Cancelar</button>
                `;
                container.appendChild(msgDiv);
            });
    }

    removeScheduledMessage(id) {
        this.scheduledMessages = this.scheduledMessages.filter(msg => msg.id !== id);
        this.saveScheduledMessages();
        this.renderScheduledMessages();
        this.showNotification('Mensagem agendada cancelada!', 'info');
    }

    startScheduledMessageChecker() {
        setInterval(() => {
            const now = new Date();

            this.scheduledMessages.forEach(async (msg) => {
                if (!msg.sent && msg.time <= now) {
                    if (msg.target === 'all') {
                        await this.broadcastMessage(msg.message);
                    } else {
                        await this.sendMessage(msg.userId, msg.message);
                    }

                    msg.sent = true;
                    this.log(`Mensagem agendada enviada: ${msg.message.substring(0, 30)}...`, 'info');
                }
            });

            this.saveScheduledMessages();
            this.renderScheduledMessages();
        }, 60000); // Check every minute
    }

    saveContentFilter() {
        const blockedWordsText = document.getElementById('blockedWords').value;
        this.blockedWords = blockedWordsText.split(',').map(word => word.trim().toLowerCase()).filter(word => word);

        const settings = {
            blockedWords: this.blockedWords,
            autoDelete: document.getElementById('autoDelete').checked,
            warnUser: document.getElementById('warnUser').checked,
            banUser: document.getElementById('banUser').checked
        };

        localStorage.setItem('contentFilter', JSON.stringify(settings));
        this.log('Filtro de conteúdo salvo', 'info');
        this.showNotification('Filtro de conteúdo salvo!', 'success');
    }

    checkContentFilter(text, userId) {
        const lowerText = text.toLowerCase();
        const containsBlocked = this.blockedWords.some(word => lowerText.includes(word));

        if (!containsBlocked) return false;

        const settings = JSON.parse(localStorage.getItem('contentFilter') || '{}');

        if (settings.warnUser) {
            this.sendMessage(userId, '⚠️ Sua mensagem contém conteúdo inadequado. Por favor, mantenha a conversa respeitosa.');

            const warnings = this.userWarnings.get(userId) || 0;
            this.userWarnings.set(userId, warnings + 1);

            if (settings.banUser && warnings >= 2) {
                this.bannedUsers.add(userId);
                this.sendMessage(userId, '🚫 Você foi banido por violar as regras de conduta.');
                this.log(`Usuário ${userId} banido por múltiplas violações`, 'warning');
            }
        }

        this.log(`Mensagem filtrada de usuário ${userId}: ${text}`, 'warning');
        return true;
    }

    analyzeSentiment(text) {
        // Simple sentiment analysis (in real app, use proper NLP)
        const positiveWords = ['bom', 'ótimo', 'excelente', 'legal', 'obrigado', 'feliz', 'adorei'];
        const negativeWords = ['ruim', 'péssimo', 'horrível', 'odeio', 'triste', 'raiva', 'problema'];

        const lowerText = text.toLowerCase();
        const hasPositive = positiveWords.some(word => lowerText.includes(word));
        const hasNegative = negativeWords.some(word => lowerText.includes(word));

        if (hasPositive && !hasNegative) return 'positive';
        if (hasNegative && !hasPositive) return 'negative';
        return 'neutral';
    }

    updateSentimentAnalysis() {
        const sentiments = { positive: 0, neutral: 0, negative: 0 };

        this.messageHistory.forEach(msg => {
            sentiments[msg.sentiment]++;
        });

        document.getElementById('positiveCount').textContent = sentiments.positive;
        document.getElementById('neutralCount').textContent = sentiments.neutral;
        document.getElementById('negativeCount').textContent = sentiments.negative;
    }

    saveAISettings() {
        const aiEnabled = document.getElementById('enableAI').checked;
        const aiPrompt = document.getElementById('aiPrompt').value;
        const aiConfidence = document.getElementById('aiConfidence').value;

        this.aiEnabled = aiEnabled;
        this.aiPrompt = aiPrompt;
        this.aiConfidence = aiConfidence;

        const settings = { aiEnabled, aiPrompt, aiConfidence };
        localStorage.setItem('aiSettings', JSON.stringify(settings));

        this.log('Configurações de IA salvas', 'info');
        this.showNotification('Configurações de IA salvas!', 'success');
    }

    async generateAIResponse(message, userId) {
        // Simulated AI response (in real app, integrate with OpenAI or similar)
        const responses = [
            'Interessante! Pode me contar mais sobre isso?',
            'Entendo sua perspectiva. Como posso ajudar?',
            'Obrigado por compartilhar isso comigo.',
            'Essa é uma boa pergunta. Deixe-me pensar...',
            'Posso ajudar você com isso!'
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        // Simulate AI processing delay
        setTimeout(() => {
            this.sendMessage(userId, `🤖 ${randomResponse}`);
            this.log(`Resposta IA gerada para usuário ${userId}`, 'info');
        }, 1000);
    }

    createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            customCommands: Array.from(this.customCommands.entries()),
            conversationFlow: this.conversationFlow,
            scheduledMessages: this.scheduledMessages,
            contentFilter: JSON.parse(localStorage.getItem('contentFilter') || '{}'),
            aiSettings: JSON.parse(localStorage.getItem('aiSettings') || '{}'),
            welcomeMessage: localStorage.getItem('welcomeMessage'),
            helpMessage: localStorage.getItem('helpMessage'),
            stats: this.stats,
            language: this.language
        };

        this.currentBackup = backup;

        const status = document.getElementById('backupStatus');
        status.textContent = `Backup criado em ${new Date().toLocaleString()}`;
        status.className = 'backup-status success';

        this.log('Backup criado com sucesso', 'info');
        this.showNotification('Backup criado!', 'success');
    }

    downloadBackup() {
        if (!this.currentBackup) {
            this.showNotification('Crie um backup primeiro', 'error');
            return;
        }

        const dataStr = JSON.stringify(this.currentBackup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `bot-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        this.showNotification('Backup baixado!', 'success');
    }

    restoreBackup() {
        const fileInput = document.getElementById('backupFile');
        const file = fileInput.files[0];

        if (!file) {
            this.showNotification('Selecione um arquivo de backup', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);

                // Restore data
                this.customCommands = new Map(backup.customCommands || []);
                this.conversationFlow = backup.conversationFlow || [];
                this.scheduledMessages = backup.scheduledMessages || [];
                this.stats = backup.stats || this.stats;
                this.language = backup.language || 'pt';

                // Restore localStorage items
                if (backup.contentFilter) localStorage.setItem('contentFilter', JSON.stringify(backup.contentFilter));
                if (backup.aiSettings) localStorage.setItem('aiSettings', JSON.stringify(backup.aiSettings));
                if (backup.welcomeMessage) localStorage.setItem('welcomeMessage', backup.welcomeMessage);
                if (backup.helpMessage) localStorage.setItem('helpMessage', backup.helpMessage);

                // Update UI
                this.renderCustomCommands();
                this.renderScheduledMessages();
                this.renderConversationFlow();
                this.loadConfig();
                this.loadAdvancedConfig();

                const status = document.getElementById('backupStatus');
                status.textContent = `Backup restaurado de ${backup.timestamp}`;
                status.className = 'backup-status success';

                this.log('Backup restaurado com sucesso', 'info');
                this.showNotification('Backup restaurado!', 'success');

            } catch (error) {
                const status = document.getElementById('backupStatus');
                status.textContent = 'Erro ao restaurar backup';
                status.className = 'backup-status error';

                this.log('Erro ao restaurar backup: ' + error.message, 'error');
                this.showNotification('Erro ao restaurar backup', 'error');
            }
        };

        reader.readAsText(file);
    }

    saveLanguage() {
        this.language = document.getElementById('botLanguage').value;
        localStorage.setItem('botLanguage', this.language);

        this.log(`Idioma alterado para: ${this.language}`, 'info');
        this.showNotification('Idioma salvo!', 'success');
    }

    initializeCharts() {
        // Simple chart initialization (in real app, use Chart.js or similar)
        this.updateCharts();
    }

    updateCharts() {
        // Update messages per hour chart
        const messagesCanvas = document.getElementById('messagesChart');
        if (messagesCanvas) {
            this.drawSimpleChart(messagesCanvas, this.stats.messagesPerHour, 'Mensagens por Hora');
        }

        // Update users chart
        const usersCanvas = document.getElementById('usersChart');
        if (usersCanvas) {
            this.drawSimpleChart(usersCanvas, this.stats.usersPerDay, 'Usuários por Dia');
        }
    }

    drawSimpleChart(canvas, data, title) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const maxValue = Math.max(...data) || 1;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Set up gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');

        // Draw bars
        const barWidth = width / data.length;

        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * (height - 20);
            const x = index * barWidth;
            const y = height - barHeight;

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth - 2, barHeight);

            // Draw value on top
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(value.toString(), x + barWidth/2, y - 5);
        });
    }

    exportLogs() {
        const logs = document.getElementById('logs').textContent;
        const dataBlob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `bot-logs-${new Date().toISOString().split('T')[0]}.txt`;
        link.click();

        URL.revokeObjectURL(url);
        this.showNotification('Logs exportados!', 'success');
    }

    filterLogs() {
        const filter = document.getElementById('logFilter').value;
        const logEntries = document.querySelectorAll('.log-entry');

        logEntries.forEach(entry => {
            if (filter === 'all') {
                entry.style.display = 'block';
            } else {
                entry.style.display = entry.classList.contains(filter) ? 'block' : 'none';
            }
        });
    }

    loadAdvancedConfig() {
        // Load custom commands
        const savedCommands = localStorage.getItem('customCommands');
        if (savedCommands) {
            this.customCommands = new Map(JSON.parse(savedCommands));
            this.renderCustomCommands();
        }

        // Load scheduled messages
        const savedScheduled = localStorage.getItem('scheduledMessages');
        if (savedScheduled) {
            this.scheduledMessages = JSON.parse(savedScheduled);
            this.renderScheduledMessages();
        }

        // Load content filter
        const savedFilter = localStorage.getItem('contentFilter');
        if (savedFilter) {
            const filter = JSON.parse(savedFilter);
            this.blockedWords = filter.blockedWords || [];
            document.getElementById('blockedWords').value = this.blockedWords.join(', ');
            document.getElementById('autoDelete').checked = filter.autoDelete || false;
            document.getElementById('warnUser').checked = filter.warnUser || false;
            document.getElementById('banUser').checked = filter.banUser || false;
        }

        // Load AI settings
        const savedAI = localStorage.getItem('aiSettings');
        if (savedAI) {
            const ai = JSON.parse(savedAI);
            this.aiEnabled = ai.aiEnabled || false;
            this.aiPrompt = ai.aiPrompt || '';
            document.getElementById('enableAI').checked = this.aiEnabled;
            document.getElementById('aiPrompt').value = this.aiPrompt;
            document.getElementById('aiConfidence').value = ai.aiConfidence || 70;
            document.getElementById('confidenceValue').textContent = (ai.aiConfidence || 70) + '%';
        }

        // Load language
        const savedLanguage = localStorage.getItem('botLanguage');
        if (savedLanguage) {
            this.language = savedLanguage;
            document.getElementById('botLanguage').value = this.language;
        }
    }

    saveCustomCommands() {
        localStorage.setItem('customCommands', JSON.stringify(Array.from(this.customCommands.entries())));
    }

    saveScheduledMessages() {
        localStorage.setItem('scheduledMessages', JSON.stringify(this.scheduledMessages));
    }

    processFlowMessage(message, userId) {
        const session = this.userSessions.get(userId);
        const currentStep = this.conversationFlow[session.currentStep];

        if (!currentStep) {
            this.userSessions.delete(userId);
            this.sendMessage(userId, 'Conversa finalizada. Obrigado!');
            return;
        }

        session.responses[currentStep.trigger] = message;
        session.currentStep++;
        const nextStep = this.conversationFlow[session.currentStep];

        if (nextStep) {
            this.sendMessage(userId, nextStep.message);
        } else {
            this.sendMessage(userId, 'Obrigado pelas informações! Nossa equipe entrará em contato em breve.');
            this.log(`Fluxo de conversa finalizado para usuário ${userId}: ${JSON.stringify(session.responses)}`, 'info');
            this.userSessions.delete(userId);
        }
    }

    startConversationFlow(userId) {
        if (this.conversationFlow.length === 0) return;

        this.userSessions.set(userId, {
            currentStep: 0,
            responses: {},
            startTime: new Date()
        });

        const firstStep = this.conversationFlow[0];
        this.sendMessage(userId, firstStep.message);
        this.log(`Iniciado fluxo de conversa para usuário ${userId}`, 'info');
    }

    async sendMessage(userId, message) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: userId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            const data = await response.json();

            if (data.ok) {
                this.log(`Mensagem enviada para ${userId}: ${message}`, 'info');
                this.stats.totalMessages++;
                this.stats.todayMessages++;
                this.updateStats();
            } else {
                this.log(`Erro ao enviar mensagem: ${data.description}`, 'error');
            }
        } catch (error) {
            this.log(`Erro ao enviar mensagem: ${error.message}`, 'error');
        }
    }

    saveMessages() {
        const welcomeMessage = document.getElementById('welcomeMessage').value;
        const helpMessage = document.getElementById('helpMessage').value;

        localStorage.setItem('welcomeMessage', welcomeMessage);
        localStorage.setItem('helpMessage', helpMessage);

        this.log('Mensagens salvas com sucesso!', 'info');
        this.showNotification('Mensagens salvas!', 'success');
    }

    enableAutoMessages() {
        if (this.autoMessageInterval) {
            clearInterval(this.autoMessageInterval);
        }

        const interval = document.getElementById('autoInterval').value * 60000;
        const message = document.getElementById('autoMessage').value;

        this.autoMessageInterval = setInterval(() => {
            if (this.botRunning && this.users.size > 0) {
                this.broadcastMessage(message);
                this.log('Mensagem automática enviada', 'info');
            }
        }, interval);

        document.getElementById('autoMessageStatus').textContent = 'Ativado';
        this.log('Mensagens automáticas ativadas', 'info');
        this.showNotification('Mensagens automáticas ativadas!', 'success');
    }

    disableAutoMessages() {
        if (this.autoMessageInterval) {
            clearInterval(this.autoMessageInterval);
            this.autoMessageInterval = null;
        }

        document.getElementById('autoMessageStatus').textContent = 'Desativado';
        this.log('Mensagens automáticas desativadas', 'info');
        this.showNotification('Mensagens automáticas desativadas!', 'info');
    }

    sendBroadcast() {
        const message = document.getElementById('broadcastMessage').value;

        if (!message.trim()) {
            this.showNotification('Digite uma mensagem para enviar', 'error');
            return;
        }

        if (!this.botRunning) {
            this.showNotification('Bot precisa estar ativo para enviar mensagens', 'error');
            return;
        }

        this.broadcastMessage(message);
        document.getElementById('broadcastMessage').value = '';
        this.showNotification(`Mensagem enviada para ${this.users.size} usuários!`, 'success');
    }

    async broadcastMessage(message) {
        let sentCount = 0;
        const batchSize = 5; // Enviar em lotes menores
        const userArray = Array.from(this.users);

        for (let i = 0; i < userArray.length; i += batchSize) {
            const batch = userArray.slice(i, i + batchSize);
            
            const promises = batch.map(async (userId) => {
                try {
                    await this.sendMessage(userId, message);
                    sentCount++;
                } catch (error) {
                    this.log(`Erro ao enviar para ${userId}: ${error.message}`, 'error');
                }
            });

            await Promise.all(promises);
            
            // Delay maior entre lotes para respeitar rate limits do Telegram
            if (i + batchSize < userArray.length) {
                await this.delay(1000);
            }
        }

        this.log(`Mensagem em massa enviada para ${sentCount}/${this.users.size} usuários: ${message}`, 'info');
    }

    async sendImageToAll() {
        const fileInput = document.getElementById('imageFile');
        const caption = document.getElementById('imageCaption').value;

        if (!fileInput.files[0]) {
            this.showNotification('Selecione uma imagem primeiro', 'error');
            return;
        }

        if (!this.botRunning) {
            this.showNotification('Bot precisa estar ativo para enviar imagens', 'error');
            return;
        }

        const file = fileInput.files[0];
        let sentCount = 0;
        const userArray = Array.from(this.users);
        const batchSize = 3; // Lotes menores para imagens

        for (let i = 0; i < userArray.length; i += batchSize) {
            const batch = userArray.slice(i, i + batchSize);
            
            for (const userId of batch) {
                try {
                    await this.sendPhoto(userId, file, caption);
                    sentCount++;
                    await this.delay(500); // Delay maior para imagens
                } catch (error) {
                    this.log(`Erro ao enviar imagem para ${userId}: ${error.message}`, 'error');
                }
            }
            
            // Delay entre lotes
            if (i + batchSize < userArray.length) {
                await this.delay(2000);
            }
        }

        this.showNotification(`Imagem enviada para ${sentCount}/${this.users.size} usuários!`, 'success');
        fileInput.value = '';
        document.getElementById('imageCaption').value = '';
    }

    async sendImageToUser() {
        const fileInput = document.getElementById('imageFile');
        const caption = document.getElementById('imageCaption').value;
        const userId = document.getElementById('specificUserId').value;

        if (!fileInput.files[0]) {
            this.showNotification('Selecione uma imagem primeiro', 'error');
            return;
        }

        if (!userId) {
            this.showNotification('Digite o ID do usuário', 'error');
            return;
        }

        if (!this.botRunning) {
            this.showNotification('Bot precisa estar ativo para enviar imagens', 'error');
            return;
        }

        try {
            const file = fileInput.files[0];
            await this.sendPhoto(userId, file, caption);
            this.showNotification('Imagem enviada com sucesso!', 'success');

            fileInput.value = '';
            document.getElementById('imageCaption').value = '';
            document.getElementById('specificUserId').value = '';
            document.getElementById('specificUserId').style.display = 'none';
        } catch (error) {
            this.showNotification('Erro ao enviar imagem', 'error');
            this.log(`Erro ao enviar imagem: ${error.message}`, 'error');
        }
    }

    async sendPhoto(userId, file, caption = '') {
        const formData = new FormData();
        formData.append('chat_id', userId);
        formData.append('photo', file);
        if (caption) {
            formData.append('caption', caption);
        }

        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.ok) {
            this.log(`Imagem enviada para ${userId}${caption ? ` com legenda: ${caption}` : ''}`, 'info');
            this.stats.totalMessages++;
            this.stats.todayMessages++;
            this.updateStats();
        } else {
            throw new Error(data.description || 'Erro ao enviar imagem');
        }
    }

    async checkBotStatus() {
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            const data = await response.json();

            if (data.ok) {
                document.getElementById('activeUsers').textContent = this.users.size;
            }
        } catch (error) {
            this.log(`Erro ao verificar status: ${error.message}`, 'warning');
        }
    }

    updateBotStatus(online) {
        const statusElement = document.getElementById('botStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');

        if (online) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Bot Online';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Bot Offline';
        }
    }

    updateStats() {
        document.getElementById('totalMessages').textContent = this.stats.totalMessages;
        document.getElementById('totalUsers').textContent = this.stats.totalUsers;
        document.getElementById('todayMessages').textContent = this.stats.todayMessages;
    }

    loadConfig() {
        const welcomeMessage = localStorage.getItem('welcomeMessage');
        const helpMessage = localStorage.getItem('helpMessage');

        if (welcomeMessage) {
            document.getElementById('welcomeMessage').value = welcomeMessage;
        }

        if (helpMessage) {
            document.getElementById('helpMessage').value = helpMessage;
        }
    }

    addFlowStep() {
        const stepNumber = this.conversationFlow.length + 1;
        const stepDiv = document.createElement('div');
        stepDiv.className = 'flow-step';
        stepDiv.innerHTML = `
            <div class="flow-step-header">
                <span class="flow-step-title">Etapa ${stepNumber}</span>
                <div class="flow-step-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove(); botPanel.updateFlowSteps();" class="btn-danger">Remover</button>
                </div>
            </div>
            <div class="flow-step-content">
                <div class="flow-input-group">
                    <label>Palavra-chave/Comando:</label>
                    <input type="text" class="flow-trigger" placeholder="Ex: /contato, palavra-chave" value="${stepNumber === 1 ? '/start' : ''}">
                </div>
                <div class="flow-input-group">
                    <label>Tipo de Resposta:</label>
                    <select class="flow-type">
                        <option value="text">Texto</option>
                        <option value="question">Pergunta</option>
                        <option value="options">Opções</option>
                    </select>
                </div>
                <div class="flow-input-group">
                    <label>Mensagem:</label>
                    <textarea class="flow-message" placeholder="Digite a mensagem que será enviada..."></textarea>
                </div>
                <div class="flow-input-group">
                    <label>Próxima Etapa (opcional):</label>
                    <input type="number" class="flow-next" placeholder="Número da próxima etapa" min="1">
                </div>
            </div>
        `;

        document.getElementById('flowSteps').appendChild(stepDiv);

        if (stepNumber > 1) {
            const connector = document.createElement('div');
            connector.className = 'flow-connector';
            connector.innerHTML = '<div class="flow-arrow"></div>';
            document.getElementById('flowSteps').insertBefore(connector, stepDiv);
        }
    }

    saveConversationFlow() {
        const flowSteps = document.querySelectorAll('.flow-step');
        this.conversationFlow = [];

        flowSteps.forEach((step, index) => {
            const trigger = step.querySelector('.flow-trigger').value;
            const type = step.querySelector('.flow-type').value;
            const message = step.querySelector('.flow-message').value;
            const next = step.querySelector('.flow-next').value;

            if (trigger && message) {
                this.conversationFlow.push({
                    id: index + 1,
                    trigger: trigger,
                    type: type,
                    message: message,
                    next: next ? parseInt(next) : null
                });
            }
        });

        localStorage.setItem('conversationFlow', JSON.stringify(this.conversationFlow));
        this.log(`Fluxo de conversa salvo com ${this.conversationFlow.length} etapas`, 'info');
        this.showNotification('Fluxo de conversa salvo!', 'success');
    }

    loadConversationFlow() {
        const savedFlow = localStorage.getItem('conversationFlow');
        if (savedFlow) {
            this.conversationFlow = JSON.parse(savedFlow);
            this.renderConversationFlow();
        }
    }

    renderConversationFlow() {
        const flowContainer = document.getElementById('flowSteps');
        flowContainer.innerHTML = '';

        this.conversationFlow.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.className = 'flow-step';
            stepDiv.innerHTML = `
                <div class="flow-step-header">
                    <span class="flow-step-title">Etapa ${step.id}</span>
                    <div class="flow-step-actions">
                        <button onclick="this.parentElement.parentElement.parentElement.remove(); botPanel.updateFlowSteps();" class="btn-danger">Remover</button>
                    </div>
                </div>
                <div class="flow-step-content">
                    <div class="flow-input-group">
                        <label>Palavra-chave/Comando:</label>
                        <input type="text" class="flow-trigger" value="${step.trigger}">
                    </div>
                    <div class="flow-input-group">
                        <label>Tipo de Resposta:</label>
                        <select class="flow-type">
                            <option value="text" ${step.type === 'text' ? 'selected' : ''}>Texto</option>
                            <option value="question" ${step.type === 'question' ? 'selected' : ''}>Pergunta</option>
                            <option value="options" ${step.type === 'options' ? 'selected' : ''}>Opções</option>
                        </select>
                    </div>
                    <div class="flow-input-group">
                        <label>Mensagem:</label>
                        <textarea class="flow-message">${step.message}</textarea>
                    </div>
                    <div class="flow-input-group">
                        <label>Próxima Etapa (opcional):</label>
                        <input type="number" class="flow-next" value="${step.next || ''}" min="1">
                    </div>
                </div>
            `;

            flowContainer.appendChild(stepDiv);

            if (index > 0) {
                const connector = document.createElement('div');
                connector.className = 'flow-connector';
                connector.innerHTML = '<div class="flow-arrow"></div>';
                flowContainer.insertBefore(connector, stepDiv);
            }
        });
    }

    resetConversationFlow() {
        if (confirm('Tem certeza que deseja resetar todo o fluxo de conversa?')) {
            this.conversationFlow = [];
            document.getElementById('flowSteps').innerHTML = '';
            localStorage.removeItem('conversationFlow');
            this.log('Fluxo de conversa resetado', 'info');
            this.showNotification('Fluxo de conversa resetado!', 'info');
        }
    }

    updateFlowSteps() {
        const steps = document.querySelectorAll('.flow-step-title');
        steps.forEach((title, index) => {
            title.textContent = `Etapa ${index + 1}`;
        });
    }

    log(message, type = 'info') {
        const logsContainer = document.getElementById('logs');
        const timestamp = new Date().toLocaleTimeString();

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span>${message}`;

        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    clearLogs() {
        document.getElementById('logs').innerHTML = '';
        this.log('Logs limpos', 'info');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    addButton() {
        const text = document.getElementById('buttonText').value.trim();
        const responseType = document.getElementById('buttonResponseType').value;
        const response = document.getElementById('buttonResponse').value.trim();
        const command = document.getElementById('buttonCommand').value.trim();

        if (!text || !response) {
            this.showNotification('Preencha o texto e a resposta do botão', 'error');
            return;
        }

        const groupSelect = document.getElementById('testGroup');
        const selectedGroup = groupSelect.value;

        if (!selectedGroup) {
            this.showNotification('Selecione ou crie um grupo primeiro', 'error');
            return;
        }

        const buttonId = Date.now().toString();
        const button = {
            id: buttonId,
            text: text,
            responseType: responseType,
            response: response,
            command: command
        };

        if (this.buttonGroups.has(selectedGroup)) {
            this.buttonGroups.get(selectedGroup).buttons.push(button);
        } else {
            this.buttonGroups.set(selectedGroup, {
                name: selectedGroup,
                buttons: [button]
            });
        }

        this.saveButtonGroups();
        this.renderButtonGroups();
        this.updateGroupSelect();

        // Clear form
        document.getElementById('buttonText').value = '';
        document.getElementById('buttonResponse').value = '';
        document.getElementById('buttonCommand').value = '';

        this.log(`Botão adicionado: ${text} no grupo ${selectedGroup}`, 'info');
        this.showNotification('Botão adicionado com sucesso!', 'success');
    }

    createButtonGroup() {
        const groupName = document.getElementById('groupName').value.trim();

        if (!groupName) {
            this.showNotification('Digite um nome para o grupo', 'error');
            return;
        }

        if (this.buttonGroups.has(groupName)) {
            this.showNotification('Grupo já existe', 'error');
            return;
        }

        this.buttonGroups.set(groupName, {
            name: groupName,
            buttons: []
        });

        this.saveButtonGroups();
        this.renderButtonGroups();
        this.updateGroupSelect();

        document.getElementById('groupName').value = '';

        this.log(`Grupo de botões criado: ${groupName}`, 'info');
        this.showNotification('Grupo criado com sucesso!', 'success');
    }

    renderButtonGroups() {
        const container = document.getElementById('buttonGroups');
        container.innerHTML = '';

        this.buttonGroups.forEach((group, groupName) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'button-group-item';
            groupDiv.innerHTML = `
                <div class="button-group-header">
                    <span class="button-group-name">${group.name}</span>
                    <div class="button-group-controls">
                        <button onclick="botPanel.removeButtonGroup('${groupName}')" class="btn btn-danger">Remover Grupo</button>
                    </div>
                </div>
                <div class="button-list" id="buttonList-${groupName}"></div>
            `;
            container.appendChild(groupDiv);

            const buttonList = document.getElementById(`buttonList-${groupName}`);
            group.buttons.forEach(button => {
                const buttonDiv = document.createElement('div');
                buttonDiv.className = 'button-item';
                buttonDiv.innerHTML = `
                    <div class="button-item-header">
                        <span class="button-item-text">${button.text}</span>
                        <button onclick="botPanel.removeButton('${groupName}', '${button.id}')" class="button-item-remove">×</button>
                    </div>
                    <div class="button-item-type">${button.responseType}</div>
                    <div class="button-item-response">${button.response.substring(0, 50)}...</div>
                `;
                buttonList.appendChild(buttonDiv);
            });
        });
    }

    updateGroupSelect() {
        const select = document.getElementById('testGroup');
        select.innerHTML = '<option value="">Selecione um grupo</option>';

        this.buttonGroups.forEach((group, groupName) => {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = group.name;
            select.appendChild(option);
        });
    }

    removeButtonGroup(groupName) {
        if (confirm(`Tem certeza que deseja remover o grupo "${groupName}"?`)) {
            this.buttonGroups.delete(groupName);
            this.saveButtonGroups();
            this.renderButtonGroups();
            this.updateGroupSelect();
            this.showNotification('Grupo removido!', 'info');
        }
    }

    removeButton(groupName, buttonId) {
        const group = this.buttonGroups.get(groupName);
        if (group) {
            group.buttons = group.buttons.filter(button => button.id !== buttonId);
            this.saveButtonGroups();
            this.renderButtonGroups();
            this.showNotification('Botão removido!', 'info');
        }
    }

    testButtons() {
        const groupName = document.getElementById('testGroup').value;

        if (!groupName) {
            this.showNotification('Selecione um grupo para testar', 'error');
            return;
        }

        if (!this.botRunning) {
            this.showNotification('Bot precisa estar ativo para testar', 'error');
            return;
        }

        const group = this.buttonGroups.get(groupName);
        if (!group || group.buttons.length === 0) {
            this.showNotification('Grupo não encontrado ou está vazio', 'error');
            return;
        }

        const buttons = this.createTelegramButtons(group.buttons, groupName);

        // Send to first user for testing (in real scenario, you'd specify test user)
        if (this.users.size > 0) {
            const firstUser = Array.from(this.users)[0];
            this.sendMessageWithButtons(firstUser, `🧪 Teste do grupo: ${groupName}`, buttons);
            this.showNotification('Teste de botões enviado!', 'success');
        } else {
            this.showNotification('Nenhum usuário disponível para teste', 'error');
        }
    }

    getButtonsForCommand(command) {
        // Find button groups that have buttons associated with this command
        for (const [groupName, group] of this.buttonGroups) {
            const hasCommand = group.buttons.some(button => button.command === command);
            if (hasCommand) {
                return this.createTelegramButtons(group.buttons, groupName);
            }
        }
        return null;
    }

    getMainMenuButtons() {
        // Return main menu buttons if they exist
        if (this.buttonGroups.has('menu')) {
            const menuGroup = this.buttonGroups.get('menu');
            return this.createTelegramButtons(menuGroup.buttons, 'menu');
        }
        return null;
    }

    createTelegramButtons(buttons, groupName) {
        return buttons.map(button => {
            const buttonData = {
                type: 'button_action',
                group: groupName,
                button: button.id
            };

            if (button.responseType === 'url') {
                return {
                    text: button.text,
                    url: button.response
                };
            } else {
                return {
                    text: button.text,
                    callback_data: JSON.stringify(buttonData)
                };
            }
        });
    }

    async sendMessageWithButtons(userId, text, buttons) {
        try {
            const keyboard = {
                inline_keyboard: this.chunkArray(buttons, 2) // 2 buttons per row
            };

            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: userId,
                    text: text,
                    reply_markup: keyboard,
                    parse_mode: 'HTML'
                })
            });

            const data = await response.json();

            if (data.ok) {
                this.log(`Mensagem com botões enviada para ${userId}: ${text}`, 'info');
                this.stats.totalMessages++;
                this.stats.todayMessages++;
                this.updateStats();
            } else {
                this.log(`Erro ao enviar mensagem com botões: ${data.description}`, 'error');
            }
        } catch (error) {
            this.log(`Erro ao enviar mensagem com botões: ${error.message}`, 'error');
        }
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    saveButtonGroups() {
        const serializedGroups = Array.from(this.buttonGroups.entries());
        localStorage.setItem('buttonGroups', JSON.stringify(serializedGroups));
    }

    loadButtonGroups() {
        const saved = localStorage.getItem('buttonGroups');
        if (saved) {
            const serializedGroups = JSON.parse(saved);
            this.buttonGroups = new Map(serializedGroups);
            this.renderButtonGroups();
            this.updateGroupSelect();
        }
    }

    // Menu Management Methods
    addMenuItem() {
        const name = document.getElementById('menuItemName').value.trim();
        const description = document.getElementById('menuItemDescription').value.trim();
        const price = parseFloat(document.getElementById('menuItemPrice').value);
        const category = document.getElementById('menuItemCategory').value;
        const status = document.getElementById('menuItemStatus').value;
        const imageFile = document.getElementById('menuItemImage').files[0];

        if (!name || !description || isNaN(price)) {
            this.showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        const itemId = Date.now().toString();
        const menuItem = {
            id: itemId,
            name,
            description,
            price,
            category,
            status,
            image: null,
            createdAt: new Date()
        };

        if (imageFile) {
            this.convertImageToBase64(imageFile).then(base64 => {
                menuItem.image = base64;
                this.saveMenuItem(menuItem);
            });
        } else {
            this.saveMenuItem(menuItem);
        }
    }

    saveMenuItem(menuItem) {
        this.menuItems.set(menuItem.id, menuItem);
        this.saveMenuItems();
        this.renderMenuItems();
        this.clearMenuForm();

        this.log(`Item do cardápio adicionado: ${menuItem.name}`, 'info');
        this.showNotification('Item adicionado ao cardápio!', 'success');
    }

    convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    previewImage(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('imagePreview');

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    }

    clearMenuForm() {
        document.getElementById('menuItemName').value = '';
        document.getElementById('menuItemDescription').value = '';
        document.getElementById('menuItemPrice').value = '';
        document.getElementById('menuItemCategory').value = 'principais';
        document.getElementById('menuItemStatus').value = 'disponivel';
        document.getElementById('menuItemImage').value = '';
        document.getElementById('imagePreview').innerHTML = '';
    }

    renderMenuItems(category = 'all') {
        const container = document.getElementById('menuItems');
        container.innerHTML = '';

        const filteredItems = Array.from(this.menuItems.values())
            .filter(item => category === 'all' || item.category === category);

        if (filteredItems.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                    <h3>Nenhum item encontrado</h3>
                    <p>${category === 'all' ? 'Adicione itens ao cardápio' : 'Nenhum item nesta categoria'}</p>
                </div>
            `;
            return;
        }

        filteredItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'menu-item';
            itemDiv.innerHTML = `
                <div class="menu-item-image ${!item.image ? 'no-image' : ''}">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '🍽️'}
                </div>
                <div class="menu-item-content">
                    <div class="menu-item-header">
                        <h3 class="menu-item-name">${item.name}</h3>
                        <span class="menu-item-price">R$ ${item.price.toFixed(2)}</span>
                    </div>
                    <p class="menu-item-description">${item.description}</p>
                    <span class="menu-item-category">${this.getCategoryName(item.category)}</span>
                    <span class="menu-item-status ${item.status}">${this.getStatusName(item.status)}</span>
                    <div class="menu-item-actions">
                        <button class="btn-edit" onclick="botPanel.editMenuItem('${item.id}')">Editar</button>
                        <button class="btn-remove" onclick="botPanel.removeMenuItem('${item.id}')">Remover</button>
                    </div>
                </div>
            `;
            container.appendChild(itemDiv);
        });
    }

    getCategoryName(category) {
        const names = {
            'principais': 'Pratos Principais',
            'bebidas': 'Bebidas',
            'sobremesas': 'Sobremesas',
            'entradas': 'Entradas',
            'lanches': 'Lanches',
            'pizzas': 'Pizzas'
        };
        return names[category] || category;
    }

    getStatusName(status) {
        const names = {
            'disponivel': 'Disponível',
            'indisponivel': 'Indisponível',
            'promocao': 'Em Promoção'
        };
        return names[status] || status;
    }

    filterMenuByCategory(category) {
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');

        // Render filtered items
        this.renderMenuItems(category);
    }

    editMenuItem(itemId) {
        const item = this.menuItems.get(itemId);
        if (!item) return;

        // Fill form with item data
        document.getElementById('menuItemName').value = item.name;
        document.getElementById('menuItemDescription').value = item.description;
        document.getElementById('menuItemPrice').value = item.price;
        document.getElementById('menuItemCategory').value = item.category;
        document.getElementById('menuItemStatus').value = item.status;

        if (item.image) {
            document.getElementById('imagePreview').innerHTML = `<img src="${item.image}" alt="Preview">`;
        }

        // Remove item temporarily for editing
        this.menuItems.delete(itemId);
        this.renderMenuItems();

        this.showNotification('Item carregado para edição', 'info');
    }

    removeMenuItem(itemId) {
        const item = this.menuItems.get(itemId);
        if (!item) return;

        if (confirm(`Tem certeza que deseja remover "${item.name}" do cardápio?`)) {
            this.menuItems.delete(itemId);
            this.saveMenuItems();
            this.renderMenuItems();
            this.showNotification('Item removido do cardápio', 'info');
            this.log(`Item removido: ${item.name}`, 'info');
        }
    }

    async sendMenuToAll() {
        if (!this.botRunning) {
            this.showNotification('Bot precisa estar ativo', 'error');
            return;
        }

        if (this.menuItems.size === 0) {
            this.showNotification('Adicione itens ao cardápio primeiro', 'error');
            return;
        }

        const menuText = this.generateFullMenuText();
        await this.broadcastMessage(menuText);
        this.showNotification('Cardápio enviado para todos os usuários!', 'success');
    }

    async sendCategoryMenu() {
        const category = document.getElementById('categorySelect').value;
        
        if (!category) {
            this.showNotification('Selecione uma categoria', 'error');
            return;
        }

        if (!this.botRunning) {
            this.showNotification('Bot precisa estar ativo', 'error');
            return;
        }

        const categoryItems = Array.from(this.menuItems.values())
            .filter(item => item.category === category);

        if (categoryItems.length === 0) {
            this.showNotification('Nenhum item nesta categoria', 'error');
            return;
        }

        const menuText = this.generateCategoryMenuText(category, categoryItems);
        await this.broadcastMessage(menuText);
        this.showNotification(`Cardápio da categoria ${this.getCategoryName(category)} enviado!`, 'success');
    }

    async sendFullMenu(userId) {
        const menuText = this.generateFullMenuText();
        await this.sendMessage(userId, menuText);
    }

    async sendCategoryMenu(category, userId) {
        const categoryItems = Array.from(this.menuItems.values())
            .filter(item => item.category === category);

        if (categoryItems.length === 0) {
            await this.sendMessage(userId, `Não temos itens disponíveis na categoria ${this.getCategoryName(category)} no momento.`);
            return;
        }

        const menuText = this.generateCategoryMenuText(category, categoryItems);
        await this.sendMessage(userId, menuText);
    }

    generateFullMenuText() {
        let menuText = '🍽️ *NOSSO CARDÁPIO* 🍽️\n\n';

        const categories = ['entradas', 'principais', 'pizzas', 'lanches', 'bebidas', 'sobremesas'];
        
        categories.forEach(category => {
            const categoryItems = Array.from(this.menuItems.values())
                .filter(item => item.category === category && item.status === 'disponivel');

            if (categoryItems.length > 0) {
                menuText += `📂 *${this.getCategoryName(category).toUpperCase()}*\n`;
                
                categoryItems.forEach(item => {
                    const priceText = item.status === 'promocao' ? `🔥 R$ ${item.price.toFixed(2)}` : `R$ ${item.price.toFixed(2)}`;
                    menuText += `\n🔸 *${item.name}* - ${priceText}\n`;
                    menuText += `   ${item.description}\n`;
                });
                
                menuText += '\n';
            }
        });

        menuText += '📞 Para fazer seu pedido, entre em contato conosco!\n';
        menuText += '⏰ Funcionamento: Segunda a Domingo, 18h às 23h';

        return menuText;
    }

    generateCategoryMenuText(category, items) {
        let menuText = `🍽️ *${this.getCategoryName(category).toUpperCase()}* 🍽️\n\n`;

        items.filter(item => item.status === 'disponivel').forEach(item => {
            const priceText = item.status === 'promocao' ? `🔥 R$ ${item.price.toFixed(2)}` : `R$ ${item.price.toFixed(2)}`;
            menuText += `🔸 *${item.name}* - ${priceText}\n`;
            menuText += `   ${item.description}\n\n`;
        });

        menuText += '📞 Para fazer seu pedido, entre em contato conosco!';

        return menuText;
    }

    createMenuButtons() {
        // Create a button group for menu categories
        const menuButtonGroup = {
            name: 'Cardápio',
            buttons: [
                {
                    id: 'menu_full',
                    text: '📋 Cardápio Completo',
                    responseType: 'callback',
                    response: 'this.sendFullMenu(userId)',
                    command: '/cardapio'
                },
                {
                    id: 'menu_principais',
                    text: '🍽️ Pratos Principais',
                    responseType: 'callback',
                    response: 'this.sendCategoryMenu("principais", userId)',
                    command: '/principais'
                },
                {
                    id: 'menu_bebidas',
                    text: '🥤 Bebidas',
                    responseType: 'callback',
                    response: 'this.sendCategoryMenu("bebidas", userId)',
                    command: '/bebidas'
                },
                {
                    id: 'menu_sobremesas',
                    text: '🍰 Sobremesas',
                    responseType: 'callback',
                    response: 'this.sendCategoryMenu("sobremesas", userId)',
                    command: '/sobremesas'
                }
            ]
        };

        this.buttonGroups.set('Cardápio', menuButtonGroup);
        this.saveButtonGroups();
        this.renderButtonGroups();
        this.updateGroupSelect();

        this.showNotification('Botões do cardápio criados!', 'success');
        this.log('Botões do cardápio criados automaticamente', 'info');
    }

    saveMenuItems() {
        const serializedMenu = Array.from(this.menuItems.entries());
        localStorage.setItem('menuItems', JSON.stringify(serializedMenu));
    }

    loadMenuItems() {
        const saved = localStorage.getItem('menuItems');
        if (saved) {
            const serializedMenu = JSON.parse(saved);
            this.menuItems = new Map(serializedMenu);
            this.renderMenuItems();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    saveBotState(isRunning) {
        localStorage.setItem('botRunning', JSON.stringify(isRunning));
        if (isRunning) {
            localStorage.setItem('lastUpdateId', this.lastUpdateId.toString());
        }
    }

    loadBotState() {
        const saved = localStorage.getItem('botRunning');
        if (saved) {
            const isRunning = JSON.parse(saved);
            if (isRunning) {
                const savedUpdateId = localStorage.getItem('lastUpdateId');
                if (savedUpdateId) {
                    this.lastUpdateId = parseInt(savedUpdateId) || 0;
                }
            }
            return isRunning;
        }
        return false;
    }

    async resumeBot() {
        this.log('Retomando bot após atualização da página...', 'info');
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            const data = await response.json();

            if (!data.ok) {
                throw new Error('Token inválido ou bot não encontrado');
            }

            this.updateBotStatus(true);
            this.log(`Bot retomado: @${data.result.username}`, 'info');
            this.showNotification('Bot retomado automaticamente!', 'info');

            this.startPolling();
            
            // Restart auto messages if they were enabled
            const autoMessageStatus = document.getElementById('autoMessageStatus');
            if (autoMessageStatus && autoMessageStatus.textContent === 'Ativado') {
                const interval = document.getElementById('autoInterval').value * 60000;
                const message = document.getElementById('autoMessage').value;

                this.autoMessageInterval = setInterval(() => {
                    if (this.botRunning && this.users.size > 0) {
                        this.broadcastMessage(message);
                        this.log('Mensagem automática enviada', 'info');
                    }
                }, interval);
            }
            
        } catch (error) {
            this.log(`Erro ao retomar bot: ${error.message}`, 'error');
            this.botRunning = false;
            this.saveBotState(false);
            this.updateBotStatus(false);
            this.showNotification('Erro ao retomar bot - inicie manualmente', 'warning');
        }
    }
}

// Initialize the panel when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.botPanel = new TelegramBotPanel();
});
