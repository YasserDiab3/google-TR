// ===== SOP-JHA Module (تعليمات السلامة SOP-JHA) =====
const SOPJHA = {
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        try {
            const section = document.getElementById('sop-jha-section');
            if (!section) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('❌ قسم sop-jha-section غير موجود في DOM');
                } else {
                    console.error('❌ قسم sop-jha-section غير موجود في DOM');
                }
                // محاولة إيجاد القسم بعد فترة قصيرة
                setTimeout(() => {
                    const retrySection = document.getElementById('sop-jha-section');
                    if (retrySection) {
                        this.load();
                    } else {
                        if (typeof Utils !== 'undefined' && Utils.safeError) {
                            Utils.safeError('❌ فشل في العثور على قسم sop-jha-section بعد إعادة المحاولة');
                        } else {
                            console.error('❌ فشل في العثور على قسم sop-jha-section بعد إعادة المحاولة');
                        }
                    }
                }, 500);
                return;
            }

            // عرض محتوى التحميل أولاً
            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-file-contract ml-3"></i>
                                تعليمات السلامة SOP-JHA
                            </h1>
                            <p class="section-subtitle">إدارة تعليمات السلامة وإجراءات العمل الآمنة (SOP/JHA)</p>
                        </div>
                        <button id="add-sop-jha-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة تعليمات جديدة
                        </button>
                    </div>
                </div>
                <div id="sop-jha-content" class="mt-6">
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title"><i class="fas fa-list ml-2"></i>قائمة تعليمات السلامة</h2>
                        </div>
                        <div class="card-body">
                            <div id="sop-jha-table-container">
                                <div class="empty-state">
                                    <div style="width: 300px; margin: 0 auto 16px;">
                                        <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                        </div>
                                    </div>
                                    <p class="text-gray-500">جاري التحميل...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // إعداد مستمعي الأحداث أولاً
            this.setupEventListeners();

            // تحميل القائمة فوراً بعد عرض الواجهة (حتى لو كانت البيانات فارغة)
            // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
            try {
                // استخدام setTimeout بسيط لضمان أن DOM جاهز
                setTimeout(() => {
                    this.loadSOPJHAList().catch(error => {
                        if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                            Utils.safeWarn('⚠️ خطأ في تحميل قائمة SOP-JHA الأولي:', error);
                        }
                        const container = document.getElementById('sop-jha-table-container');
                        if (container) {
                            container.innerHTML = `
                                <div class="empty-state">
                                    <i class="fas fa-exclamation-triangle text-4xl text-yellow-400 mb-4"></i>
                                    <p class="text-gray-500">حدث خطأ في تحميل البيانات</p>
                                    <p class="text-sm text-gray-400 mt-2">${error.message || 'خطأ غير معروف'}</p>
                                    <button onclick="SOPJHA.load()" class="btn-primary mt-4">
                                        <i class="fas fa-redo ml-2"></i>
                                        إعادة المحاولة
                                    </button>
                                </div>
                            `;
                        }
                    });
                }, 0);
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('خطأ في تحميل قائمة SOP-JHA:', error);
                } else {
                    console.error('خطأ في تحميل قائمة SOP-JHA:', error);
                }
                const container = document.getElementById('sop-jha-table-container');
                if (container) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-4xl text-yellow-400 mb-4"></i>
                            <p class="text-gray-500">حدث خطأ في تحميل البيانات</p>
                            <p class="text-sm text-gray-400 mt-2">${error.message || 'خطأ غير معروف'}</p>
                            <button onclick="SOPJHA.load()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                إعادة المحاولة
                            </button>
                        </div>
                    `;
                }
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('خطأ في تحميل موديول SOP-JHA:', error);
            } else {
                console.error('خطأ في تحميل موديول SOP-JHA:', error);
            }
            const section = document.getElementById('sop-jha-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-2">حدث خطأ أثناء تحميل البيانات</p>
                                <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : 'خطأ غير معروف'}</p>
                                <button onclick="SOPJHA.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('حدث خطأ أثناء تحميل تعليمات السلامة SOP-JHA. يُرجى المحاولة مرة أخرى.', { duration: 5000 });
            }
        }
    },

    async renderList() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-list ml-2"></i>قائمة تعليمات السلامة</h2>
                </div>
                <div class="card-body">
                    <div id="sop-jha-table-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadSOPJHAList() {
        const container = document.getElementById('sop-jha-table-container');
        if (!container) {
            Utils.safeWarn('⚠️ حاوية sop-jha-table-container غير موجودة');
            return;
        }

        // التأكد من وجود AppState وتهيئة البيانات
        if (typeof AppState === 'undefined' || !AppState.appData) {
            Utils.safeError('❌ AppState غير متاح');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-gray-500">خطأ في تهيئة النظام</p>
                    <button onclick="location.reload()" class="btn-primary mt-4">
                        <i class="fas fa-redo ml-2"></i>
                        تحديث الصفحة
                    </button>
                </div>
            `;
            return;
        }

        // تهيئة sopJHA إذا لم يكن موجوداً
        if (!AppState.appData.sopJHA) {
            AppState.appData.sopJHA = [];
        }

        // عرض البيانات المحلية أولاً (بدون انتظار Google Sheets)
        const items = AppState.appData.sopJHA || [];

        // تحميل البيانات من Google Sheets بشكل غير متزامن (بعد عرض الواجهة)
        if (items.length === 0 && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.readFromSheets) {
            // تحميل البيانات في الخلفية بدون انتظار
            GoogleIntegration.readFromSheets('SOPJHA').then(data => {
                if (data && Array.isArray(data) && data.length > 0) {
                    AppState.appData.sopJHA = data;
                    // تحديث الواجهة بعد تحميل البيانات
                    this.loadSOPJHAList();
                }
            }).catch(error => {
                Utils.safeWarn('⚠️ خطأ في تحميل بيانات SOPJHA من Google Sheets:', error);
            });
        }

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-contract text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد تعليمات سلامة</p>
                    <button id="add-sop-jha-empty-btn" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة تعليمات جديدة
                    </button>
                </div>
            `;
            // إعادة ربط الأزرار بعد إضافة المحتوى
            setTimeout(() => {
                const addEmptyBtn = document.getElementById('add-sop-jha-empty-btn');
                if (addEmptyBtn) {
                    addEmptyBtn.addEventListener('click', () => this.showForm());
                }
            }, 100);
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>العنوان</th>
                            <th>القسم</th>
                            <th>تاريخ الإصدار</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>
                                    <span class="badge badge-${item.type === 'SOP' ? 'info' : 'warning'}">
                                        ${item.type || 'SOP'}
                                    </span>
                                </td>
                                <td>${Utils.escapeHTML(item.title || '')}</td>
                                <td>${Utils.escapeHTML(item.department || '')}</td>
                                <td>${item.issueDate ? Utils.formatDate(item.issueDate) : '-'}</td>
                                <td>
                                    <span class="badge badge-${item.status === 'نشط' ? 'success' : 'warning'}">
                                        ${item.status || '-'}
                                    </span>
                                </td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <button onclick="SOPJHA.viewSOPJHA('${item.id}')" class="btn-icon btn-icon-info" title="عرض">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button onclick="SOPJHA.exportPDF('${item.id}')" class="btn-icon btn-icon-success" title="تصدير PDF">
                                            <i class="fas fa-file-pdf"></i>
                                        </button>
                                        <button onclick="SOPJHA.editSOPJHA('${item.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="SOPJHA.deleteSOPJHA('${item.id}')" class="btn-icon btn-icon-danger" title="حذف">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    setupEventListeners() {
        setTimeout(() => {
            const addBtn = document.getElementById('add-sop-jha-btn');
            const addEmptyBtn = document.getElementById('add-sop-jha-empty-btn');
            if (addBtn) addBtn.addEventListener('click', () => this.showForm());
            if (addEmptyBtn) addEmptyBtn.addEventListener('click', () => this.showForm());
        }, 100);
    },

    async showForm(data = null) {
        const isEdit = !!data;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? 'تعديل تعليمات السلامة' : 'إضافة تعليمات سلامة جديدة'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="sop-jha-form" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">النوع *</label>
                                <select id="sop-type" required class="form-input">
                                    <option value="">اختر النوع</option>
                                    <option value="SOP" ${data?.type === 'SOP' ? 'selected' : ''}>SOP - إجراءات التشغيل القياسية</option>
                                    <option value="JHA" ${data?.type === 'JHA' ? 'selected' : ''}>JHA - تحليل مخاطر الوظيفة</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">العنوان *</label>
                                <input type="text" id="sop-title" required class="form-input"
                                    value="${Utils.escapeHTML(data?.title || '')}" placeholder="عنوان التعليمات">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">القسم *</label>
                                <input type="text" id="sop-department" required class="form-input"
                                    value="${Utils.escapeHTML(data?.department || '')}" placeholder="القسم المعني">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الإصدار *</label>
                                <input type="date" id="sop-issue-date" required class="form-input"
                                    value="${data?.issueDate ? new Date(data.issueDate).toISOString().slice(0, 10) : ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة *</label>
                                <select id="sop-status" required class="form-input">
                                    <option value="">اختر الحالة</option>
                                    <option value="نشط" ${data?.status === 'نشط' ? 'selected' : ''}>نشط</option>
                                    <option value="مراجعة" ${data?.status === 'مراجعة' ? 'selected' : ''}>قيد المراجعة</option>
                                    <option value="منتهي" ${data?.status === 'منتهي' ? 'selected' : ''}>منتهي</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">النسخة</label>
                                <input type="text" id="sop-version" class="form-input"
                                    value="${Utils.escapeHTML(data?.version || '1.0')}" placeholder="1.0">
                            </div>
                        </div>
                        
                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الوصف / الإجراءات *</label>
                            <textarea id="sop-procedures" required class="form-input" rows="8"
                                placeholder="وصف تفصيلي للإجراءات والتعليمات">${Utils.escapeHTML(data?.procedures || '')}</textarea>
                        </div>
                        
                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">المخاطر المحتملة</label>
                            <textarea id="sop-hazards" class="form-input" rows="4"
                                placeholder="وصف تفصيلي للمخاطر المحتملة وطرق التعامل معها">${Utils.escapeHTML(data?.hazards || '')}</textarea>
                        </div>
                        
                        <div class="col-span-2">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">مهمات الوقاية المطلوبة</label>
                            <div id="sop-ppe-matrix">
                                ${typeof PPEMatrix !== 'undefined' ? PPEMatrix.generate('sop-ppe-matrix') : ''}
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button type="submit" form="sop-jha-form" class="btn-primary">حفظ</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = modal.querySelector('#sop-jha-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(data?.id, modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async handleSubmit(editId, modal) {
        // منع النقر المتكرر
        const submitBtn = modal?.querySelector('button[type="submit"]') || 
                         document.querySelector('.modal-overlay button[type="submit"]');
        
        if (submitBtn && submitBtn.disabled) {
            return; // النموذج قيد المعالجة
        }

        // تعطيل الزر لمنع النقر المتكرر
        let originalText = '';
        if (submitBtn) {
            originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
        }

        // فحص العناصر قبل الاستخدام
        const typeEl = document.getElementById('sop-type');
        const titleEl = document.getElementById('sop-title');
        const departmentEl = document.getElementById('sop-department');
        const issueDateEl = document.getElementById('sop-issue-date');
        const statusEl = document.getElementById('sop-status');
        const versionEl = document.getElementById('sop-version');
        const proceduresEl = document.getElementById('sop-procedures');
        const hazardsEl = document.getElementById('sop-hazards');
        
        if (!typeEl || !titleEl || !departmentEl || !issueDateEl || !statusEl || !versionEl || !proceduresEl || !hazardsEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        const formData = {
            id: editId || Utils.generateId('SOP'),
            type: typeEl.value,
            title: titleEl.value.trim(),
            department: departmentEl.value.trim(),
            issueDate: new Date(issueDateEl.value).toISOString(),
            status: statusEl.value,
            version: versionEl.value.trim(),
            procedures: proceduresEl.value.trim(),
            hazards: hazardsEl.value.trim(),
            requiredPPE: typeof PPEMatrix !== 'undefined' ? PPEMatrix.getSelected() : [],
            createdAt: editId ? (AppState.appData.sopJHA?.find(s => s.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // التأكد من وجود المصفوفة
        if (!AppState.appData.sopJHA) {
            AppState.appData.sopJHA = [];
        }

        try {
            // 1. حفظ البيانات فوراً في الذاكرة
            if (editId) {
                const index = AppState.appData.sopJHA.findIndex(s => s.id === editId);
                if (index !== -1) {
                    AppState.appData.sopJHA[index] = formData;
                } else {
                    AppState.appData.sopJHA.push(formData);
                }
                Notification.success('تم تحديث التعليمات بنجاح');
            } else {
                AppState.appData.sopJHA.push(formData);
                Notification.success('تم إضافة التعليمات بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            
            // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
            modal.remove();
            
            // 3. استعادة الزر بعد النجاح
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            
            // 4. تحديث القائمة فوراً
            this.load();
            
            // 5. معالجة المهام الخلفية (Google Sheets) في الخلفية
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                GoogleIntegration.autoSave('SOPJHA', AppState.appData.sopJHA).catch(error => {
                    Utils.safeError('خطأ في حفظ Google Sheets:', error);
                });
            }
        } catch (error) {
            Utils.safeError('خطأ في حفظ التعليمات:', error);
            Notification.error('حدث خطأ: ' + error.message);
            
            // استعادة الزر في حالة الخطأ
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    },

    async editSOPJHA(id) {
        const item = AppState.appData.sopJHA?.find(s => s.id === id);
        if (item) {
            await this.showForm(item);
        } else {
            Notification.error('التعليمات غير موجودة');
        }
    },

    async viewSOPJHA(id) {
        const item = AppState.appData.sopJHA?.find(s => s.id === id);
        if (!item) {
            Notification.error('التعليمات غير موجودة');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">${item.type}: ${Utils.escapeHTML(item.title)}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div><strong>النوع:</strong> ${Utils.escapeHTML(item.type || '')}</div>
                            <div><strong>القسم:</strong> ${Utils.escapeHTML(item.department || '')}</div>
                            <div><strong>تاريخ الإصدار:</strong> ${item.issueDate ? Utils.formatDate(item.issueDate) : '-'}</div>
                            <div><strong>النسخة:</strong> ${Utils.escapeHTML(item.version || '')}</div>
                            <div><strong>الحالة:</strong> 
                                <span class="badge badge-${item.status === 'نشط' ? 'success' : 'warning'}">
                                    ${item.status || '-'}
                                </span>
                            </div>
                        </div>
                        <div><strong>الإجراءات:</strong><br><div class="p-3 bg-gray-50 rounded">${Utils.escapeHTML(item.procedures || '')}</div></div>
                        ${item.hazards ? `<div><strong>المخاطر:</strong><br><div class="p-3 bg-red-50 rounded">${Utils.escapeHTML(item.hazards)}</div></div>` : ''}
                        ${item.requiredPPE && item.requiredPPE.length > 0 ? `
                            <div><strong>مهمات الوقاية المطلوبة:</strong><br>
                                ${item.requiredPPE.map(ppe => `<span class="badge badge-info mr-2">${ppe}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button type="button" onclick="SOPJHA.exportPDF('${item.id}');" class="btn-success">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button type="button" onclick="SOPJHA.editSOPJHA('${item.id}'); this.closest('.modal-overlay').remove();" class="btn-primary">تعديل</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async deleteSOPJHA(id) {
        if (!confirm('هل أنت متأكد من حذف هذه التعليمات؟')) return;
        
        Loading.show();
        try {
            if (!AppState.appData.sopJHA) {
                AppState.appData.sopJHA = [];
            }
            
            const beforeLength = AppState.appData.sopJHA.length;
            AppState.appData.sopJHA = AppState.appData.sopJHA.filter(s => s.id !== id);
            
            if (AppState.appData.sopJHA.length === beforeLength) {
                Loading.hide();
                Notification.warning('لم يتم العثور على التعليمات للحذف');
                return;
            }
            
            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            
            // حفظ في Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                await GoogleIntegration.autoSave('SOPJHA', AppState.appData.sopJHA);
            }
            
            Loading.hide();
            Notification.success('تم حذف التعليمات بنجاح');
            this.load();
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حذف التعليمات:', error);
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    async exportPDF(id) {
        const item = AppState.appData.sopJHA?.find(s => s.id === id);
        if (!item) {
            Notification.error('التعليمات غير موجودة');
            return;
        }

        try {
            Loading.show();

            const formCode = item.isoCode || item.id?.substring(0, 12) || 'SOP-UNKNOWN';
            const formTitle = `${item.type}: ${item.title || 'تعليمات السلامة'}`;

            const content = `
                <table>
                    <tr><th>النوع</th><td>${Utils.escapeHTML(item.type || 'N/A')}</td></tr>
                    <tr><th>العنوان</th><td>${Utils.escapeHTML(item.title || 'N/A')}</td></tr>
                    <tr><th>القسم</th><td>${Utils.escapeHTML(item.department || 'N/A')}</td></tr>
                    <tr><th>تاريخ الإصدار</th><td>${item.issueDate ? Utils.formatDate(item.issueDate) : 'N/A'}</td></tr>
                    <tr><th>النسخة</th><td>${Utils.escapeHTML(item.version || 'N/A')}</td></tr>
                    <tr><th>الحالة</th><td>${Utils.escapeHTML(item.status || 'N/A')}</td></tr>
                </table>
                <div class="section-title">الإجراءات / الوصف:</div>
                <div class="description">${Utils.escapeHTML(item.procedures || 'N/A')}</div>
                ${item.hazards ? `
                    <div class="section-title">المخاطر المحتملة:</div>
                    <div class="description">${Utils.escapeHTML(item.hazards)}</div>
                ` : ''}
                ${item.requiredPPE && item.requiredPPE.length > 0 ? `
                    <div class="section-title">مهمات الوقاية المطلوبة:</div>
                    <table>
                        <tr>
                            <th>نوع مهمات الوقاية</th>
                            <th>الحالة</th>
                        </tr>
                        ${item.requiredPPE.map(ppe => `
                            <tr>
                                <td>${Utils.escapeHTML(ppe)}</td>
                                <td>✓ مطلوب</td>
                            </tr>
                        `).join('')}
                    </table>
                ` : ''}
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, true, true)
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>SOP/JHA</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Loading.hide();
                            Notification.success('تم تحديث التقرير للطباعة/الحفظ كـ PDF');
                        }, 1000);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof SOPJHA !== 'undefined') {
            window.SOPJHA = SOPJHA;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ SOPJHA module loaded and available on window.SOPJHA');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير SOPJHA:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof SOPJHA !== 'undefined') {
            try {
                window.SOPJHA = SOPJHA;
            } catch (e) {
                console.error('❌ فشل تصدير SOPJHA:', e);
            }
        }
    }
})();

