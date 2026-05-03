/**
 * AIAssistant Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ملاحظة: إذا كان AIAssistant موجوداً بالفعل (من ai-assistant.js)، ندمج الوظائف
// بدلاً من إعادة تعريفه، نضيف الوظائف الإضافية إليه
if (typeof AIAssistant === 'undefined') {
    window.AIAssistant = {};
}
// دمج الوظائف في AIAssistant الموجود
Object.assign(window.AIAssistant, {
    async analyzeData(dataType) {
        try {
            Loading.show();

            let analysis = '';
            let recommendations = [];

            switch (dataType) {
                case 'incidents':
                    const incidents = AppState.appData.incidents || [];
                    const highSeverity = incidents.filter(i => i.severity === 'عالية').length;
                    const recentIncidents = incidents.filter(i => {
                        const date = new Date(i.date || i.createdAt);
                        const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
                        return daysAgo <= 30;
                    }).length;

                    analysis = `تم تحليل ${incidents.length} حادث.`;
                    analysis += `\n- الحوادث عالية الخطورة: ${highSeverity}`;
                    analysis += `\n- الحوادث خلال آخر 30 يوم: ${recentIncidents}`;

                    if (highSeverity > incidents.length * 0.2) {
                        recommendations.push({
                            type: 'critical',
                            message: 'نسبة الحوادث عالية الخطورة مرتعة. يوصى بمراجعة شاملة لبروتوكولات السلامة'
                        });
                    }

                    if (recentIncidents > 5) {
                        recommendations.push({
                            type: 'warning',
                            message: 'عدد الحوادث في الشهر الأخير مرتفع. يوصى بزيادة التدريب والمراقبة'
                        });
                    }
                    break;

                case 'training':
                    const trainings = AppState.appData.training || [];
                    const completed = trainings.filter(t => t.status === 'مكتمل').length;
                    const upcoming = trainings.filter(t => t.status === 'مخطط').length;
                    const totalParticipants = typeof Training !== 'undefined' && Training.getParticipantsCount
                        ? trainings.reduce((sum, t) => sum + Training.getParticipantsCount(t), 0)
                        : trainings.reduce((sum, t) => sum + (t.participants?.length || t.participantsCount || 0), 0);

                    analysis = `تم تحليل ${trainings.length} برنامج تدريبي.`;
                    analysis += `\n- البرامج المكتملة: ${completed}`;
                    analysis += `\n- البرامج المخططة: ${upcoming}`;
                    analysis += `\n- إجمالي المشاركين: ${totalParticipants}`;

                    if (upcoming > completed) {
                        recommendations.push({
                            type: 'info',
                            message: 'هناك برامج تدريبية مخططة أكثر من المكتملة. تأكد من متابعة تنفيذها'
                        });
                    }
                    break;

                case 'risk':
                    const risks = AppState.appData.riskAssessments || [];
                    const highRisk = risks.filter(r => {
                        const level = parseInt(r.riskLevel || '0');
                        return level > 10;
                    }).length;

                    analysis = `تم تحليل ${risks.length} تقييم مخاطر.`;
                    analysis += `\n- التقييمات عالية المخاطر: ${highRisk}`;

                    if (highRisk > 0) {
                        recommendations.push({
                            type: 'critical',
                            message: 'يوجد تقييمات مخاطر عالية. يوصى بمراجعة ورية واتخاذ إجراءات تصحيحية'
                        });
                    }
                    break;

                case 'comprehensive':
                    const allIncidents = AppState.appData.incidents || [];
                    const allTrainings = AppState.appData.training || [];
                    const allRisks = AppState.appData.riskAssessments || [];
                    const violations = AppState.appData.violations || [];

                    analysis = `تحليل شامل للنظام:\n`;
                    analysis += `- إجمالي الحوادث: ${allIncidents.length}\n`;
                    analysis += `- إجمالي التدريبات: ${allTrainings.length}\n`;
                    analysis += `- إجمالي تقييمات المخاطر: ${allRisks.length}\n`;
                    analysis += `- إجمالي المخالفات: ${violations.length}\n`;

                    // تحليل شامل
                    const incidentsRate = allIncidents.length / 30; // معدل يومي
                    if (incidentsRate > 0.5) {
                        recommendations.push({
                            type: 'warning',
                            message: 'معدل الحوادث مرتع. يوصى بتعزيز برامج السلامة'
                        });
                    }

                    const trainingCompletion = allTrainings.filter(t => t.status === 'مكتمل').length / (allTrainings.length || 1);
                    if (trainingCompletion < 0.7) {
                        recommendations.push({
                            type: 'warning',
                            message: 'نسبة إتمام التدريبات منخفضة. يوصى بمتابعة البرامج المخططة'
                        });
                    }
                    break;
            }

            Loading.hide();

            // محاولة تحسين التحليل بـ Gemini
            let geminiEnhancement = '';
            try {
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                    const geminiQ = `قدم تحليلاً ذكياً لـ ${dataType === 'incidents' ? 'الحوادث' : dataType === 'training' ? 'التدريب' : dataType === 'risk' ? 'المخاطر' : 'جميع البيانات'} بناءً على: ${analysis}`;
                    const geminiRes = await GoogleIntegration.sendToAppsScript('processAIQuestion', {
                        question: geminiQ,
                        context: { userId: AppState.currentUser?.id, userName: AppState.currentUser?.name, userRole: AppState.currentUser?.role }
                    });
                    if (geminiRes && geminiRes.success && geminiRes.text) {
                        geminiEnhancement = geminiRes.text;
                    }
                }
            } catch (e) { /* Fallback to static analysis */ }

            // عرض النتائج
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2 class="modal-title">
                            <i class="fas fa-robot ml-2"></i>
                            تحليل الذكاء الاصطناعي
                        </h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="space-y-4">
                            ${geminiEnhancement ? `
                                <div class="content-card" style="border-right: 3px solid #3b82f6;">
                                    <h3 class="card-title" style="color:#1d4ed8;">
                                        <i class="fas fa-robot ml-2"></i>
                                        تحليل Gemini الذكي
                                    </h3>
                                    <div class="card-body">
                                        <pre class="whitespace-pre-wrap text-sm text-gray-700">${Utils.escapeHTML(geminiEnhancement)}</pre>
                                    </div>
                                </div>
                            ` : ''}
                            <div class="content-card">
                                <h3 class="card-title">البيانات الإحصائية</h3>
                                <div class="card-body">
                                    <pre class="whitespace-pre-wrap text-sm">${Utils.escapeHTML(analysis)}</pre>
                                </div>
                            </div>
                            
                            ${recommendations.length > 0 ? `
                                <div class="content-card">
                                    <h3 class="card-title">التوصيات</h3>
                                    <div class="card-body space-y-2">
                                        ${recommendations.map(rec => `
                                            <div class="p-3 rounded border-l-4 ${rec.type === 'critical' ? 'bg-red-50 border-red-500' :
                    rec.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                        'bg-blue-50 border-blue-500'
                }">
                                                <div class="flex items-start">
                                                    <i class="fas fa-${rec.type === 'critical' ? 'exclamation-circle text-red-600' :
                    rec.type === 'warning' ? 'exclamation-triangle text-yellow-600' :
                        'info-circle text-blue-600'
                } ml-2 mt-1"></i>
                                                    <span class="text-sm">${Utils.escapeHTML(rec.message)}</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تحليل البيانات:', error);
            Notification.error('شل التحليل: ' + error.message);
        }
    },

    /**
     * إرسال سؤال مباشر لـ Gemini من لوحة الإدارة
     */
    async askGeminiDirect() {
        const input = document.getElementById('admin-ai-question-input');
        const answerBox = document.getElementById('admin-ai-answer');
        const answerText = document.getElementById('admin-ai-answer-text');
        const loadingBox = document.getElementById('admin-ai-loading');
        if (!input || !input.value.trim()) return;

        const question = input.value.trim();

        // إظهار مؤشر التحميل
        if (answerBox) answerBox.classList.add('hidden');
        if (loadingBox) loadingBox.classList.remove('hidden');

        try {
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                const response = await GoogleIntegration.sendToAppsScript('processAIQuestion', {
                    question: question,
                    context: {
                        userId: AppState.currentUser?.id || null,
                        userName: AppState.currentUser?.name || null,
                        userRole: AppState.currentUser?.role || null
                    }
                });
                if (loadingBox) loadingBox.classList.add('hidden');
                if (response && response.success && response.text) {
                    if (answerText) answerText.textContent = response.text;
                    if (answerBox) answerBox.classList.remove('hidden');
                } else {
                    if (answerText) answerText.textContent = 'لم يتمكن المساعد من الإجابة. يرجى المحاولة مرة أخرى.';
                    if (answerBox) answerBox.classList.remove('hidden');
                }
            } else {
                // استخدام AIAssistant المحلي كـ Fallback
                const localResponse = await AIAssistant.ask(question);
                if (loadingBox) loadingBox.classList.add('hidden');
                if (localResponse && localResponse.success) {
                    if (answerText) answerText.textContent = localResponse.text || localResponse.message;
                    if (answerBox) answerBox.classList.remove('hidden');
                }
            }
        } catch (error) {
            if (loadingBox) loadingBox.classList.add('hidden');
            if (answerText) answerText.textContent = 'حدث خطأ في الاتصال. يرجى المحاولة لاحقاً.';
            if (answerBox) answerBox.classList.remove('hidden');
            Utils.safeError('خطأ في askGeminiDirect:', error);
        }
    },

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        // التحقق من وجود التبعيات المطلوبة
        if (typeof Utils === 'undefined') {
            console.error('Utils غير متوفر!');
            return;
        }
        if (typeof AppState === 'undefined') {
            Utils.safeError('AppState غير متوفر!');
            return;
        }

        // دعم معرفات القسم المختلفة
        let section = document.getElementById('ai-assistant-section');
        if (!section) {
            section = document.getElementById('aiassistant-section');
        }
        if (!section) {
            Utils.safeWarn('⚠️ AIAssistant: قسم ai-assistant-section غير موجود');
            return;
        }

        try {
            const aiTitle = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('ai.title') : 'مساعد الذكاء الاصطناعي';
            const aiSubtitle = (typeof i18n !== 'undefined' && i18n.translate) ? i18n.translate('ai.subtitle') : 'تحليل ذكي للبيانات وتوصيات تلقائية';

            // إحصائيات استخدام المساعد
            const userLogs = AppState.appData?.userAILog || [];
            const totalQuestions = userLogs.length;
            const uniqueUsers = new Set(userLogs.map(log => log.userId)).size;
            const todayQuestions = userLogs.filter(log => {
                try {
                    const logDate = new Date(log.timestamp);
                    const today = new Date();
                    return logDate.toDateString() === today.toDateString();
                } catch (e) {
                    return false;
                }
            }).length;
            const thisWeekQuestions = userLogs.filter(log => {
                try {
                    const logDate = new Date(log.timestamp);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return logDate >= weekAgo;
                } catch (e) {
                    return false;
                }
            }).length;

            // أكثر الأسئلة شيوعاً
            const questionCounts = {};
            userLogs.forEach(log => {
                try {
                    const question = log.question?.toLowerCase().trim() || '';
                    if (question) {
                        questionCounts[question] = (questionCounts[question] || 0) + 1;
                    }
                } catch (e) {
                    // تجاهل الأخطاء في معالجة السجلات
                }
            });
            const topQuestions = Object.entries(questionCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-robot ml-3"></i>
                            ${aiTitle}
                        </h1>
                        <p class="section-subtitle">${aiSubtitle}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <span style="display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #86efac;border-radius:9999px;padding:4px 14px;font-size:0.8rem;color:#16a34a;font-weight:600;">
                            <i class="fas fa-circle" style="font-size:0.5rem;color:#22c55e;"></i>
                            Gemini 1.5 Flash متصل
                        </span>
                        <button onclick="AIAssistant.showSettings()" class="btn-secondary">
                            <i class="fas fa-cog ml-2"></i>
                            الإعدادات
                        </button>
                        <button onclick="AIAssistant.showUserLogs()" class="btn-primary">
                            <i class="fas fa-list ml-2"></i>
                            سجل الاستخدام
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- إحصائيات الاستخدام -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="content-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 mb-1">إجمالي الأسئلة</p>
                            <p class="text-2xl font-bold text-blue-600">${totalQuestions}</p>
                        </div>
                        <div class="text-3xl text-blue-200">
                            <i class="fas fa-question-circle"></i>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 mb-1">المستخدمين النشطين</p>
                            <p class="text-2xl font-bold text-green-600">${uniqueUsers}</p>
                        </div>
                        <div class="text-3xl text-green-200">
                            <i class="fas fa-users"></i>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 mb-1">أسئلة اليوم</p>
                            <p class="text-2xl font-bold text-orange-600">${todayQuestions}</p>
                        </div>
                        <div class="text-3xl text-orange-200">
                            <i class="fas fa-calendar-day"></i>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600 mb-1">أسئلة هذا الأسبوع</p>
                            <p class="text-2xl font-bold text-purple-600">${thisWeekQuestions}</p>
                        </div>
                        <div class="text-3xl text-purple-200">
                            <i class="fas fa-calendar-week"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- أكثر الأسئلة شيوعاً -->
            ${topQuestions.length > 0 ? `
                <div class="content-card mt-6">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-chart-bar ml-2"></i>
                            أكثر الأسئلة شيوعاً
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="space-y-2">
                            ${topQuestions.map(([question, count], index) => `
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div class="flex items-center gap-3">
                                        <span class="text-lg font-bold text-gray-400">${index + 1}</span>
                                        <span class="text-sm text-gray-700">${Utils.escapeHTML(question.substring(0, 60))}${question.length > 60 ? '...' : ''}</span>
                                    </div>
                                    <span class="badge badge-primary">${count} مرة</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- مربع السؤال المباشر لـ Gemini -->
            <div class="content-card mt-6" style="border: 2px solid #3b82f6; border-radius: 12px;">
                <div class="card-body">
                    <div class="flex items-center gap-2 mb-3">
                        <i class="fas fa-robot" style="color:#3b82f6;font-size:1.2rem;"></i>
                        <h2 class="text-lg font-bold" style="color:#1e40af;">اسأل Gemini مباشرة</h2>
                        <span style="background:#dbeafe;color:#1d4ed8;border-radius:9999px;padding:2px 10px;font-size:0.75rem;font-weight:600;">AI</span>
                    </div>
                    <p class="text-gray-500 text-sm mb-3">اطرح أي سؤال عن بيانات السلامة — Gemini سيجيبك بناءً على بيانات النظام الفعلية</p>
                    <div class="flex gap-2">
                        <input type="text" id="admin-ai-question-input"
                            class="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                            placeholder="مثال: ما هي أكثر أسباب الحوادث تكراراً؟ أو كيف نحسن معدل إتمام التدريب؟"
                            onkeydown="if(event.key==='Enter') AIAssistant.askGeminiDirect()">
                        <button onclick="AIAssistant.askGeminiDirect()" class="btn-primary" style="white-space:nowrap;">
                            <i class="fas fa-paper-plane ml-1"></i>
                            إرسال
                        </button>
                    </div>
                    <div id="admin-ai-answer" class="mt-3 hidden">
                        <div style="background:#f8fafc;border-right:3px solid #3b82f6;border-radius:6px;padding:12px 16px;">
                            <div class="flex items-center gap-2 mb-2">
                                <i class="fas fa-robot" style="color:#3b82f6;font-size:0.85rem;"></i>
                                <span class="text-xs font-semibold" style="color:#3b82f6;">Gemini</span>
                            </div>
                            <p id="admin-ai-answer-text" class="text-sm text-gray-700 whitespace-pre-wrap"></p>
                        </div>
                    </div>
                    <div id="admin-ai-loading" class="mt-3 hidden text-center py-3">
                        <i class="fas fa-spinner fa-spin" style="color:#3b82f6;"></i>
                        <span class="text-sm text-gray-500 mr-2">Gemini يفكر...</span>
                    </div>
                    <!-- أسئلة مقترحة -->
                    <div class="flex flex-wrap gap-2 mt-3">
                        <span class="text-xs text-gray-400 ml-1">اقتراحات:</span>
                        ${[
                            'ما مستوى المخاطر الحالي؟',
                            'تحليل الحوادث هذا الشهر',
                            'ما التوصيات لتحسين السلامة؟',
                            'الإجراءات المتأخرة'
                        ].map(q => `<button onclick="document.getElementById('admin-ai-question-input').value='${q}';AIAssistant.askGeminiDirect()"
                            style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:9999px;padding:3px 12px;font-size:0.75rem;cursor:pointer;">${q}</button>`).join('')}
                    </div>
                </div>
            </div>

            <!-- أدوات التحليل -->
            <div class="mt-6">
                <h2 class="text-xl font-bold mb-4">
                    <i class="fas fa-brain ml-2"></i>
                    أدوات التحليل الذكي
                    <span style="background:#dbeafe;color:#1d4ed8;border-radius:9999px;padding:2px 10px;font-size:0.8rem;font-weight:600;margin-right:8px;">مدعوم بـ Gemini</span>
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-exclamation-triangle ml-2"></i>
                                تحليل الحوادث
                            </h2>
                        </div>
                        <div class="card-body">
                            <p class="text-gray-600 mb-4">تحليل شامل للحوادث مع توصيات ذكية</p>
                            <button onclick="AIAssistant.analyzeData('incidents')" class="btn-primary w-full">
                                <i class="fas fa-brain ml-2"></i>
                                تحليل الحوادث
                            </button>
                        </div>
                    </div>
                    
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-graduation-cap ml-2"></i>
                                تحليل التدريبات
                            </h2>
                        </div>
                        <div class="card-body">
                            <p class="text-gray-600 mb-4">تحليل برامج التدريب والمشاركين</p>
                            <button onclick="AIAssistant.analyzeData('training')" class="btn-primary w-full">
                                <i class="fas fa-brain ml-2"></i>
                                تحليل التدريبات
                            </button>
                        </div>
                    </div>
                    
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-shield-alt ml-2"></i>
                                تحليل المخاطر
                            </h2>
                        </div>
                        <div class="card-body">
                            <p class="text-gray-600 mb-4">تحليل تقييمات المخاطر والإجراءات</p>
                            <button onclick="AIAssistant.analyzeData('risk')" class="btn-primary w-full">
                                <i class="fas fa-brain ml-2"></i>
                                تحليل المخاطر
                            </button>
                        </div>
                    </div>
                    
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-chart-line ml-2"></i>
                                تحليل شامل
                            </h2>
                        </div>
                        <div class="card-body">
                            <p class="text-gray-600 mb-4">تحليل شامل لجميع بيانات النظام</p>
                            <button onclick="AIAssistant.analyzeData('comprehensive')" class="btn-primary w-full">
                                <i class="fas fa-brain ml-2"></i>
                                تحليل شامل
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        } catch (error) {
            Utils.safeError('خطأ في تحميل AIAssistant:', error);
            section.innerHTML = `
                <div class="section-header">
                    <h1 class="section-title">
                        <i class="fas fa-robot ml-3"></i>
                        مساعد الذكاء الاصطناعي
                    </h1>
                </div>
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                            <p class="text-gray-500">حدث خطأ في تحميل الموديول</p>
                            <p class="text-sm text-gray-400 mt-2">${error.message || 'خطأ غير معروف'}</p>
                            <button onclick="AIAssistant.load()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                إعادة المحاولة
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * عرض إعدادات المساعد
     */
    showSettings() {
        const settings = AppState.appData?.aiAssistantSettings || {
            enabled: true,
            autoAlerts: true,
            logQuestions: true,
            maxLogEntries: 1000,
            alertThresholds: {
                budgetPercentage: 80,
                expiredPermits: true,
                highSeverityIncidents: true
            }
        };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-cog ml-2"></i>
                        إعدادات مساعد الذكاء الاصطناعي
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="ai-assistant-settings-form" class="space-y-6">
                        <div class="content-card">
                            <h3 class="card-title mb-4">الإعدادات العامة</h3>
                            <div class="space-y-4">
                                <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                                    <div>
                                        <span class="font-semibold">تفعيل مساعد المستخدم</span>
                                        <p class="text-xs text-gray-600 mt-1">تفعيل/تعطيل مساعد المستخدم الذكي</p>
                                    </div>
                                    <input type="checkbox" id="ai-enabled" ${settings.enabled ? 'checked' : ''} class="form-checkbox">
                                </label>
                                
                                <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                                    <div>
                                        <span class="font-semibold">تسجيل الأسئلة</span>
                                        <p class="text-xs text-gray-600 mt-1">تسجيل جميع أسئلة المستخدمين في السجل</p>
                                    </div>
                                    <input type="checkbox" id="ai-log-questions" ${settings.logQuestions ? 'checked' : ''} class="form-checkbox">
                                </label>
                                
                                <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                                    <div>
                                        <span class="font-semibold">التنبيهات التلقائية</span>
                                        <p class="text-xs text-gray-600 mt-1">عرض تنبيهات ذكية عند وجود مشاكل</p>
                                    </div>
                                    <input type="checkbox" id="ai-auto-alerts" ${settings.autoAlerts ? 'checked' : ''} class="form-checkbox">
                                </label>
                            </div>
                        </div>
                        
                        <div class="content-card">
                            <h3 class="card-title mb-4">إعدادات السجل</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        الحد الأقصى لعدد السجلات
                                    </label>
                                    <input type="number" id="ai-max-log-entries" class="form-input" 
                                        value="${settings.maxLogEntries || 1000}" min="100" max="10000" step="100">
                                    <p class="text-xs text-gray-600 mt-1">سيتم الاحتفاظ بآخر N سجل فقط</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="content-card">
                            <h3 class="card-title mb-4">إعدادات التنبيهات</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        نسبة الإنفاق للميزانية (لإظهار التنبيه)
                                    </label>
                                    <input type="number" id="ai-budget-threshold" class="form-input" 
                                        value="${settings.alertThresholds?.budgetPercentage || 80}" min="0" max="100" step="5">
                                    <p class="text-xs text-gray-600 mt-1">سيتم إظهار تنبيه عند تجاوز هذه النسبة</p>
                                </div>
                                
                                <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                                    <div>
                                        <span class="font-semibold">تنبيه التصاريح المنتهية</span>
                                        <p class="text-xs text-gray-600 mt-1">إظهار تنبيه عند وجود تصاريح منتهية</p>
                                    </div>
                                    <input type="checkbox" id="ai-alert-expired-permits" ${settings.alertThresholds?.expiredPermits ? 'checked' : ''} class="form-checkbox">
                                </label>
                                
                                <label class="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
                                    <div>
                                        <span class="font-semibold">تنبيه الحوادث عالية الخطورة</span>
                                        <p class="text-xs text-gray-600 mt-1">إظهار تنبيه عند وجود حوادث عالية الخطورة</p>
                                    </div>
                                    <input type="checkbox" id="ai-alert-high-severity" ${settings.alertThresholds?.highSeverityIncidents ? 'checked' : ''} class="form-checkbox">
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button type="button" id="save-ai-settings-btn" class="btn-primary">حفظ الإعدادات</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const saveBtn = modal.querySelector('#save-ai-settings-btn');
        saveBtn.addEventListener('click', () => {
            this.saveSettings(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * حفظ الإعدادات
     */
    async saveSettings(modal) {
        if (!AppState.appData) AppState.appData = {};

        const settings = {
            enabled: document.getElementById('ai-enabled').checked,
            autoAlerts: document.getElementById('ai-auto-alerts').checked,
            logQuestions: document.getElementById('ai-log-questions').checked,
            maxLogEntries: parseInt(document.getElementById('ai-max-log-entries').value) || 1000,
            alertThresholds: {
                budgetPercentage: parseInt(document.getElementById('ai-budget-threshold').value) || 80,
                expiredPermits: document.getElementById('ai-alert-expired-permits').checked,
                highSeverityIncidents: document.getElementById('ai-alert-high-severity').checked
            },
            updatedAt: new Date().toISOString(),
            updatedBy: AppState.currentUser?.email || 'unknown'
        };

        AppState.appData.aiAssistantSettings = settings;

        Loading.show();
        try {
            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                await GoogleIntegration.autoSave('AIAssistantSettings', [settings]);
            }
            Notification.success('تم حفظ الإعدادات بنجاح');
            modal.remove();
            this.load();
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
            Utils.safeError('خطأ في حفظ الإعدادات:', error);
        } finally {
            Loading.hide();
        }
    },

    /**
     * عرض سجل استخدام المستخدمين
     */
    showUserLogs() {
        const logs = AppState.appData?.userAILog || [];
        const sortedLogs = [...logs].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        // تجميع حسب المستخدم
        const userStats = {};
        logs.forEach(log => {
            const userId = log.userId || 'unknown';
            if (!userStats[userId]) {
                userStats[userId] = {
                    userName: log.userName || 'مستخدم غير معروف',
                    email: userId,
                    totalQuestions: 0,
                    lastActivity: null
                };
            }
            userStats[userId].totalQuestions++;
            const logDate = new Date(log.timestamp);
            if (!userStats[userId].lastActivity || logDate > new Date(userStats[userId].lastActivity)) {
                userStats[userId].lastActivity = log.timestamp;
            }
        });

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-list ml-2"></i>
                        سجل استخدام مساعد المستخدم الذكي
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4 flex items-center justify-between flex-wrap gap-4">
                        <div class="flex items-center gap-4">
                            <input type="text" id="ai-log-search" class="form-input" placeholder="بحث في السجل..." style="min-width: 300px;">
                            <select id="ai-log-user-filter" class="form-input">
                                <option value="all">جميع المستخدمين</option>
                                ${Object.entries(userStats).map(([userId, stats]) => `
                                    <option value="${userId}">${Utils.escapeHTML(stats.userName)} (${stats.totalQuestions})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="AIAssistant.exportLogs()" class="btn-success">
                                <i class="fas fa-file-excel ml-2"></i>
                                تصدير Excel
                            </button>
                            <button onclick="AIAssistant.clearOldLogs()" class="btn-danger">
                                <i class="fas fa-trash ml-2"></i>
                                حذف السجلات القديمة
                            </button>
                        </div>
                    </div>
                    
                    <!-- إحصائيات المستخدمين -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        ${Object.entries(userStats).slice(0, 3).map(([userId, stats]) => `
                            <div class="content-card">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm font-semibold text-gray-700">${Utils.escapeHTML(stats.userName)}</p>
                                        <p class="text-xs text-gray-500">${Utils.escapeHTML(stats.email)}</p>
                                        <p class="text-sm text-gray-600 mt-2">
                                            <i class="fas fa-question-circle ml-1"></i>
                                            ${stats.totalQuestions} سؤال
                                        </p>
                                    </div>
                                    <div class="text-2xl text-blue-200">
                                        <i class="fas fa-user"></i>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- جدول السجلات -->
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title">سجل الأسئلة والأجوبة</h3>
                            <span class="badge badge-primary">${sortedLogs.length} سجل</span>
                        </div>
                        <div class="card-body">
                            <div class="overflow-x-auto">
                                <table class="data-table" id="ai-log-table">
                                    <thead>
                                        <tr>
                                            <th>التاريخ والوقت</th>
                                            <th>المستخدم</th>
                                            <th>السؤال</th>
                                            <th>الإجابة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sortedLogs.slice(0, 100).map(log => `
                                            <tr>
                                                <td>${Utils.formatDateTime(log.timestamp)}</td>
                                                <td>
                                                    <div>
                                                        <div class="font-semibold">${Utils.escapeHTML(log.userName || 'غير معروف')}</div>
                                                        <div class="text-xs text-gray-500">${Utils.escapeHTML(log.userId || '')}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div class="max-w-md truncate" title="${Utils.escapeHTML(log.question || '')}">
                                                        ${Utils.escapeHTML((log.question || '').substring(0, 80))}${(log.question || '').length > 80 ? '...' : ''}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div class="max-w-md truncate" title="${Utils.escapeHTML(log.response || '')}">
                                                        ${Utils.escapeHTML((log.response || '').substring(0, 80))}${(log.response || '').length > 80 ? '...' : ''}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button onclick="AIAssistant.viewLogDetail('${log.id}')" class="btn-sm btn-primary">
                                                        <i class="fas fa-eye"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                ${sortedLogs.length > 100 ? `
                                    <div class="mt-4 text-center text-gray-600">
                                        <p>عرض أول 100 سجل من أصل ${sortedLogs.length} سجل</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // إضافة البحث والفلترة
        const searchInput = modal.querySelector('#ai-log-search');
        const userFilter = modal.querySelector('#ai-log-user-filter');
        const table = modal.querySelector('#ai-log-table');

        const filterTable = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedUser = userFilter.value;
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const matchesSearch = !searchTerm || text.includes(searchTerm);
                const matchesUser = selectedUser === 'all' || row.textContent.includes(selectedUser);
                row.style.display = (matchesSearch && matchesUser) ? '' : 'none';
            });
        };

        searchInput.addEventListener('input', filterTable);
        userFilter.addEventListener('change', filterTable);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * عرض تفاصيل سجل معين
     */
    viewLogDetail(logId) {
        const log = AppState.appData?.userAILog?.find(l => l.id === logId);
        if (!log) {
            Notification.error('السجل غير موجود');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-info-circle ml-2"></i>
                        تفاصيل السجل
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="content-card">
                            <h3 class="card-title mb-3">معلومات المستخدم</h3>
                            <div class="space-y-2">
                                <div><strong>الاسم:</strong> ${Utils.escapeHTML(log.userName || 'غير معروف')}</div>
                                <div><strong>البريد الإلكتروني:</strong> ${Utils.escapeHTML(log.userId || '')}</div>
                                <div><strong>التاريخ والوقت:</strong> ${Utils.formatDateTime(log.timestamp)}</div>
                            </div>
                        </div>
                        
                        <div class="content-card">
                            <h3 class="card-title mb-3">السؤال</h3>
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <p class="text-gray-700">${Utils.escapeHTML(log.question || '')}</p>
                            </div>
                        </div>
                        
                        <div class="content-card">
                            <h3 class="card-title mb-3">الإجابة</h3>
                            <div class="p-4 bg-blue-50 rounded-lg">
                                <pre class="whitespace-pre-wrap text-sm text-gray-700">${Utils.escapeHTML(log.response || '')}</pre>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * تصدير السجلات إلى Excel
     */
    async exportLogs() {
        const logs = AppState.appData?.userAILog || [];
        if (logs.length === 0) {
            Notification.warning('لا توجد سجلات للتصدير');
            return;
        }

        Loading.show();
        try {
            const data = logs.map(log => ({
                'التاريخ والوقت': Utils.formatDateTime(log.timestamp),
                'المستخدم': log.userName || 'غير معروف',
                'البريد الإلكتروني': log.userId || '',
                'السؤال': log.question || '',
                'الإجابة': log.response || ''
            }));

            if (typeof Utils !== 'undefined' && Utils.exportToExcel) {
                Utils.exportToExcel(data, 'سجل_استخدام_المساعد_الذكي');
            } else {
                // طريقة بديلة
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'سجل الاستخدام');
                XLSX.writeFile(wb, `سجل_استخدام_المساعد_الذكي_${new Date().toISOString().slice(0, 10)}.xlsx`);
            }

            Notification.success('تم تصدير السجلات بنجاح');
        } catch (error) {
            Notification.error('حدث خطأ أثناء التصدير: ' + error.message);
            Utils.safeError('خطأ في التصدير:', error);
        } finally {
            Loading.hide();
        }
    },

    /**
     * حذف السجلات القديمة
     */
    async clearOldLogs() {
        const settings = AppState.appData?.aiAssistantSettings || {};
        const maxLogEntries = settings.maxLogEntries || 1000;
        const logs = AppState.appData?.userAILog || [];

        if (logs.length <= maxLogEntries) {
            Notification.info(`عدد السجلات الحالي (${logs.length}) أقل من الحد الأقصى (${maxLogEntries})`);
            return;
        }

        if (!confirm(`هل أنت متأكد من حذف السجلات القديمة؟ سيتم الاحتفاظ بآخر ${maxLogEntries} سجل فقط.`)) {
            return;
        }

        Loading.show();
        try {
            const sortedLogs = [...logs].sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );

            AppState.appData.userAILog = sortedLogs.slice(0, maxLogEntries);
            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }

            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                await GoogleIntegration.autoSave('UserAILog', AppState.appData.userAILog);
            }

            Notification.success(`تم حذف ${logs.length - maxLogEntries} سجل قديم`);
            this.showUserLogs();
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
            Utils.safeError('خطأ في حذف السجلات:', error);
        } finally {
            Loading.hide();
        }
    }
});

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined') {
            // ملاحظة: AIAssistant تم إنشاؤه بالفعل في السطر 8 باستخدام Object.assign
            if (typeof window.AIAssistant === 'undefined') {
                window.AIAssistant = {};
            }
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ AIAssistant module loaded and available on window.AIAssistant');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير AIAssistant:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined') {
            try {
                if (typeof window.AIAssistant === 'undefined') {
                    window.AIAssistant = {};
                }
            } catch (e) {
                console.error('❌ فشل تصدير AIAssistant:', e);
            }
        }
    }
})();