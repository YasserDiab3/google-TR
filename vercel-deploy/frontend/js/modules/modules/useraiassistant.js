/**
 * UserAIAssistant Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
const UserAIAssistant = {
    isOpen: false,
    conversationHistory: [],
    context: {
        currentModule: null,
        currentTopic: null,
        lastIntent: null,
        mentionedEntities: []
    },
    // مراجع لتنظيف الموارد
    _smartAlertsInterval: null,
    _eventListenersAbortController: null,

    /**
     * تحميل الموديول
     */
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('useraiassistant-section');
        if (!section) {
            // محاولة البحث عن قسم بديل
            const altSection = document.getElementById('user-ai-assistant-section');
            if (altSection) {
                // تهيئة المساعد فقط إذا كان موجوداً في مكان آخر
                this.init();
                return;
            }
            return;
        }

        try {
            // إذا كان القسم موجوداً، يمكن إضافة محتوى إضافي هنا
            // لكن المساعد يعمل بشكل عائم، لذا نكتفي بالتهيئة
            // إضافة محتوى توضيحي في القسم
            section.innerHTML = `
                <div class="section-header">
                    <h1 class="section-title">
                        <i class="fas fa-robot ml-3"></i>
                        مساعد المستخدم الذكي
                    </h1>
                    <p class="section-subtitle">مساعد ذكي متاح في جميع أنحاء التطبيق</p>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="text-center py-8">
                            <i class="fas fa-comments text-6xl text-blue-500 mb-4"></i>
                            <h3 class="text-xl font-semibold mb-2">المساعد الذكي متاح الآن</h3>
                            <p class="text-gray-600 mb-4">يمكنك الوصول إلى المساعد الذكي من خلال الزر العائم في الزاوية السفلية اليمنى</p>
                            <button onclick="UserAIAssistant.toggle()" class="btn-primary">
                                <i class="fas fa-comment-dots ml-2"></i>
                                فتح المساعد
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // تهيئة المساعد
            this.init();
        } catch (error) {
            Utils.safeError('خطأ في تحميل UserAIAssistant:', error);
            if (section) {
                section.innerHTML = `
                    <div class="section-header">
                        <h1 class="section-title">
                            <i class="fas fa-robot ml-3"></i>
                            مساعد المستخدم الذكي
                        </h1>
                    </div>
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500">حدث خطأ في تحميل الموديول</p>
                                <button onclick="UserAIAssistant.load()" class="btn-primary mt-4">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    },

    /**
     * تهيئة المساعد
     */
    init() {
        // منع التهيئة المزدوجة — إذا تم تهيئة المساعد مسبقاً نتجاهل الاستدعاء
        if (this._initialized) return;
        this._initialized = true;

        // إخفاء الزر في شاشة تسجيل الدخول
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        const assistantBtn = document.getElementById('user-ai-assistant-btn');
        const chatWindow = document.getElementById('user-ai-assistant-chat');

        if (!assistantBtn || !chatWindow) {
            this._initialized = false; // السماح بإعادة المحاولة إذا لم تُوجد العناصر بعد
            return;
        }

        // إظهار/إخفاء الزر حسب حالة التطبيق
        const updateButtonVisibility = () => {
            if (mainApp && mainApp.style.display !== 'none') {
                assistantBtn.style.display = 'flex';
            } else {
                assistantBtn.style.display = 'none';
                this.close();
            }
        };

        // مراقبة تغييرات العرض
        const observer = new MutationObserver(updateButtonVisibility);
        if (mainApp) {
            observer.observe(mainApp, { attributes: true, attributeFilter: ['style'] });
        }
        updateButtonVisibility();

        // فتح/إغلاق النافذة
        assistantBtn.addEventListener('click', () => {
            this.toggle();
        });

        document.getElementById('user-ai-assistant-close')?.addEventListener('click', () => {
            this.close();
        });

        // زر مسح المحادثة
        document.getElementById('user-ai-assistant-clear')?.addEventListener('click', () => {
            if (confirm('هل تريد مسح المحادثة؟')) {
                this.clearConversation();
            }
        });

        // إرسال الرسالة عند الضغط على Enter
        const input = document.getElementById('user-ai-assistant-input');
        const sendBtn = document.getElementById('user-ai-assistant-send');

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // أزرار الإجراءات السريعة
        document.querySelectorAll('.user-ai-quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // فحص التنبيهات الذكية
        this.checkSmartAlerts();

        // تنظيف interval القديم إن وجد
        if (this._smartAlertsInterval) {
            clearInterval(this._smartAlertsInterval);
        }

        // تحديث التنبيهات كل 5 دقائق
        this._smartAlertsInterval = setInterval(() => {
            this.checkSmartAlerts();
        }, 5 * 60 * 1000);

        Utils.safeLog('✅ تم تهيئة مساعد المستخدم الذكي');
    },

    /**
     * فتح/إغلاق نافذة المحادثة
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    /**
     * فتح نافذة المحادثة
     */
    async open() {
        const chatWindow = document.getElementById('user-ai-assistant-chat');
        if (chatWindow) {
            chatWindow.style.display = 'flex';
            this.isOpen = true;
            // التركيز على حقل الإدخال
            setTimeout(() => {
                document.getElementById('user-ai-assistant-input')?.focus();
            }, 100);

            // عرض توصيات ذكية تلقائية عند الفتح (إذا كانت المحادثة فارغة)
            if (this.conversationHistory.length <= 1) {
                await this.showSmartRecommendations();
            }
        }
    },

    /**
     * عرض توصيات ذكية تلقائية
     */
    async showSmartRecommendations() {
        try {
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                const context = {
                    userId: AppState.currentUser?.email || AppState.currentUser?.id || 'unknown',
                    userName: AppState.currentUser?.name || AppState.currentUser?.displayName || 'Unknown',
                    userRole: AppState.currentUser?.role || 'user'
                };

                try {
                    const recommendations = await GoogleIntegration.sendToAppsScript('getSmartRecommendations', {
                        userId: context.userId,
                        context: context
                    });

                    if (recommendations && recommendations.success && recommendations.recommendations && recommendations.recommendations.length > 0) {
                        // عرض التوصيات بعد رسالة الترحيب
                        setTimeout(() => {
                            const topRecommendations = recommendations.recommendations.slice(0, 3);
                            let recommendationText = '💡 توصيات ذكية:\n\n';

                            topRecommendations.forEach((rec, index) => {
                                const priorityIcon = {
                                    'urgent': '🔴',
                                    'high': '🟠',
                                    'medium': '🟡',
                                    'low': '🟢'
                                };
                                recommendationText += `${priorityIcon[rec.priority] || '•'} ${rec.title}\n`;
                                recommendationText += `   ${rec.description}\n\n`;
                            });

                            this.addMessage('assistant', recommendationText, [], {
                                isRecommendation: true
                            });
                        }, 1000);
                    }
                } catch (error) {
                    Utils.safeWarn('خطأ في جلب التوصيات:', error);
                }
            }
        } catch (error) {
            Utils.safeWarn('خطأ في عرض التوصيات:', error);
        }
    },

    /**
     * إغلاق نافذة المحادثة
     */
    close() {
        const chatWindow = document.getElementById('user-ai-assistant-chat');
        if (chatWindow) {
            chatWindow.style.display = 'none';
            this.isOpen = false;
            // لا نعيد تعيين السياق عند الإغلاق، للحفاظ على السياق عند إعادة الفتح
        }
    },

    /**
     * مسح المحادثة
     */
    clearConversation() {
        const messagesContainer = document.getElementById('user-ai-assistant-messages');
        if (messagesContainer) {
            // الاحتفاظ بالرسالة الترحيبية فقط
            const welcomeMessage = messagesContainer.querySelector('.user-ai-message-assistant:first-child');
            messagesContainer.innerHTML = '';
            if (welcomeMessage) {
                messagesContainer.appendChild(welcomeMessage);
            } else {
                // إضافة رسالة ترحيبية جديدة
                this.addMessage('assistant', 'مرحباً! أنا مساعد النظام. كيف يمكنني مساعدتك اليوم؟');
            }
        }

        // إعادة تعيين السياق
        this.resetContext();

        // مسح السجل
        this.conversationHistory = [];
    },

    /**
     * إرسال رسالة
     */
    async sendMessage() {
        const input = document.getElementById('user-ai-assistant-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // إضافة رسالة المستخدم
        this.addMessage('user', message);
        input.value = '';

        // إظهار حالة التحميل
        const loadingId = this.showLoading();

        // قياس وقت الاستجابة
        const startTime = Date.now();

        try {
            // معالجة الرسالة والحصول على الرد
            const response = await this.processMessage(message);

            // حساب وقت الاستجابة
            const responseTime = Date.now() - startTime;
            response.responseTime = responseTime;

            // إزالة حالة التحميل
            this.hideLoading(loadingId);

            // إضافة رد المساعد مع البيانات الإضافية
            this.addMessage('assistant', response.text, response.actions, {
                responseTime: response.responseTime,
                module: response.module,
                intent: response.intent,
                data: response.data
            });

            // تسجيل السؤال
            this.logQuestion(message, response);

        } catch (error) {
            this.hideLoading(loadingId);
            this.addMessage('assistant', 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.');
            Utils.safeError('خطأ في معالجة الرسالة:', error);
        }
    },

    /**
     * إضافة رسالة إلى المحادثة
     */
    addMessage(type, text, actions = [], metadata = {}) {
        const messagesContainer = document.getElementById('user-ai-assistant-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `user-ai-message user-ai-message-${type}`;

        const avatar = document.createElement('div');
        avatar.className = 'user-ai-message-avatar';
        avatar.innerHTML = type === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const content = document.createElement('div');
        content.className = 'user-ai-message-content';

        // معالجة النص (دعم الأسطر المتعددة والتنسيق) — منع عرض رد فارغ
        const displayText = (text !== undefined && text !== null && String(text).trim()) ? text : 'لم أتمكن من إرجاع رد. يرجى صياغة السؤال بشكل أوضح أو المحاولة لاحقاً.';
        const textContent = this.formatMessageText(displayText);
        content.appendChild(textContent);

        // إضافة معلومات إضافية (وقت الاستجابة، الموديول، إلخ)
        if (metadata.responseTime && type === 'assistant') {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'user-ai-message-meta';
            metaDiv.innerHTML = `<span class="text-xs text-gray-500">⏱️ ${metadata.responseTime}ms</span>`;
            if (metadata.module) {
                metaDiv.innerHTML += ` <span class="text-xs text-gray-500">• ${this.getModuleDisplayName(metadata.module)}</span>`;
            }
            content.appendChild(metaDiv);
        }

        // إضافة أزرار الإجراءات السريعة
        if (actions.length > 0) {
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'user-ai-quick-buttons';

            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'user-ai-quick-button';
                button.innerHTML = `<i class="${action.icon || 'fas fa-arrow-left'}"></i> ${action.label}`;
                button.addEventListener('click', () => {
                    if (action.action === 'navigate') {
                        this.navigateToPage(action.target);
                    } else if (action.action === 'open') {
                        this.openModule(action.target);
                    }
                });
                buttonsDiv.appendChild(button);
            });

            content.appendChild(buttonsDiv);
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        messagesContainer.appendChild(messageDiv);

        // التمرير إلى الأسفل مع تأثير سلس
        setTimeout(() => {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);

        // حفظ في السجل
        this.conversationHistory.push({
            type,
            text,
            timestamp: new Date().toISOString(),
            metadata: metadata
        });

        // الاحتفاظ بآخر 50 رسالة في الذاكرة
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }
    },

    /**
     * تنسيق نص الرسالة (دعم الأسطر المتعددة، الرموز التعبيرية، إلخ)
     */
    formatMessageText(text) {
        const container = document.createElement('div');
        container.className = 'user-ai-message-text';

        if (!text) {
            container.textContent = '';
            return container;
        }

        // تقسيم النص إلى أسطر
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            if (line.trim() === '') {
                // سطر فارغ
                container.appendChild(document.createElement('br'));
            } else {
                const p = document.createElement('p');
                p.textContent = line;

                // تنسيق خاص للعناوين (تبدأ بـ • أو رقم)
                if (line.match(/^[•\d\-]/)) {
                    p.className = 'user-ai-message-list-item';
                }

                // تنسيق خاص للعناوين (تبدأ برموز)
                if (line.match(/^[📊🔍💡⚠️✅🔴🟠🟡🟢]/)) {
                    p.className = 'user-ai-message-heading';
                }

                container.appendChild(p);
            }
        });

        return container;
    },

    /**
     * الحصول على اسم الموديول للعرض
     */
    getModuleDisplayName(module) {
        const names = {
            'incidents': 'الحوادث',
            'nearmiss': 'الحوادث الوشيكة',
            'training': 'التدريب',
            'budget': 'الميزانية',
            'ptw': 'تصاريح العمل',
            'inspection': 'الفحوصات',
            'clinic': 'العيادة',
            'kpi': 'مؤشرات الأداء',
            'violations': 'المخالفات',
            'actions': 'الإجراءات'
        };

        return names[module] || module;
    },

    /**
     * إظهار حالة التحميل
     */
    showLoading() {
        const messagesContainer = document.getElementById('user-ai-assistant-messages');
        if (!messagesContainer) return null;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'user-ai-message user-ai-message-assistant';
        loadingDiv.id = 'user-ai-loading-' + Date.now();

        const avatar = document.createElement('div');
        avatar.className = 'user-ai-message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';

        const content = document.createElement('div');
        content.className = 'user-ai-message-content';
        content.innerHTML = `
            <div class="user-ai-loading">
                <div class="user-ai-loading-dot"></div>
                <div class="user-ai-loading-dot"></div>
                <div class="user-ai-loading-dot"></div>
            </div>
        `;

        loadingDiv.appendChild(avatar);
        loadingDiv.appendChild(content);
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return loadingDiv.id;
    },

    /**
     * إخفاء حالة التحميل
     */
    hideLoading(loadingId) {
        if (loadingId) {
            const loadingElement = document.getElementById(loadingId);
            if (loadingElement) {
                loadingElement.remove();
            }
        }
    },

    /**
     * معالجة الرسالة والحصول على الرد
     */
    async processMessage(message) {
        try {
            // تحسين السؤال باستخدام السياق
            const enhancedMessage = this.enhanceMessageWithContext(message);
            
            // استخدام خدمة AIAssistant الجديدة إذا كانت متاحة
            if (typeof AIAssistant !== 'undefined' && AIAssistant.ask) {
                try {
                    const response = await AIAssistant.ask(enhancedMessage, {
                        userId: AppState.currentUser?.id || null,
                        userName: AppState.currentUser?.name || null,
                        userRole: AppState.currentUser?.role || null,
                        conversationHistory: this.conversationHistory.slice(-5)
                    });
                    
                    if (response) {
                        // تحديث السياق عند النجاح
                        if (response.success) this.updateContext(enhancedMessage, response);
                        // إرجاع النص دائماً (حتى عند عدم العثور على موظف) لتفادي رد فارغ
                        const text = response.text || response.message;
                        if (text) {
                            return {
                                text: text,
                                data: response.data,
                                intent: response.intent,
                                module: response.module,
                                actions: response.actions || []
                            };
                        }
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في استخدام AIAssistant:', error);
                    // الاستمرار في الطريقة القديمة كـ fallback
                }
            }
            
            // الطريقة القديمة (fallback)
            return await this.processMessageOld(message);
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة الرسالة:', error);
            return {
                text: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.',
                actions: []
            };
        }
    },
    
    async processMessageOld(message) {
        try {
            // تحسين السؤال باستخدام السياق
            const enhancedMessage = this.enhanceMessageWithContext(message);

            // محاولة استخدام Backend AI أولاً
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                const context = {
                    userId: AppState.currentUser?.email || AppState.currentUser?.id || 'unknown',
                    userName: AppState.currentUser?.name || AppState.currentUser?.displayName || 'Unknown',
                    userRole: AppState.currentUser?.role || 'user',
                    conversationHistory: this.conversationHistory.slice(-5), // آخر 5 رسائل
                    currentModule: this.context.currentModule,
                    currentTopic: this.context.currentTopic,
                    lastIntent: this.context.lastIntent,
                    mentionedEntities: this.context.mentionedEntities
                };

                try {
                    const aiResponse = await GoogleIntegration.sendToAppsScript('processAIQuestion', {
                        question: enhancedMessage,
                        context: context
                    });

                    if (aiResponse && aiResponse.success) {
                        // تحديث السياق
                        this.updateContext(enhancedMessage, aiResponse);

                        // استخدام رد Backend AI
                        return {
                            text: aiResponse.text || aiResponse.message || 'تمت المعالجة',
                            data: aiResponse.data || null,
                            intent: aiResponse.intent || null,
                            module: aiResponse.module || null,
                            actions: aiResponse.actions || [],
                            responseTime: aiResponse.responseTime || 0
                        };
                    }
                } catch (backendError) {
                    Utils.safeWarn('خطأ في الاتصال بـ Backend AI، استخدام المعالجة المحلية:', backendError);
                    // الاستمرار في المعالجة المحلية
                }
            }

            // المعالجة المحلية (fallback)
            const response = await this.processMessageLocal(enhancedMessage);

            // تحديث السياق حتى في المعالجة المحلية
            this.updateContext(enhancedMessage, response);

            return response;

        } catch (error) {
            Utils.safeError('خطأ في معالجة الرسالة:', error);
            return {
                text: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.',
                actions: []
            };
        }
    },

    /**
     * تحسين الرسالة باستخدام السياق
     */
    enhanceMessageWithContext(message) {
        let enhanced = message;

        // إذا كان السؤال قصيراً والسياق موجود، أضف معلومات السياق
        if (message.length < 20 && this.context.currentModule) {
            // إضافة الموديول الحالي إذا كان السؤال عاماً
            const moduleName = this.getModuleDisplayName(this.context.currentModule);
            if (!message.toLowerCase().includes(moduleName.toLowerCase()) &&
                !message.toLowerCase().includes(this.context.currentModule.toLowerCase())) {
                // لا نضيف تلقائياً، بل نستخدم السياق في المعالجة
            }
        }

        // إذا كان هناك موضوع حالي، أضفه للسياق
        if (this.context.currentTopic && !message.toLowerCase().includes(this.context.currentTopic.toLowerCase())) {
            // استخدام السياق في المعالجة
        }

        return enhanced;
    },

    /**
     * تحديث السياق بناءً على الرسالة والرد
     */
    updateContext(message, response) {
        // تحديث الموديول الحالي
        if (response.module) {
            this.context.currentModule = response.module;
        }

        // تحديث النية الأخيرة
        if (response.intent) {
            this.context.lastIntent = response.intent.type || response.intent;
        }

        // استخراج الكيانات المذكورة من الرسالة
        this.extractEntities(message);

        // تحديث الموضوع الحالي
        if (response.module) {
            this.context.currentTopic = this.getModuleDisplayName(response.module);
        }
    },

    /**
     * استخراج الكيانات من الرسالة
     */
    extractEntities(message) {
        const lowerMessage = message.toLowerCase();

        // استخراج أسماء الإدارات
        const departments = ['إنتاج', 'صيانة', 'أمن', 'سلامة', 'إدارة', 'موارد بشرية'];
        departments.forEach(dept => {
            if (lowerMessage.includes(dept.toLowerCase())) {
                if (!this.context.mentionedEntities.includes(dept)) {
                    this.context.mentionedEntities.push(dept);
                }
            }
        });

        // الاحتفاظ بآخر 10 كيانات
        if (this.context.mentionedEntities.length > 10) {
            this.context.mentionedEntities = this.context.mentionedEntities.slice(-10);
        }
    },

    /**
     * إعادة تعيين السياق
     */
    resetContext() {
        this.context = {
            currentModule: null,
            currentTopic: null,
            lastIntent: null,
            mentionedEntities: []
        };
    },

    /**
     * معالجة محلية للرسالة (fallback)
     */
    async processMessageLocal(message) {
        const lowerMessage = message.toLowerCase();

        // البحث عن الكلمات المفتاحية
        if (this.matchesKeywords(lowerMessage, ['حادث', 'incident', 'سجل حادث', 'report incident'])) {
            return this.handleIncidentQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['تدريب', 'training', 'برنامج تدريبي', 'training program'])) {
            return this.handleTrainingQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['ميزانية', 'budget', 'إنفاق', 'spending'])) {
            return this.handleBudgetQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['تصريح', 'permit', 'ptw', 'work permit'])) {
            return this.handlePermitQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['فحص', 'inspection', 'فحص دوري', 'periodic inspection'])) {
            return this.handleInspectionQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['عيادة', 'clinic', 'طبي', 'medical'])) {
            return this.handleClinicQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['مؤشر', 'kpi', 'أداء', 'performance'])) {
            return this.handleKPIQuestion();
        }

        if (this.matchesKeywords(lowerMessage, ['مساعدة', 'help', 'كيف', 'how', 'استخدام', 'use'])) {
            return this.handleHelpQuestion();
        }

        // رد افتراضي محسّن
        return {
            text: 'أنا هنا لمساعدتك! يمكنك أن تسألني عن:\n\n' +
                '• تحليل البيانات والإحصائيات\n' +
                '• البحث في السجلات\n' +
                '• العد والإحصائيات\n' +
                '• التحقق من الحالة\n' +
                '• التوصيات الذكية\n\n' +
                'جرب أن تسألني:\n' +
                '• "ما عدد الحوادث هذا الشهر؟"\n' +
                '• "تحليل بيانات التدريب"\n' +
                '• "ما حالة الميزانية؟"\n' +
                '• "أعطني توصيات"',
            actions: [
                { label: 'فتح الحوادث', icon: 'fas fa-exclamation-triangle', action: 'navigate', target: 'incidents' },
                { label: 'فتح التدريب', icon: 'fas fa-graduation-cap', action: 'navigate', target: 'training' },
                { label: 'فتح الميزانية', icon: 'fas fa-wallet', action: 'navigate', target: 'safety-budget' }
            ]
        };
    },

    /**
     * التحقق من وجود كلمات مفتاحية في الرسالة
     */
    matchesKeywords(message, keywords) {
        return keywords.some(keyword => message.includes(keyword.toLowerCase()));
    },

    /**
     * معالجة سؤال عن الحوادث
     */
    handleIncidentQuestion() {
        const incidents = AppState.appData?.incidents || [];
        const recentIncidents = incidents.filter(i => {
            const date = new Date(i.date || i.createdAt);
            const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
            return daysAgo <= 30;
        }).length;

        const highSeverity = incidents.filter(i => i.severity === 'عالية' || i.severity === 'high').length;

        let text = `📊 معلومات عن الحوادث:\n\n`;
        text += `• إجمالي الحوادث المسجلة: ${incidents.length}\n`;
        text += `• الحوادث خلال آخر 30 يوم: ${recentIncidents}\n`;
        text += `• الحوادث عالية الخطورة: ${highSeverity}\n\n`;
        text += `لتسجيل حادث جديد، انتقل إلى صفحة الحوادث واضغط على "إضافة حادث جديد".`;

        return {
            text,
            actions: [
                { label: 'فتح صفحة الحوادث', icon: 'fas fa-exclamation-triangle', action: 'navigate', target: 'incidents' },
                { label: 'إضافة حادث جديد', icon: 'fas fa-plus', action: 'open', target: 'incidents' }
            ]
        };
    },

    /**
     * معالجة سؤال عن التدريب
     */
    handleTrainingQuestion() {
        const trainings = AppState.appData?.training || [];
        const completed = trainings.filter(t => t.status === 'مكتمل' || t.status === 'completed').length;
        const upcoming = trainings.filter(t => t.status === 'مخطط' || t.status === 'planned').length;
        const totalParticipants = typeof Training !== 'undefined' && Training.getParticipantsCount
            ? trainings.reduce((sum, t) => sum + Training.getParticipantsCount(t), 0)
            : trainings.reduce((sum, t) => sum + (t.participants?.length || t.participantsCount || 0), 0);

        let text = `🎓 معلومات عن التدريب:\n\n`;
        text += `• إجمالي البرامج التدريبية: ${trainings.length}\n`;
        text += `• البرامج المكتملة: ${completed}\n`;
        text += `• البرامج المخططة: ${upcoming}\n`;
        text += `• إجمالي المشاركين: ${totalParticipants}\n\n`;
        text += `يمكنك عرض تفاصيل التدريبات من صفحة التدريب.`;

        return {
            text,
            actions: [
                { label: 'فتح صفحة التدريب', icon: 'fas fa-graduation-cap', action: 'navigate', target: 'training' },
                { label: 'عرض التقارير', icon: 'fas fa-chart-bar', action: 'open', target: 'training' }
            ]
        };
    },

    /**
     * معالجة سؤال عن الميزانية
     */
    handleBudgetQuestion() {
        const budget = AppState.appData?.safetyBudget || [];
        const totalBudget = budget.reduce((sum, item) => sum + (parseFloat(item.budgetAmount || 0)), 0);
        const totalSpent = budget.reduce((sum, item) => sum + (parseFloat(item.spentAmount || 0)), 0);
        const remaining = totalBudget - totalSpent;
        const percentage = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0;

        let text = `💰 حالة الميزانية:\n\n`;
        text += `• إجمالي الميزانية: ${totalBudget.toLocaleString()} ريال\n`;
        text += `• المبلغ المنفق: ${totalSpent.toLocaleString()} ريال\n`;
        text += `• المبلغ المتبقي: ${remaining.toLocaleString()} ريال\n`;
        text += `• نسبة الإنفاق: ${percentage}%\n\n`;

        if (percentage > 80) {
            text += `⚠️ تنبيه: تم تجاوز 80% من الميزانية المخصصة.`;
        } else if (percentage > 60) {
            text += `⚠️ ملاحظة: تم إنفاق أكثر من 60% من الميزانية.`;
        } else {
            text += `✅ الميزانية في حالة جيدة.`;
        }

        return {
            text,
            actions: [
                { label: 'فتح صفحة الميزانية', icon: 'fas fa-wallet', action: 'navigate', target: 'safety-budget' },
                { label: 'عرض التفاصيل', icon: 'fas fa-eye', action: 'open', target: 'safety-budget' }
            ]
        };
    },

    /**
     * معالجة سؤال عن التصاريح
     */
    handlePermitQuestion() {
        const ptw = AppState.appData?.ptw || [];
        const active = ptw.filter(p => p.status === 'نشط' || p.status === 'active').length;
        const expired = ptw.filter(p => {
            if (!p.expiryDate) return false;
            const expiryDate = new Date(p.expiryDate);
            return expiryDate < new Date();
        }).length;
        const expiringSoon = ptw.filter(p => {
            if (!p.expiryDate) return false;
            const expiryDate = new Date(p.expiryDate);
            const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
        }).length;

        let text = `🪪 معلومات عن تصاريح العمل:\n\n`;
        text += `• إجمالي التصاريح: ${ptw.length}\n`;
        text += `• التصاريح النشطة: ${active}\n`;
        text += `• التصاريح المنتهية: ${expired}\n`;
        text += `• التصاريح التي تنتهي خلال 7 أيام: ${expiringSoon}\n\n`;

        if (expired > 0 || expiringSoon > 0) {
            text += `⚠️ تنبيه: يوجد ${expired} تصريح منتهي و ${expiringSoon} تصريح سينتهي قريباً.`;
        } else {
            text += `✅ جميع التصاريح في حالة جيدة.`;
        }

        return {
            text,
            actions: [
                { label: 'فتح صفحة التصاريح', icon: 'fas fa-id-card', action: 'navigate', target: 'ptw' },
                { label: 'عرض التصاريح المنتهية', icon: 'fas fa-exclamation-circle', action: 'open', target: 'ptw' }
            ]
        };
    },

    /**
     * معالجة سؤال عن الفحوصات
     */
    handleInspectionQuestion() {
        const inspections = AppState.appData?.periodicInspections || [];
        const completed = inspections.filter(i => i.status === 'مكتمل' || i.status === 'completed').length;
        const pending = inspections.filter(i => i.status === 'قيد الانتظار' || i.status === 'pending').length;

        let text = `🔍 معلومات عن الفحوصات الدورية:\n\n`;
        text += `• إجمالي الفحوصات: ${inspections.length}\n`;
        text += `• الفحوصات المكتملة: ${completed}\n`;
        text += `• الفحوصات قيد الانتظار: ${pending}\n\n`;
        text += `يمكنك عرض تفاصيل الفحوصات من صفحة الفحوصات الدورية.`;

        return {
            text,
            actions: [
                { label: 'فتح صفحة الفحوصات', icon: 'fas fa-clipboard-check', action: 'navigate', target: 'periodic-inspections' },
                { label: 'عرض التفاصيل', icon: 'fas fa-eye', action: 'open', target: 'periodic-inspections' }
            ]
        };
    },

    /**
     * معالجة سؤال عن العيادة
     */
    handleClinicQuestion() {
        const clinic = AppState.appData?.clinic || [];
        const recent = clinic.filter(c => {
            const date = new Date(c.date || c.createdAt);
            const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
            return daysAgo <= 30;
        }).length;

        let text = `🏥 معلومات عن العيادة الطبية:\n\n`;
        text += `• إجمالي السجلات: ${clinic.length}\n`;
        text += `• السجلات خلال آخر 30 يوم: ${recent}\n\n`;
        text += `يمكنك عرض تفاصيل السجلات الطبية من صفحة العيادة الطبية.`;

        return {
            text,
            actions: [
                { label: 'فتح صفحة العيادة', icon: 'fas fa-hospital', action: 'navigate', target: 'clinic' },
                { label: 'عرض السجلات', icon: 'fas fa-list', action: 'open', target: 'clinic' }
            ]
        };
    },

    /**
     * معالجة سؤال عن مؤشرات الأداء
     */
    handleKPIQuestion() {
        const kpis = AppState.appData?.safetyKPIs || [];

        let text = `📈 معلومات عن مؤشرات الأداء:\n\n`;
        text += `• إجمالي المؤشرات: ${kpis.length}\n\n`;
        text += `يمكنك عرض تفاصيل مؤشرات الأداء من صفحة مؤشرات الأداء.`;

        return {
            text,
            actions: [
                { label: 'فتح صفحة المؤشرات', icon: 'fas fa-gauge-high', action: 'navigate', target: 'safety-performance-kpis' },
                { label: 'عرض التفاصيل', icon: 'fas fa-chart-line', action: 'open', target: 'safety-performance-kpis' }
            ]
        };
    },

    /**
     * معالجة سؤال المساعدة
     */
    handleHelpQuestion() {
        const text = `مرحباً! أنا مساعد النظام وأنا هنا لمساعدتك.\n\nيمكنني مساعدتك في:\n\n` +
            `• الإجابة على أسئلتك حول كيفية استخدام النظام\n` +
            `• جلب البيانات من الموديولات المختلفة\n` +
            `• تقديم اقتراحات وتنبيهات ذكية\n` +
            `• توجيهك إلى الصفحات المطلوبة\n\n` +
            `جرب أن تسألني عن:\n` +
            `• "كيف أسجل حادث؟"\n` +
            `• "ما عدد الحوادث هذا الشهر؟"\n` +
            `• "ما حالة الميزانية؟"\n` +
            `• "هل هناك تصاريح منتهية؟"`;

        return {
            text,
            actions: [
                { label: 'فتح لوحة التحكم', icon: 'fas fa-dashboard', action: 'navigate', target: 'dashboard' },
                { label: 'فتح الإعدادات', icon: 'fas fa-cog', action: 'navigate', target: 'settings' }
            ]
        };
    },

    /**
     * معالجة الإجراءات السريعة
     */
    handleQuickAction(action) {
        switch (action) {
            case 'how-to-report-incident':
                this.addMessage('user', 'كيف أسجل حادث؟');
                this.sendMessage();
                break;
            default:
                Utils.safeWarn('إجراء سريع غير معروف:', action);
                break;
        }
    },

    /**
     * فحص التنبيهات الذكية
     */
    checkSmartAlerts() {
        // يمكن إضافة منطق للتنبيهات الذكية هنا
        // مثل: التحقق من التصاريح المنتهية، الحوادث الجديدة، إلخ
    },

    /**
     * التنقل إلى صفحة
     */
    navigateToPage(pageId) {
        if (typeof UI !== 'undefined' && UI.showSection) {
            UI.showSection(pageId);
            this.close();
        }
    },

    /**
     * فتح موديول
     */
    openModule(moduleId) {
        if (typeof UI !== 'undefined' && UI.showSection) {
            UI.showSection(moduleId);
            this.close();
        }
    },

    /**
     * تسجيل السؤال
     */
    logQuestion(question, response) {
        // يمكن إضافة منطق لتسجيل الأسئلة والردود للتحليل
        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
            try {
                GoogleIntegration.sendToAppsScript('logAIQuestion', {
                    question: question,
                    response: response.text,
                    intent: response.intent,
                    module: response.module,
                    timestamp: new Date().toISOString()
                }).catch(err => {
                    Utils.safeWarn('فشل تسجيل السؤال:', err);
                });
            } catch (error) {
                Utils.safeWarn('خطأ في تسجيل السؤال:', error);
            }
        }
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('🧹 تنظيف موارد UserAIAssistant module...');
            }

            // تنظيف interval
            if (this._smartAlertsInterval) {
                clearInterval(this._smartAlertsInterval);
                this._smartAlertsInterval = null;
            }

            // تنظيف event listeners
            if (this._eventListenersAbortController) {
                this._eventListenersAbortController.abort();
                this._eventListenersAbortController = null;
            }

            // تنظيف البيانات المؤقتة
            this.conversationHistory = [];
            this.context = {
                currentModule: null,
                currentTopic: null,
                lastIntent: null,
                mentionedEntities: []
            };
            this.isOpen = false;

            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم تنظيف موارد UserAIAssistant module');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تنظيف UserAIAssistant module:', error);
            }
        }
    }
};

// ===== Auto-init: تهيئة تلقائية عند تحميل الموديول =====
// يضمن تسجيل click listener حتى عند الدخول بجلسة محفوظة (session restore)
(function () {
    'use strict';
    try {
        const tryAutoInit = function () {
            if (!UserAIAssistant || UserAIAssistant._initialized) return;
            const mainApp = document.getElementById('main-app');
            if (mainApp && mainApp.style.display !== 'none') {
                UserAIAssistant.init();
            } else if (mainApp) {
                // انتظار حتى يظهر التطبيق الرئيسي
                const obs = new MutationObserver(function (_, observer) {
                    if (mainApp.style.display !== 'none') {
                        observer.disconnect();
                        UserAIAssistant.init();
                    }
                });
                obs.observe(mainApp, { attributes: true, attributeFilter: ['style'] });
            }
        };
        // تأخير بسيط لضمان اكتمال تحميل DOM
        setTimeout(tryAutoInit, 300);
    } catch (e) {
        // تجاهل أخطاء التهيئة التلقائية
    }
})();

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof UserAIAssistant !== 'undefined') {
            window.UserAIAssistant = UserAIAssistant;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ UserAIAssistant module loaded and available on window.UserAIAssistant');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير UserAIAssistant:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof UserAIAssistant !== 'undefined') {
            try {
                window.UserAIAssistant = UserAIAssistant;
            } catch (e) {
                console.error('❌ فشل تصدير UserAIAssistant:', e);
            }
        }
    }
})();