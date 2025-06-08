class SalesBot {
    constructor() {
        this.botToken = '7713545288:AAH12fWBmelTuLl3wHeAFKGKDdjFNsrMp94';
        this.botRunning = this.loadBotState();
        this.leads = new Map();
        this.products = new Map();
        this.campaigns = new Map();
        this.abTests = new Map();
        this.salesFunnel = {
            awareness: new Set(),
            interest: new Set(),
            consideration: new Set(),
            purchase: new Set()
        };
        this.lastUpdateId = 0;
        this.pollingInterval = null;
        this.processedMessages = new Set();
        this.lastMessageTime = new Map();

        // Sales metrics
        this.salesMetrics = {
            totalRevenue: 0,
            conversions: 0,
            totalLeads: 0,
            conversionRate: 0,
            revenueByDay: new Array(30).fill(0),
            conversionsByDay: new Array(30).fill(0)
        };

        // Marketing strategies
        this.marketingStrategies = {
            welcome: {
                enabled: true,
                giftEnabled: true,
                discountEnabled: true,
                surveyEnabled: false,
                message: `🎉 Olá! Bem-vindo(a) ao nosso bot de vendas!\n\nComo presente de boas-vindas, você ganhou 20% OFF na sua primeira compra! 🎁\n\nUse o código: BEMVINDO20\n\nO que posso ajudar você hoje?`
            },
            nurturing: {
                enabled: true,
                sequence: [
                    { day: 1, action: 'educational_content', message: '📚 Conteúdo educativo sobre nossos produtos' },
                    { day: 3, action: 'social_proof', message: '⭐ Veja o que nossos clientes dizem sobre nós' },
                    { day: 7, action: 'special_offer', message: '🔥 Oferta especial só para você!' }
                ]
            },
            closing: {
                scarcityEnabled: true,
                socialProofEnabled: true,
                urgencyEnabled: true,
                urgencyTimer: 24,
                urgencyDiscount: 15
            },
            retention: {
                birthdayDiscountEnabled: true,
                loyaltyProgramEnabled: true,
                winBackCampaignEnabled: false
            },
            upsell: {
                enabled: true,
                product: 'Produto Premium',
                discount: 10
            }
        };

        // Pre-loaded campaign templates
        this.campaignTemplates = {
            'flash-sale': {
                name: '🔥 Flash Sale',
                message: '🔥 FLASH SALE! 50% OFF em todos os produtos por apenas 2 horas!\n\nNão perca essa oportunidade única!\n\nClique aqui para aproveitar: [LINK]',
                target: 'all',
                urgency: true
            },
            'remarketing': {
                name: '🎯 Remarketing',
                message: '👋 Olá! Notamos que você demonstrou interesse em nossos produtos.\n\nQue tal finalizar sua compra? Temos uma oferta especial esperando por você!\n\n💰 15% OFF com o código: VOLTA15',
                target: 'inactive',
                urgency: false
            },
            'black-friday': {
                name: '💝 Black Friday',
                message: '🖤 BLACK FRIDAY CHEGOU!\n\nDescontos de até 70% em TODOS os produtos!\n\n⏰ Por tempo limitado - não perca!\n\nCompre agora: [LINK]',
                target: 'all',
                urgency: true
            }
        };

        this.initializeSystem();
        this.loadSalesData();
        this.loadMarketingStrategies();
        this.initializeCharts();

        // Auto-start bot if it was running before page refresh
        if (this.botRunning) {
            this.resumeBot();
        }
    }

    initializeSystem() {
        // Bot control event listeners
        document.getElementById('startBot').addEventListener('click', () => this.startBot());
        document.getElementById('stopBot').addEventListener('click', () => this.stopBot());
        document.getElementById('restartBot').addEventListener('click', () => this.restartBot());

        // Marketing strategy event listeners
        document.querySelectorAll('.strategy-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchStrategy(e.target.dataset.strategy));
        });

        document.getElementById('saveWelcomeStrategy').addEventListener('click', () => this.saveWelcomeStrategy());

        // Product management
        document.getElementById('addProduct').addEventListener('click', () => this.addProduct());

        // Campaign management
        document.getElementById('createCampaign').addEventListener('click', () => this.createCampaign());

        // A/B Testing
        document.getElementById('startABTest').addEventListener('click', () => this.startABTest());

        // Funnel management
        document.getElementById('createFunnelStep').addEventListener('click', () => this.createFunnelStep());
        document.getElementById('optimizeFunnel').addEventListener('click', () => this.optimizeFunnel());
        document.getElementById('analyzeFunnel').addEventListener('click', () => this.analyzeFunnel());

        // Lead management
        document.getElementById('exportLeads').addEventListener('click', () => this.exportLeads());
        document.getElementById('leadStatus').addEventListener('change', () => this.filterLeads());
        document.getElementById('leadSource').addEventListener('change', () => this.filterLeads());

        // Analytics
        document.getElementById('generateReport').addEventListener('click', () => this.generateReport());
        document.getElementById('chartPeriod').addEventListener('change', () => this.updateCharts());

        // Support
        document.getElementById('viewTickets').addEventListener('click', () => this.viewSupportTickets());

        // Logs
        document.getElementById('clearLogs').addEventListener('click', () => this.clearLogs());
        document.getElementById('exportLogs').addEventListener('click', () => this.exportLogs());
        document.getElementById('logFilter').addEventListener('change', () => this.filterLogs());

        // Initialize pre-loaded products
        this.loadSampleProducts();

        // Initialize metrics update interval
        setInterval(() => this.updateSalesMetrics(), 30000);

        // Start checking bot status
        this.checkBotStatus();
        setInterval(() => this.checkBotStatus(), 5000);
    }

    async startBot() {
        this.log('🚀 Iniciando Sales Bot...', 'system');

        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            const data = await response.json();

            if (!data.ok) {
                throw new Error('Token inválido ou bot não encontrado');
            }

            this.botRunning = true;
            this.saveBotState(true);
            this.updateBotStatus(true);
            this.log(`✅ Sales Bot iniciado: @${data.result.username}`, 'system');
            this.showNotification('Sales Bot iniciado com sucesso! 🚀', 'success');

            this.startPolling();
        } catch (error) {
            this.log(`❌ Erro ao iniciar bot: ${error.message}`, 'error');
            this.showNotification('Erro ao iniciar bot', 'error');
        }
    }

    async stopBot() {
        this.log('⏹️ Parando Sales Bot...', 'system');

        this.botRunning = false;
        this.saveBotState(false);
        this.updateBotStatus(false);

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        this.log('⏹️ Sales Bot parado!', 'system');
        this.showNotification('Sales Bot parado!', 'info');
    }

    async restartBot() {
        this.log('🔄 Reiniciando Sales Bot...', 'system');
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
                this.log(`⚠️ Erro no polling: ${error.message}`, 'error');
            }
        }, 3000);
    }

    handleMessage(message) {
        const userId = message.from.id;
        const username = message.from.username || message.from.first_name;
        const text = message.text || '';
        const messageId = message.message_id;

        // Verificar se a mensagem já foi processada
        const messageKey = `${userId}_${messageId}_${text}`;
        if (this.processedMessages.has(messageKey)) {
            return;
        }
        this.processedMessages.add(messageKey);

        // Rate limiting
        const now = Date.now();
        const lastTime = this.lastMessageTime.get(userId) || 0;
        if (now - lastTime < 1000) {
            this.log(`⚠️ Rate limit aplicado para usuário ${username}`, 'system');
            return;
        }
        this.lastMessageTime.set(userId, now);

        // Gerenciar lead
        this.manageLead(userId, username, text);

        this.log(`💬 Mensagem de ${username} (${userId}): ${text}`, 'sales');
        this.processMessage(text, userId, username);
        this.updateSalesMetrics();
    }

    manageLead(userId, username, message) {
        if (!this.leads.has(userId)) {
            // Novo lead
            const lead = {
                id: userId,
                username: username,
                status: 'new',
                source: 'telegram',
                firstContact: new Date(),
                lastContact: new Date(),
                messages: [message],
                funnelStage: 'awareness',
                totalValue: 0,
                conversions: 0
            };

            this.leads.set(userId, lead);
            this.salesFunnel.awareness.add(userId);
            this.salesMetrics.totalLeads++;

            // Enviar estratégia de boas-vindas
            if (this.marketingStrategies.welcome.enabled) {
                this.sendWelcomeStrategy(userId);
            }

            this.log(`👥 Novo lead capturado: ${username}`, 'sales');
        } else {
            // Lead existente
            const lead = this.leads.get(userId);
            lead.lastContact = new Date();
            lead.messages.push(message);
            lead.status = 'contacted';
            this.leads.set(userId, lead);
        }

        this.updateLeadsList();
    }

    processMessage(message, userId, username) {
        let response = '';
        let buttons = null;

        // Análise de intenção de compra
        const buyingIntent = this.analyzeBuyingIntent(message);
        const lead = this.leads.get(userId);

        switch (message.toLowerCase()) {
            case '/start':
                response = this.marketingStrategies.welcome.message;
                this.moveleadToStage(userId, 'interest');
                break;

            case '/produtos':
            case '/catalogo':
                response = this.generateProductCatalog();
                this.moveleadToStage(userId, 'consideration');
                break;

            case '/ajuda':
                response = `🆘 Central de Ajuda\n\nComandos disponíveis:\n/produtos - Ver catálogo\n/ofertas - Ofertas especiais\n/suporte - Falar com atendente\n\nComo posso ajudar você?`;
                break;

            case '/ofertas':
                response = this.generateSpecialOffers(userId);
                this.moveleadToStage(userId, 'consideration');
                break;

            case '/suporte':
                response = `🎧 Você será conectado com um de nossos atendentes em breve.\n\nEnquanto isso, posso ajudar com:\n• Informações sobre produtos\n• Status do pedido\n• Dúvidas sobre pagamento`;
                this.createSupportTicket(userId, username);
                break;

            default:
                if (buyingIntent.score > 0.7) {
                    response = this.generateSalesResponse(buyingIntent, userId);
                    this.moveleadToStage(userId, 'consideration');
                } else if (buyingIntent.score > 0.4) {
                    response = this.generateNurturingResponse(userId);
                    this.moveleadToStage(userId, 'interest');
                } else {
                    response = `Obrigado pela sua mensagem! 😊\n\nEstou aqui para ajudar com:\n🛍️ Produtos e preços\n💰 Ofertas especiais\n🎧 Suporte técnico\n\nDigite /produtos para ver nosso catálogo!`;
                }
        }

        this.sendMessage(userId, response, buttons);
    }

    analyzeBuyingIntent(message) {
        const buyingKeywords = [
            'comprar', 'preço', 'valor', 'quanto custa', 'orçamento', 'pagar',
            'desconto', 'promoção', 'oferta', 'barato', 'em conta',
            'quero', 'preciso', 'interesse', 'cotação', 'parcelamento'
        ];

        const considerationKeywords = [
            'informação', 'detalhes', 'especificação', 'características',
            'como funciona', 'garantia', 'qualidade', 'avaliação'
        ];

        const urgencyKeywords = [
            'urgente', 'rápido', 'hoje', 'agora', 'imediato', 'logo'
        ];

        let score = 0;
        const lowerMessage = message.toLowerCase();

        buyingKeywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) score += 0.3;
        });

        considerationKeywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) score += 0.2;
        });

        urgencyKeywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) score += 0.1;
        });

        return {
            score: Math.min(score, 1),
            intent: score > 0.7 ? 'buy' : score > 0.4 ? 'consider' : 'browse',
            keywords: lowerMessage
        };
    }

    generateSalesResponse(intent, userId) {
        const lead = this.leads.get(userId);
        let response = `🎯 Perfeito! Vejo que você tem interesse em comprar!\n\n`;

        if (intent.keywords.includes('preço') || intent.keywords.includes('valor')) {
            response += `💰 Nossos preços são super competitivos!\n\n`;
            response += this.generateProductCatalog();
        } else if (intent.keywords.includes('desconto') || intent.keywords.includes('promoção')) {
            response += `🔥 Temos ofertas especiais para você!\n\n`;
            response += this.generateSpecialOffers(userId);
        } else {
            response += `Vou te mostrar nossos melhores produtos:\n\n`;
            response += this.generateProductCatalog();
        }

        // Aplicar técnica de fechamento se habilitada
        if (this.marketingStrategies.closing.urgencyEnabled) {
            response += `\n⏰ OFERTA ESPECIAL: ${this.marketingStrategies.closing.urgencyDiscount}% OFF se decidir nas próximas ${this.marketingStrategies.closing.urgencyTimer} horas!`;
        }

        return response;
    }

    generateNurturingResponse(userId) {
        const nurturingMessages = [
            `Que bom ter você aqui! 😊\n\nVou te ajudar a encontrar exatamente o que precisa.\n\nQue tipo de produto você está procurando?`,
            `Entendi seu interesse! 👍\n\nTemos várias opções que podem te interessar.\n\nGostaria de ver nosso catálogo?`,
            `Fico feliz em poder ajudar! 🤝\n\nVamos encontrar a melhor solução para você.\n\nPosso fazer algumas perguntas para entender melhor sua necessidade?`
        ];

        return nurturingMessages[Math.floor(Math.random() * nurturingMessages.length)];
    }

    moveleadToStage(userId, newStage) {
        const lead = this.leads.get(userId);
        if (!lead) return;

        const currentStage = lead.funnelStage;

        // Remove do estágio atual
        if (this.salesFunnel[currentStage]) {
            this.salesFunnel[currentStage].delete(userId);
        }

        // Adiciona no novo estágio
        if (this.salesFunnel[newStage]) {
            this.salesFunnel[newStage].add(userId);
            lead.funnelStage = newStage;
            this.leads.set(userId, lead);

            this.log(`📈 Lead ${lead.username} movido para: ${newStage}`, 'sales');
            this.updateFunnelDisplay();
        }
    }

    sendWelcomeStrategy(userId) {
        setTimeout(() => {
            this.sendMessage(userId, this.marketingStrategies.welcome.message);

            if (this.marketingStrategies.welcome.giftEnabled) {
                this.log(`🎁 Brinde de boas-vindas enviado para usuário ${userId}`, 'marketing');
            }
        }, 1000);
    }

    generateProductCatalog() {
        let catalog = `🛍️ **NOSSO CATÁLOGO**\n\n`;

        if (this.products.size === 0) {
            return `Nosso catálogo está sendo atualizado. Em breve teremos novidades incríveis para você! 🚀`;
        }

        this.products.forEach((product, id) => {
            catalog += `📦 **${product.name}**\n`;
            catalog += `💰 R$ ${product.price.toFixed(2)}\n`;
            catalog += `📝 ${product.description}\n`;
            catalog += `📂 Categoria: ${this.getCategoryName(product.category)}\n\n`;
        });

        catalog += `💬 Para comprar, me mande uma mensagem com o nome do produto!\n`;
        catalog += `🎧 Precisa de ajuda? Digite /suporte`;

        return catalog;
    }

    generateSpecialOffers(userId) {
        const offers = [
            `🔥 **OFERTA RELÂMPAGO**\n30% OFF em todos os produtos!\nCódigo: RELAMPAGO30\n⏰ Válido por 24h`,
            `💎 **OFERTA EXCLUSIVA**\nCompre 2 e leve 3!\n🎁 O terceiro produto é grátis\n⏰ Só hoje!`,
            `🎯 **DESCONTO ESPECIAL**\n25% OFF na sua primeira compra\nCódigo: PRIMEIRA25\n⏰ Só para novos clientes`
        ];

        return offers[Math.floor(Math.random() * offers.length)];
    }

    createSupportTicket(userId, username) {
        const ticket = {
            id: Date.now(),
            userId: userId,
            username: username,
            status: 'open',
            created: new Date(),
            messages: []
        };

        // Simular criação de ticket
        this.log(`🎫 Ticket de suporte criado para ${username} (#${ticket.id})`, 'system');

        // Atualizar métricas de suporte
        this.updateSupportMetrics();
    }

    // Marketing Strategy Management
    switchStrategy(strategy) {
        // Update active tab
        document.querySelectorAll('.strategy-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-strategy="${strategy}"]`).classList.add('active');

        // Show corresponding content
        document.querySelectorAll('.strategy-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`${strategy}Strategy`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
    }

    saveWelcomeStrategy() {
        const welcomeMessage = document.getElementById('welcomeMessage').value;
        const giftEnabled = document.getElementById('welcomeGift').checked;
        const discountEnabled = document.getElementById('welcomeDiscount').checked;
        const surveyEnabled = document.getElementById('welcomeSurvey').checked;

        this.marketingStrategies.welcome = {
            enabled: true,
            giftEnabled,
            discountEnabled,
            surveyEnabled,
            message: welcomeMessage
        };

        this.saveMarketingStrategies();
        this.log('💾 Estratégia de boas-vindas salva', 'marketing');
        this.showNotification('Estratégia de boas-vindas salva!', 'success');
    }

    // Product Management
    addProduct() {
        const name = document.getElementById('productName').value.trim();
        const description = document.getElementById('productDescription').value.trim();
        const price = parseFloat(document.getElementById('productPrice').value);
        const category = document.getElementById('productCategory').value;
        const commission = parseFloat(document.getElementById('productCommission').value);

        if (!name || !description || isNaN(price)) {
            this.showNotification('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        const productId = Date.now().toString();
        const product = {
            id: productId,
            name,
            description,
            price,
            category,
            commission,
            createdAt: new Date(),
            sales: 0,
            revenue: 0
        };

        this.products.set(productId, product);
        this.saveProducts();
        this.renderProductsList();
        this.clearProductForm();

        this.log(`📦 Produto adicionado: ${name} - R$ ${price.toFixed(2)}`, 'sales');
        this.showNotification('Produto adicionado com sucesso!', 'success');
    }

    clearProductForm() {
        document.getElementById('productName').value = '';
        document.getElementById('productDescription').value = '';
        document.getElementById('productPrice').value = '';
        document.getElementById('productCategory').value = 'digital';
        document.getElementById('productCommission').value = '10';
    }

    renderProductsList() {
        const container = document.getElementById('productsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.products.size === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>Nenhum produto cadastrado</h3>
                    <p>Adicione produtos ao seu catálogo</p>
                </div>
            `;
            return;
        }

        this.products.forEach((product, id) => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product-item';
            productDiv.innerHTML = `
                <div class="product-header">
                    <h3>${product.name}</h3>
                    <span class="product-price">R$ ${product.price.toFixed(2)}</span>
                </div>
                <p class="product-description">${product.description}</p>
                <div class="product-meta">
                    <span class="product-category">${this.getCategoryName(product.category)}</span>
                    <span class="product-commission">${product.commission}% comissão</span>
                </div>
                <div class="product-stats">
                    <span>📊 ${product.sales} vendas</span>
                    <span>💰 R$ ${product.revenue.toFixed(2)} faturado</span>
                </div>
                <div class="product-actions">
                    <button class="btn btn-sm btn-primary" onclick="salesBot.editProduct('${id}')">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="salesBot.removeProduct('${id}')">Remover</button>
                </div>
            `;
            container.appendChild(productDiv);
        });
    }

    getCategoryName(category) {
        const names = {
            'digital': 'Produto Digital',
            'physical': 'Produto Físico',
            'service': 'Serviço',
            'course': 'Curso',
            'consultation': 'Consultoria'
        };
        return names[category] || category;
    }

    removeProduct(productId) {
        const product = this.products.get(productId);
        if (!product) return;

        if (confirm(`Tem certeza que deseja remover "${product.name}"?`)) {
            this.products.delete(productId);
            this.saveProducts();
            this.renderProductsList();
            this.showNotification('Produto removido!', 'info');
            this.log(`🗑️ Produto removido: ${product.name}`, 'sales');
        }
    }

    // Campaign Management
    loadCampaignTemplate(templateName) {
        const template = this.campaignTemplates[templateName];
        if (!template) return;

        document.getElementById('campaignName').value = template.name;
        document.getElementById('campaignMessage').value = template.message;
        document.getElementById('campaignTarget').value = template.target;

        this.showNotification(`Template "${template.name}" carregado!`, 'success');
    }

    createCampaign() {
        const name = document.getElementById('campaignName').value.trim();
        const message = document.getElementById('campaignMessage').value.trim();
        const target = document.getElementById('campaignTarget').value;

        if (!name || !message) {
            this.showNotification('Preencha nome e mensagem da campanha', 'error');
            return;
        }

        const campaignId = Date.now().toString();
        const campaign = {
            id: campaignId,
            name,
            message,
            target,
            created: new Date(),
            sent: 0,
            opens: 0,
            clicks: 0,
            conversions: 0
        };

        this.campaigns.set(campaignId, campaign);
        this.launchCampaign(campaign);

        // Clear form
        document.getElementById('campaignName').value = '';
        document.getElementById('campaignMessage').value = '';

        this.log(`📢 Campanha criada e lançada: ${name}`, 'marketing');
        this.showNotification('Campanha lançada com sucesso!', 'success');
    }

    async launchCampaign(campaign) {
        let targetLeads = [];

        switch (campaign.target) {
            case 'all':
                targetLeads = Array.from(this.leads.keys());
                break;
            case 'new':
                targetLeads = Array.from(this.leads.values())
                    .filter(lead => lead.status === 'new')
                    .map(lead => lead.id);
                break;
            case 'inactive':
                const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
                targetLeads = Array.from(this.leads.values())
                    .filter(lead => lead.lastContact < threeDaysAgo)
                    .map(lead => lead.id);
                break;
            case 'customers':
                targetLeads = Array.from(this.leads.values())
                    .filter(lead => lead.conversions > 0)
                    .map(lead => lead.id);
                break;
        }

        // Send campaign messages
        for (const leadId of targetLeads) {
            try {
                await this.sendMessage(leadId, campaign.message);
                campaign.sent++;
                await this.delay(1000); // Rate limiting
            } catch (error) {
                this.log(`❌ Erro ao enviar campanha para ${leadId}: ${error.message}`, 'error');
            }
        }

        this.campaigns.set(campaign.id, campaign);
        this.log(`📊 Campanha "${campaign.name}" enviada para ${campaign.sent} leads`, 'marketing');
    }

    // A/B Testing
    startABTest() {
        const testName = document.getElementById('testName').value.trim();
        const versionA = document.getElementById('versionA').value.trim();
        const versionB = document.getElementById('versionB').value.trim();
        const metric = document.getElementById('successMetric').value;

        if (!testName || !versionA || !versionB) {
            this.showNotification('Preencha todos os campos do teste', 'error');
            return;
        }

        const testId = Date.now().toString();
        const test = {
            id: testId,
            name: testName,
            versionA: { message: versionA, sent: 0, metric_value: 0 },
            versionB: { message: versionB, sent: 0, metric_value: 0 },
            successMetric: metric,
            status: 'running',
            created: new Date()
        };

        this.abTests.set(testId, test);
        this.renderActiveTests();

        // Clear form
        document.getElementById('testName').value = '';
        document.getElementById('versionA').value = '';
        document.getElementById('versionB').value = '';

        this.log(`🧪 Teste A/B iniciado: ${testName}`, 'marketing');
        this.showNotification('Teste A/B iniciado!', 'success');
    }

    renderActiveTests() {
        const container = document.getElementById('activeTests');
        if (!container) return;

        container.innerHTML = '';

        if (this.abTests.size === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <p>Nenhum teste A/B ativo</p>
                </div>
            `;
            return;
        }

        this.abTests.forEach((test, id) => {
            const testDiv = document.createElement('div');
            testDiv.className = 'test-item';
            testDiv.innerHTML = `
                <div class="test-header">
                    <h4>${test.name}</h4>
                    <span class="test-status ${test.status}">${test.status}</span>
                </div>
                <div class="test-results">
                    <div class="version-result">
                        <strong>Versão A:</strong> ${test.versionA.sent} envios
                        <div class="metric-value">${test.successMetric}: ${test.versionA.metric_value}</div>
                    </div>
                    <div class="version-result">
                        <strong>Versão B:</strong> ${test.versionB.sent} envios
                        <div class="metric-value">${test.successMetric}: ${test.versionB.metric_value}</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="salesBot.stopABTest('${id}')">Parar Teste</button>
            `;
            container.appendChild(testDiv);
        });
    }

    stopABTest(testId) {
        const test = this.abTests.get(testId);
        if (!test) return;

        test.status = 'completed';
        this.abTests.set(testId, test);
        this.renderActiveTests();

        this.log(`🧪 Teste A/B finalizado: ${test.name}`, 'marketing');
        this.showNotification('Teste A/B finalizado!', 'info');
    }

    // Lead Management
    updateLeadsList() {
        const container = document.getElementById('leadsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.leads.size === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <h3>Nenhum lead cadastrado</h3>
                    <p>Os leads aparecerão aqui conforme interagirem com o bot</p>
                </div>
            `;
            return;
        }

        const leadsArray = Array.from(this.leads.values()).slice(0, 20); // Mostrar apenas os 20 mais recentes

        leadsArray.forEach(lead => {
            const leadDiv = document.createElement('div');
            leadDiv.className = 'lead-item';
            leadDiv.innerHTML = `
                <div class="lead-header">
                    <span class="lead-name">👤 ${lead.username}</span>
                    <span class="lead-status ${lead.status}">${this.getStatusName(lead.status)}</span>
                </div>
                <div class="lead-info">
                    <span>📅 ${lead.firstContact.toLocaleDateString()}</span>
                    <span>📊 ${lead.funnelStage}</span>
                    <span>💰 R$ ${lead.totalValue.toFixed(2)}</span>
                </div>
                <div class="lead-actions">
                    <button class="btn btn-sm btn-primary" onclick="salesBot.viewLeadDetails('${lead.id}')">Detalhes</button>
                    <button class="btn btn-sm btn-success" onclick="salesBot.contactLead('${lead.id}')">Contatar</button>
                </div>
            `;
            container.appendChild(leadDiv);
        });
    }

    getStatusName(status) {
        const names = {
            'new': 'Novo',
            'contacted': 'Contatado',
            'qualified': 'Qualificado',
            'converted': 'Convertido'
        };
        return names[status] || status;
    }

    filterLeads() {
        // Implementar filtros de leads
        this.updateLeadsList();
    }

    exportLeads() {
        const leadsData = Array.from(this.leads.values()).map(lead => ({
            id: lead.id,
            username: lead.username,
            status: lead.status,
            source: lead.source,
            firstContact: lead.firstContact,
            lastContact: lead.lastContact,
            funnelStage: lead.funnelStage,
            totalValue: lead.totalValue,
            conversions: lead.conversions
        }));

        const csvContent = this.convertToCSV(leadsData);
        this.downloadCSV(csvContent, 'leads-export.csv');
        this.showNotification('Leads exportados!', 'success');
    }

    // Funnel Management
    createFunnelStep() {
        this.showNotification('Funcionalidade em desenvolvimento', 'info');
    }

    optimizeFunnel() {
        // Simular otimização do funil
        let optimizations = [];

        const awarenessCount = this.salesFunnel.awareness.size;
        const interestCount = this.salesFunnel.interest.size;
        const considerationCount = this.salesFunnel.consideration.size;
        const purchaseCount = this.salesFunnel.purchase.size;

        const awarenessToInterest = awarenessCount > 0 ? (interestCount / awarenessCount) * 100 : 0;
        const interestToConsideration = interestCount > 0 ? (considerationCount / interestCount) * 100 : 0;
        const considerationToPurchase = considerationCount > 0 ? (purchaseCount / considerationCount) * 100 : 0;

        if (awarenessToInterest < 30) {
            optimizations.push('🎯 Melhore a estratégia de boas-vindas para aumentar o engajamento');
        }

        if (interestToConsideration < 50) {
            optimizations.push('🌱 Implemente uma sequência de nutrição mais efetiva');
        }

        if (considerationToPurchase < 20) {
            optimizations.push('💸 Use técnicas de fechamento mais persuasivas');
        }

        if (optimizations.length === 0) {
            optimizations.push('✅ Seu funil está otimizado! Continue monitorando a performance.');
        }

        const message = `🔍 Análise do Funil:\n\n${optimizations.join('\n\n')}`;
        this.showNotification('Análise concluída!', 'success');
        this.log('⚡ Otimização do funil executada', 'marketing');

        // Mostrar resultados
        alert(message);
    }

    analyzeFunnel() {
        const awarenessCount = this.salesFunnel.awareness.size;
        const interestCount = this.salesFunnel.interest.size;
        const considerationCount = this.salesFunnel.consideration.size;
        const purchaseCount = this.salesFunnel.purchase.size;

        const analysis = `
📊 ANÁLISE DO FUNIL DE VENDAS

🎯 Consciência: ${awarenessCount} leads
🤔 Interesse: ${interestCount} leads
💭 Consideração: ${considerationCount} leads
💰 Compra: ${purchaseCount} conversões

📈 Taxas de Conversão:
• Consciência → Interesse: ${awarenessCount > 0 ? ((interestCount / awarenessCount) * 100).toFixed(1) : 0}%
• Interesse → Consideração: ${interestCount > 0 ? ((considerationCount / interestCount) * 100).toFixed(1) : 0}%
• Consideração → Compra: ${considerationCount > 0 ? ((purchaseCount / considerationCount) * 100).toFixed(1) : 0}%

💡 Taxa de Conversão Geral: ${awarenessCount > 0 ? ((purchaseCount / awarenessCount) * 100).toFixed(1) : 0}%
        `;

        alert(analysis);
        this.log('📊 Análise do funil gerada', 'marketing');
    }

    updateFunnelDisplay() {
        document.getElementById('awarenessCount').textContent = this.salesFunnel.awareness.size;
        document.getElementById('interestCount').textContent = this.salesFunnel.interest.size;
        document.getElementById('considerationCount').textContent = this.salesFunnel.consideration.size;
        document.getElementById('purchaseCount').textContent = this.salesFunnel.purchase.size;
    }

    // Sales Metrics
    updateSalesMetrics() {
        document.getElementById('totalRevenue').textContent = `R$ ${this.salesMetrics.totalRevenue.toFixed(2)}`;
        document.getElementById('conversions').textContent = this.salesMetrics.conversions;
        document.getElementById('totalLeads').textContent = this.salesMetrics.totalLeads;

        const conversionRate = this.salesMetrics.totalLeads > 0 ? 
            (this.salesMetrics.conversions / this.salesMetrics.totalLeads * 100).toFixed(1) : 0;
        document.getElementById('conversionRate').textContent = `${conversionRate}%`;

        document.getElementById('activeLeads').textContent = this.leads.size;
        document.getElementById('todayConversations').textContent = this.getTodayConversations();

        this.updateFunnelDisplay();
    }

    getTodayConversations() {
        const today = new Date().toDateString();
        return Array.from(this.leads.values()).filter(lead => 
            lead.lastContact.toDateString() === today
        ).length;
    }

    // Support Management
    updateSupportMetrics() {
        // Simular métricas de suporte
        document.getElementById('openTickets').textContent = Math.floor(Math.random() * 10);
        document.getElementById('avgResponseTime').textContent = `${Math.floor(Math.random() * 24)}h`;
    }

    viewSupportTickets() {
        this.showNotification('Abrindo central de tickets...', 'info');
        this.log('🎫 Visualização de tickets acessada', 'system');
    }

    // Integration Management
    connectIntegration(type) {
        const integrations = {
            'payment': 'Gateway de Pagamento',
            'email': 'Email Marketing',
            'whatsapp': 'WhatsApp Business',
            'analytics': 'Google Analytics'
        };

        const name = integrations[type];
        this.showNotification(`Conectando ${name}...`, 'info');

        // Simular conexão
        setTimeout(() => {
            const element = document.getElementById(type === 'payment' ? 'paymentGateway' : 
                                                 type === 'email' ? 'emailMarketing' :
                                                 type === 'whatsapp' ? 'whatsappBusiness' : 'googleAnalytics');

            if (element) {
                element.textContent = 'Conectado';
                element.className = 'integration-status connected';
            }

            this.showNotification(`${name} conectado com sucesso!`, 'success');
            this.log(`🔗 Integração conectada: ${name}`, 'system');
        }, 2000);
    }

    // Charts and Analytics
    initializeCharts() {
        // Simular dados dos gráficos
        this.updateCharts();
    }

    updateCharts() {
        // Atualizar gráficos com dados simulados
        const period = document.getElementById('chartPeriod')?.value || 7;

        // Simular dados baseados no período
        for (let i = 0; i < period; i++) {
            this.salesMetrics.revenueByDay[i] = Math.random() * 1000;
            this.salesMetrics.conversionsByDay[i] = Math.floor(Math.random() * 20);
        }

        this.drawCharts();
    }

    drawCharts() {
        // Revenue Chart
        const revenueCanvas = document.getElementById('revenueChart');
        if (revenueCanvas) {
            this.drawChart(revenueCanvas, this.salesMetrics.revenueByDay, 'Receita', '#10b981');
        }

        // Funnel Chart
        const funnelCanvas = document.getElementById('funnelChart');
        if (funnelCanvas) {
            const funnelData = [
                this.salesFunnel.awareness.size,
                this.salesFunnel.interest.size,
                this.salesFunnel.consideration.size,
                this.salesFunnel.purchase.size
            ];
            this.drawChart(funnelCanvas, funnelData, 'Funil', '#3b82f6');
        }

        // Campaign Chart
        const campaignCanvas = document.getElementById('campaignChart');
        if (campaignCanvas) {
            const campaignData = Array.from(this.campaigns.values()).map(c => c.sent);
            this.drawChart(campaignCanvas, campaignData, 'Campanhas', '#8b5cf6');
        }
    }

    drawChart(canvas, data, title, color) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const maxValue = Math.max(...data) || 1;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw bars
        const barWidth = width / data.length;

        data.forEach((value, index) => {
            const barHeight = (value / maxValue) * (height - 40);
            const x = index * barWidth;
            const y = height - barHeight - 20;

            // Gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, color + '80');

            ctx.fillStyle = gradient;
            ctx.fillRect(x + 2, y, barWidth - 4, barHeight);

            // Value on top
            ctx.fillStyle = '#374151';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(value.toString(), x + barWidth/2, y - 5);
        });
    }

    generateReport() {
        const report = {
            period: document.getElementById('chartPeriod').value,
            totalRevenue: this.salesMetrics.totalRevenue,
            totalLeads: this.salesMetrics.totalLeads,
            conversions: this.salesMetrics.conversions,
            conversionRate: this.salesMetrics.totalLeads > 0 ? (this.salesMetrics.conversions / this.salesMetrics.totalLeads * 100).toFixed(1) : 0,
            funnelData: {
                awareness: this.salesFunnel.awareness.size,
                interest: this.salesFunnel.interest.size,
                consideration: this.salesFunnel.consideration.size,
                purchase: this.salesFunnel.purchase.size
            },
            campaigns: this.campaigns.size,
            products: this.products.size
        };

        const reportText = `
RELATÓRIO DE VENDAS - ${new Date().toLocaleDateString()}

📊 MÉTRICAS PRINCIPAIS:
• Receita Total: R$ ${report.totalRevenue.toFixed(2)}
• Total de Leads: ${report.totalLeads}
• Conversões: ${report.conversions}
• Taxa de Conversão: ${report.conversionRate}%

🔄 FUNIL DE VENDAS:
• Consciência: ${report.funnelData.awareness}
• Interesse: ${report.funnelData.interest}
• Consideração: ${report.funnelData.consideration}
• Compra: ${report.funnelData.purchase}

📢 CAMPANHAS: ${report.campaigns} ativas
🛍️ PRODUTOS: ${report.products} cadastrados

Período: Últimos ${report.period} dias
        `;

        // Download report
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-vendas-${new Date().toISOString().split('T')[0]}.txt`;
        link.click();
        URL.revokeObjectURL(url);

        this.showNotification('Relatório gerado e baixado!', 'success');
        this.log('📄 Relatório de vendas gerado', 'system');
    }

    // Utility Methods
    async sendMessage(userId, message, buttons = null) {
        try {
            const payload = {
                chat_id: userId,
                text: message,
                parse_mode: 'Markdown'
            };

            if (buttons) {
                payload.reply_markup = {
                    inline_keyboard: buttons
                };
            }

            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.ok) {
                this.log(`📤 Mensagem enviada para ${userId}`, 'system');
            } else {
                this.log(`❌ Erro ao enviar mensagem: ${data.description}`, 'error');
            }
        } catch (error) {
            this.log(`❌ Erro ao enviar mensagem: ${error.message}`, 'error');
        }
    }

    async checkBotStatus() {
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            const data = await response.json();

            if (data.ok && this.botRunning) {
                this.updateBotStatus(true);
            }
        } catch (error) {
            this.log(`⚠️ Erro ao verificar status: ${error.message}`, 'error');
        }
    }

    updateBotStatus(online) {
        const statusElement = document.getElementById('botStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');

        if (online) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Online';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Offline';
        }
    }

    // Data Management
    loadSampleProducts() {
        const sampleProducts = [
            {
                id: '1',
                name: 'Curso de Marketing Digital',
                description: 'Aprenda estratégias avançadas de marketing digital com especialistas da área',
                price: 297.00,
                category: 'course',
                commission: 15,
                sales: 45,
                revenue: 13365.00,
                createdAt: new Date()
            },
            {
                id: '2',
                name: 'Consultoria de Vendas',
                description: 'Consultoria personalizada para otimizar seus processos de vendas',
                price: 500.00,
                category: 'consultation',
                commission: 20,
                sales: 23,
                revenue: 11500.00,
                createdAt: new Date()
            },
            {
                id: '3',
                name: 'E-book: Funil de Vendas',
                description: 'Guia completo para criar funis de vendas que convertem',
                price: 47.00,
                category: 'digital',
                commission: 30,
                sales: 156,
                revenue: 7332.00,
                createdAt: new Date()
            }
        ];

        sampleProducts.forEach(product => {
            this.products.set(product.id, product);
            this.salesMetrics.totalRevenue += product.revenue;
            this.salesMetrics.conversions += product.sales;
        });

        this.renderProductsList();
    }

    loadSalesData() {
        const saved = localStorage.getItem('salesBotData');
        if (saved) {
            const data = JSON.parse(saved);
            this.salesMetrics = { ...this.salesMetrics, ...data.salesMetrics };

            if (data.leads) {
                this.leads = new Map(data.leads);
            }

            if (data.products) {
                this.products = new Map(data.products);
            }

            if (data.campaigns) {
                this.campaigns = new Map(data.campaigns);
            }
        }
    }

    saveSalesData() {
        const data = {
            salesMetrics: this.salesMetrics,
            leads: Array.from(this.leads.entries()),
            products: Array.from(this.products.entries()),
            campaigns: Array.from(this.campaigns.entries()),
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('salesBotData', JSON.stringify(data));
    }

    loadMarketingStrategies() {
        const saved = localStorage.getItem('marketingStrategies');
        if (saved) {
            this.marketingStrategies = { ...this.marketingStrategies, ...JSON.parse(saved) };
        }
    }

    saveMarketingStrategies() {
        localStorage.setItem('marketingStrategies', JSON.stringify(this.marketingStrategies));
    }

    saveProducts() {
        this.saveSalesData();
    }

    // Utility functions
    log(message, type = 'system') {
        const logsContainer = document.getElementById('logs');
        if (!logsContainer) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span>${message}`;

        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;

        // Manter apenas os últimos 200 logs
        const logs = logsContainer.querySelectorAll('.log-entry');
        if (logs.length > 200) {
            logs[0].remove();
        }
    }

    clearLogs() {
        const logsContainer = document.getElementById('logs');
        if (logsContainer) {
            logsContainer.innerHTML = '';
        }
        this.log('🗑️ Logs limpos', 'system');
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

    exportLogs() {
        const logs = document.getElementById('logs').textContent;
        const dataBlob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `sales-bot-logs-${new Date().toISOString().split('T')[0]}.txt`;
        link.click();

        URL.revokeObjectURL(url);
        this.showNotification('Logs exportados!', 'success');
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

    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value}"` : value;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    }

    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    saveBotState(isRunning) {
        localStorage.setItem('salesBotRunning', JSON.stringify(isRunning));
        if (isRunning) {
            localStorage.setItem('salesBotLastUpdateId', this.lastUpdateId.toString());
        }
    }

    loadBotState() {
        const saved = localStorage.getItem('salesBotRunning');
        if (saved) {
            const isRunning = JSON.parse(saved);
            if (isRunning) {
                const savedUpdateId = localStorage.getItem('salesBotLastUpdateId');
                if (savedUpdateId) {
                    this.lastUpdateId = parseInt(savedUpdateId) || 0;
                }
            }
            return isRunning;
        }
        return false;
    }

    async resumeBot() {
        this.log('🔄 Retomando Sales Bot após atualização...', 'system');

        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
            const data = await response.json();

            if (!data.ok) {
                throw new Error('Token inválido ou bot não encontrado');
            }

            this.updateBotStatus(true);
            this.log(`✅ Sales Bot retomado: @${data.result.username}`, 'system');
            this.showNotification('Sales Bot retomado automaticamente!', 'info');

            this.startPolling();
        } catch (error) {
            this.log(`❌ Erro ao retomar bot: ${error.message}`, 'error');
            this.botRunning = false;
            this.saveBotState(false);
            this.updateBotStatus(false);
            this.showNotification('Erro ao retomar bot - inicie manualmente', 'warning');
        }
    }

    handleCallbackQuery(callbackQuery) {
        const userId = callbackQuery.from.id;
        const username = callbackQuery.from.username || callbackQuery.from.first_name;
        const data = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;

        this.log(`↩️ Callback Query de ${username} (${userId}): ${data}`, 'sales');

        // Processar o callback data
        this.processCallbackData(data, userId, messageId);
    }

    async processCallbackData(data, userId, messageId) {
        switch (data) {
            case 'ver_catalogo':
                const catalog = this.generateProductCatalog();
                this.sendMessage(userId, catalog);
                break;
            case 'falar_com_atendente':
                this.sendMessage(userId, 'Você será conectado a um atendente em breve.');
                this.createSupportTicket(userId);
                break;
            default:
                this.sendMessage(userId, 'Opção inválida.');
        }

        // Remover os botões da mensagem original
        await this.removeInlineKeyboard(userId, messageId);
    }

    async removeInlineKeyboard(userId, messageId) {
        try {
            const payload = {
                chat_id: userId,
                message_id: messageId
            };

            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/editMessageReplyMarkup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.ok) {
                this.log(`⌨️ Inline keyboard removido da mensagem ${messageId} para ${userId}`, 'system');
            } else {
                this.log(`❌ Erro ao remover inline keyboard: ${data.description}`, 'error');
            }
        } catch (error) {
            this.log(`❌ Erro ao remover inline keyboard: ${error.message}`, 'error');
        }
    }
}

// Initialize the Sales Bot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.salesBot = new SalesBot();

    // Auto-save data every 5 minutes
    setInterval(() => {
        window.salesBot.saveSalesData();
        window.salesBot.saveMarketingStrategies();
    }, 300000);
});
