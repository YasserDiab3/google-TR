/**
 * Risk Matrix Component - Compact & Professional
 * مصفوفة تقييم المخاطر - مدمجة واحترافية
 */
const RiskMatrix = {
    /**
     * توليد مصفوفة تقييم المخاطر
     */
    generate(containerId, options = {}) {
        const {
            selectedLikelihood = null,
            selectedConsequence = null,
            interactive = true
        } = options;

        // مستويات مدمجة
        const likelihood = [
            { value: 5, label: 'شبه مؤكد' },
            { value: 4, label: 'محتمل جداً' },
            { value: 3, label: 'محتمل' },
            { value: 2, label: 'غير محتمل' },
            { value: 1, label: 'نادر' }
        ];

        const consequence = [
            { value: 1, label: 'ضئيلة' },
            { value: 2, label: 'بسيطة' },
            { value: 3, label: 'متوسطة' },
            { value: 4, label: 'كبيرة' },
            { value: 5, label: 'كارثية' }
        ];

        // حساب مستوى الخطر
        const getRiskLevel = (l, c) => {
            const score = l * c;
            if (score >= 15) return { level: 'critical', label: 'حرج', color: '#fff', bg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', border: '#991b1b' };
            if (score >= 10) return { level: 'high', label: 'عالي', color: '#fff', bg: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: '#ea580c' };
            if (score >= 5) return { level: 'medium', label: 'متوسط', color: '#000', bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', border: '#f59e0b' };
            return { level: 'low', label: 'منخفض', color: '#fff', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: '#059669' };
        };

        // HTML مدمج واحترافي
        return `
            <style>
                .risk-matrix-compact {
                    max-width: 450px;
                    margin: 0 auto;
                    font-family: 'Cairo', 'Segoe UI', sans-serif;
                }
                .risk-matrix-compact table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 3px;
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    padding: 8px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }
                .risk-matrix-compact th {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    padding: 6px 3px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-align: center;
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .risk-matrix-compact th.corner {
                    width: 70px;
                    font-size: 0.65rem;
                }
                .risk-matrix-compact td.label {
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    color: white;
                    padding: 6px 3px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-align: center;
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .risk-matrix-compact .risk-cell {
                    padding: 8px 4px;
                    text-align: center;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .risk-matrix-compact .risk-cell:hover {
                    transform: scale(1.12) translateY(-2px);
                    z-index: 10;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
                }
                .risk-matrix-compact .risk-cell.selected {
                    transform: scale(1.15) translateY(-3px);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5), 0 8px 20px rgba(0,0,0,0.25);
                    z-index: 20;
                }
                .risk-matrix-compact .risk-cell .score {
                    font-size: 1.2rem;
                    font-weight: 900;
                    line-height: 1;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .risk-matrix-compact .risk-cell .level {
                    font-size: 0.6rem;
                    font-weight: 700;
                    margin-top: 2px;
                    opacity: 0.95;
                }
                .risk-legend {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 6px;
                    margin-top: 12px;
                    font-size: 0.7rem;
                }
                .risk-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 8px;
                    background: white;
                    border-radius: 6px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .risk-legend-color {
                    width: 18px;
                    height: 18px;
                    border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
            </style>
            
            <div class="risk-matrix-compact">
                <table>
                    <thead>
                        <tr>
                            <th class="corner">
                                <div style="font-size: 0.65rem;">الاحتمالية</div>
                                <div style="font-size: 0.55rem; opacity: 0.8;">↓</div>
                            </th>
                            ${consequence.map(c => `
                                <th>
                                    <div>${c.label}</div>
                                    <div style="font-size: 0.85rem; margin-top: 1px;">${c.value}</div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${likelihood.map(l => `
                            <tr>
                                <td class="label">
                                    <div>${l.label}</div>
                                    <div style="font-size: 0.85rem; margin-top: 1px;">${l.value}</div>
                                </td>
                                ${consequence.map(c => {
            const risk = getRiskLevel(l.value, c.value);
            const score = l.value * c.value;
            const isSelected = selectedLikelihood === l.value && selectedConsequence === c.value;

            return `
                                        <td class="risk-cell ${isSelected ? 'selected' : ''}"
                                            data-likelihood="${l.value}"
                                            data-likelihood-label="${l.label}"
                                            data-consequence="${c.value}"
                                            data-consequence-label="${c.label}"
                                            data-score="${score}"
                                            data-level="${risk.level}"
                                            data-level-label="${risk.label}"
                                            style="background: ${risk.bg}; color: ${risk.color};"
                                            onclick="RiskMatrix.selectCell(this, '${containerId}')">
                                            <div class="score">${score}</div>
                                            <div class="level">${risk.label}</div>
                                        </td>
                                    `;
        }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="risk-legend">
                    <div class="risk-legend-item">
                        <div class="risk-legend-color" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);"></div>
                        <span style="color: #059669; font-weight: 700;">منخفض (1-4)</span>
                    </div>
                    <div class="risk-legend-item">
                        <div class="risk-legend-color" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);"></div>
                        <span style="color: #d97706; font-weight: 700;">متوسط (5-9)</span>
                    </div>
                    <div class="risk-legend-item">
                        <div class="risk-legend-color" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);"></div>
                        <span style="color: #ea580c; font-weight: 700;">عالي (10-14)</span>
                    </div>
                    <div class="risk-legend-item">
                        <div class="risk-legend-color" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);"></div>
                        <span style="color: #dc2626; font-weight: 700;">حرج (15-25)</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * معالجة اختيار خلية - مع تحديث تلقائي للملاحظات
     */
    selectCell(cell, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // إزالة التحديد السابق
        container.querySelectorAll('.risk-cell').forEach(c => {
            c.classList.remove('selected');
        });

        // تحديد الخلية الحالية
        cell.classList.add('selected');

        // استخراج البيانات
        const likelihood = parseInt(cell.getAttribute('data-likelihood'));
        const likelihoodLabel = cell.getAttribute('data-likelihood-label');
        const consequence = parseInt(cell.getAttribute('data-consequence'));
        const consequenceLabel = cell.getAttribute('data-consequence-label');
        const score = parseInt(cell.getAttribute('data-score'));
        const level = cell.getAttribute('data-level');
        const levelLabel = cell.getAttribute('data-level-label');

        // التعرف على نوع النموذج (PTW أو Investigation)
        const isInvestigationForm = containerId === 'investigation-risk-matrix';
        const isPTWForm = containerId === 'ptw-risk-matrix';

        if (isPTWForm) {
            // معالجة نموذج تصريح العمل (PTW)
            const likelihoodInput = document.getElementById('ptw-risk-likelihood');
            const consequenceInput = document.getElementById('ptw-risk-consequence');

            if (likelihoodInput) likelihoodInput.value = likelihood;
            if (consequenceInput) consequenceInput.value = consequence;

            // تحديث حقل الملاحظات تلقائياً
            const notesTextarea = document.getElementById('ptw-risk-notes');
            if (notesTextarea) {
                const riskInfo = `📊 تقييم المخاطر المحدد:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• الاحتمالية: ${likelihoodLabel} (${likelihood})
• العواقب: ${consequenceLabel} (${consequence})
• النتيجة: ${score}
• مستوى الخطر: ${levelLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━

ملاحظات إضافية:
`;

                // إذا كان الحقل فارغاً أو يحتوي على تقييم سابق، استبدله
                const currentValue = notesTextarea.value.trim();
                if (!currentValue || currentValue.startsWith('📊 تقييم المخاطر المحدد:')) {
                    notesTextarea.value = riskInfo;
                } else {
                    // إضافة التقييم في البداية
                    notesTextarea.value = riskInfo + '\n' + currentValue;
                }

                // تمييز الحقل مؤقتاً
                notesTextarea.style.background = '#fef3c7';
                notesTextarea.style.borderColor = '#f59e0b';
                setTimeout(() => {
                    notesTextarea.style.background = '';
                    notesTextarea.style.borderColor = '';
                }, 1000);
            }
        } else if (isInvestigationForm) {
            // معالجة نموذج التحقيق في الحادث (Investigation)
            
            // تحديث الحقول المخفية
            const probabilityInput = document.getElementById('investigation-risk-probability');
            const severityInput = document.getElementById('investigation-risk-severity');
            const levelInput = document.getElementById('investigation-risk-level');

            if (probabilityInput) probabilityInput.value = likelihood;
            if (severityInput) severityInput.value = consequence;
            if (levelInput) levelInput.value = score;

            // تحديث حقل "نتيجة التقييم" تلقائياً
            const resultInput = document.getElementById('investigation-risk-result');
            if (resultInput) {
                // تحديد القيمة بناءً على مستوى الخطر
                let resultValue = levelLabel; // استخدام النص العربي مباشرة
                
                // تأثير بصري للتحديث
                resultInput.value = resultValue;
                resultInput.style.background = this.getRiskBackgroundColor(level);
                resultInput.style.color = (level === 'low' || level === 'medium') ? '#000' : '#fff';
                resultInput.style.fontWeight = '700';
                resultInput.style.textAlign = 'center';
                
                // تمييز الحقل مؤقتاً
                setTimeout(() => {
                    resultInput.style.background = '#f0fdfa';
                    resultInput.style.color = '#000';
                }, 2000);
            }

            // تحديث حقل "شرح الخطر" تلقائياً
            const explanationTextarea = document.getElementById('investigation-risk-explanation');
            if (explanationTextarea) {
                const riskExplanation = `📊 نتائج تقييم المخاطر للحادث:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الاحتمالية (Likelihood): ${likelihoodLabel} - المستوى ${likelihood}/5
• الشدة/العواقب (Consequence): ${consequenceLabel} - المستوى ${consequence}/5
• الدرجة الكلية للمخاطر: ${score} نقطة
• مستوى الخطر المحدد: ${levelLabel}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

التفسير والتوصيات:
${this.getRiskExplanationText(score, levelLabel, likelihoodLabel, consequenceLabel)}

ملاحظات إضافية من المحقق:
`;

                // إذا كان الحقل فارغاً أو يحتوي على تقييم سابق، استبدله
                const currentValue = explanationTextarea.value.trim();
                if (!currentValue || currentValue.startsWith('📊 نتائج تقييم المخاطر')) {
                    explanationTextarea.value = riskExplanation;
                } else {
                    // الاحتفاظ بالملاحظات الإضافية
                    explanationTextarea.value = riskExplanation;
                }

                // تمييز الحقل مؤقتاً
                explanationTextarea.style.background = '#ecfdf5';
                explanationTextarea.style.borderColor = '#10b981';
                explanationTextarea.style.borderWidth = '2px';
                setTimeout(() => {
                    explanationTextarea.style.background = '#f0fdfa';
                    explanationTextarea.style.borderColor = '#14b8a6';
                    explanationTextarea.style.borderWidth = '1px';
                }, 2000);
            }
        }

        // إطلاق حدث مخصص
        const event = new CustomEvent('riskMatrixSelect', {
            detail: {
                likelihood,
                likelihoodLabel,
                consequence,
                consequenceLabel,
                score,
                level,
                levelLabel,
                containerId
            },
            bubbles: true
        });
        container.dispatchEvent(event);

        // إشعار بصري
        if (typeof Notification !== 'undefined' && Notification.success) {
            Notification.success(`تم تحديد مستوى الخطر: ${levelLabel} (${score})`);
        }

        // Log للتطوير
        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('✅ Risk Matrix Selection:', {
                container: containerId,
                likelihood: `${likelihoodLabel} (${likelihood})`,
                consequence: `${consequenceLabel} (${consequence})`,
                score,
                level: `${levelLabel} (${level})`
            });
        }
    },

    /**
     * الحصول على لون الخلفية بناءً على مستوى الخطر
     */
    getRiskBackgroundColor(level) {
        const colors = {
            'low': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            'medium': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            'high': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            'critical': 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
        };
        return colors[level] || colors['low'];
    },

    /**
     * الحصول على نص الشرح بناءً على مستوى الخطر
     */
    getRiskExplanationText(score, levelLabel, likelihoodLabel, consequenceLabel) {
        const explanations = {
            'منخفض': `هذا الحادث يُصنف ضمن المخاطر المنخفضة (${score} نقاط)، حيث أن احتمالية حدوثه ${likelihoodLabel} والعواقب المحتملة ${consequenceLabel}. يُنصح بمراقبة الوضع واتخاذ إجراءات وقائية بسيطة لتجنب تكرار الحادث.`,
            
            'متوسط': `هذا الحادث يُصنف ضمن المخاطر المتوسطة (${score} نقاط)، مما يعني أن احتمالية حدوثه ${likelihoodLabel} والعواقب المحتملة ${consequenceLabel}. يتطلب الأمر اتخاذ إجراءات تصحيحية واضحة ومتابعة دورية لضمان عدم تكرار الحادث أو تطوره إلى خطر أعلى.`,
            
            'عالي': `هذا الحادث يُصنف ضمن المخاطر العالية (${score} نقاط)، حيث أن احتمالية حدوثه ${likelihoodLabel} والعواقب المحتملة ${consequenceLabel}. يتطلب اتخاذ إجراءات عاجلة وشاملة، مع ضرورة تخصيص موارد كافية ومتابعة مكثفة من الإدارة العليا لمنع تكرار الحادث.`,
            
            'حرج': `هذا الحادث يُصنف ضمن المخاطر الحرجة (${score} نقاط)، وهو أعلى مستوى خطورة! احتمالية حدوثه ${likelihoodLabel} والعواقب ${consequenceLabel}. يتطلب تدخلاً فورياً وإيقاف أي أنشطة مشابهة حتى يتم معالجة جميع الأسباب الجذرية. يجب رفع التقرير للإدارة العليا فوراً مع خطة عمل شاملة.`
        };
        
        return explanations[levelLabel] || 'يرجى مراجعة تقييم المخاطر واتخاذ الإجراءات المناسبة.';
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof RiskMatrix !== 'undefined') {
            window.RiskMatrix = RiskMatrix;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ RiskMatrix module loaded and available on window.RiskMatrix');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير RiskMatrix:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof RiskMatrix !== 'undefined') {
            try {
                window.RiskMatrix = RiskMatrix;
            } catch (e) {
                console.error('❌ فشل تصدير RiskMatrix:', e);
            }
        }
    }
})();
