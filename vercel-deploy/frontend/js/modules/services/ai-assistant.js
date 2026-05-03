/**
 * AI Assistant Service
 * مساعد الذكاء الاصطناعي - للرد على الأسئلة واسترجاع البيانات
 * 
 * المميزات:
 * - الإجابة على الأسئلة العامة
 * - استرجاع بيانات الموظفين حسب الكود الوظيفي
 * - استرجاع مخالفات الموظفين والمقاولين
 * - استرجاع بيانات التدريب
 * - استرجاع مهمات الوقاية الشخصية
 * - استرجاع معايير واشتراطات السلامة
 */

const AIAssistant = {
    /**
     * معالجة سؤال المستخدم وإرجاع رد ذكي
     * @param {string} question - سؤال المستخدم
     * @param {Object} options - خيارات إضافية
     * @return {Promise<Object>} رد ذكي مع البيانات
     */
    async ask(question, options = {}) {
        try {
            if (!question || typeof question !== 'string' || question.trim().length === 0) {
                return {
                    success: false,
                    message: 'يرجى إدخال سؤال صحيح'
                };
            }

            const questionLower = question.toLowerCase().trim();
            
            // تحليل السؤال وفهم النية
            const intent = this.analyzeIntent(questionLower, question);
            
            // استخراج المعاملات من السؤال
            const parameters = this.extractParameters(questionLower, question);
            
            // تحديد نوع الطلب
            let response = null;
            
            switch (intent.type) {
                case 'employee_data':
                    response = await this.handleEmployeeDataRequest(parameters, options);
                    break;
                    
                case 'contractor_data':
                    response = await this.handleContractorDataRequest(parameters, options);
                    break;
                    
                case 'violation':
                    response = await this.handleViolationRequest(parameters, options, intent);
                    break;
                    
                case 'training':
                    response = await this.handleTrainingRequest(parameters, options, intent);
                    break;
                    
                case 'ppe':
                    response = await this.handlePPERequest(parameters, options);
                    break;
                    
                case 'permit':
                    response = await this.handlePermitRequest(parameters, options, intent);
                    break;
                    
                case 'safety_standards':
                    response = await this.handleSafetyStandardsRequest(parameters, options);
                    break;
                    
                case 'general_question':
                default:
                    // استخدام Backend AI إذا كان متاحاً
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                        try {
                            const backendResponse = await GoogleIntegration.sendToAppsScript('processAIQuestion', {
                                question: question,
                                context: {
                                    userId: AppState.currentUser?.id || null,
                                    userName: AppState.currentUser?.name || null,
                                    userRole: AppState.currentUser?.role || null,
                                    ...this.buildEnrichedContext()
                                }
                            });
                            
                            if (backendResponse && backendResponse.success) {
                                response = {
                                    success: true,
                                    text: backendResponse.text || backendResponse.message,
                                    data: backendResponse.data,
                                    intent: backendResponse.intent,
                                    module: backendResponse.module,
                                    actions: backendResponse.actions || []
                                };
                            } else {
                                response = this.generateDefaultResponse(question);
                            }
                        } catch (error) {
                            Utils.safeWarn('⚠️ خطأ في الاتصال بالـ Backend AI:', error);
                            response = this.generateDefaultResponse(question);
                        }
                    } else {
                        response = this.generateDefaultResponse(question);
                    }
                    break;
            }
            
            // تسجيل السؤال والرد
            if (typeof UserActivityLog !== 'undefined') {
                UserActivityLog.log('ai_query', 'AI Assistant', null, {
                    question: question,
                    intent: intent.type,
                    response: response.success ? 'success' : 'failed'
                }).catch(() => {});
            }
            
            return response;
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة السؤال:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء معالجة السؤال. يرجى المحاولة مرة أخرى.',
                error: error.toString()
            };
        }
    },

    /**
     * تحليل نية السؤال
     */
    analyzeIntent(questionLower, originalQuestion) {
        const intent = {
            type: 'general_question',
            confidence: 0.5,
            keywords: [],
            isLastRequest: false // للتحقق من طلب "آخر" شيء
        };
        
        // التحقق من طلب "آخر" شيء
        const lastPatterns = ['آخر', 'last', 'أحدث', 'recent', 'الأخير', 'the last'];
        intent.isLastRequest = lastPatterns.some(pattern => questionLower.includes(pattern));
        
        // أنماط بيانات الموظفين
        const employeePatterns = [
            'موظف', 'employee', 'كود وظيفي', 'job code', 'jobcode',
            'بيانات موظف', 'employee data', 'معلومات موظف', 'employee info',
            'كود', 'code', 'رقم موظف', 'employee number'
        ];
        
        // أنماط المخالفات
        const violationPatterns = [
            'مخالفة', 'violation', 'مخالفات', 'violations',
            'مخالفة موظف', 'employee violation', 'مخالفة مقاول', 'contractor violation'
        ];
        
        // أنماط التدريب
        const trainingPatterns = [
            'تدريب', 'training', 'برنامج تدريبي', 'training program',
            'بيانات تدريب', 'training data', 'مصفوفة تدريب', 'training matrix',
            'تدريب موظف', 'employee training', 'آخر تدريب', 'last training'
        ];
        
        // أنماط مهمات الوقاية
        const ppePatterns = [
            'مهمات وقاية', 'ppe', 'معدات حماية', 'protective equipment',
            'استلام مهمات', 'receive ppe', 'مهمات وقاية شخصية',
            'مصفوفة مهمات', 'ppe matrix'
        ];
        
        // أنماط معايير السلامة
        const safetyStandardsPatterns = [
            'معايير سلامة', 'safety standards', 'اشتراطات سلامة', 'safety requirements',
            'معايير', 'standards', 'اشتراطات', 'requirements',
            'iso', 'إجراءات', 'procedures', 'مستندات', 'documents',
            'سلامة', 'safety', 'صحة', 'health', 'أمان', 'security'
        ];
        
        // أنماط بيانات المقاولين
        const contractorPatterns = [
            'مقاول', 'contractor', 'بيانات مقاول', 'contractor data',
            'معلومات مقاول', 'contractor info', 'مقاولين', 'contractors'
        ];
        
        // أنماط التصاريح
        const permitPatterns = [
            'تصريح', 'permit', 'تصاريح', 'permits', 'ptw',
            'تصريح عمل', 'work permit', 'تصريح مقاول', 'contractor permit',
            'تصاريح مقاول', 'contractor permits'
        ];
        
        // حساب النقاط لكل نوع
        let employeeScore = 0;
        let violationScore = 0;
        let trainingScore = 0;
        let ppeScore = 0;
        let safetyStandardsScore = 0;
        let contractorScore = 0;
        let permitScore = 0;
        
        employeePatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) employeeScore += 1;
        });
        
        violationPatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) violationScore += 1;
        });
        
        trainingPatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) trainingScore += 1;
        });
        
        ppePatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) ppeScore += 1;
        });
        
        safetyStandardsPatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) safetyStandardsScore += 1;
        });
        
        contractorPatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) contractorScore += 1;
        });
        
        permitPatterns.forEach(pattern => {
            if (questionLower.includes(pattern)) permitScore += 1;
        });
        
        // تحديد النية الأقوى
        const scores = {
            'employee_data': employeeScore,
            'violation': violationScore,
            'training': trainingScore,
            'ppe': ppeScore,
            'safety_standards': safetyStandardsScore,
            'contractor_data': contractorScore,
            'permit': permitScore
        };
        
        let maxScore = 0;
        let maxType = 'general_question';
        
        for (let type in scores) {
            if (scores[type] > maxScore) {
                maxScore = scores[type];
                maxType = type;
            }
        }
        
        intent.type = maxScore > 0 ? maxType : 'general_question';
        intent.confidence = Math.min(maxScore / 3, 1.0);
        
        return intent;
    },

    /**
     * استخراج المعاملات من السؤال
     */
    extractParameters(questionLower, originalQuestion) {
        const params = {
            employeeCode: null,
            employeeNumber: null,
            employeeName: null,
            jobCode: null,
            violationType: null,
            personType: null, // 'employee' or 'contractor'
            trainingType: null,
            ppeType: null,
            standardType: null,
            searchTerm: null,
            contractorName: null,
            contractorId: null
        };
        
        // استخراج كود الموظف أو الكود الوظيفي
        const codePatterns = [
            /كود\s*(\d+)/i,
            /code\s*(\d+)/i,
            /job\s*code\s*(\d+)/i,
            /الكود\s*(\d+)/i,
            /رقم\s*(\d+)/i,
            /كود\s*الموظف\s*(\d+)/i,
            /كود\s*وظيفي\s*(\d+)/i,
            /الموظف\s*(\d+)/i,
            /موظف\s*(\d+)/i
        ];
        
        for (let pattern of codePatterns) {
            const match = originalQuestion.match(pattern);
            if (match && match[1]) {
                params.employeeCode = match[1];
                params.jobCode = match[1];
                break;
            }
        }
        
        // استخراج رقم الموظف
        const employeeNumberPatterns = [
            /رقم\s*موظف\s*(\d+)/i,
            /employee\s*number\s*(\d+)/i,
            /emp\s*no\s*(\d+)/i
        ];
        
        for (let pattern of employeeNumberPatterns) {
            const match = originalQuestion.match(pattern);
            if (match && match[1]) {
                params.employeeNumber = match[1];
                break;
            }
        }
        
        // تحديد نوع الشخص (موظف أو مقاول)
        if (questionLower.includes('مقاول') || questionLower.includes('contractor')) {
            params.personType = 'contractor';
        } else if (questionLower.includes('موظف') || questionLower.includes('employee')) {
            params.personType = 'employee';
        }
        
        // استخراج اسم الموظف (إذا كان موجوداً)
        const nameMatch = originalQuestion.match(/(?:اسم|name)\s+([أ-ي\s]+)/i);
        if (nameMatch && nameMatch[1]) {
            params.employeeName = nameMatch[1].trim();
        }
        
        // استخراج مصطلح البحث (لأسئلة السلامة)
        const searchMatch = originalQuestion.match(/(?:ما هي|what is|كيف|how|معلومات عن|information about)\s+([أ-ي\s]+)/i);
        if (searchMatch && searchMatch[1]) {
            params.searchTerm = searchMatch[1].trim();
        }
        
        // استخراج اسم المقاول (إذا كان موجوداً)
        if (params.personType === 'contractor') {
            // محاولة استخراج الاسم بعد كلمة "مقاول" أو "contractor"
            const contractorNamePatterns = [
                /(?:مقاول|contractor)\s+(?:اسمه|name|هو|is)\s+([أ-ي\s]+?)(?:\s|$|\?|؟)/i,
                /(?:مقاول|contractor)\s+([أ-ي\s]+?)(?:\s|$|\?|؟)/i,
                /(?:بيانات|data|معلومات|info)\s+(?:مقاول|contractor)\s+([أ-ي\s]+?)(?:\s|$|\?|؟)/i,
                /(?:اسم|name)\s+(?:مقاول|contractor)\s+([أ-ي\s]+?)(?:\s|$|\?|؟)/i
            ];
            
            for (let pattern of contractorNamePatterns) {
                const match = originalQuestion.match(pattern);
                if (match && match[1]) {
                    const extractedName = match[1].trim();
                    // التأكد من أن الاسم ليس كلمة فارغة أو كلمة واحدة فقط
                    if (extractedName.length > 2 && !extractedName.match(/^(هو|is|اسمه|name)$/i)) {
                        params.contractorName = extractedName;
                        break;
                    }
                }
            }
            
            // إذا لم يتم العثور على اسم، محاولة استخراج الاسم من نهاية السؤال
            if (!params.contractorName) {
                const nameMatch = originalQuestion.match(/(?:اسم|name)\s+([أ-ي\s]+?)(?:\s|$|\?|؟)/i);
                if (nameMatch && nameMatch[1]) {
                    const extractedName = nameMatch[1].trim();
                    if (extractedName.length > 2) {
                        params.contractorName = extractedName;
                    }
                }
            }
        }
        
        return params;
    },

    /**
     * معالجة طلب بيانات الموظف - تقرير شامل
     */
    async handleEmployeeDataRequest(parameters, options) {
        try {
            let employee = null;
            
            // البحث عن الموظف
            if (parameters.employeeCode || parameters.jobCode) {
                const code = parameters.employeeCode || parameters.jobCode;
                employee = this.findEmployeeByCode(code);
            } else if (parameters.employeeNumber) {
                employee = this.findEmployeeByNumber(parameters.employeeNumber);
            } else if (parameters.employeeName) {
                employee = this.findEmployeeByName(parameters.employeeName);
            }
            
            if (!employee) {
                return {
                    success: false,
                    message: 'لم يتم العثور على موظف بهذه البيانات. يرجى التحقق من الكود أو الرقم المدخل.',
                    text: '❌ لم يتم العثور على موظف بهذه البيانات.\n\nيرجى التحقق من:\n• الكود الوظيفي\n• رقم الموظف\n• الاسم'
                };
            }
            
            const employeeCode = employee.employeeNumber || employee.job || employee.id;
            const employeeId = employee.id || employee.employeeNumber;
            
            // تجميع بيانات الموظف
            const employeeData = {
                basic: {
                    name: employee.name || 'غير محدد',
                    employeeNumber: employee.employeeNumber || 'غير محدد',
                    sapId: employee.sapId || 'غير محدد',
                    job: employee.job || 'غير محدد',
                    department: employee.department || 'غير محدد',
                    branch: employee.branch || 'غير محدد',
                    location: employee.location || 'غير محدد',
                    position: employee.position || 'غير محدد',
                    email: employee.email || 'غير محدد',
                    phone: employee.phone || 'غير محدد'
                },
                violations: [],
                training: null,
                trainingRecords: [],
                ppe: null,
                ppeRecords: [],
                clinicVisits: [],
                injuries: [],
                incidents: []
            };
            
            // الحصول على المخالفات (محلي فقط — سريع)
            try {
                const violations = AppState.appData.Violations || AppState.appData.violations || [];
                employeeData.violations = violations.filter(v => 
                    (v.employeeCode === employeeCode || 
                     v.employeeNumber === employeeCode ||
                     v.employeeId === employeeId ||
                     v.employeeCode === employee.employeeNumber ||
                     v.employeeNumber === employee.employeeNumber) &&
                    v.personType === 'employee'
                ).sort((a, b) => {
                    const dateA = new Date(a.violationDate || a.createdAt || 0);
                    const dateB = new Date(b.violationDate || b.createdAt || 0);
                    return dateB - dateA;
                });
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على المخالفات:', error);
            }
            
            // الحصول على بيانات التدريب (محلي فقط لتسريع الرد — بدون استدعاء Backend)
            try {
                const allTrainings = AppState.appData.Training || AppState.appData.training || [];
                employeeData.trainingRecords = allTrainings.filter(t => {
                    if (!t.participants) return false;
                    const participants = Array.isArray(t.participants) ? t.participants : [];
                    return participants.some(p => 
                        (p.code || p.employeeCode || p.employeeNumber) === employeeCode ||
                        (p.name && employee.name && p.name.toLowerCase().includes(employee.name.toLowerCase()))
                    );
                }).sort((a, b) => {
                    const dateA = new Date(a.startDate || a.createdAt || 0);
                    const dateB = new Date(b.startDate || b.createdAt || 0);
                    return dateB - dateA;
                });
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على بيانات التدريب:', error);
            }

            // الحصول على مهمات الوقاية (محلي فقط لتسريع الرد)
            try {
                const ppeRecords = AppState.appData.PPE || AppState.appData.ppe || [];
                employeeData.ppeRecords = ppeRecords.filter(p => 
                    p.employeeCode === employeeCode ||
                    p.employeeNumber === employeeCode ||
                    p.employeeCode === employee.employeeNumber ||
                    p.employeeNumber === employee.employeeNumber
                ).sort((a, b) => {
                    const dateA = new Date(a.receiptDate || a.createdAt || 0);
                    const dateB = new Date(b.receiptDate || b.createdAt || 0);
                    return dateB - dateA;
                });
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على مهمات الوقاية:', error);
            }
            
            // الحصول على زيارات العيادة (محلي فقط لتسريع الرد)
            try {
                const clinicVisits = AppState.appData.Clinic || AppState.appData.clinicVisits || [];
                employeeData.clinicVisits = clinicVisits.filter(v =>
                    (v.employeeCode === employeeCode || v.employeeNumber === employeeCode ||
                     v.employeeCode === employee.employeeNumber || v.employeeNumber === employee.employeeNumber) &&
                    (v.personType === 'employee' || !v.personType)
                ).sort((a, b) => new Date(b.visitDate || b.createdAt || 0) - new Date(a.visitDate || a.createdAt || 0));
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على زيارات العيادة:', error);
            }

            // الحصول على الإصابات (محلي فقط)
            try {
                const injuries = AppState.appData.injuries || [];
                employeeData.injuries = injuries.filter(i =>
                    (i.employeeCode === employeeCode || i.employeeNumber === employeeCode ||
                     i.employeeCode === employee.employeeNumber || i.employeeNumber === employee.employeeNumber) &&
                    (i.personType === 'employee' || !i.personType)
                ).sort((a, b) => new Date(b.injuryDate || b.createdAt || 0) - new Date(a.injuryDate || a.createdAt || 0));
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على الإصابات:', error);
            }

            // الحصول على الحوادث (محلي فقط)
            try {
                const incidents = AppState.appData.Incidents || AppState.appData.incidents || [];
                employeeData.incidents = incidents.filter(inc => {
                    // البحث في المتأثرين
                    if (inc.affectedPersons && Array.isArray(inc.affectedPersons)) {
                        return inc.affectedPersons.some(ap => 
                            (ap.employeeCode === employeeCode ||
                             ap.employeeNumber === employeeCode ||
                             ap.employeeCode === employee.employeeNumber ||
                             ap.employeeNumber === employee.employeeNumber) ||
                            (ap.name && employee.name && ap.name.toLowerCase().includes(employee.name.toLowerCase()))
                        );
                    }
                    // البحث في الحقول المباشرة
                    return (inc.employeeCode === employeeCode ||
                           inc.employeeNumber === employeeCode ||
                           inc.employeeCode === employee.employeeNumber ||
                           inc.employeeNumber === employee.employeeNumber) ||
                           (inc.employeeName && employee.name && inc.employeeName.toLowerCase().includes(employee.name.toLowerCase()));
                }).sort((a, b) => {
                    const dateA = new Date(a.date || a.incidentDate || a.createdAt || 0);
                    const dateB = new Date(b.date || b.incidentDate || b.createdAt || 0);
                    return dateB - dateA;
                });
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على الحوادث:', error);
            }
            
            // توليد تقرير شامل
            let responseText = `📋 تقرير شامل عن الموظف\n`;
            responseText += `═══════════════════════════════════\n\n`;
            
            // البيانات الأساسية
            responseText += `👤 البيانات الأساسية:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            responseText += `الاسم: ${employeeData.basic.name}\n`;
            responseText += `رقم الموظف: ${employeeData.basic.employeeNumber}\n`;
            responseText += `الكود الوظيفي: ${employeeData.basic.job}\n`;
            responseText += `الإدارة: ${employeeData.basic.department}\n`;
            responseText += `الفرع: ${employeeData.basic.branch}\n`;
            responseText += `الموقع: ${employeeData.basic.location}\n`;
            responseText += `المنصب: ${employeeData.basic.position}\n`;
            if (employeeData.basic.email !== 'غير محدد') {
                responseText += `البريد الإلكتروني: ${employeeData.basic.email}\n`;
            }
            if (employeeData.basic.phone !== 'غير محدد') {
                responseText += `الهاتف: ${employeeData.basic.phone}\n`;
            }
            responseText += `\n`;
            
            // المخالفات
            responseText += `⚠️ المخالفات:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            if (employeeData.violations.length > 0) {
                responseText += `إجمالي المخالفات: ${employeeData.violations.length}\n\n`;
                employeeData.violations.slice(0, 5).forEach((v, index) => {
                    responseText += `${index + 1}. ${v.violationType || 'غير محدد'}\n`;
                    if (v.violationDate) {
                        responseText += `   التاريخ: ${new Date(v.violationDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    responseText += `   الشدة: ${v.severity || 'غير محدد'}\n`;
                    if (v.violationLocation) {
                        responseText += `   الموقع: ${v.violationLocation}\n`;
                    }
                    if (v.actionTaken) {
                        responseText += `   الإجراء: ${v.actionTaken}\n`;
                    }
                    responseText += `\n`;
                });
                if (employeeData.violations.length > 5) {
                    responseText += `... و ${employeeData.violations.length - 5} مخالفة أخرى\n`;
                }
            } else {
                responseText += `✅ لا توجد مخالفات مسجلة\n`;
            }
            responseText += `\n`;
            
            // التدريب
            responseText += `📚 التدريب:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            if (employeeData.trainingRecords.length > 0) {
                responseText += `إجمالي برامج التدريب: ${employeeData.trainingRecords.length}\n\n`;
                employeeData.trainingRecords.slice(0, 5).forEach((t, index) => {
                    responseText += `${index + 1}. ${t.title || t.topic || t.name || 'غير محدد'}\n`;
                    if (t.startDate) {
                        responseText += `   التاريخ: ${new Date(t.startDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (t.status) {
                        responseText += `   الحالة: ${t.status}\n`;
                    }
                    if (t.hours) {
                        responseText += `   الساعات: ${t.hours}\n`;
                    }
                    responseText += `\n`;
                });
                if (employeeData.trainingRecords.length > 5) {
                    responseText += `... و ${employeeData.trainingRecords.length - 5} برنامج تدريبي آخر\n`;
                }
            } else {
                responseText += `ℹ️ لا توجد سجلات تدريب مسجلة\n`;
            }
            if (employeeData.training) {
                responseText += `\n📊 مصفوفة التدريب: متوفرة\n`;
            }
            responseText += `\n`;
            
            // مهمات الوقاية
            responseText += `🛡️ مهمات الوقاية المستلمة:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            if (employeeData.ppeRecords.length > 0) {
                responseText += `إجمالي السجلات: ${employeeData.ppeRecords.length}\n\n`;
                employeeData.ppeRecords.slice(0, 5).forEach((p, index) => {
                    responseText += `${index + 1}. ${p.equipmentType || 'غير محدد'}\n`;
                    if (p.receiptDate) {
                        responseText += `   تاريخ الاستلام: ${new Date(p.receiptDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (p.quantity) {
                        responseText += `   الكمية: ${p.quantity}\n`;
                    }
                    if (p.status) {
                        responseText += `   الحالة: ${p.status}\n`;
                    }
                    responseText += `\n`;
                });
                if (employeeData.ppeRecords.length > 5) {
                    responseText += `... و ${employeeData.ppeRecords.length - 5} سجل آخر\n`;
                }
            } else {
                responseText += `ℹ️ لا توجد سجلات مهمات وقاية مسجلة\n`;
            }
            if (employeeData.ppe) {
                responseText += `\n📊 مصفوفة مهمات الوقاية: متوفرة\n`;
            }
            responseText += `\n`;
            
            // تردد على العيادة
            responseText += `🏥 تردد على العيادة:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            if (employeeData.clinicVisits.length > 0) {
                responseText += `إجمالي الزيارات: ${employeeData.clinicVisits.length}\n\n`;
                employeeData.clinicVisits.slice(0, 5).forEach((v, index) => {
                    responseText += `${index + 1}. `;
                    if (v.visitDate) {
                        responseText += `${new Date(v.visitDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (v.reason) {
                        responseText += `   السبب: ${v.reason}\n`;
                    }
                    if (v.diagnosis) {
                        responseText += `   التشخيص: ${v.diagnosis}\n`;
                    }
                    if (v.treatment) {
                        responseText += `   العلاج: ${v.treatment}\n`;
                    }
                    responseText += `\n`;
                });
                if (employeeData.clinicVisits.length > 5) {
                    responseText += `... و ${employeeData.clinicVisits.length - 5} زيارة أخرى\n`;
                }
            } else {
                responseText += `✅ لا توجد زيارات مسجلة\n`;
            }
            responseText += `\n`;
            
            // الإصابات
            responseText += `🩹 الإصابات:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            if (employeeData.injuries.length > 0) {
                responseText += `إجمالي الإصابات: ${employeeData.injuries.length}\n\n`;
                employeeData.injuries.slice(0, 5).forEach((i, index) => {
                    responseText += `${index + 1}. ${i.injuryType || 'غير محدد'}\n`;
                    if (i.injuryDate) {
                        responseText += `   التاريخ: ${new Date(i.injuryDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (i.injuryLocation) {
                        responseText += `   الموقع: ${i.injuryLocation}\n`;
                    }
                    if (i.injuryDescription) {
                        const desc = i.injuryDescription.length > 50 
                            ? i.injuryDescription.substring(0, 50) + '...' 
                            : i.injuryDescription;
                        responseText += `   الوصف: ${desc}\n`;
                    }
                    if (i.treatment) {
                        responseText += `   العلاج: ${i.treatment}\n`;
                    }
                    responseText += `\n`;
                });
                if (employeeData.injuries.length > 5) {
                    responseText += `... و ${employeeData.injuries.length - 5} إصابة أخرى\n`;
                }
            } else {
                responseText += `✅ لا توجد إصابات مسجلة\n`;
            }
            responseText += `\n`;
            
            // الحوادث
            responseText += `🚨 الحوادث:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            if (employeeData.incidents.length > 0) {
                responseText += `إجمالي الحوادث: ${employeeData.incidents.length}\n\n`;
                employeeData.incidents.slice(0, 5).forEach((inc, index) => {
                    responseText += `${index + 1}. ${inc.incidentType || inc.type || 'غير محدد'}\n`;
                    if (inc.date || inc.incidentDate) {
                        responseText += `   التاريخ: ${new Date(inc.date || inc.incidentDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (inc.location) {
                        responseText += `   الموقع: ${inc.location}\n`;
                    }
                    if (inc.severity) {
                        responseText += `   الشدة: ${inc.severity}\n`;
                    }
                    if (inc.description) {
                        const desc = inc.description.length > 50 
                            ? inc.description.substring(0, 50) + '...' 
                            : inc.description;
                        responseText += `   الوصف: ${desc}\n`;
                    }
                    responseText += `\n`;
                });
                if (employeeData.incidents.length > 5) {
                    responseText += `... و ${employeeData.incidents.length - 5} حادث آخر\n`;
                }
            } else {
                responseText += `✅ لا توجد حوادث مسجلة\n`;
            }
            responseText += `\n`;
            
            // ملخص إحصائي
            responseText += `📊 الملخص الإحصائي:\n`;
            responseText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            responseText += `• عدد المخالفات: ${employeeData.violations.length}\n`;
            responseText += `• عدد برامج التدريب: ${employeeData.trainingRecords.length}\n`;
            responseText += `• عدد سجلات مهمات الوقاية: ${employeeData.ppeRecords.length}\n`;
            responseText += `• عدد زيارات العيادة: ${employeeData.clinicVisits.length}\n`;
            responseText += `• عدد الإصابات: ${employeeData.injuries.length}\n`;
            responseText += `• عدد الحوادث: ${employeeData.incidents.length}\n`;
            
            return {
                success: true,
                text: responseText,
                data: employeeData,
                intent: { type: 'employee_data' },
                module: 'employees',
                actions: [
                    {
                        label: 'عرض تفاصيل الموظف',
                        action: 'navigate',
                        target: 'employees',
                        params: { employeeId: employee.id }
                    }
                ]
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب بيانات الموظف:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن بيانات الموظف.',
                error: error.toString()
            };
        }
    },

    /**
     * معالجة طلب بيانات المقاول
     */
    async handleContractorDataRequest(parameters, options) {
        try {
            let contractor = null;
            
            // البحث عن المقاول
            if (parameters.contractorName) {
                contractor = this.findContractorByName(parameters.contractorName);
            } else if (parameters.contractorId) {
                contractor = this.findContractorById(parameters.contractorId);
            }
            
            if (!contractor) {
                return {
                    success: false,
                    message: 'لم يتم العثور على مقاول بهذه البيانات. يرجى التحقق من الاسم المدخل.',
                    text: '❌ لم يتم العثور على مقاول بهذه البيانات.\n\nيرجى التحقق من:\n• اسم المقاول\n• رقم العقد'
                };
            }
            
            // تجميع بيانات المقاول
            const contractorData = {
                basic: {
                    name: contractor.name || contractor.company || contractor.contractorName || 'غير محدد',
                    serviceType: contractor.serviceType || 'غير محدد',
                    contractNumber: contractor.contractNumber || contractor.licenseNumber || 'غير محدد',
                    startDate: contractor.startDate || 'غير محدد',
                    endDate: contractor.endDate || 'غير محدد',
                    status: contractor.status || 'غير محدد',
                    contactPerson: contractor.contactPerson || 'غير محدد',
                    phone: contractor.phone || 'غير محدد',
                    email: contractor.email || 'غير محدد'
                },
                violations: null,
                permits: null
            };
            
            // الحصول على مخالفات المقاول
            try {
                const violations = AppState.appData.violations || [];
                const contractorViolations = violations.filter(v => 
                    (v.contractorId === contractor.id ||
                     v.contractorName === contractor.name ||
                     v.contractorName === contractor.company ||
                     v.contractorName === contractor.contractorName) &&
                    v.personType === 'contractor'
                );
                
                if (contractorViolations.length > 0) {
                    contractorData.violations = contractorViolations.slice(0, 10);
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على مخالفات المقاول:', error);
            }
            
            // الحصول على تصاريح المقاول
            try {
                const permits = AppState.appData.ptw || [];
                const contractorName = contractor.name || contractor.company || contractor.contractorName || '';
                const contractorPermits = permits.filter(p => {
                    if (!p) return false;
                    const teamMembers = Array.isArray(p.teamMembers) ? p.teamMembers : [];
                    const hasContractor = teamMembers.some(member => 
                        member && member.contractorName && (
                            member.contractorName === contractor.name ||
                            member.contractorName === contractor.company ||
                            member.contractorName === contractor.contractorName
                        )
                    );
                    
                    const hasInAuthorizedParty = p.authorizedParty && 
                        typeof p.authorizedParty === 'string' && (
                            p.authorizedParty.includes(contractor.name || '') ||
                            p.authorizedParty.includes(contractor.company || '') ||
                            p.authorizedParty.includes(contractor.contractorName || '')
                        );
                    
                    return hasContractor || hasInAuthorizedParty;
                });
                
                if (contractorPermits.length > 0) {
                    contractorData.permits = contractorPermits.slice(0, 10);
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على تصاريح المقاول:', error);
            }
            
            // توليد نص الرد
            let responseText = `🏢 بيانات المقاول:\n\n`;
            responseText += `الاسم: ${contractorData.basic.name}\n`;
            responseText += `نوع الخدمة: ${contractorData.basic.serviceType}\n`;
            responseText += `رقم العقد: ${contractorData.basic.contractNumber}\n`;
            
            if (contractorData.basic.startDate !== 'غير محدد') {
                responseText += `تاريخ البدء: ${new Date(contractorData.basic.startDate).toLocaleDateString('ar-SA')}\n`;
            }
            if (contractorData.basic.endDate !== 'غير محدد') {
                responseText += `تاريخ الانتهاء: ${new Date(contractorData.basic.endDate).toLocaleDateString('ar-SA')}\n`;
            }
            responseText += `الحالة: ${contractorData.basic.status}\n`;
            
            if (contractorData.basic.contactPerson !== 'غير محدد') {
                responseText += `الشخص المسؤول: ${contractorData.basic.contactPerson}\n`;
            }
            if (contractorData.basic.phone !== 'غير محدد') {
                responseText += `الهاتف: ${contractorData.basic.phone}\n`;
            }
            if (contractorData.basic.email !== 'غير محدد') {
                responseText += `البريد الإلكتروني: ${contractorData.basic.email}\n`;
            }
            
            if (contractorData.violations && contractorData.violations.length > 0) {
                responseText += `\n⚠️ عدد المخالفات: ${contractorData.violations.length}\n`;
            }
            
            if (contractorData.permits && contractorData.permits.length > 0) {
                responseText += `\n🪪 عدد التصاريح: ${contractorData.permits.length}\n`;
            }
            
            return {
                success: true,
                text: responseText,
                data: contractorData,
                intent: { type: 'contractor_data' },
                module: 'contractors',
                actions: [
                    {
                        label: 'عرض تفاصيل المقاول',
                        action: 'navigate',
                        target: 'contractors',
                        params: { contractorId: contractor.id }
                    }
                ]
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب بيانات المقاول:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن بيانات المقاول.',
                error: error.toString()
            };
        }
    },
    
    /**
     * البحث عن مقاول بالاسم
     */
    findContractorByName(name) {
        const contractors = AppState.appData.contractors || [];
        const nameLower = name.toLowerCase().trim();
        return contractors.find(contractor => {
            const contractorName = (contractor.name || contractor.company || contractor.contractorName || '').toLowerCase();
            return contractorName.includes(nameLower) || nameLower.includes(contractorName);
        });
    },
    
    /**
     * البحث عن مقاول بالمعرف
     */
    findContractorById(id) {
        const contractors = AppState.appData.contractors || [];
        return contractors.find(contractor => 
            contractor.id === id ||
            contractor.id?.toString() === id.toString()
        );
    },
    
    /**
     * البحث عن موظف بالكود (يدعم employees و Employees)
     */
    findEmployeeByCode(code) {
        const codeStr = String(code).trim();
        const employees = AppState.appData.Employees || AppState.appData.employees || [];
        return employees.find(emp =>
            (emp.job && String(emp.job).trim() === codeStr) ||
            (emp.employeeNumber && String(emp.employeeNumber).trim() === codeStr) ||
            (emp.sapId && String(emp.sapId).trim() === codeStr) ||
            (emp.id && String(emp.id).trim() === codeStr)
        );
    },

    /**
     * البحث عن موظف برقم الموظف
     */
    findEmployeeByNumber(number) {
        const employees = AppState.appData.Employees || AppState.appData.employees || [];
        return employees.find(emp => 
            emp.employeeNumber === number ||
            emp.sapId === number
        );
    },

    /**
     * البحث عن موظف بالاسم
     */
    findEmployeeByName(name) {
        const employees = AppState.appData.Employees || AppState.appData.employees || [];
        const nameLower = name.toLowerCase().trim();
        return employees.find(emp => 
            emp.name && emp.name.toLowerCase().includes(nameLower)
        );
    },

    /**
     * معالجة طلب المخالفات
     */
    async handleViolationRequest(parameters, options, intent = {}) {
        try {
            const violations = AppState.appData.violations || [];
            let filteredViolations = violations;
            let employee = null;
            let contractor = null;
            
            // البحث عن الموظف إذا كان هناك كود أو اسم
            if (parameters.employeeCode || parameters.jobCode) {
                const code = parameters.employeeCode || parameters.jobCode;
                employee = this.findEmployeeByCode(code);
            } else if (parameters.employeeNumber) {
                employee = this.findEmployeeByNumber(parameters.employeeNumber);
            } else if (parameters.employeeName) {
                employee = this.findEmployeeByName(parameters.employeeName);
            }
            
            // البحث عن المقاول إذا كان هناك اسم مقاول
            if (parameters.contractorName || parameters.personType === 'contractor') {
                if (parameters.contractorName) {
                    contractor = this.findContractorByName(parameters.contractorName);
                }
            }
            
            // فلترة حسب نوع الشخص
            if (parameters.personType) {
                filteredViolations = filteredViolations.filter(v => 
                    v.personType === parameters.personType
                );
            }
            
            // فلترة حسب المقاول
            if (contractor || (parameters.personType === 'contractor' && !employee)) {
                if (contractor) {
                    filteredViolations = filteredViolations.filter(v => 
                        v.contractorId === contractor.id ||
                        v.contractorName === contractor.name ||
                        v.contractorName === contractor.company ||
                        v.contractorName === contractor.contractorName
                    );
                } else if (parameters.personType === 'contractor') {
                    // فلترة جميع مخالفات المقاولين
                    filteredViolations = filteredViolations.filter(v => 
                        v.personType === 'contractor' && v.contractorName
                    );
                }
            }
            
            // فلترة حسب كود الموظف
            if (parameters.employeeCode || parameters.jobCode) {
                const code = parameters.employeeCode || parameters.jobCode;
                filteredViolations = filteredViolations.filter(v => 
                    v.employeeCode === code ||
                    v.employeeNumber === code ||
                    v.employeeId === code ||
                    (employee && (
                        v.employeeCode === employee.employeeNumber ||
                        v.employeeNumber === employee.employeeNumber ||
                        v.employeeId === employee.id
                    ))
                );
            }
            
            // فلترة حسب اسم الموظف
            if (parameters.employeeName || (employee && employee.name)) {
                const nameToSearch = parameters.employeeName || employee.name;
                const nameLower = nameToSearch.toLowerCase();
                filteredViolations = filteredViolations.filter(v => 
                    (v.employeeName && v.employeeName.toLowerCase().includes(nameLower)) ||
                    (employee && v.employeeName && employee.name && 
                     v.employeeName.toLowerCase().includes(employee.name.toLowerCase()))
                );
            }
            
            // ترتيب حسب التاريخ (الأحدث أولاً)
            filteredViolations.sort((a, b) => {
                const dateA = new Date(a.violationDate || a.createdAt || 0);
                const dateB = new Date(b.violationDate || b.createdAt || 0);
                return dateB - dateA;
            });
            
            if (filteredViolations.length === 0) {
                let personInfo = '';
                if (employee) {
                    personInfo = ` للموظف ${employee.name || employee.employeeNumber}`;
                } else if (contractor) {
                    personInfo = ` للمقاول ${contractor.name || contractor.company || contractor.contractorName}`;
                } else if (parameters.personType === 'contractor') {
                    personInfo = ' للمقاولين';
                }
                return {
                    success: true,
                    text: `✅ لم يتم العثور على مخالفات${personInfo} تطابق المعايير المحددة.`,
                    data: { violations: [], count: 0, employee: employee, contractor: contractor },
                    intent: { type: 'violation' },
                    module: 'violations'
                };
            }
            
            // إذا طلب آخر مخالفة
            if (intent.isLastRequest && filteredViolations.length > 0) {
                const lastViolation = filteredViolations[0];
                let responseText = `📋 آخر مخالفة`;
                if (employee) {
                    responseText += ` للموظف ${employee.name || employee.employeeNumber}`;
                } else if (contractor) {
                    responseText += ` للمقاول ${contractor.name || contractor.company || contractor.contractorName}`;
                }
                responseText += `:\n\n`;
                responseText += `نوع المخالفة: ${lastViolation.violationType || 'غير محدد'}\n`;
                if (lastViolation.violationDate) {
                    const violationDate = new Date(lastViolation.violationDate);
                    responseText += `التاريخ: ${violationDate.toLocaleDateString('ar-SA')}\n`;
                    const daysAgo = Math.floor((Date.now() - violationDate.getTime()) / (1000 * 60 * 60 * 24));
                    responseText += `منذ: ${daysAgo} يوم\n`;
                }
                responseText += `الشدة: ${lastViolation.severity || 'غير محدد'}\n`;
                if (lastViolation.violationLocation) {
                    responseText += `الموقع: ${lastViolation.violationLocation}\n`;
                }
                if (lastViolation.actionTaken) {
                    responseText += `الإجراء المتخذ: ${lastViolation.actionTaken}\n`;
                }
                if (lastViolation.status) {
                    responseText += `الحالة: ${lastViolation.status}\n`;
                }
                
                return {
                    success: true,
                    text: responseText,
                    data: {
                        lastViolation: lastViolation,
                        violations: filteredViolations.slice(0, 10),
                        count: filteredViolations.length,
                        employee: employee,
                        contractor: contractor
                    },
                    intent: { type: 'violation', isLast: true },
                    module: 'violations',
                    actions: [
                        {
                            label: 'عرض جميع المخالفات',
                            action: 'navigate',
                            target: 'violations'
                        }
                    ]
                };
            }
            
            // توليد نص الرد
            let responseText = `📋 المخالفات`;
            if (employee) {
                responseText += ` للموظف ${employee.name || employee.employeeNumber}`;
            } else if (contractor) {
                responseText += ` للمقاول ${contractor.name || contractor.company || contractor.contractorName}`;
            } else if (parameters.personType === 'contractor') {
                responseText += ' للمقاولين';
            }
            responseText += `:\n\n`;
            responseText += `إجمالي المخالفات: ${filteredViolations.length}\n\n`;
            
            filteredViolations.slice(0, 5).forEach((violation, index) => {
                responseText += `${index + 1}. ${violation.violationType || 'غير محدد'}\n`;
                responseText += `   التاريخ: ${violation.violationDate ? new Date(violation.violationDate).toLocaleDateString('ar-SA') : 'غير محدد'}\n`;
                responseText += `   الشدة: ${violation.severity || 'غير محدد'}\n`;
                if (violation.employeeName) {
                    responseText += `   الموظف: ${violation.employeeName}`;
                    if (violation.employeeCode) {
                        responseText += ` (كود: ${violation.employeeCode})`;
                    }
                    responseText += `\n`;
                }
                if (violation.contractorName) {
                    responseText += `   المقاول: ${violation.contractorName}\n`;
                }
                if (violation.violationLocation) {
                    responseText += `   الموقع: ${violation.violationLocation}\n`;
                }
                responseText += `\n`;
            });
            
            if (filteredViolations.length > 5) {
                responseText += `... و ${filteredViolations.length - 5} مخالفة أخرى\n`;
            }
            
            return {
                success: true,
                text: responseText,
                data: {
                    violations: filteredViolations.slice(0, 10),
                    count: filteredViolations.length,
                    employee: employee,
                    contractor: contractor
                },
                intent: { type: 'violation' },
                module: 'violations',
                actions: [
                    {
                        label: 'عرض جميع المخالفات',
                        action: 'navigate',
                        target: 'violations'
                    }
                ]
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب المخالفات:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن المخالفات.',
                error: error.toString()
            };
        }
    },

    /**
     * معالجة طلب بيانات التدريب
     */
    async handleTrainingRequest(parameters, options, intent = {}) {
        try {
            const isLastRequest = intent.isLastRequest || false;
            let trainingData = null;
            let employee = null;
            
            // إذا كان هناك كود موظف، البحث عن الموظف
            if (parameters.employeeCode || parameters.jobCode) {
                const code = parameters.employeeCode || parameters.jobCode;
                employee = this.findEmployeeByCode(code);
            } else if (parameters.employeeNumber) {
                employee = this.findEmployeeByNumber(parameters.employeeNumber);
            } else if (parameters.employeeName) {
                employee = this.findEmployeeByName(parameters.employeeName);
            }
            
            // إذا كان هناك موظف وطلب آخر تدريب
            if (employee && isLastRequest) {
                return await this.handleLastTrainingRequest(employee);
            }
            
            // إذا كان هناك موظف، الحصول على مصفوفة التدريب
            if (employee) {
                try {
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                        const result = await GoogleIntegration.sendToAppsScript('getEmployeeTrainingMatrix', {
                            employeeId: employee.id || employee.employeeNumber
                        });
                        
                        if (result && result.success && result.data) {
                            trainingData = result.data;
                        }
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في الحصول على مصفوفة التدريب:', error);
                }
                
                // البحث عن تدريبات الموظف من بيانات التدريب
                const allTrainings = AppState.appData.training || [];
                const employeeTrainings = allTrainings.filter(t => {
                    if (!t.participants || !Array.isArray(t.participants)) return false;
                    return t.participants.some(p => 
                        (p.code || p.employeeCode || p.employeeNumber) === (employee.employeeNumber || employee.job) ||
                        (p.name && employee.name && p.name.toLowerCase().includes(employee.name.toLowerCase()))
                    );
                });
                
                // ترتيب حسب التاريخ (الأحدث أولاً)
                employeeTrainings.sort((a, b) => {
                    const dateA = new Date(a.startDate || a.createdAt || 0);
                    const dateB = new Date(b.startDate || b.createdAt || 0);
                    return dateB - dateA;
                });
                
                if (employeeTrainings.length > 0) {
                    let responseText = `📚 تدريبات الموظف ${employee.name || employee.employeeNumber}:\n\n`;
                    
                    if (isLastRequest && employeeTrainings.length > 0) {
                        const lastTraining = employeeTrainings[0];
                        responseText = `📚 آخر تدريب للموظف ${employee.name || employee.employeeNumber}:\n\n`;
                        responseText += `البرنامج: ${lastTraining.title || lastTraining.name || lastTraining.topic || 'غير محدد'}\n`;
                        if (lastTraining.startDate) {
                            const trainingDate = new Date(lastTraining.startDate);
                            responseText += `التاريخ: ${trainingDate.toLocaleDateString('ar-SA')}\n`;
                            const daysAgo = Math.floor((Date.now() - trainingDate.getTime()) / (1000 * 60 * 60 * 24));
                            responseText += `منذ: ${daysAgo} يوم\n`;
                        }
                        if (lastTraining.status) {
                            responseText += `الحالة: ${lastTraining.status}\n`;
                        }
                        if (lastTraining.hours) {
                            responseText += `عدد الساعات: ${lastTraining.hours}\n`;
                        }
                        if (lastTraining.trainer) {
                            responseText += `المدرب: ${lastTraining.trainer}\n`;
                        }
                        if (lastTraining.location) {
                            responseText += `الموقع: ${lastTraining.location}\n`;
                        }
                        
                        return {
                            success: true,
                            text: responseText,
                            data: { 
                                lastTraining: lastTraining,
                                employee: employee,
                                allTrainings: employeeTrainings.slice(0, 10)
                            },
                            intent: { type: 'training', isLast: true },
                            module: 'training',
                            actions: [
                                {
                                    label: 'عرض جميع تدريبات الموظف',
                                    action: 'navigate',
                                    target: 'training'
                                }
                            ]
                        };
                    }
                    
                    employeeTrainings.slice(0, 5).forEach((training, index) => {
                        responseText += `${index + 1}. ${training.title || training.topic || 'غير محدد'}\n`;
                        if (training.startDate) {
                            responseText += `   التاريخ: ${new Date(training.startDate).toLocaleDateString('ar-SA')}\n`;
                        }
                        if (training.status) {
                            responseText += `   الحالة: ${training.status}\n`;
                        }
                        responseText += `\n`;
                    });
                    
                    if (employeeTrainings.length > 5) {
                        responseText += `... و ${employeeTrainings.length - 5} تدريب آخر\n`;
                    }
                    
                    return {
                        success: true,
                        text: responseText,
                        data: {
                            trainings: employeeTrainings.slice(0, 10),
                            count: employeeTrainings.length,
                            employee: employee
                        },
                        intent: { type: 'training' },
                        module: 'training',
                        actions: [
                            {
                                label: 'عرض جميع تدريبات الموظف',
                                action: 'navigate',
                                target: 'training'
                            }
                        ]
                    };
                }
            }
            
            // إذا لم يكن هناك بيانات تدريب محددة، الحصول على جميع بيانات التدريب
            if (!trainingData && !employee) {
                const trainings = AppState.appData.training || [];
                
                // ترتيب حسب التاريخ (الأحدث أولاً)
                const sortedTrainings = trainings.sort((a, b) => {
                    const dateA = new Date(a.startDate || a.createdAt || 0);
                    const dateB = new Date(b.startDate || b.createdAt || 0);
                    return dateB - dateA;
                });
                
                if (sortedTrainings.length === 0) {
                    return {
                        success: true,
                        text: '📚 لا توجد بيانات تدريب متاحة حالياً.',
                        data: { trainings: [], count: 0 },
                        intent: { type: 'training' },
                        module: 'training'
                    };
                }
                
                // إذا طلب آخر تدريب عام
                if (isLastRequest && sortedTrainings.length > 0) {
                    const lastTraining = sortedTrainings[0];
                    let responseText = `📚 آخر تدريب في النظام:\n\n`;
                    responseText += `البرنامج: ${lastTraining.title || lastTraining.name || lastTraining.topic || 'غير محدد'}\n`;
                    if (lastTraining.startDate) {
                        const trainingDate = new Date(lastTraining.startDate);
                        responseText += `التاريخ: ${trainingDate.toLocaleDateString('ar-SA')}\n`;
                    }
                    if (lastTraining.status) {
                        responseText += `الحالة: ${lastTraining.status}\n`;
                    }
                    const lastCount = typeof Training !== 'undefined' && Training.getParticipantsCount ? Training.getParticipantsCount(lastTraining) : (lastTraining.participantsCount || 0);
                    if (lastCount) responseText += `عدد المشاركين: ${lastCount}\n`;
                    
                    return {
                        success: true,
                        text: responseText,
                        data: { lastTraining: lastTraining },
                        intent: { type: 'training', isLast: true },
                        module: 'training',
                        actions: [
                            {
                                label: 'عرض جميع برامج التدريب',
                                action: 'navigate',
                                target: 'training'
                            }
                        ]
                    };
                }
                
                // توليد نص الرد
                let responseText = `📚 بيانات التدريب:\n\n`;
                responseText += `إجمالي برامج التدريب: ${sortedTrainings.length}\n\n`;
                
                sortedTrainings.slice(0, 5).forEach((training, index) => {
                    responseText += `${index + 1}. ${training.title || training.topic || 'غير محدد'}\n`;
                    if (training.startDate) {
                        responseText += `   التاريخ: ${new Date(training.startDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (training.status) {
                        responseText += `   الحالة: ${training.status}\n`;
                    }
                    const partCount = typeof Training !== 'undefined' && Training.getParticipantsCount ? Training.getParticipantsCount(training) : (training.participantsCount || 0);
                    if (partCount) responseText += `   عدد المشاركين: ${partCount}\n`;
                    responseText += `\n`;
                });
                
                if (sortedTrainings.length > 5) {
                    responseText += `... و ${sortedTrainings.length - 5} برنامج تدريبي آخر\n`;
                }
                
                return {
                    success: true,
                    text: responseText,
                    data: {
                        trainings: sortedTrainings.slice(0, 10),
                        count: sortedTrainings.length
                    },
                    intent: { type: 'training' },
                    module: 'training',
                    actions: [
                        {
                            label: 'عرض جميع برامج التدريب',
                            action: 'navigate',
                            target: 'training'
                        }
                    ]
                };
            }
            
            // إذا كانت هناك بيانات تدريب محددة للموظف من المصفوفة
            if (trainingData) {
                let responseText = `📚 مصفوفة التدريب للموظف ${employee?.name || employee?.employeeNumber || ''}:\n\n`;
                
                const trainingKeys = Object.keys(trainingData).filter(key => 
                    key !== 'id' && 
                    key !== 'employeeId' && 
                    key !== 'createdAt' && 
                    key !== 'updatedAt'
                );
                
                trainingKeys.forEach(key => {
                    const value = trainingData[key];
                    if (value && (value === 'مكتمل' || value === 'Completed' || value === true)) {
                        responseText += `✅ ${key}: مكتمل\n`;
                    } else if (value && (value === 'قيد التنفيذ' || value === 'In Progress')) {
                        responseText += `🔄 ${key}: قيد التنفيذ\n`;
                    } else if (value && (value === 'غير مكتمل' || value === 'Not Completed' || value === false)) {
                        responseText += `❌ ${key}: غير مكتمل\n`;
                    }
                });
                
                return {
                    success: true,
                    text: responseText,
                    data: { trainingMatrix: trainingData, employee: employee },
                    intent: { type: 'training' },
                    module: 'training'
                };
            }
            
            return {
                success: true,
                text: '📚 لا توجد بيانات تدريب متاحة للموظف المحدد.',
                data: { trainings: [], count: 0 },
                intent: { type: 'training' },
                module: 'training'
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب بيانات التدريب:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن بيانات التدريب.',
                error: error.toString()
            };
        }
    },
    
    /**
     * معالجة طلب آخر تدريب للموظف
     */
    async handleLastTrainingRequest(employee) {
        try {
            const allTrainings = AppState.appData.training || [];
            const employeeTrainings = allTrainings.filter(t => {
                if (!t.participants || !Array.isArray(t.participants)) return false;
                return t.participants.some(p => 
                    (p.code || p.employeeCode || p.employeeNumber) === (employee.employeeNumber || employee.job) ||
                    (p.name && employee.name && p.name.toLowerCase().includes(employee.name.toLowerCase()))
                );
            });
            
            // ترتيب حسب التاريخ (الأحدث أولاً)
            employeeTrainings.sort((a, b) => {
                const dateA = new Date(a.startDate || a.createdAt || 0);
                const dateB = new Date(b.startDate || b.createdAt || 0);
                return dateB - dateA;
            });
            
            if (employeeTrainings.length === 0) {
                return {
                    success: true,
                    text: `📚 لا توجد تدريبات مسجلة للموظف ${employee.name || employee.employeeNumber}.`,
                    data: { lastTraining: null, employee: employee },
                    intent: { type: 'training', isLast: true },
                    module: 'training'
                };
            }
            
            const lastTraining = employeeTrainings[0];
            let responseText = `📚 آخر تدريب للموظف ${employee.name || employee.employeeNumber}:\n\n`;
            responseText += `البرنامج: ${lastTraining.title || lastTraining.name || lastTraining.topic || 'غير محدد'}\n`;
            
            if (lastTraining.startDate) {
                const trainingDate = new Date(lastTraining.startDate);
                responseText += `التاريخ: ${trainingDate.toLocaleDateString('ar-SA')}\n`;
                const daysAgo = Math.floor((Date.now() - trainingDate.getTime()) / (1000 * 60 * 60 * 24));
                responseText += `منذ: ${daysAgo} يوم\n`;
            }
            
            if (lastTraining.status) {
                responseText += `الحالة: ${lastTraining.status}\n`;
            }
            
            if (lastTraining.hours) {
                responseText += `عدد الساعات: ${lastTraining.hours}\n`;
            }
            
            if (lastTraining.trainer) {
                responseText += `المدرب: ${lastTraining.trainer}\n`;
            }
            
            if (lastTraining.location) {
                responseText += `الموقع: ${lastTraining.location}\n`;
            }
            
            return {
                success: true,
                text: responseText,
                data: { 
                    lastTraining: lastTraining,
                    employee: employee,
                    allTrainings: employeeTrainings.slice(0, 10)
                },
                intent: { type: 'training', isLast: true },
                module: 'training',
                actions: [
                    {
                        label: 'عرض جميع تدريبات الموظف',
                        action: 'navigate',
                        target: 'training'
                    }
                ]
            };
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب آخر تدريب:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن آخر تدريب.',
                error: error.toString()
            };
        }
    },

    /**
     * معالجة طلب مهمات الوقاية
     */
    async handlePPERequest(parameters, options) {
        try {
            let ppeData = null;
            
            // إذا كان هناك كود موظف، الحصول على مصفوفة مهمات الوقاية
            if (parameters.employeeCode || parameters.jobCode) {
                const code = parameters.employeeCode || parameters.jobCode;
                const employee = this.findEmployeeByCode(code);
                
                if (employee) {
                    try {
                        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                            const result = await GoogleIntegration.sendToAppsScript('getPPEMatrix', {
                                employeeId: employee.id || employee.employeeNumber
                            });
                            
                            if (result && result.success && result.data) {
                                ppeData = result.data;
                            }
                        }
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في الحصول على مصفوفة مهمات الوقاية:', error);
                    }
                }
            }
            
            // إذا لم يكن هناك بيانات محددة، الحصول على جميع سجلات مهمات الوقاية
            if (!ppeData) {
                const ppeRecords = AppState.appData.ppe || [];
                
                // ترتيب حسب التاريخ (الأحدث أولاً)
                const sortedPPE = ppeRecords.sort((a, b) => {
                    const dateA = new Date(a.receiptDate || a.createdAt || 0);
                    const dateB = new Date(b.receiptDate || b.createdAt || 0);
                    return dateB - dateA;
                });
                
                if (sortedPPE.length === 0) {
                    return {
                        success: true,
                        text: '🛡️ لا توجد سجلات مهمات وقاية متاحة حالياً.',
                        data: { ppe: [], count: 0 },
                        intent: { type: 'ppe' },
                        module: 'ppe'
                    };
                }
                
                // توليد نص الرد
                let responseText = `🛡️ سجلات مهمات الوقاية:\n\n`;
                responseText += `إجمالي السجلات: ${sortedPPE.length}\n\n`;
                
                sortedPPE.slice(0, 5).forEach((ppe, index) => {
                    responseText += `${index + 1}. ${ppe.equipmentType || 'غير محدد'}\n`;
                    if (ppe.employeeName) {
                        responseText += `   الموظف: ${ppe.employeeName}\n`;
                    }
                    if (ppe.receiptDate) {
                        responseText += `   تاريخ الاستلام: ${new Date(ppe.receiptDate).toLocaleDateString('ar-SA')}\n`;
                    }
                    if (ppe.quantity) {
                        responseText += `   الكمية: ${ppe.quantity}\n`;
                    }
                    if (ppe.status) {
                        responseText += `   الحالة: ${ppe.status}\n`;
                    }
                    responseText += `\n`;
                });
                
                if (sortedPPE.length > 5) {
                    responseText += `... و ${sortedPPE.length - 5} سجل آخر\n`;
                }
                
                return {
                    success: true,
                    text: responseText,
                    data: {
                        ppe: sortedPPE.slice(0, 10),
                        count: sortedPPE.length
                    },
                    intent: { type: 'ppe' },
                    module: 'ppe',
                    actions: [
                        {
                            label: 'عرض جميع سجلات مهمات الوقاية',
                            action: 'navigate',
                            target: 'ppe'
                        }
                    ]
                };
            }
            
            // إذا كانت هناك بيانات مهمات وقاية محددة للموظف
            let responseText = `🛡️ مصفوفة مهمات الوقاية:\n\n`;
            
            // عرض بيانات مهمات الوقاية من المصفوفة
            if (ppeData) {
                const ppeKeys = Object.keys(ppeData).filter(key => 
                    key !== 'id' && 
                    key !== 'employeeId' && 
                    key !== 'createdAt' && 
                    key !== 'updatedAt'
                );
                
                ppeKeys.forEach(key => {
                    const value = ppeData[key];
                    if (value && (value === 'مطلوب' || value === 'Required' || value === true)) {
                        responseText += `✅ ${key}: مطلوب\n`;
                    } else if (value && (value === 'متوفر' || value === 'Available')) {
                        responseText += `🟢 ${key}: متوفر\n`;
                    } else if (value && (value === 'غير متوفر' || value === 'Not Available' || value === false)) {
                        responseText += `❌ ${key}: غير متوفر\n`;
                    }
                });
            }
            
            return {
                success: true,
                text: responseText,
                data: { ppeMatrix: ppeData },
                intent: { type: 'ppe' },
                module: 'ppe'
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب مهمات الوقاية:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن مهمات الوقاية.',
                error: error.toString()
            };
        }
    },

    /**
     * معالجة طلب التصاريح
     */
    async handlePermitRequest(parameters, options, intent = {}) {
        try {
            const permits = AppState.appData.ptw || [];
            let filteredPermits = permits;
            let contractor = null;
            
            // البحث عن المقاول إذا كان هناك اسم مقاول
            if (parameters.contractorName || parameters.personType === 'contractor') {
                if (parameters.contractorName) {
                    contractor = this.findContractorByName(parameters.contractorName);
                }
                
                // فلترة التصاريح حسب المقاول
                if (contractor) {
                    filteredPermits = filteredPermits.filter(p => {
                        if (!p) return false;
                        const teamMembers = Array.isArray(p.teamMembers) ? p.teamMembers : [];
                        const contractorName = contractor.name || contractor.company || contractor.contractorName || '';
                        
                        const hasContractor = teamMembers.some(member => 
                            member && member.contractorName && (
                                member.contractorName === contractor.name ||
                                member.contractorName === contractor.company ||
                                member.contractorName === contractor.contractorName
                            )
                        );
                        
                        const hasInAuthorizedParty = p.authorizedParty && typeof p.authorizedParty === 'string' && (
                            p.authorizedParty.includes(contractor.name || '') ||
                            p.authorizedParty.includes(contractor.company || '') ||
                            p.authorizedParty.includes(contractor.contractorName || '')
                        );
                        
                        return hasContractor || hasInAuthorizedParty;
                    });
                } else if (parameters.personType === 'contractor') {
                    // البحث عن جميع تصاريح المقاولين
                    filteredPermits = filteredPermits.filter(p => {
                        if (!p) return false;
                        const teamMembers = Array.isArray(p.teamMembers) ? p.teamMembers : [];
                        const hasContractorInTeam = teamMembers.some(member => 
                            member && member.contractorName
                        );
                        const hasInAuthorizedParty = p.authorizedParty && 
                            typeof p.authorizedParty === 'string' && 
                            p.authorizedParty.toLowerCase().includes('مقاول');
                        return hasContractorInTeam || hasInAuthorizedParty;
                    });
                }
            }
            
            // ترتيب حسب التاريخ (الأحدث أولاً)
            filteredPermits.sort((a, b) => {
                const dateA = new Date(a.startDate || a.createdAt || 0);
                const dateB = new Date(b.startDate || b.createdAt || 0);
                return dateB - dateA;
            });
            
            if (filteredPermits.length === 0) {
                const contractorInfo = contractor ? ` للمقاول ${contractor.name || contractor.company || contractor.contractorName}` : '';
                return {
                    success: true,
                    text: `✅ لم يتم العثور على تصاريح${contractorInfo} تطابق المعايير المحددة.`,
                    data: { permits: [], count: 0, contractor: contractor },
                    intent: { type: 'permit' },
                    module: 'ptw'
                };
            }
            
            // إذا طلب آخر تصريح
            if (intent.isLastRequest && filteredPermits.length > 0) {
                const lastPermit = filteredPermits[0];
                let responseText = `🪪 آخر تصريح`;
                if (contractor) {
                    responseText += ` للمقاول ${contractor.name || contractor.company || contractor.contractorName}`;
                }
                responseText += `:\n\n`;
                responseText += `نوع العمل: ${lastPermit.workType || 'غير محدد'}\n`;
                if (lastPermit.startDate) {
                    const startDate = new Date(lastPermit.startDate);
                    responseText += `تاريخ البدء: ${startDate.toLocaleDateString('ar-SA')}\n`;
                }
                if (lastPermit.endDate) {
                    const endDate = new Date(lastPermit.endDate);
                    responseText += `تاريخ الانتهاء: ${endDate.toLocaleDateString('ar-SA')}\n`;
                    const daysUntilExpiry = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
                    if (daysUntilExpiry > 0) {
                        responseText += `متبقي: ${daysUntilExpiry} يوم\n`;
                    } else {
                        responseText += `⚠️ منتهي منذ: ${Math.abs(daysUntilExpiry)} يوم\n`;
                    }
                }
                responseText += `الحالة: ${lastPermit.status || 'غير محدد'}\n`;
                if (lastPermit.location || lastPermit.siteName) {
                    responseText += `الموقع: ${lastPermit.location || lastPermit.siteName || 'غير محدد'}\n`;
                }
                if (lastPermit.workDescription) {
                    const desc = lastPermit.workDescription.length > 50 
                        ? lastPermit.workDescription.substring(0, 50) + '...' 
                        : lastPermit.workDescription;
                    responseText += `الوصف: ${desc}\n`;
                }
                
                return {
                    success: true,
                    text: responseText,
                    data: {
                        lastPermit: lastPermit,
                        permits: filteredPermits.slice(0, 10),
                        count: filteredPermits.length,
                        contractor: contractor
                    },
                    intent: { type: 'permit', isLast: true },
                    module: 'ptw',
                    actions: [
                        {
                            label: 'عرض جميع التصاريح',
                            action: 'navigate',
                            target: 'ptw'
                        }
                    ]
                };
            }
            
            // توليد نص الرد
            let responseText = `🪪 التصاريح`;
            if (contractor) {
                responseText += ` للمقاول ${contractor.name || contractor.company || contractor.contractorName}`;
            }
            responseText += `:\n\n`;
            responseText += `إجمالي التصاريح: ${filteredPermits.length}\n\n`;
            
            filteredPermits.slice(0, 5).forEach((permit, index) => {
                responseText += `${index + 1}. ${permit.workType || 'غير محدد'}\n`;
                if (permit.startDate) {
                    responseText += `   تاريخ البدء: ${new Date(permit.startDate).toLocaleDateString('ar-SA')}\n`;
                }
                if (permit.endDate) {
                    responseText += `   تاريخ الانتهاء: ${new Date(permit.endDate).toLocaleDateString('ar-SA')}\n`;
                }
                responseText += `   الحالة: ${permit.status || 'غير محدد'}\n`;
                if (permit.location || permit.siteName) {
                    responseText += `   الموقع: ${permit.location || permit.siteName || 'غير محدد'}\n`;
                }
                responseText += `\n`;
            });
            
            if (filteredPermits.length > 5) {
                responseText += `... و ${filteredPermits.length - 5} تصريح آخر\n`;
            }
            
            return {
                success: true,
                text: responseText,
                data: {
                    permits: filteredPermits.slice(0, 10),
                    count: filteredPermits.length,
                    contractor: contractor
                },
                intent: { type: 'permit' },
                module: 'ptw',
                actions: [
                    {
                        label: 'عرض جميع التصاريح',
                        action: 'navigate',
                        target: 'ptw'
                    }
                ]
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب التصاريح:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن التصاريح.',
                error: error.toString()
            };
        }
    },
    
    /**
     * معالجة طلب معايير واشتراطات السلامة
     */
    async handleSafetyStandardsRequest(parameters, options) {
        try {
            const questionLower = (parameters.searchTerm || '').toLowerCase();
            
            // معلومات عامة عن السلامة
            const safetyInfo = {
                'ما هي السلامة': 'السلامة والصحة المهنية هي مجموعة من الإجراءات والتدابير التي تهدف إلى حماية العاملين من المخاطر في بيئة العمل.',
                'إجراءات السلامة': 'إجراءات السلامة تشمل: استخدام معدات الحماية الشخصية، اتباع التعليمات، الإبلاغ عن المخاطر، والتدريب المستمر.',
                'معدات الحماية': 'معدات الحماية الشخصية (PPE) تشمل: الخوذات، النظارات، القفازات، الأحذية الآمنة، وأقنعة التنفس.',
                'كيف أحمي نفسي': 'لحماية نفسك في العمل: استخدم معدات الحماية المطلوبة، اتبع التعليمات، احرص على التدريب، وأبلغ عن أي مخاطر.',
                'مخاطر العمل': 'المخاطر في العمل تشمل: المخاطر الفيزيائية (ضوضاء، حرارة)، الكيميائية، البيولوجية، والميكانيكية.'
            };
            
            // التحقق من الأسئلة الشائعة
            for (let key in safetyInfo) {
                if (questionLower.includes(key.toLowerCase()) || 
                    (parameters.searchTerm && parameters.searchTerm.toLowerCase().includes(key.toLowerCase()))) {
                    return {
                        success: true,
                        text: `🛡️ ${safetyInfo[key]}\n\n` +
                              `يمكنك الاطلاع على المزيد من المعلومات من خلال:\n` +
                              `• معايير ISO\n` +
                              `• الإجراءات واللوائح\n` +
                              `• المستندات القانونية`,
                        data: { info: safetyInfo[key] },
                        intent: { type: 'safety_standards' },
                        module: 'iso',
                        actions: [
                            {
                                label: 'عرض معايير ISO',
                                action: 'navigate',
                                target: 'iso'
                            }
                        ]
                    };
                }
            }
            
            const standards = [];
            
            // جمع معايير ISO
            const isoDocuments = AppState.appData.isoDocuments || [];
            const isoProcedures = AppState.appData.isoProcedures || [];
            const isoForms = AppState.appData.isoForms || [];
            const legalDocuments = AppState.appData.legalDocuments || [];
            
            // إضافة مستندات ISO
            isoDocuments.forEach(doc => {
                standards.push({
                    type: 'ISO Document',
                    title: doc.title || doc.name || 'غير محدد',
                    category: doc.category || 'عام',
                    description: doc.description || '',
                    date: doc.date || doc.createdAt
                });
            });
            
            // إضافة إجراءات ISO
            isoProcedures.forEach(proc => {
                standards.push({
                    type: 'ISO Procedure',
                    title: proc.title || proc.name || 'غير محدد',
                    category: proc.category || 'عام',
                    description: proc.description || '',
                    date: proc.date || proc.createdAt
                });
            });
            
            // إضافة نماذج ISO
            isoForms.forEach(form => {
                standards.push({
                    type: 'ISO Form',
                    title: form.title || form.name || 'غير محدد',
                    category: form.category || 'عام',
                    description: form.description || '',
                    date: form.date || form.createdAt
                });
            });
            
            // إضافة المستندات القانونية
            legalDocuments.forEach(doc => {
                standards.push({
                    type: 'Legal Document',
                    title: doc.title || doc.name || 'غير محدد',
                    category: doc.category || 'عام',
                    description: doc.description || '',
                    date: doc.date || doc.createdAt
                });
            });
            
            if (standards.length === 0) {
                return {
                    success: true,
                    text: '📋 لا توجد معايير أو اشتراطات سلامة متاحة حالياً.\n\n' +
                          'يمكنني مساعدتك في:\n' +
                          '• معلومات عامة عن السلامة والصحة المهنية\n' +
                          '• إجراءات السلامة في العمل\n' +
                          '• معدات الحماية الشخصية\n' +
                          '• كيفية حماية نفسك من المخاطر',
                    data: { standards: [], count: 0 },
                    intent: { type: 'safety_standards' },
                    module: 'iso'
                };
            }
            
            // ترتيب حسب التاريخ (الأحدث أولاً)
            standards.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateB - dateA;
            });
            
            // توليد نص الرد
            let responseText = `📋 معايير واشتراطات السلامة:\n\n`;
            responseText += `إجمالي المعايير: ${standards.length}\n\n`;
            
            // تجميع حسب النوع
            const byType = {};
            standards.forEach(standard => {
                if (!byType[standard.type]) {
                    byType[standard.type] = [];
                }
                byType[standard.type].push(standard);
            });
            
            Object.keys(byType).forEach(type => {
                responseText += `📌 ${type}:\n`;
                byType[type].slice(0, 3).forEach((standard, index) => {
                    responseText += `   ${index + 1}. ${standard.title}\n`;
                    if (standard.category) {
                        responseText += `      الفئة: ${standard.category}\n`;
                    }
                    if (standard.description) {
                        const desc = standard.description.length > 50 
                            ? standard.description.substring(0, 50) + '...' 
                            : standard.description;
                        responseText += `      ${desc}\n`;
                    }
                });
                if (byType[type].length > 3) {
                    responseText += `   ... و ${byType[type].length - 3} معيار آخر\n`;
                }
                responseText += `\n`;
            });
            
            responseText += `💡 يمكنك أن تسألني:\n`;
            responseText += `• "ما هي السلامة؟"\n`;
            responseText += `• "ما هي إجراءات السلامة؟"\n`;
            responseText += `• "ما هي معدات الحماية؟"\n`;
            responseText += `• "كيف أحمي نفسي في العمل؟"`;
            
            return {
                success: true,
                text: responseText,
                data: {
                    standards: standards.slice(0, 20),
                    count: standards.length,
                    byType: byType
                },
                intent: { type: 'safety_standards' },
                module: 'iso',
                actions: [
                    {
                        label: 'عرض جميع المعايير',
                        action: 'navigate',
                        target: 'iso'
                    }
                ]
            };
            
        } catch (error) {
            Utils.safeError('❌ خطأ في معالجة طلب معايير السلامة:', error);
            return {
                success: false,
                message: 'حدث خطأ أثناء البحث عن معايير السلامة.',
                error: error.toString()
            };
        }
    },

    /**
     * بناء سياق إحصائي مختصر من البيانات المحلية لتغذية Gemini عبر Backend
     * @return {Object} ملخص إحصائي من AppState.appData
     */
    buildEnrichedContext() {
        try {
            const data = (typeof AppState !== 'undefined' && AppState.appData) ? AppState.appData : {};
            const now = new Date();
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const countRecent = (arr, dateField) => {
                if (!Array.isArray(arr)) return 0;
                return arr.filter(r => {
                    const d = r[dateField];
                    return d && new Date(d) >= thisMonthStart;
                }).length;
            };

            return {
                localStats: {
                    incidents:  { total: (data.Incidents || []).length,  thisMonth: countRecent(data.Incidents, 'date') },
                    nearMiss:   { total: (data.NearMiss || []).length,   thisMonth: countRecent(data.NearMiss, 'date') },
                    violations: { total: (data.Violations || []).length, thisMonth: countRecent(data.Violations, 'date') },
                    training:   { total: (data.Training || []).length,   thisMonth: countRecent(data.Training, 'date') },
                    employees:  { total: (data.Employees || []).length },
                    contractors: { total: (data.ApprovedContractors || []).length },
                    actions: {
                        total: (data.ActionTrackingRegister || []).length,
                        overdue: (data.ActionTrackingRegister || []).filter(r =>
                            r.status !== 'Completed' && r.dueDate && new Date(r.dueDate) < now
                        ).length
                    }
                }
            };
        } catch (e) {
            return {};
        }
    },

    /**
     * توليد رد افتراضي
     */
    generateDefaultResponse(question) {
        return {
            success: true,
            text: `مرحباً! أنا مساعد النظام وأنا هنا لمساعدتك.\n\n` +
                  `يمكنني مساعدتك في:\n\n` +
                  `• البحث عن بيانات الموظفين حسب الكود الوظيفي\n` +
                  `• البحث عن بيانات المقاولين\n` +
                  `• البحث عن مخالفات الموظفين والمقاولين\n` +
                  `• البحث عن بيانات التدريب وآخر تدريب\n` +
                  `• البحث عن تصاريح العمل للمقاولين\n` +
                  `• البحث عن مهمات الوقاية الشخصية\n` +
                  `• الإجابة على أسئلة السلامة والصحة المهنية\n\n` +
                  `جرب أن تسألني:\n` +
                  `• "أعطني بيانات موظف بالكود 123"\n` +
                  `• "أعطني بيانات مقاول اسمه شركة الأمان"\n` +
                  `• "ما هي مخالفات الموظف بالكود 456؟"\n` +
                  `• "ما هي مخالفات المقاول شركة البناء؟"\n` +
                  `• "ما هو آخر تدريب للموظف بالكود 789؟"\n` +
                  `• "ما هي تصاريح المقاول شركة الصيانة؟"\n` +
                  `• "ما هي معايير السلامة المتاحة؟"\n` +
                  `• "ما هي إجراءات السلامة في العمل؟"`,
            data: null,
            intent: { type: 'general_question' },
            module: null
        };
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.AIAssistant = AIAssistant;
}
