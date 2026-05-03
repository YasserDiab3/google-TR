/**
 * DailyObservations Module
 * تم استخراجه من app-modules.js
 * ✅ تحديث: 2026-04-02 - إصلاح عرض المرفقات وصور بعد التنفيذ
 */
// ===== Daily Observations Module (الملاحظات اليومية) =====

/** تنسيق id: DOB-NNNN (مثال: DOB-2988). رقم الملاحظة isoCode: OBS-YYYYMM-NNNN (مثال: OBS-202602-2988). */

/**
 * توليد معرف ملاحظة يومية بالتنسيق DOB-NNNN.
 * يأخذ أكبر رقم مستخدم من أي id (DOB_N أو OBS-YYYYMM-NNNN أو أي ذيل رقمي) لتفادي التكرار.
 * @param {Array} existingData - مصفوفة سجلات الملاحظات الموجودة
 * @returns {string} معرف جديد مثل DOB-2999
 */
function generateDailyObservationId(existingData) {
    const patternDob = /^DOB-(\d+)$/i;
    const patternObs = /^OBS-\d{6}-(\d+)$/i;
    const patternTrailingNum = /(\d+)$/;
    let maxNum = 0;
    
    if (existingData && Array.isArray(existingData)) {
        existingData.forEach(function (record) {
            if (!record || !record.id) return;
            const id = String(record.id).trim();
            let num = 0;
            
            // التحقق من DOB-NNNN أولاً
            const mDob = id.match(patternDob);
            if (mDob) {
                num = parseInt(mDob[1], 10);
            } else {
                // التحقق من OBS-YYYYMM-NNNN
                const mObs = id.match(patternObs);
                if (mObs) {
                    num = parseInt(mObs[1], 10);
                } else {
                    // أي رقم في النهاية
                    const mTrail = id.match(patternTrailingNum);
                    if (mTrail) num = parseInt(mTrail[1], 10);
                }
            }
            if (!isNaN(num) && num > maxNum) maxNum = num;
        });
    }
    const nextNum = maxNum + 1;
    return 'DOB-' + String(nextNum).padStart(4, '0');
}

/**
 * استخراج رقم الملاحظة (isoCode) للتسجيل في جدول قاعدة البيانات.
 * القيمة المسجلة في عمود isoCode = OBS-YYYYMM- + آخر 4 أرقام من id (DOB-NNNN).
 * مثال: id = DOB-2988 → isoCode = OBS-202602-2988
 * @param {string} id - معرف الملاحظة (مثل DOB-NNNN)
 * @returns {string} رقم الملاحظة OBS-YYYYMM-NNNN للتسجيل في الخلية
 */
function getObservationIsoCodeFromId(id) {
    if (!id || typeof id !== 'string') return 'OBS-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-0000';
    const str = id.trim();
    
    // لـ DOB-NNNN نحوله إلى OBS-YYYYMM-NNNN
    const dobMatch = str.match(/^DOB-(\d+)$/i);
    if (dobMatch) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const num = dobMatch[1];
        return 'OBS-' + yyyy + mm + '-' + num;
    }
    
    // إذا كان OBS-YYYYMM-NNNN بالفعل
    const obsMatch = str.match(/^OBS-\d{6}-(\d+)$/i);
    if (obsMatch) {
        return str;
    }
    
    // أي رقم في النهاية
    const matchAny = str.match(/(\d+)$/);
    if (matchAny) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        return 'OBS-' + yyyy + mm + '-' + matchAny[1];
    }
    
    return 'OBS-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-0000';
}

const DailyObservations = {
    /**
     * الحصول على اللغة الحالية
     */
    getCurrentLanguage() {
        return localStorage.getItem('language') || AppState?.currentLanguage || 'ar';
    },

    /**
     * الحصول على الترجمات حسب اللغة الحالية
     */
    getTranslations() {
        const lang = this.getCurrentLanguage();
        const isRTL = lang === 'ar';

        const translations = {
            ar: {
                'title.observationsRegistry': 'سجل الملاحظات',
                'btn.registerNew': 'تسجيل ملاحظة جديدة',
                'btn.reset': 'إعادة تعيين',
                'filter.search': 'البحث',
                'filter.site': 'الموقع',
                'filter.location': 'المكان',
                'filter.type': 'النوع',
                'filter.shift': 'الوردية',
                'filter.risk': 'الخطورة',
                'filter.status': 'الحالة',
                'filter.observer': 'صاحب الملاحظة',
                'filter.responsible': 'المسؤول',
                'filter.all': 'الكل',
                'filter.searchPlaceholder': 'ابحث...',
                'empty.noObservations': 'لا توجد ملاحظات مسجلة',
                'empty.noMatching': 'لا توجد ملاحظات مطابقة لعوامل التصفية الحالية'
            },
            en: {
                'title.observationsRegistry': 'Observations Registry',
                'btn.registerNew': 'Register New Observation',
                'btn.reset': 'Reset',
                'filter.search': 'Search',
                'filter.site': 'Site',
                'filter.location': 'Location',
                'filter.type': 'Type',
                'filter.shift': 'Shift',
                'filter.risk': 'Risk',
                'filter.status': 'Status',
                'filter.observer': 'Observer',
                'filter.responsible': 'Responsible',
                'filter.all': 'All',
                'filter.searchPlaceholder': 'Search...',
                'empty.noObservations': 'No observations recorded',
                'empty.noMatching': 'No observations match the current filter criteria'
            }
        };

        return {
            t: (key) => translations[lang]?.[key] || key,
            isRTL,
            lang
        };
    },

    /**
     * التحقق من صلاحية الوصول لتبويب معين
     */
    hasTabAccess(tabName) {
        const user = AppState.currentUser;
        if (!user) return false;

        // المدير لديه صلاحيات كاملة
        if (user.role === 'admin') return true;

        // التحقق من الصلاحيات التفصيلية
        if (typeof Permissions !== 'undefined') {
            return Permissions.hasDetailedPermission('daily-observations', tabName);
        }

        // افتراضياً، نعطي الوصول (للتوافق مع المستخدمين القدامى)
        return true;
    },

    /**
     * سياق المستخدم لقراءة الملاحظات من الخادم (فلترة حسب الإدارة والصلاحيات)
     */
    buildObservationsRequestContext() {
        const user = AppState.currentUser;
        if (!user) return null;
        let detailed = {};
        if (typeof Permissions !== 'undefined' && typeof Permissions.getEffectivePermissions === 'function') {
            try {
                const eff = Permissions.getEffectivePermissions(user) || {};
                detailed = eff['daily-observationsPermissions'] || {};
            } catch (e) {
                detailed = {};
            }
        }
        return {
            role: user.role || '',
            email: (user.email || '').trim(),
            name: (user.name || '').trim(),
            department: (user.department || '').trim(),
            id: user.id || '',
            dailyObservationsPermissions: {
                'observations-specialist-review': detailed['observations-specialist-review'] === true,
                'observations-manager-approve': detailed['observations-manager-approve'] === true,
                'observations-view-all': detailed['observations-view-all'] === true,
                /** افتراضياً مفعّل ما لم يُلغَ صراحةً (مفتاح مفقود = رؤية حسب الإدارة) */
                'observations-view-department': detailed['observations-view-department'] !== false
            }
        };
    },

    /** تفكيك مهام طويلة على الخيط الرئيسي (يقلّل تحذيرات Violation بعد انتظار الشبكة) */
    async yieldToMain() {
        if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
            try {
                await scheduler.yield();
                return;
            } catch (e) { /* ignore */ }
        }
        await new Promise((r) => setTimeout(r, 0));
    },

    getWorkflowStageLabel(stage) {
        const s = String(stage || '').trim();
        if (!s) return '— (سجل قديم)';
        const map = this.WORKFLOW_STAGES || {};
        return map[s] || s;
    },

    /** من يملك رؤية كل الملاحظات محلياً (يتوافق مع منطق الخادم) */
    _isAdminRole(user) {
        if (!user) return false;
        const r = String(user.role || '').trim();
        const rl = r.toLowerCase();
        return rl === 'admin' || rl === 'system_admin' || r === 'مدير النظام' || r === 'مدير';
    },

    /**
     * حذف/تعديل السجل، الاستيراد، تصدير PPT، حذف الجميع — لمدير النظام (الدور أو صلاحية المدير في Permissions)
     */
    canDailyObservationsFullAdminUi() {
        if (this._isAdminRole(AppState.currentUser)) return true;
        if (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function') {
            return Permissions.isCurrentUserAdmin();
        }
        return false;
    },

    _isSafetyOfficerRole(user) {
        if (!user) return false;
        const r = String(user.role || '').trim();
        const rl = r.toLowerCase();
        return rl === 'safety_officer' || r === 'مسئول السلامة' || r === 'مسؤول السلامة';
    },

    canViewAllObservationsWorkflow() {
        const user = AppState.currentUser;
        if (!user) return false;
        if (this._isAdminRole(user) || this._isSafetyOfficerRole(user)) return true;
        if (typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission) {
            if (Permissions.hasDetailedPermission('daily-observations', 'observations-specialist-review')) return true;
            if (Permissions.hasDetailedPermission('daily-observations', 'observations-manager-approve')) return true;
            if (Permissions.hasDetailedPermission('daily-observations', 'observations-view-all')) return true;
        }
        return false;
    },

    /** مرحلة مسؤول السلامة (أخصائي) = دور safety_officer أو مدير النظام أو صلاحية تفصيلية */
    hasSpecialistWorkflowPermission() {
        const user = AppState.currentUser;
        if (!user) return false;
        if (this._isAdminRole(user) || this._isSafetyOfficerRole(user)) return true;
        return typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-specialist-review');
    },

    /** اعتماد مدير السلامة = دور مدير النظام (admin) أو صلاحية تفصيلية — وليس مسؤول السلامة (أخصائي) */
    hasManagerWorkflowPermission() {
        const user = AppState.currentUser;
        if (!user) return false;
        if (this._isAdminRole(user)) return true;
        return typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-manager-approve');
    },

    /** ✅ مدير السلامة - للصلاحيات العامة */
    _isSafetyManager() {
        const user = AppState.currentUser;
        if (!user) return false;
        if (this._isAdminRole(user)) return true;
        return this.hasManagerWorkflowPermission();
    },

    /** ✅ أخصائي السلامة */
    _isSafetyOfficer() {
        const user = AppState.currentUser;
        if (!user) return false;
        return this._isSafetyOfficerRole(user) || this.hasSpecialistWorkflowPermission();
    },

    /** ✅ بناء HTML لصور بعد التنفيذ */
    _buildAfterExecutionPhotosHtml(images) {
        if (!images || !Array.isArray(images) || images.length === 0) {
            return '<p class="text-sm text-gray-500 italic" style="font-family: \'Cairo\', sans-serif;"><i class="fas fa-camera ml-1"></i>لا توجد صور بعد التنفيذ</p>';
        }

        return `
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                ${images.map((img, index) => `
                    <div class="relative group border-2 border-emerald-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <img src="${img.url || img}" alt="صورة بعد التنفيذ ${index + 1}" 
                             class="w-full h-40 object-cover cursor-pointer" 
                             onclick="window.open('${img.url || img}', '_blank')"
                             style="font-family: 'Cairo', sans-serif;" />
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                            <a href="${img.url || img}" target="_blank" class="opacity-0 group-hover:opacity-100 transition-opacity btn-sm bg-white text-emerald-600 rounded-lg px-4 py-2 font-semibold" style="font-family: 'Cairo', sans-serif;">
                                <i class="fas fa-eye ml-1"></i>عرض
                            </a>
                        </div>
                        ${img.uploadedAt ? `
                        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs px-2 py-1" style="font-family: 'Cairo', sans-serif;">
                            <i class="fas fa-user ml-1"></i>${Utils.escapeHTML(img.uploadedBy || 'Unknown')} | 
                            <i class="fas fa-calendar ml-1"></i>${Utils.formatDate(img.uploadedAt)}
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    /** ✅ معالجة اختيار صورة بعد التنفيذ - معاينة ورفع تلقائي */
    async handleAfterExecutionPhotoUpload(observationId, inputElement) {
        if (!inputElement || !inputElement.files || inputElement.files.length === 0) {
            return;
        }

        const file = inputElement.files[0];
        if (!file.type.startsWith('image/')) {
            Notification?.error?.('يرجى اختيار ملف صورة صالح', 5000);
            return;
        }

        // التحقق من حجم الملف (حد أقصى 5 ميجابايت)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            Notification?.error?.('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت', 5000);
            return;
        }

        // عرض المعاينة فوراً
        const previewContainer = document.getElementById(`after-execution-preview-container-${observationId}`);
        const previewImg = document.getElementById(`after-execution-preview-${observationId}`);
        
        if (previewContainer && previewImg) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
                previewContainer.style.display = 'block';
                
                // رفع الصورة تلقائياً بعد المعاينة
                this._autoUploadAfterExecutionPhoto(observationId, file);
            };
            reader.readAsDataURL(file);
        }
    },

    /** ✅ رفع تلقائي للصورة بعد التنفيذ */
    async _autoUploadAfterExecutionPhoto(observationId, file) {
        try {
            Loading?.show?.();

            // تحويل الصورة إلى Base64
            const base64Image = await this._fileToBase64(file);

            // تحديث الملاحظة مع الصورة الجديدة
            const updateData = {
                afterExecutionImages: [],
                updatedBy: AppState.currentUser?.email || AppState.currentUser?.name || 'System'
            };

            // الحصول على الصور الموجودة مسبقاً من AppState مباشرة (أسرع وأضمن)
            const obs = AppState.appData.dailyObservations.find(o => o.id === observationId);
            if (obs && Array.isArray(obs.afterExecutionImages)) {
                updateData.afterExecutionImages = obs.afterExecutionImages;
            }

            // إضافة الصورة الجديدة
            updateData.afterExecutionImages.push(base64Image);

            // استدعاء API للتحديث
            GoogleIntegration.sendRequest({
                action: 'updateObservation',
                data: {
                    observationId: observationId,
                    updateData: updateData
                }
            }).then(result => {
                Loading?.hide?.();
                
                // ✅ تحديث البيانات في AppState فوراً (حتى لو فشل Backend)
                const localObsIndex = AppState.appData.dailyObservations.findIndex(o => o.id === observationId);
                if (localObsIndex !== -1) {
                    AppState.appData.dailyObservations[localObsIndex].afterExecutionImages = updateData.afterExecutionImages;
                    AppState.appData.dailyObservations[localObsIndex].updatedAt = new Date().toISOString();
                }

                if (result && result.success) {
                    Notification?.success?.('تم حفظ الصورة بنجاح', 3000);

                    // تحديث العرض في المودال المفتوح
                    const container = document.getElementById(`after-execution-photos-container-${observationId}`);
                    if (container) {
                        container.innerHTML = this._buildAfterExecutionPhotosHtml(updateData.afterExecutionImages);
                    }

                    // إخفاء المعاينة
                    const previewContainer = document.getElementById(`after-execution-preview-container-${observationId}`);
                    if (previewContainer) {
                        previewContainer.style.display = 'none';
                    }

                    // إعادة تعيين حقل الملف
                    const input = document.getElementById(`after-execution-photo-input-${observationId}`);
                    if (input) {
                        input.value = '';
                    }
                } else {
                    // ✅ نجاح محلي حتى لو فشل Backend
                    Notification?.success?.('تم حفظ الصورة محلياً', 3000);
                    
                    // تحديث العرض محلياً
                    const container = document.getElementById(`after-execution-photos-container-${observationId}`);
                    if (container) {
                        container.innerHTML = this._buildAfterExecutionPhotosHtml(updateData.afterExecutionImages);
                    }
                }
            }).catch(error => {
                Loading?.hide?.();
                Utils?.safeWarn?.('خطأ في رفع صورة بعد التنفيذ:', error);
                
                // ✅ نجاح محلي حتى لو فشل الطلب
                Notification?.success?.('تم حفظ الصورة محلياً', 3000);
                
                // تحديث العرض محلياً
                const container = document.getElementById(`after-execution-photos-container-${observationId}`);
                if (container) {
                    container.innerHTML = this._buildAfterExecutionPhotosHtml(updateData.afterExecutionImages);
                }
            });
        } catch (error) {
            Loading?.hide?.();
            Utils?.safeError?.('خطأ في رفع صورة بعد التنفيذ:', error);
            Notification?.error?.('حدث خطأ أثناء رفع الصورة: ' + (error.message || 'خطأ غير معروف'), 8000);
        }
    },

    /** ✅ رفع صورة بعد التنفيذ (للتوافق) */
    async uploadAfterExecutionPhoto(observationId) {
        // هذه الدالة لم تعد مستخدمة - الرفع الآن تلقائي
        Notification?.info?.('سيتم رفع الصورة تلقائياً عند الاختيار', 3000);
    },

    /** ✅ تحويل ملف إلى Base64 */
    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /** ✅ الحصول على بيانات الملاحظة */
    async _getObservationData(observationId) {
        try {
            const result = await GoogleIntegration.sendRequest({
                action: 'getObservation',
                data: { observationId: observationId }
            });
            return result?.success ? result.data : null;
        } catch (error) {
            Utils?.safeError?.('خطأ في الحصول على بيانات الملاحظة:', error);
            return null;
        }
    },

    canShowAssignResponsiblePanel(obs) {
        const stage = String(obs?.workflowStage || '').trim();
        const u = AppState.currentUser;
        const adm = this._isAdminRole(u);
        const specReviewPerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-specialist-review');
        const mgrApprovePerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-manager-approve');
        const canActAsSpecialist = adm || this._isSafetyOfficerRole(u) || specReviewPerm;
        const canActAsSafetyManager = adm || mgrApprovePerm;
        const early = stage === 'pending_specialist' || stage === 'returned_specialist' || stage === 'pending_manager';
        const deptStages = stage === 'pending_department' || stage === 'in_progress';
        if (adm) return true;
        if ((canActAsSpecialist || canActAsSafetyManager) && early) return true;
        if (this.isUserInResponsibleDepartment(obs) && deptStages) return true;
        return false;
    },

    readAssignFieldsFromDetailModal(observationId) {
        const oid = String(observationId || '').replace(/"/g, '');
        const modal = document.querySelector('.modal-overlay[data-observation-id="' + oid + '"]');
        if (!modal) return { assignedToName: '', assignedToEmail: '' };
        const n = modal.querySelector('.obs-assign-name[data-oid="' + oid + '"]');
        const e = modal.querySelector('.obs-assign-email[data-oid="' + oid + '"]');
        return {
            assignedToName: (n && n.value ? n.value : '').trim(),
            assignedToEmail: (e && e.value ? e.value : '').trim()
        };
    },

    /** مستخدمون نشطون من AppState لقائمة التعيين */
    getObservationAssignableUsers() {
        const raw = Array.isArray(AppState.appData.users) ? AppState.appData.users : [];
        const seen = new Set();
        const out = [];
        raw.forEach((u) => {
            if (!u || typeof u !== 'object') return;
            if (u.isActive === false) return;
            const st = String(u.status || '').toLowerCase();
            if (st === 'inactive' || st === 'معطل' || st === 'disabled') return;
            const email = String(u.email || '').trim();
            const name = String(u.name || u.fullName || email || '').trim();
            if (!name && !email) return;
            const key = (email || name).toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push({
                name: name || email,
                email,
                department: String(u.department || '').trim()
            });
        });
        out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
        return out;
    },

    /**
     * عرض «المعيّن» للواجهة العامة: الاسم والإدارة فقط (بدون بريد إلكتروني)
     */
    formatAssigneePublicDisplay(obs) {
        let name = String(obs?.assignedToName || '').trim();
        // بيانات قديمة أو يدوية: "الاسم — email@domain"
        if (name) {
            name = name.replace(/\s*[—–\-]\s*[^\s@]+@[^\s@]+\.[^\s@]+$/i, '').trim();
        }
        const email = String(obs?.assignedToEmail || '').trim().toLowerCase();
        if (!name && !email) return '';
        const users = this.getObservationAssignableUsers();
        let dept = '';
        const u = users.find((x) => String(x.email || '').trim().toLowerCase() === email);
        if (u && u.department) dept = String(u.department).trim();
        if (name && dept) return `${name} (${dept})`;
        if (name) return name;
        if (email && u) {
            const nm = String(u.name || '').trim();
            if (nm && dept) return `${nm} (${dept})`;
            if (nm) return nm;
        }
        return '—';
    },

    getWorkflowCommentFieldsVisibility(obs) {
        const stage = String(obs?.workflowStage || '').trim() || 'pending_specialist';
        const u = AppState.currentUser;
        const adm = this._isAdminRole(u);
        const specReviewPerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-specialist-review');
        const mgrApprovePerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-manager-approve');
        const canActAsSpecialist = adm || this._isSafetyOfficerRole(u) || specReviewPerm;
        const canActAsSafetyManager = adm || mgrApprovePerm;
        const specOk = canActAsSpecialist && (stage === 'pending_specialist' || stage === 'returned_specialist');
        const mgrOk = canActAsSafetyManager && stage === 'pending_manager';
        return {
            showOptional: specOk || mgrOk,
            showReject: mgrOk || (adm && stage === 'pending_manager')
        };
    },

    readWorkflowCommentsFromDetailModal(observationId) {
        const oid = String(observationId || '').replace(/"/g, '');
        const modal = document.querySelector('.modal-overlay[data-observation-id="' + oid + '"]');
        if (!modal) return { comments: '', rejectionReason: '' };
        const o = modal.querySelector('.obs-wf-optional-comment[data-oid="' + oid + '"]');
        const r = modal.querySelector('.obs-wf-reject-reason[data-oid="' + oid + '"]');
        return {
            comments: (o && o.value ? o.value : '').trim(),
            rejectionReason: (r && r.value ? r.value : '').trim()
        };
    },

    buildWorkflowInlineCommentFieldsHtml(obs) {
        const v = this.getWorkflowCommentFieldsVisibility(obs);
        if (!v.showOptional && !v.showReject) return '';
        const oidAttr = String(obs.id || '').replace(/"/g, '');
        let html = '<div class="obs-wf-inline-fields" style="margin-top:0.85rem;display:flex;flex-direction:column;gap:0.45rem;">';
        if (v.showOptional) {
            html += `
            <label style="font-size:0.8rem;opacity:0.95;">تعليق اختياري مع الإجراء</label>
            <textarea class="form-input obs-wf-optional-comment" data-oid="${oidAttr}" rows="2" placeholder="يُرسل مع «إرسال لمدير السلامة» أو «اعتماد وإرسال للإدارة»…" style="width:100%;max-width:100%;color:#111;resize:vertical;"></textarea>`;
        }
        if (v.showReject) {
            html += `
            <label style="font-size:0.8rem;opacity:0.95;">سبب الرفض أو الإرجاع</label>
            <textarea class="form-input obs-wf-reject-reason" data-oid="${oidAttr}" rows="2" placeholder="املأه قبل الضغط على رفض أو إرجاع…" style="width:100%;max-width:100%;color:#111;resize:vertical;"></textarea>`;
        }
        html += '</div>';
        return html;
    },

    buildAssignResponsibleHtml(obs) {
        if (!this.canShowAssignResponsiblePanel(obs)) return '';
        const oidAttr = String(obs.id || '').replace(/"/g, '');
        const an = Utils.escapeHTML(String(obs.assignedToName || ''));
        const ae = Utils.escapeHTML(String(obs.assignedToEmail || ''));
        const users = this.getObservationAssignableUsers();
        const currentEmail = String(obs.assignedToEmail || '').trim().toLowerCase();
        const options = ['<option value="">— اختر مستخدماً من النظام —</option>'].concat(
            users.map((u) => {
                const payload = encodeURIComponent(JSON.stringify({ name: u.name, email: u.email }));
                const dept = u.department ? ` (${u.department})` : '';
                const label = Utils.escapeHTML(String(u.name || '').trim() + dept);
                const sel = currentEmail && String(u.email || '').trim().toLowerCase() === currentEmail ? ' selected' : '';
                return `<option value="${payload}"${sel}>${label}</option>`;
            })
        );
        const userListNote = users.length === 0
            ? '<div style="font-size:0.72rem;opacity:0.85;margin-bottom:0.35rem;">لا توجد بيانات مستخدمين محمّلة؛ يمكن الإدخال يدوياً أو مزامنة المستخدمين من الإعدادات.</div>'
            : '';
        return `
        <div class="obs-assign-box" style="margin-top: 1rem; padding: 0.85rem; background: rgba(255,255,255,0.14); border-radius: 12px; border: 1px solid rgba(255,255,255,0.28);">
            <div style="font-weight: 600; margin-bottom: 0.45rem;"><i class="fas fa-user-tag ml-2"></i>تعيين مسؤول المتابعة</div>
            <div style="font-size: 0.78rem; opacity: 0.9; margin-bottom: 0.5rem;">يحدده مسؤول السلامة (أخصائي) أو مدير السلامة (مدير النظام) أو مسؤول الإدارة المعنية.</div>
            ${userListNote}
            <label style="display:block;font-size:0.8rem;opacity:0.9;margin-bottom:0.25rem;">مستخدمو النظام <span style="opacity:0.75;font-size:0.72rem;">(الاسم والإدارة — دون عرض البريد)</span></label>
            <select class="form-input obs-assign-user-select" data-oid="${oidAttr}" style="width:100%;max-width:420px;color:#111;margin-bottom:0.5rem;display:block;">
                ${options.join('')}
            </select>
            <div style="font-size:0.75rem;opacity:0.85;margin-bottom:0.35rem;">أو الاسم يدوياً:</div>
            <input type="text" class="form-input obs-assign-name" data-oid="${oidAttr}" placeholder="الاسم الكامل" value="${an}" style="width:100%;max-width:340px;color:#111;margin-bottom:0.35rem;display:block;" />
            <input type="hidden" class="obs-assign-email" data-oid="${oidAttr}" value="${ae}" autocomplete="off" />
            <p style="font-size:0.72rem;opacity:0.82;margin:0 0 0.5rem;line-height:1.45;">يُربَط البريد تلقائياً عند الاختيار من القائمة ويُستخدم في الخلفية دون عرضه.</p>
            <button type="button" class="btn-secondary btn-sm obs-wf-assign-save" data-oid="${oidAttr}" style="background: rgba(255,255,255,0.22); color: #fff; border: 1px solid rgba(255,255,255,0.45);">
                <i class="fas fa-save ml-1"></i>حفظ التعيين
            </button>
        </div>`;
    },

    replaceObservationDetailModal(observationId, record) {
        const oid = String(observationId || '').replace(/"/g, '');
        const old = document.querySelector('.modal-overlay[data-observation-id="' + oid + '"]');
        if (!old || !record) return;
        const updated = this.normalizeRecord(record);
        const newModal = this.createObservationModal(updated);
        old.replaceWith(newModal);
        this.attachWorkflowPanelListeners(newModal);
    },

    /** إغلاق نافذة تفاصيل الملاحظة فوراً (مثلاً بعد طلب سير العمل دون انتظار الخادم) */
    closeObservationDetailModalIfOpen(observationId) {
        const oid = String(observationId || '').replace(/"/g, '');
        const m = document.querySelector('.modal-overlay[data-observation-id="' + oid + '"]');
        if (m) m.remove();
    },

    getObservationDetailInlineAlertsEl(observationId) {
        const oid = String(observationId || '').replace(/"/g, '');
        const modal = document.querySelector('.modal-overlay[data-observation-id="' + oid + '"]');
        return modal ? modal.querySelector('[data-obs-inline-alerts]') : null;
    },

    /** رسائل خطأ/نجاح أعلى نموذج التفاصيل (ظاهرة فوق شريط سير العمل) */
    showObservationDetailInlineAlert(observationId, type, message) {
        const el = this.getObservationDetailInlineAlertsEl(observationId);
        if (!el || message == null || String(message).trim() === '') return false;
        const safe = Utils.escapeHTML(String(message));
        const cls = type === 'success' ? 'obs-inline-alert obs-inline-alert-success'
            : type === 'warning' ? 'obs-inline-alert obs-inline-alert-warning'
            : type === 'error' ? 'obs-inline-alert obs-inline-alert-error'
            : 'obs-inline-alert obs-inline-alert-info';
        el.innerHTML = `<div class="${cls}"><button type="button" class="obs-inline-alert-close" aria-label="إغلاق">&times;</button><span class="obs-inline-alert-msg">${safe}</span></div>`;
        const close = el.querySelector('.obs-inline-alert-close');
        if (close) close.addEventListener('click', () => { el.innerHTML = ''; });
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) { /* ignore */ }
        return true;
    },

    clearObservationDetailInlineAlert(observationId) {
        const el = this.getObservationDetailInlineAlertsEl(observationId);
        if (el) el.innerHTML = '';
    },

    /** ترتيب السجل الزمني تنازلياً (الأحدث أولاً) */
    normalizeTimeLogArray(raw) {
        let timeLog = [];
        try {
            if (raw == null) return [];
            if (Array.isArray(raw)) timeLog = raw.slice();
            else if (typeof raw === 'string' && raw) timeLog = JSON.parse(raw);
        } catch (e) {
            timeLog = [];
        }
        if (!Array.isArray(timeLog)) timeLog = [];
        return timeLog.sort((a, b) => {
            const tb = new Date(b.timestamp || 0).getTime();
            const ta = new Date(a.timestamp || 0).getTime();
            return tb - ta;
        });
    },

    /** سطر العرض: «الدور: التفصيل» أو النص القديم note */
    formatTimelineDetailLine(log) {
        if (!log || typeof log !== 'object') return '—';
        const r = String(log.roleLabel || '').trim();
        const d = String(log.actionDetail || '').trim();
        if (r && d) return r + ': ' + d;
        const n = String(log.note || '').trim();
        return n || '—';
    },

    formatTimelineDate(ts) {
        if (!ts) return '';
        try {
            const dt = new Date(ts);
            if (Number.isNaN(dt.getTime())) return '';
            return dt.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory' });
        } catch (e) {
            return typeof Utils !== 'undefined' && Utils.formatDate ? Utils.formatDate(ts) : '';
        }
    },

    /**
     * HTML السجل الزمني (بطاقات: تاريخ | اسم + نقطة | سطر الدور والإجراء)
     */
    buildObservationTimelineHtml(timeLogRaw) {
        const timeLog = this.normalizeTimeLogArray(timeLogRaw);
        if (!timeLog.length) {
            return '<p class="text-gray-500 text-sm">لا يوجد سجل زمني</p>';
        }
        return `
            <div class="obs-timeline-list space-y-2">
                ${timeLog.map((log) => `
                    <div class="obs-timeline-item">
                        <div class="obs-timeline-meta">
                            <div class="obs-timeline-body">
                                <div class="obs-timeline-user-row">
                                    <span class="obs-timeline-name">${Utils.escapeHTML(log.user || '')}</span>
                                    <span class="obs-timeline-dot" aria-hidden="true"></span>
                                </div>
                                <p class="obs-timeline-detail">${Utils.escapeHTML(this.formatTimelineDetailLine(log))}</p>
                                ${log.action === 'status_changed' && log.oldStatus != null && log.newStatus != null ? `
                                    <p class="obs-timeline-status-hint text-xs text-gray-500 mt-1">
                                        من <span class="font-medium">${Utils.escapeHTML(String(log.oldStatus))}</span>
                                        إلى <span class="font-medium">${Utils.escapeHTML(String(log.newStatus))}</span>
                                    </p>
                                ` : ''}
                            </div>
                            <time class="obs-timeline-date" datetime="${Utils.escapeHTML(String(log.timestamp || ''))}">${Utils.escapeHTML(this.formatTimelineDate(log.timestamp))}</time>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    formatResponsibleTableCell(obs) {
        const dept = Utils.escapeHTML(obs.responsibleDepartment || '-');
        const asn = (obs.assignedToName || '').trim();
        if (!asn) return dept;
        return `<div class="text-sm text-gray-800">${dept}</div><div class="text-xs text-gray-500">${Utils.escapeHTML(asn)}</div>`;
    },

    /** تطبيع اسم الإدارة (مطابق لـ _dobNormalizeDept_ في الخادم) */
    normalizeObservationDepartment(s) {
        return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    },

    isUserInResponsibleDepartment(observation) {
        const u = this.normalizeObservationDepartment(AppState.currentUser?.department);
        const d = this.normalizeObservationDepartment(observation?.responsibleDepartment);
        return !!(u && d && u === d);
    },

    /**
     * فلترة الملاحظات للمستخدم الحالي — نفس منطق filterDailyObservationsForRequestContext في الخادم.
     * تُستخدم في الواجهة عندما تُحمَّل القائمة كاملة من المزامنة العامة دون سياق.
     */
    filterDailyObservationsForCurrentUserScope(rows) {
        const list = Array.isArray(rows) ? rows : [];
        if (this.canViewAllObservationsWorkflow()) return list.slice();
        const ctx = typeof this.buildObservationsRequestContext === 'function' ? this.buildObservationsRequestContext() : null;
        if (!ctx) return list.slice();

        const norm = (x) => this.normalizeObservationDepartment(x);
        const userDept = norm(ctx.department);
        const userEmail = String(ctx.email || '').trim().toLowerCase();
        const userName = String(ctx.name || '').trim().toLowerCase();
        const perms = ctx.dailyObservationsPermissions || {};
        const deptScope = perms['observations-view-department'] !== false;

        return list.filter((obs) => {
            if (!obs) return false;
            const o = this.normalizeRecord(obs);
            const stage = String(o.workflowStage || '').trim();
            const resp = norm(o.responsibleDepartment);
            const subEmail = String(o.submittedByEmail || '').trim().toLowerCase();
            const observer = String(o.observerName || '').trim().toLowerCase();

            const isSubmitter = (userEmail && subEmail && userEmail === subEmail) ||
                (userName && observer && userName === observer);

            if (!stage) {
                if (isSubmitter) return true;
                if (deptScope && userDept && resp && userDept === resp) return true;
                return false;
            }
            if (isSubmitter) return true;

            const early = (stage === 'pending_specialist' || stage === 'pending_manager' || stage === 'returned_specialist');
            if (early) return false;

            if (deptScope && userDept && resp && userDept === resp) {
                return (
                    stage === 'pending_department' ||
                    stage === 'in_progress' ||
                    stage === 'closed' ||
                    stage === 'rejected'
                );
            }
            return false;
        });
    },

    /** قائمة الملاحظات الظاهرة للمستخدم (سجل كامل في AppState قد يتضمن صفوفاً مخفية على الخادم) */
    getDailyObservationsVisibleToCurrentUser() {
        const raw = Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : [];
        return this.filterDailyObservationsForCurrentUserScope(raw);
    },

    isDailyObservationVisibleToCurrentUser(rawOrNormalized) {
        if (!rawOrNormalized) return false;
        if (this.canViewAllObservationsWorkflow()) return true;
        const one = this.normalizeRecord(rawOrNormalized);
        return this.filterDailyObservationsForCurrentUserScope([one]).length === 1;
    },

    canEditObservationStatusInDetail(/* observation */) {
        return this.canViewAllObservationsWorkflow() || this.isSystemManager();
    },

    /**
     * ✅ التحقق من صلاحية تعديل الحقول في نموذج التفاصيل
     * مسموح لـ: مدير السلامة، أخصائي السلامة، إدارة السلامة
     */
    canEditObservationFieldsInDetail(observation) {
        const user = AppState.currentUser;
        if (!user) return false;
        
        // مدير النظام لديه صلاحيات كاملة
        if (this._isAdminRole(user)) return true;
        
        // مدير السلامة
        if (this.hasManagerWorkflowPermission()) return true;
        
        // أخصائي السلامة
        if (this.hasSpecialistWorkflowPermission()) return true;
        
        // التحقق من الصلاحيات التفصيلية
        if (typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission) {
            return Permissions.hasDetailedPermission('daily-observations', 'observations-edit-fields');
        }
        
        return false;
    },

    /**
     * ✅ الحصول على أنواع الملاحظات
     */
    getObservationTypes() {
        const types = [
            'ملاحظة سلوكية',
            'ملاحظة شرط عمل',
            'ملاحظة أداة',
            'ملاحظة معدات',
            'ملاحظة بيئة عمل',
            'ملاحظة أخرى'
        ];
        const customTypes = (AppState.appData?.dailyObservations || [])
            .map(obs => obs.observationType)
            .filter(Boolean);
        return [...new Set([...types, ...customTypes])].sort();
    },

    /**
     * ✅ الحصول على مستويات الخطورة
     */
    getRiskLevels() {
        return ['منخفض', 'متوسط', 'مرتفع', 'شديد'];
    },

    /**
     * ✅ الحصول على الإدارات
     */
    getDepartments() {
        const depts = (AppState.appData?.users || [])
            .map(u => u.department)
            .filter(Boolean);
        return [...new Set(depts)].sort();
    },

    /**
     * ✅ معالجة تغيير حقل في نموذج التفاصيل
     */
    async handleFieldChange(observationId, fieldName, newValue, element) {
        try {
            // تحديث محلي فوري
            const obs = AppState.appData.dailyObservations.find(o => o.id === observationId);
            if (!obs) {
                Notification.error('الملاحظة غير موجودة');
                return;
            }

            // تحديث في الذاكرة
            obs[fieldName] = newValue;
            obs.updatedAt = new Date().toISOString();

            // إشعار بتحديث
            const fieldLabels = {
                observationType: 'نوع الملاحظة',
                riskLevel: 'معدل الخطورة',
                responsibleDepartment: 'المسؤول عن التنفيذ',
                expectedCompletionDate: 'التاريخ المتوقع للتنفيذ',
                details: 'تفاصيل الملاحظة',
                correctiveAction: 'الإجراء التصحيحي / الوقائي'
            };
            
            Notification.success(`تم تحديث ${fieldLabels[fieldName] || fieldName} بنجاح`);

            // حفظ في الخلفية
            const updateData = {
                [fieldName]: newValue,
                updatedAt: obs.updatedAt
            };

            GoogleIntegration.sendRequest({
                action: 'updateObservation',
                data: {
                    observationId: observationId,
                    updateData: updateData
                }
            }).catch(error => {
                Utils.safeWarn('⚠️ خطأ في حفظ التحديث في الخلفية:', error);
            });

        } catch (error) {
            Utils.safeError('خطأ في تحديث الحقل:', error);
            Notification.error('حدث خطأ أثناء التحديث: ' + error.message);
        }
    },

    openEditFromDetailModal(observationId) {
        if (!this.canDailyObservationsFullAdminUi()) {
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('تعديل الملاحظة متاح لمدير النظام فقط');
            }
            return;
        }
        const openModal = document.querySelector('.modal-overlay[data-observation-id="' + observationId + '"]')
            || document.querySelector('.modal-overlay');
        if (openModal) openModal.remove();
        const raw = (AppState.appData.dailyObservations || []).find((o) => o.id === observationId);
        if (!raw) {
            Notification.error('الملاحظة غير موجودة');
            return;
        }
        if (typeof this.isDailyObservationVisibleToCurrentUser === 'function' && !this.isDailyObservationVisibleToCurrentUser(raw)) {
            Notification.error('لا صلاحية لتعديل هذه الملاحظة');
            return;
        }
        this.showForm(this.normalizeRecord(raw));
    },

    buildWorkflowActionButtonsHtml(obs) {
        const id = obs.id;
        const oidAttr = String(id || '').replace(/"/g, '');
        const stage = (obs.workflowStage || '').trim() || 'pending_specialist';
        const btns = [];
        const u = AppState.currentUser;
        const adm = this._isAdminRole(u);
        const specReviewPerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-specialist-review');
        const mgrApprovePerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-manager-approve');
        /** إرسال للأخصائي/المدير: مدير النظام، أو مسؤول سلامة، أو صلاحية مراجعة أخصائي — وليس لكل المستخدمين */
        const canActAsSpecialist = adm || this._isSafetyOfficerRole(u) || specReviewPerm;
        /** أزرار اعتماد مدير السلامة (الثلاثة): مدير النظام أو صلاحية observations-manager-approve فقط */
        const canActAsSafetyManager = adm || mgrApprovePerm;

        if (canActAsSpecialist && (stage === 'pending_specialist' || stage === 'returned_specialist')) {
            btns.push(`<button type="button" class="btn-primary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="specialist_forward" style="background: #22c55e; border: none;"><i class="fas fa-share ml-1"></i>إرسال لمدير السلامة</button>`);
        }
        if (canActAsSafetyManager && stage === 'pending_manager') {
            btns.push(`<button type="button" class="btn-primary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="manager_approve" style="background: #0ea5e9; border: none;"><i class="fas fa-check ml-1"></i>اعتماد وإرسال للإدارة</button>`);
            btns.push(`<button type="button" class="btn-secondary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="manager_return_specialist" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4);"><i class="fas fa-undo ml-1"></i>إرجاع لمسؤول السلامة (أخصائي)</button>`);
            btns.push(`<button type="button" class="btn-secondary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="manager_reject" style="background: #b91c1c; color: white; border: none;"><i class="fas fa-times ml-1"></i>رفض</button>`);
        }
        /** إرجاع/رفض إداري: مدير النظام فقط (لا تُعرض لمن لديه صلاحية اعتماد فقط) */
        if (adm && stage === 'pending_manager') {
            btns.push(`<button type="button" class="btn-secondary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="admin_return_specialist" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.35);"><i class="fas fa-user-shield ml-1"></i>إرجاع من مدير النظام لمسؤول السلامة</button>`);
            btns.push(`<button type="button" class="btn-secondary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="admin_reject" style="background: #7f1d1d; color: white; border: none;"><i class="fas fa-ban ml-1"></i>رفض إداري</button>`);
        }
        if ((stage === 'in_progress' || stage === 'pending_department')) {
            const deptUser = this.isUserInResponsibleDepartment(obs);
            if (adm || canActAsSafetyManager || canActAsSpecialist || deptUser) {
                btns.push(`<button type="button" class="btn-primary btn-sm obs-wf-action" data-oid="${oidAttr}" data-wfa="close_observation" style="background: #6366f1; border: none;"><i class="fas fa-flag-checkered ml-1"></i>إغلاق الملاحظة</button>`);
            }
        }
        return btns.join('');
    },

    buildDepartmentWorkflowFormHtml(obs) {
        const stage = (obs.workflowStage || '').trim();
        if (stage !== 'pending_department' && stage !== 'in_progress') return '';
        const isDept = this.isUserInResponsibleDepartment(obs);
        const adm = this._isAdminRole(AppState.currentUser);
        if (!isDept && !adm) return '';
        const oidAttr = String(obs.id || '').replace(/"/g, '');
        const corr = Utils.escapeHTML(String(obs.correctiveAction || ''));
        const exp = obs.expectedCompletionDate ? String(obs.expectedCompletionDate).slice(0, 10) : '';
        return `
        <div class="obs-dept-workflow" style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.12); border-radius: 12px; border: 1px solid rgba(255,255,255,0.25);">
            <div style="font-weight: 600; margin-bottom: 0.5rem;"><i class="fas fa-building ml-2"></i>إدخال الإدارة المسؤولة</div>
            <label style="display:block;font-size:0.85rem;opacity:0.9;">الإجراء التصحيحي</label>
            <textarea class="form-input obs-dept-corrective-input" data-oid="${oidAttr}" rows="3" style="width:100%;margin:0.35rem 0 0.75rem;color:#111;">${corr}</textarea>
            <label style="display:block;font-size:0.85rem;opacity:0.9;">تاريخ الإغلاق المتوقع</label>
            <input type="date" class="form-input obs-dept-expected-input" data-oid="${oidAttr}" value="${exp.replace(/"/g, '')}" style="width:100%;max-width:280px;margin:0.35rem 0;color:#111;" />
            <div style="margin-top:0.75rem;">
                <button type="button" class="btn-primary btn-sm obs-wf-dept-save" data-oid="${oidAttr}"><i class="fas fa-save ml-1"></i>حفظ إجراء الإدارة</button>
            </div>
        </div>`;
    },

    buildWorkflowBannerHtml(observation) {
        const metaRows = [];
        const pushMetaRow = (title, value) => {
            const v = String(value ?? '').trim();
            if (!v) return;
            metaRows.push(
                `<div class="obs-wf-meta-line" style="display:flex;flex-wrap:wrap;gap:0.35rem 0.5rem;align-items:baseline;direction:rtl;text-align:right;">` +
                `<span style="opacity:0.88;">${Utils.escapeHTML(title)}</span>` +
                `<strong style="font-weight:700;opacity:1;">${Utils.escapeHTML(v)}</strong>` +
                `</div>`
            );
        };
        pushMetaRow('المُسجِّل:', observation.submittedBy);
        pushMetaRow('مراجعة مسؤول السلامة (أخصائي):', observation.specialistReviewedBy);
        pushMetaRow('اعتماد مدير السلامة (مدير النظام):', observation.managerApprovedBy);
        pushMetaRow('ملاحظة:', observation.rejectionReason);
        const actions = this.buildWorkflowActionButtonsHtml(observation);
        const deptForm = this.buildDepartmentWorkflowFormHtml(observation);
        const assignBox = this.buildAssignResponsibleHtml(observation);
        const commentFields = this.buildWorkflowInlineCommentFieldsHtml(observation);
        if (observation.assignedToName || observation.assignedToEmail) {
            const assignLabel = this.formatAssigneePublicDisplay(observation);
            if (assignLabel && assignLabel !== '—') pushMetaRow('معيّن:', assignLabel);
        }
        const metaLine = metaRows.length
            ? `<div class="obs-wf-meta" style="font-size: 0.8rem; line-height: 1.55; margin-bottom: 0.35rem; display: flex; flex-direction: column; gap: 0.4rem; direction: rtl; text-align: right;">${metaRows.join('')}</div>`
            : '';
        return `
        <div class="obs-workflow-panel" style="background: linear-gradient(135deg, #312e81 0%, #5b21b6 100%); color: white; padding: 1.25rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
            ${metaLine}
            ${commentFields}
            ${assignBox}
            ${actions ? `<div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">${actions}</div>` : ''}
            ${deptForm}
        </div>`;
    },

    attachWorkflowPanelListeners(modal) {
        if (!modal) return;
        modal.querySelectorAll('.obs-wf-action').forEach((btn) => {
            btn.addEventListener('click', () => {
                const oid = btn.getAttribute('data-oid');
                const wfa = btn.getAttribute('data-wfa');
                if (!oid || !wfa) return;
                requestAnimationFrame(() => {
                    void this.promptAndRunWorkflowTransition(oid, wfa).catch((e) => {
                        Utils.safeWarn('promptAndRunWorkflowTransition', e);
                    });
                });
            });
        });
        modal.querySelectorAll('.obs-wf-dept-save').forEach((btn) => {
            btn.addEventListener('click', () => {
                const oid = btn.getAttribute('data-oid');
                if (!oid) return;
                const corrEl = modal.querySelector('.obs-dept-corrective-input[data-oid="' + oid.replace(/"/g, '') + '"]');
                const expEl = modal.querySelector('.obs-dept-expected-input[data-oid="' + oid.replace(/"/g, '') + '"]');
                const payload = {
                    correctiveAction: (corrEl?.value || '').trim(),
                    expectedCompletionDate: expEl?.value ? new Date(expEl.value).toISOString() : ''
                };
                requestAnimationFrame(() => {
                    void this.runWorkflowTransition(oid, 'department_update', payload).catch((e) => {
                        Utils.safeWarn('runWorkflowTransition department_update', e);
                    });
                });
            });
        });
        modal.querySelectorAll('.obs-wf-assign-save').forEach((btn) => {
            btn.addEventListener('click', () => {
                const oid = btn.getAttribute('data-oid');
                if (!oid) return;
                const { assignedToName, assignedToEmail } = this.readAssignFieldsFromDetailModal(oid);
                if (!assignedToName) {
                    if (typeof Notification !== 'undefined' && Notification.warning) Notification.warning('يرجى إدخال اسم المسؤول المعيّن');
                    return;
                }
                requestAnimationFrame(() => {
                    void this.runWorkflowTransition(oid, 'assign_responsible', { assignedToName, assignedToEmail }).catch((e) => {
                        Utils.safeWarn('runWorkflowTransition assign_responsible', e);
                    });
                });
            });
        });
        modal.querySelectorAll('.obs-assign-user-select').forEach((sel) => {
            sel.addEventListener('change', () => {
                const oid = sel.getAttribute('data-oid');
                if (!oid) return;
                let name = '';
                let email = '';
                try {
                    const v = sel.value;
                    if (v) {
                        const o = JSON.parse(decodeURIComponent(v));
                        name = String(o.name || '').trim();
                        email = String(o.email || '').trim();
                    }
                } catch (e) { /* ignore */ }
                const root = sel.closest('.modal-overlay');
                if (!root) return;
                const esc = oid.replace(/"/g, '');
                const n = root.querySelector('.obs-assign-name[data-oid="' + esc + '"]');
                const em = root.querySelector('.obs-assign-email[data-oid="' + esc + '"]');
                if (n) n.value = name;
                if (em) em.value = email;
            });
        });
    },

    async promptAndRunWorkflowTransition(observationId, action) {
        const needsReason = (
            action === 'manager_reject' ||
            action === 'admin_reject' ||
            action === 'manager_return_specialist' ||
            action === 'admin_return_specialist'
        );
        const { comments, rejectionReason } = this.readWorkflowCommentsFromDetailModal(observationId);
        if (needsReason) {
            if (!rejectionReason.trim()) {
                const msg = 'يرجى إدخال سبب الرفض أو الإرجاع في الحقل المخصص داخل بطاقة سير الاعتماد.';
                this.showObservationDetailInlineAlert(observationId, 'warning', msg);
                if (typeof Notification !== 'undefined' && Notification.warning) Notification.warning('السبب مطلوب');
                return;
            }
        }
        const assign =
            action === 'specialist_forward' || action === 'manager_approve'
                ? this.readAssignFieldsFromDetailModal(observationId)
                : {};
        await this.runWorkflowTransition(observationId, action, {
            comments: needsReason ? '' : comments,
            rejectionReason: needsReason ? rejectionReason : '',
            ...assign
        });
    },

    pushObservationInAppNotification(title, body, observationId) {
        try {
            const key = 'hse_obs_workflow_notifications';
            const raw = localStorage.getItem(key);
            let list = [];
            try {
                list = raw ? JSON.parse(raw) : [];
            } catch (e) {
                list = [];
            }
            if (!Array.isArray(list)) list = [];
            list.unshift({
                title: title || '',
                body: body || '',
                observationId: observationId || '',
                at: new Date().toISOString()
            });
            list = list.slice(0, 40);
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) {
            Utils.safeWarn('pushObservationInAppNotification', e);
        }
    },

    async runWorkflowTransition(observationId, action, extra = {}) {
        const u = AppState.currentUser || {};
        const actor = {
            name: (u.name || '').trim() || 'مستخدم',
            email: (u.email || '').trim(),
            role: u.role || '',
            department: (u.department || '').trim(),
            dailyObservationsPermissions: {}
        };
        if (typeof Permissions !== 'undefined' && typeof Permissions.getEffectivePermissions === 'function') {
            try {
                const eff = Permissions.getEffectivePermissions(u) || {};
                actor.dailyObservationsPermissions = eff['daily-observationsPermissions'] || {};
            } catch (e) { /* ignore */ }
        }
        // إغلاق النافذة فوراً وإشعار المستخدم دون انتظار الخادم (تجنّب شاشة التحميل الطويلة ومهلة 12 ثانية الافتراضية)
        this.closeObservationDetailModalIfOpen(observationId);
        if (typeof Notification !== 'undefined' && Notification.info) {
            Notification.info('جاري تنفيذ طلب سير الملاحظة...');
        }
        try {
            const res = await GoogleIntegration.callBackend('transitionObservationWorkflow', {
                observationId,
                action,
                comments: extra.comments || '',
                rejectionReason: extra.rejectionReason || '',
                correctiveAction: extra.correctiveAction,
                expectedCompletionDate: extra.expectedCompletionDate,
                assignedToName: extra.assignedToName,
                assignedToEmail: extra.assignedToEmail,
                actor,
                __timeoutMs: 120000
            });
            if (res && res.success) {
                const okMsg = res.message || 'تم التحديث';
                const idx = AppState.appData.dailyObservations.findIndex((o) => o.id === observationId);
                if (idx !== -1 && res.data) {
                    AppState.appData.dailyObservations[idx] = this.normalizeRecord(res.data);
                }
                try {
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) window.DataManager.save();
                } catch (e) { /* ignore */ }
                this.pushObservationInAppNotification('سير الملاحظات', res.message || 'تم تحديث الملاحظة', observationId);
                await this.yieldToMain();
                try {
                    this.loadObservationsList(this.currentFilter?.filter || null);
                } catch (e) {
                    Utils.safeWarn('loadObservationsList بعد سير الملاحظة', e);
                }
                await this.yieldToMain();
                Notification.success(okMsg);
            } else {
                const errMsg = res?.message || 'فشل التحديث';
                Notification.error(errMsg);
            }
        } catch (err) {
            const errMsg = (err && err.message) ? err.message : String(err);
            Notification.error(errMsg);
        }
    },

    runObservationDueDateReminders() {
        try {
            const list = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
                ? this.getDailyObservationsVisibleToCurrentUser()
                : (AppState.appData.dailyObservations || []);
            const now = new Date();
            const uid = (AppState.currentUser && AppState.currentUser.id) ? String(AppState.currentUser.id) : 'anon';
            list.forEach((raw) => {
                const o = this.normalizeRecord(raw);
                if (o.workflowStage !== 'in_progress' || !o.expectedCompletionDate) return;
                const due = new Date(o.expectedCompletionDate);
                if (Number.isNaN(due.getTime())) return;
                const ms = due.getTime() - now.getTime();
                const days = Math.ceil(ms / (86400000));
                if (days < 0 || days > 2) return;
                const isDept = this.isUserInResponsibleDepartment(o);
                const canSee = this.canViewAllObservationsWorkflow() || isDept;
                if (!canSee) return;
                const sk = `obs_due_${uid}_${o.id}_${due.toISOString().slice(0, 10)}`;
                if (sessionStorage.getItem(sk)) return;
                sessionStorage.setItem(sk, '1');
                const msg = days < 0
                    ? `تجاوز موعد الإغلاق المتوقع للملاحظة ${o.isoCode || o.id}`
                    : `تنبيه: موعد الإغلاق خلال ${days} يوم للملاحظة ${o.isoCode || o.id}`;
                if (typeof Notification !== 'undefined' && Notification.warning) Notification.warning(msg);
            });
        } catch (e) {
            Utils.safeWarn('runObservationDueDateReminders', e);
        }
    },

    /**
     * عناصر صندوق الإشعارات العامة: حالة الملاحظات (تأخير، بانتظار مدير/أخصائي، إرسال للإدارة).
     * تُربَط بـ localStorage للمقروء (نفس باقي الإشعارات في app-ui).
     */
    getObservationInboxNotifications(readNotifications) {
        const read = Array.isArray(readNotifications) ? readNotifications : [];
        const out = [];
        if (!AppState?.appData?.dailyObservations || typeof this.getDailyObservationsVisibleToCurrentUser !== 'function') {
            return out;
        }
        const u = AppState.currentUser;
        if (!u) return out;

        const adm = this._isAdminRole(u);
        const specReviewPerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-specialist-review');
        const mgrApprovePerm = typeof Permissions !== 'undefined' && Permissions.hasDetailedPermission &&
            Permissions.hasDetailedPermission('daily-observations', 'observations-manager-approve');
        const canActAsSpecialist = adm || this._isSafetyOfficerRole(u) || specReviewPerm;
        const canActAsSafetyManager = adm || mgrApprovePerm;

        const navigateToObservation = (obsId) => {
            return () => {
                try {
                    const nav = document.querySelector('a[data-section="daily-observations"]');
                    if (nav) nav.click();
                } catch (e) { /* ignore */ }
                setTimeout(() => {
                    if (typeof this.viewObservation === 'function') {
                        void this.viewObservation(obsId);
                    }
                }, 320);
            };
        };

        const list = this.getDailyObservationsVisibleToCurrentUser();
        list.forEach((raw) => {
            const o = this.normalizeRecord(raw);
            const iso = String(o.isoCode || o.id || '').trim();
            const oid = o.id;
            const stage = String(o.workflowStage || '').trim();

            const isDept = this.isUserInResponsibleDepartment(o);
            const viewAll = this.canViewAllObservationsWorkflow();

            if (stage === 'in_progress' && o.expectedCompletionDate) {
                const due = new Date(o.expectedCompletionDate);
                if (Number.isNaN(due.getTime())) return;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
                if (dueDay < today && (viewAll || isDept)) {
                    const daysOver = Math.floor((today - dueDay) / 86400000);
                    const nid = `obs-delay-${oid}`;
                    if (!read.includes(nid)) {
                        const dayWord = daysOver === 1 ? 'يوماً' : `${daysOver} أيام`;
                        out.push({
                            id: nid,
                            variant: 'observation',
                            type: 'warning',
                            title: 'تأخير موعد تنفيذ ملاحظة',
                            message: `تجاوز موعد الإغلاق المتوقع للملاحظة ${iso} (${dayWord})`,
                            time: o.updatedAt || o.expectedCompletionDate || new Date(),
                            icon: 'fa-clock',
                            observationId: oid,
                            onClick: navigateToObservation(oid)
                        });
                    }
                }
            }

            if (stage === 'pending_manager' && canActAsSafetyManager) {
                const nid = `obs-pending-mgr-${oid}`;
                if (!read.includes(nid)) {
                    out.push({
                        id: nid,
                        variant: 'observation',
                        type: 'info',
                        title: 'ملاحظة بانتظار مدير السلامة',
                        message: `الملاحظة ${iso} — راجعها واعتمدها لإرسالها للإدارة المعنية`,
                        time: o.managerApprovedAt || o.updatedAt || new Date(),
                        icon: 'fa-user-shield',
                        observationId: oid,
                        onClick: navigateToObservation(oid)
                    });
                }
            }

            if ((stage === 'pending_specialist' || stage === 'returned_specialist') && canActAsSpecialist) {
                const nid = `obs-pending-spec-${oid}`;
                if (!read.includes(nid)) {
                    out.push({
                        id: nid,
                        variant: 'observation',
                        type: 'info',
                        title: 'ملاحظة بانتظار مراجعة مسؤول السلامة',
                        message: `الملاحظة ${iso} — راجعها وأرسلها لمدير السلامة`,
                        time: o.updatedAt || new Date(),
                        icon: 'fa-clipboard-check',
                        observationId: oid,
                        onClick: navigateToObservation(oid)
                    });
                }
            }

            if (stage === 'pending_department' && (isDept || viewAll)) {
                const nid = `obs-approved-dept-${oid}`;
                if (!read.includes(nid)) {
                    const detailShort = String(o.details || '').trim().slice(0, 120);
                    const msg = detailShort
                        ? `الملاحظة ${iso} — ${detailShort}${detailShort.length >= 120 ? '…' : ''}`
                        : `الملاحظة ${iso} أرسلت للإدارة المسؤولة (${o.responsibleDepartment || ''}) لتسجيل الإجراء التصحيحي`;
                    out.push({
                        id: nid,
                        variant: 'observation',
                        type: 'success',
                        title: 'تم اعتماد ملاحظة وإرسالها للإدارة',
                        message: msg,
                        time: o.managerApprovedAt || o.updatedAt || new Date(),
                        icon: 'fa-check-circle',
                        observationId: oid,
                        onClick: navigateToObservation(oid)
                    });
                }
            }
        });

        return out;
    },

    DEFAULT_SITES: [
        { id: 'factory-1', name: 'مصنع 1' },
        { id: 'factory-2', name: 'مصنع 2' },
        { id: 'warehouse-1', name: 'مخزن 1' }
    ],

    OBSERVATION_TYPES: [
        { value: 'وضع غير آمن', label: 'وضع غير آمن' },
        { value: 'تصرف غير آمن', label: 'تصرف غير آمن' },
        { value: 'مقترح', label: 'مقترح' },
        { value: 'أخرى', label: 'أخرى' }
    ],

    SHIFTS: ['الأولى', 'الثانية', 'الثالثة'],
    RISK_LEVELS: ['منخفض', 'متوسط', 'عالي'],
    STATUS_OPTIONS: ['مفتوح', 'جاري', 'مغلق'],

    /** مراحل سير الاعتماد (مخزنة بالإنجليزية في الخلفية) */
    WORKFLOW_STAGES: {
        pending_specialist: 'بانتظار مراجعة مسؤول السلامة (أخصائي)',
        pending_manager: 'بانتظار اعتماد مدير السلامة (مدير النظام)',
        pending_department: 'بانتظار إدخال الإجراء من الإدارة',
        returned_specialist: 'معادة لمراجعة مسؤول السلامة (أخصائي)',
        in_progress: 'جاري التنفيذ',
        closed: 'مكتملة (مغلقة)',
        rejected: 'مرفوضة'
    },

    /** خطوات مسار الاعتماد المعروض في نموذج التفاصيل (من اليمين لليسار في الواجهة) */
    WORKFLOW_PATH_STEPS: [
        { title: 'أخصائي السلامة' },
        { title: 'مدير السلامة' },
        { title: 'إدارة التنفيذ' },
        { title: 'جاري التنفيذ' },
        { title: 'مغلقة' }
    ],

    /**
     * حالة المسار البصري: أي خطوة نشطة، وهل اكتمل المسار أو رُفض
     */
    getWorkflowPathVisualState(stage) {
        const s = String(stage || '').trim() || 'pending_specialist';
        if (s === 'rejected') {
            return { mode: 'rejected', activeIndex: -1 };
        }
        if (s === 'closed') {
            return { mode: 'closed', activeIndex: 4 };
        }
        let activeIndex = 0;
        if (s === 'pending_specialist' || s === 'returned_specialist') activeIndex = 0;
        else if (s === 'pending_manager') activeIndex = 1;
        else if (s === 'pending_department') activeIndex = 2;
        else if (s === 'in_progress') activeIndex = 3;
        else activeIndex = 0;
        return { mode: 'progress', activeIndex };
    },

    /** نص سطر «المرحلة الحالية» مع سياق اختياري (مثل الإدارة المسؤولة) — نص عادي يُهرب عند الإدراج في HTML */
    getWorkflowCurrentStageLine(obs) {
        const stage = String(obs?.workflowStage || '').trim();
        let base = this.getWorkflowStageLabel(stage);
        if (stage === 'in_progress' && obs && obs.responsibleDepartment) {
            const dept = String(obs.responsibleDepartment).trim();
            if (dept) base += ` (${dept})`;
        }
        return base;
    },

    /**
     * بطاقة مسار الاعتماد المحسّنة (شارات أفقية + المرحلة الحالية)
     */
    buildWorkflowPathHtml(observation) {
        const stage = (observation.workflowStage || '').trim();
        const vs = this.getWorkflowPathVisualState(stage);
        const steps = this.WORKFLOW_PATH_STEPS || [];
        const badgeBase =
            'display:inline-flex;align-items:center;gap:0.25rem;padding:0.4rem 0.85rem;border-radius:9999px;font-size:0.8rem;font-weight:600;white-space:nowrap;border:1px solid transparent;';
        const badges = steps.map((step, i) => {
            const n = i + 1;
            const text = `${n}. ${step.title}`;
            let st = '';
            if (vs.mode === 'closed') {
                st = `${badgeBase}background:#dcfce7;color:#166534;border-color:#bbf7d0;`;
            } else if (vs.mode === 'rejected') {
                st = `${badgeBase}background:#f3f4f6;color:#9ca3af;border-color:#e5e7eb;`;
            } else if (vs.mode === 'progress') {
                if (i < vs.activeIndex) {
                    st = `${badgeBase}background:#dcfce7;color:#166534;border-color:#bbf7d0;`;
                } else if (i === vs.activeIndex) {
                    st = `${badgeBase}background:#7c3aed;color:#fff;border-color:#6d28d9;box-shadow:0 2px 8px rgba(124,58,237,0.35);`;
                } else {
                    st = `${badgeBase}background:#f3f4f6;color:#6b7280;border-color:#e5e7eb;`;
                }
            } else {
                st = `${badgeBase}background:#f3f4f6;color:#6b7280;`;
            }
            return `<span class="obs-workflow-path-badge" style="${st}">${Utils.escapeHTML(text)}</span>`;
        }).join('');

        const currentLine =
            vs.mode === 'rejected'
                ? `<span style="color:#b91c1c;font-weight:600;">المرحلة الحالية: مرفوضة</span>${observation.rejectionReason ? ` — ${Utils.escapeHTML(String(observation.rejectionReason).slice(0, 120))}${String(observation.rejectionReason).length > 120 ? '…' : ''}` : ''}`
                : `<span style="color:#374151;"><strong style="font-weight:700;">المرحلة الحالية:</strong> ${Utils.escapeHTML(this.getWorkflowCurrentStageLine(observation))}</span>`;

        const rejectedBanner =
            vs.mode === 'rejected'
                ? `<div style="margin-bottom:0.65rem;padding:0.45rem 0.65rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:0.8rem;color:#991b1b;"><i class="fas fa-ban ml-1"></i>سير الاعتماد متوقف — الملاحظة مرفوضة</div>`
                : '';

        return `
        <div class="obs-workflow-path-card" dir="rtl" style="background:#fff;color:#111827;border-radius:14px;padding:1rem 1.15rem;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            ${rejectedBanner}
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:10px;background:linear-gradient(135deg,#ede9fe,#ddd6fe);color:#5b21b6;">
                    <i class="fas fa-project-diagram" style="font-size:0.95rem;"></i>
                </span>
                <span style="font-weight:800;font-size:1.05rem;color:#111827;letter-spacing:-0.02em;">مسار الاعتماد</span>
            </div>
            <div class="obs-workflow-path-steps" style="display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;justify-content:flex-start;direction:rtl;">
                ${badges}
            </div>
            <div style="margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid #f3f4f6;font-size:0.9rem;line-height:1.5;">
                ${currentLine}
            </div>
        </div>`;
    },

    MAX_ATTACHMENT_SIZE: 10 * 1024 * 1024,
    // عتبة عدد الملاحظات لإظهار التحذير
    OBSERVATIONS_THRESHOLD: 10, // عدد الملاحظات في موقع واحد لإظهار التنبيه

    state: {
        selectedSiteId: '',
        selectedSiteName: '',
        availablePlaces: [],
        selectedPlaceId: '',
        isCustomLocationSelected: false,
        customLocationName: '',
        currentAttachments: [],
        editingId: null,
        activeModal: null,
        isLoadingPlaces: false,
        activeTab: 'observations-registry' // حفظ التبويب النشط
    },
    currentFilter: null, // الفلتر النشط الحالي من الكروت
    sheetJsPromise: null,
    _dailyObsLoadPromise: null,
    _dailyObsBackendFetchOk: false,

    /**
     * تحميل ورقة DailyObservations من Google Sheets مرة واحدة (مع منع التكرار)
     */
    async ensureDailyObservationsDataLoaded({ force = false } = {}) {
        if (this._dailyObsLoadPromise && !force) {
            return this._dailyObsLoadPromise;
        }
        this._dailyObsLoadPromise = (async () => {
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.readFromSheets) return;

            const isEnabled = AppState?.googleConfig?.appsScript?.enabled && AppState?.googleConfig?.appsScript?.scriptUrl;
            if (!isEnabled) {
                this._dailyObsBackendFetchOk = true;
                return;
            }

            const ctx = typeof this.buildObservationsRequestContext === 'function' ? this.buildObservationsRequestContext() : null;
            const data = await GoogleIntegration.readFromSheets('DailyObservations', {
                timeout: 15000,
                observationsRequestContext: ctx
            }).catch(() => null);
            if (Array.isArray(data)) {
                const oldData = AppState.appData.dailyObservations || [];
                const viewAll = typeof this.canViewAllObservationsWorkflow === 'function' && this.canViewAllObservationsWorkflow();
                if (!viewAll) {
                    AppState.appData.dailyObservations = data;
                } else if (data.length === 0 && oldData.length > 0) {
                    Utils?.safeLog?.('⚠️ DailyObservations: البيانات الجديدة فارغة - الاحتفاظ بالمحلي');
                } else {
                    AppState.appData.dailyObservations = data;
                }
            }

            try { localStorage.setItem('daily_observations_last_sync', String(Date.now())); } catch (e) {}

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                try { window.DataManager.save(); } catch (e) {}
            }
            this._dailyObsBackendFetchOk = true;
        })().finally(() => {
            this._dailyObsLoadPromise = null;
        });
        return this._dailyObsLoadPromise;
    },

    /**
     * حفظ حالة الواجهة قبل إعادة الرسم
     */
    saveUIState() {
        // حفظ التبويب النشط
        const activeTabBtn = document.querySelector('.tab-btn.active[data-tab]');
        if (activeTabBtn) {
            const tabName = activeTabBtn.getAttribute('data-tab');
            this.state.activeTab = tabName;
        }
        
        // حفظ حالة المودال المفتوح (إن وجد)
        if (this.state.activeModal) {
            // لا نحفظ المودال لأنه سيتم إغلاقه عند إعادة الرسم
            // لكن يمكن حفظ معرف المودال إذا كان مطلوباً
        }
        
        // حفظ أي حالة أخرى للواجهة (كاروسيل، إلخ)
        // يمكن إضافة المزيد هنا حسب الحاجة
    },

    /**
     * استعادة حالة الواجهة بعد إعادة الرسم
     */
    restoreUIState() {
        // استعادة التبويب النشط
        if (this.state.activeTab) {
            setTimeout(() => {
                const tabBtn = document.querySelector(`.tab-btn[data-tab="${this.state.activeTab}"]`);
                if (tabBtn) {
                    tabBtn.click(); // استدعاء click لتفعيل التبويب
                }
            }, 150); // انتظار قصير لضمان اكتمال إعداد التبويبات
        }
    },

    /**
     * إعادة عرض المحتوى عند تغيير اللغة
     */
    refreshOnLanguageChange() {
        // إعادة عرض القائمة إذا كانت معروضة
        if (this.state && this.state.activeTab) {
            this.renderList();
        }
    },

    async load() {
        // إضافة مستمع لتغيير اللغة
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.refreshOnLanguageChange();
            });
            
            window.addEventListener('storage', (e) => {
                if (e.key === 'language' && e.newValue !== e.oldValue) {
                    this.refreshOnLanguageChange();
                }
            });
            
            this._languageChangeListenerAdded = true;
        }

        // التأكد من توفر DataManager - محاولة متعددة مع انتظار
        let dataManagerAvailable = false;
        const maxRetries = 10;
        const retryDelay = 200;
        
        for (let i = 0; i < maxRetries; i++) {
            if (typeof window !== 'undefined' && (typeof window.DataManager !== 'undefined' || typeof DataManager !== 'undefined')) {
                dataManagerAvailable = true;
                break;
            }
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
        if (!dataManagerAvailable) {
            const warnMsg = '⚠️ DailyObservations: DataManager غير متاح - قد لا تعمل بعض الوظائف بشكل صحيح';
            Utils?.safeWarn?.(warnMsg) || (typeof Utils !== 'undefined' && Utils.safeWarn ? Utils.safeWarn(warnMsg) : null);
        }

        // دعم معرفات القسم المختلفة
        let section = document.getElementById('daily-observations-section');
        if (!section) {
            section = document.getElementById('dailyobservations-section');
        }
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ DailyObservations: قسم daily-observations-section غير موجود');
            } else {
                console.warn('⚠️ DailyObservations: قسم daily-observations-section غير موجود');
            }
            return;
        }

        // التحقق من توفر AppState (لا تترك الواجهة فارغة)
        if (typeof AppState === 'undefined') {
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-2">تعذر تحميل الملاحظات اليومية</p>
                            <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                            <button onclick="location.reload()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                تحديث الصفحة
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // ✅ عند فتح المديول: اختر أول تبويب متاح حسب الصلاحيات (بدلاً من ترك الواجهة فارغة)
        const canRegistry = this.hasTabAccess('observations-registry');
        const canTop10 = this.hasTabAccess('top-10-observations');
        const canAnalysis = this.hasTabAccess('data-analysis');
        const firstTab = canRegistry ? 'observations-registry' : (canTop10 ? 'top-10-observations' : (canAnalysis ? 'data-analysis' : ''));
        if (!firstTab) {
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">ليس لديك صلاحية للوصول إلى الملاحظات اليومية</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        this.state.activeTab = firstTab;
        // حفظ حالة الواجهة قبل إعادة الرسم (بعد تعيين التبويب الافتراضي)
        this.saveUIState();

        // التأكد من وجود البيانات
        if (!AppState.appData) {
            AppState.appData = {};
        }
        if (!AppState.appData.dailyObservations) {
            AppState.appData.dailyObservations = [];
        }

        const isAdmin = this.isCurrentUserAdmin();

        try {
            const hasObsData = Array.isArray(AppState.appData.dailyObservations) && AppState.appData.dailyObservations.length > 0;
            let lastSync = null;
            try { lastSync = localStorage.getItem('daily_observations_last_sync'); } catch (e) {}
            const cacheAge = lastSync ? (Date.now() - parseInt(lastSync, 10)) : Infinity;
            const CACHE_DURATION = 10 * 60 * 1000;
            const isStale = cacheAge >= CACHE_DURATION;
            if ((!hasObsData || isStale) && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.readFromSheets) {
                void this.ensureDailyObservationsDataLoaded({ force: isStale && hasObsData })
                    .catch(() => {})
                    .finally(() => {
                        try {
                            const tableEl = document.getElementById('observations-table-container');
                            const statsEl = document.getElementById('observations-stats-cards');
                            if (!tableEl && !statsEl) return;
                            if (tableEl && typeof this.loadObservationsList === 'function') {
                                this.loadObservationsList();
                            }
                            if (statsEl && typeof this.renderStatsCards === 'function') {
                                this.renderStatsCards();
                            }
                        } catch (e) { /* ignore */ }
                    });
            } else if (hasObsData) {
                this._dailyObsBackendFetchOk = true;
            }
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.readFromSheets) {
                this._dailyObsBackendFetchOk = true;
            }

            // إظهار الهيكل فوراً: لا ننتظر الشبكة ولا نغطي الشاشة بـ skeleton كامل
            await this.yieldToMain();

            // تحميل المحتوى بالتوازي مع timeout لتجنب واجهة فارغة أو انتظار طويل
            const CONTENT_TIMEOUT_MS = 10000;
            const withTimeout = (promise, fallbackHtml) => {
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('انتهت مهلة التحميل')), CONTENT_TIMEOUT_MS)
                );
                return Promise.race([promise, timeout]).catch((error) => {
                    Utils?.safeWarn?.('⚠️ تحميل محتوى الملاحظات اليومية:', error?.message || error);
                    return fallbackHtml;
                });
            };
            const listErrorHtml = `
                <div class="content-card"><div class="card-body"><div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p class="text-gray-500">حدث خطأ في تحميل البيانات أو انتهت المهلة</p>
                    <button onclick="DailyObservations.load()" class="btn-primary mt-4"><i class="fas fa-redo ml-2"></i>إعادة المحاولة</button>
                </div></div></div>`;
            const analysisErrorHtml = `
                <div class="content-card"><div class="card-body"><div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p class="text-gray-500">حدث خطأ في تحميل تحليل البيانات</p>
                    <button onclick="DailyObservations.load()" class="btn-primary mt-4"><i class="fas fa-redo ml-2"></i>إعادة المحاولة</button>
                </div></div></div>`;
            const top10ErrorHtml = `
                <div class="content-card"><div class="card-body"><div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p class="text-gray-500">حدث خطأ في تحميل أفضل 10 ملاحظات</p>
                    <button onclick="DailyObservations.load()" class="btn-primary mt-4"><i class="fas fa-redo ml-2"></i>إعادة المحاولة</button>
                </div></div></div>`;

            const [listResult, analysisResult, top10Result] = await Promise.all([
                withTimeout(this.renderList(), listErrorHtml),
                isAdmin ? withTimeout(this.renderDataAnalysis(), analysisErrorHtml) : Promise.resolve(''),
                withTimeout(this.renderTop10Observations(), top10ErrorHtml)
            ]);
            let listContent = listResult || listErrorHtml;
            let analysisContent = isAdmin ? (analysisResult || analysisErrorHtml) : '';
            let top10Content = top10Result || top10ErrorHtml;

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-clipboard-check ml-3"></i>
                                الملاحظات اليومية
                            </h1>
                            <p class="section-subtitle">تسجيل الملاحظات اليومية ومتابعة الإجراءات التصحيحية</p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${this.canDailyObservationsFullAdminUi() ? `
                            <button id="import-observations-excel-btn" class="btn-secondary">
                                <i class="fas fa-file-import ml-2"></i>
                                استيراد من Excel
                            </button>
                            ` : ''}
                            <button id="export-observations-excel-btn" class="btn-success">
                                <i class="fas fa-file-excel ml-2"></i>
                                تصدير Excel
                            </button>
                            ${this.canDailyObservationsFullAdminUi() ? `
                            <button id="export-observations-ppt-btn" class="btn-secondary">
                                <i class="fas fa-file-powerpoint ml-2"></i>
                                تصدير PPT
                            </button>
                            ` : ''}
                            <button id="add-observation-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة ملاحظة جديدة
                            </button>
                            ${this.canDailyObservationsFullAdminUi() ? `
                            <button id="delete-all-observations-btn" class="btn-secondary" style="background-color: #dc3545; color: white; border-color: #dc3545;">
                                <i class="fas fa-trash-alt ml-2"></i>
                                حذف جميع الملاحظات
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Tabs Navigation: سجل الملاحظات | أفضل 10 ملاحظات | تحليل البيانات | تحديث -->
                <div class="tabs-container mt-6" style="border-bottom: 2px solid var(--border-color);">
                    <div class="tabs-nav" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${canRegistry ? `
                        <button class="tab-btn ${this.state.activeTab === 'observations-registry' ? 'active' : ''}" data-tab="observations-registry" style="padding: 12px 24px; border: none; background: transparent; border-bottom: 3px solid ${this.state.activeTab === 'observations-registry' ? 'var(--primary-color)' : 'transparent'}; color: ${this.state.activeTab === 'observations-registry' ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            <i class="fas fa-list ml-2"></i>
                            سجل الملاحظات
                        </button>
                        ` : ''}
                        ${canTop10 ? `
                        <button class="tab-btn ${this.state.activeTab === 'top-10-observations' ? 'active' : ''}" data-tab="top-10-observations" style="padding: 12px 24px; border: none; background: transparent; border-bottom: 3px solid ${this.state.activeTab === 'top-10-observations' ? 'var(--primary-color)' : 'transparent'}; color: ${this.state.activeTab === 'top-10-observations' ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            <i class="fas fa-trophy ml-2"></i>
                            أفضل 10 ملاحظات
                        </button>
                        ` : ''}
                        ${canAnalysis ? `
                        <button class="tab-btn ${this.state.activeTab === 'data-analysis' ? 'active' : ''}" data-tab="data-analysis" style="padding: 12px 24px; border: none; background: transparent; border-bottom: 3px solid ${this.state.activeTab === 'data-analysis' ? 'var(--primary-color)' : 'transparent'}; color: ${this.state.activeTab === 'data-analysis' ? 'var(--primary-color)' : 'var(--text-secondary)'}; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            <i class="fas fa-chart-line ml-2"></i>
                            تحليل البيانات
                        </button>
                        ` : ''}
                        <button type="button" id="daily-observations-refresh-btn" class="tab-btn" style="padding: 12px 24px; border: none; background: transparent; border-bottom: 3px solid transparent; color: var(--text-secondary); font-weight: 600; cursor: pointer; transition: all 0.3s;" title="تحديث المديول">
                            <i class="fas fa-sync-alt ml-2"></i>
                            تحديث
                        </button>
                    </div>
                </div>

                <!-- Tab Content -->
                <div id="observations-content" class="mt-6">
                    ${canRegistry ? `
                    <div id="tab-observations-registry" class="tab-content ${this.state.activeTab === 'observations-registry' ? 'active' : ''}" style="${this.state.activeTab === 'observations-registry' ? '' : 'display: none;'}">
                        ${listContent}
                    </div>
                    ` : ''}
                    ${canTop10 ? `
                    <div id="tab-top-10-observations" class="tab-content ${this.state.activeTab === 'top-10-observations' ? 'active' : ''}" style="${this.state.activeTab === 'top-10-observations' ? '' : 'display: none;'}">
                        ${top10Content}
                    </div>
                    ` : ''}
                    ${canAnalysis ? `
                    <div id="tab-data-analysis" class="tab-content ${this.state.activeTab === 'data-analysis' ? 'active' : ''}" style="${this.state.activeTab === 'data-analysis' ? '' : 'display: none;'}">
                        ${analysisContent}
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.setupEventListeners();
            
            // تهيئة الفلتر الحالي
            this.currentFilter = null;
            
            // تفعيل التبويبات لكل المستخدمين (إذا كان أكثر من تبويب متاح)
            try {
                this.setupTabs();
            } catch (e) { /* ignore */ }
            
            // استعادة حالة الواجهة بعد إعادة الرسم
            this.restoreUIState();
            
            try {
                requestAnimationFrame(() => {
                    const runDeferred = () => {
                        try {
                            if (this.state && this.state.activeTab === 'observations-registry') {
                                void this.loadObservationsList();
                                try {
                                    this.runObservationDueDateReminders();
                                } catch (remErr) {
                                    Utils.safeWarn('⚠️ تنبيهات مواعيد الملاحظات:', remErr);
                                }
                            }
                        } catch (err) {
                            Utils.safeWarn('⚠️ خطأ في تحميل قائمة الملاحظات الأولي:', err);
                        }
                    };
                    if (typeof requestIdleCallback !== 'undefined') {
                        requestIdleCallback(runDeferred, { timeout: 2500 });
                    } else {
                        setTimeout(runDeferred, 0);
                    }
                });
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل قائمة الملاحظات الأولي:', error);
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('خطأ عام في تحميل DailyObservations:', error);
            } else {
                console.error('خطأ عام في تحميل DailyObservations:', error);
            }
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-clipboard-check ml-3"></i>
                            الملاحظات اليومية
                        </h1>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-2">حدث خطأ أثناء تحميل البيانات</p>
                                <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : 'خطأ غير معروف'}</p>
                                <button onclick="DailyObservations.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    async renderList() {
        // جمع القيم الفريدة للفلاتر (حسب نطاق صلاحية المستخدم / الإدارة)
        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);

        const observations = observationsRaw.map(item => this.normalizeRecord(item));
        
        // جمع القيم الفريدة
        const sites = [...new Set(observations.map(o => o.siteName).filter(Boolean))].sort();
        const locations = [...new Set(observations.map(o => o.locationName).filter(Boolean))].sort();
        const types = [...new Set(observations.map(o => o.observationType).filter(Boolean))].sort();
        const shifts = [...new Set(observations.map(o => o.shift).filter(Boolean))].sort();
        const riskLevels = [...new Set(observations.map(o => o.riskLevel).filter(Boolean))].sort();
        const statuses = [...new Set(observations.map(o => o.status).filter(Boolean))].sort();
        const observers = [...new Set(observations.map(o => o.observerName).filter(Boolean))].sort();
        const responsibles = [...new Set(observations.map(o => o.responsibleDepartment).filter(Boolean))].sort();

        const { t, isRTL } = this.getTranslations();
        const iconMarginClass = isRTL ? 'ml-1' : 'mr-1';
        const titleIconMargin = isRTL ? 'ml-2' : 'mr-2';
        
        return `
            <!-- الكروت الإحصائية -->
            <div id="observations-stats-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <!-- سيتم ملؤها ديناميكياً -->
            </div>

            <!-- جدول الملاحظات -->
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between gap-4 mb-4 flex-wrap" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; flex: 1;">
                            <h2 class="card-title" style="text-align: ${isRTL ? 'right' : 'left'}; margin: 0; white-space: nowrap;">
                                <i class="fas fa-list ${titleIconMargin}"></i>
                                ${t('title.observationsRegistry')}
                            </h2>
                            <!-- شريط التاريخ - على اليمين بجانب العنوان -->
                            <div class="date-range-bar" style="background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%); padding: 8px 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px; border: 1px solid #e0e7ff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 12px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                                        <i class="fas fa-calendar-alt" style="color: #6366f1;"></i>
                                        من تاريخ
                                    </label>
                                    <input type="date" id="observation-date-from" class="date-range-input" style="padding: 6px 10px; border: 1px solid #c7d2fe; border-radius: 6px; background: white; font-size: 12px; color: #1e293b; min-width: 120px; direction: ${isRTL ? 'rtl' : 'ltr'};">
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 12px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                                        <i class="fas fa-calendar-check" style="color: #10b981;"></i>
                                        إلى تاريخ
                                    </label>
                                    <input type="date" id="observation-date-to" class="date-range-input" style="padding: 6px 10px; border: 1px solid #c7d2fe; border-radius: 6px; background: white; font-size: 12px; color: #1e293b; min-width: 120px; direction: ${isRTL ? 'rtl' : 'ltr'};">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- الفلاتر في صف واحد احترافي -->
                <div class="observations-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 -20px 0 -20px; width: calc(100% + 40px); direction: ${isRTL ? 'rtl' : 'ltr'};">
                    <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; align-items: end;">
                        <!-- حقل البحث -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-search ${iconMarginClass}"></i>${t('filter.search')}
                            </label>
                            <input type="text" id="observation-search" class="filter-input" placeholder="${t('filter.searchPlaceholder')}" style="direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: ${isRTL ? 'right' : 'left'};">
                        </div>

                        <!-- فلتر الموقع -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-map-marker-alt ${iconMarginClass}"></i>${t('filter.site')}
                            </label>
                            <select id="observation-filter-site" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${sites.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر المكان -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-location-dot ${iconMarginClass}"></i>${t('filter.location')}
                            </label>
                            <select id="observation-filter-location" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${locations.map(l => `<option value="${Utils.escapeHTML(l)}">${Utils.escapeHTML(l)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر نوع الملاحظة -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-tag ${iconMarginClass}"></i>${t('filter.type')}
                            </label>
                            <select id="observation-filter-type" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${types.map(type => `<option value="${Utils.escapeHTML(type)}">${Utils.escapeHTML(type)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر الوردية -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-clock ${iconMarginClass}"></i>${t('filter.shift')}
                            </label>
                            <select id="observation-filter-shift" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${shifts.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر معدل الخطورة -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-exclamation-triangle ${iconMarginClass}"></i>${t('filter.risk')}
                            </label>
                            <select id="observation-filter-risk" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${riskLevels.map(r => `<option value="${Utils.escapeHTML(r)}">${Utils.escapeHTML(r)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر الحالة -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-info-circle ${iconMarginClass}"></i>${t('filter.status')}
                            </label>
                            <select id="observation-filter-status" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${statuses.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر صاحب الملاحظة -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-user ${iconMarginClass}"></i>${t('filter.observer')}
                            </label>
                            <select id="observation-filter-observer" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${observers.map(o => `<option value="${Utils.escapeHTML(o)}">${Utils.escapeHTML(o)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- فلتر المسؤول -->
                        <div class="filter-field">
                            <label class="filter-label" style="text-align: ${isRTL ? 'right' : 'left'};">
                                <i class="fas fa-user-tie ${iconMarginClass}"></i>${t('filter.responsible')}
                            </label>
                            <select id="observation-filter-responsible" class="filter-input" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                                <option value="">${t('filter.all')}</option>
                                ${responsibles.map(r => `<option value="${Utils.escapeHTML(r)}">${Utils.escapeHTML(r)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- زر إعادة التعيين وزر التحديث -->
                        <div class="filter-field">
                            <button id="observation-reset-filters" class="filter-reset-btn" type="button">
                                <i class="fas fa-redo ${iconMarginClass}"></i>${t('btn.reset')}
                            </button>
                        </div>
                        <div class="filter-field">
                            <button id="observation-refresh-btn" class="filter-reset-btn" type="button" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                                <i class="fas fa-sync-alt ${iconMarginClass}"></i>تحديث
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding-top: 20px;">
                    <div id="observations-table-container">
                        <div class="empty-state" style="direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: ${isRTL ? 'right' : 'left'};">
                            <p class="text-gray-500">${t('empty.noObservations')}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * حساب الإحصائيات وعرض الكروت
     */
    renderStatsCards(observations = null, activeFilter = null) {
        const container = document.getElementById('observations-stats-cards');
        if (!container) return;

        // إذا لم يتم تمرير الملاحظات، جلبها من AppState
        if (!observations) {
            const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
                ? this.getDailyObservationsVisibleToCurrentUser()
                : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);
            observations = observationsRaw.map(item => this.normalizeRecord(item));
        }

        const total = observations.length;
        const open = observations.filter(o => o.status === 'مفتوح' || o.status === 'جديد').length;
        const closed = observations.filter(o => o.status === 'مغلق').length;
        const highRisk = observations.filter(o => o.riskLevel === 'عالي' || o.riskLevel === 'عالية').length;
        const mediumRisk = observations.filter(o => o.riskLevel === 'متوسط' || o.riskLevel === 'متوسطة').length;
        const lowRisk = observations.filter(o => o.riskLevel === 'منخفض' || o.riskLevel === 'بسيطة' || o.riskLevel === 'بسيط').length;
        
        // حساب عدد الملاحظات حسب المصنع (siteName)
        const observationsByFactory = {};
        const uniqueFactories = new Set();
        observations.forEach(o => {
            const factory = o.siteName || '';
            if (factory) {
                uniqueFactories.add(factory);
                observationsByFactory[factory] = (observationsByFactory[factory] || 0) + 1;
            }
        });
        
        // العثور على المصنع الذي يحتوي على أكبر عدد من الملاحظات
        let maxObservationsCount = 0;
        let factoryWithMaxObservations = '';
        Object.keys(observationsByFactory).forEach(factory => {
            const count = observationsByFactory[factory];
            if (count > maxObservationsCount) {
                maxObservationsCount = count;
                factoryWithMaxObservations = factory;
            }
        });
        
        // عدد الملاحظات في المصنع (أكبر عدد ملاحظات في مصنع واحد)
        const observationsInFactory = maxObservationsCount;
        const mostCommonFactory = factoryWithMaxObservations || 'لا يوجد';
        
        // التحقق من المواقع الخطرة (مواقع تحتوي على عدد ملاحظات يتجاوز العتبة)
        const highRiskSites = Object.keys(observationsByFactory).filter(factory => 
            observationsByFactory[factory] >= this.OBSERVATIONS_THRESHOLD
        );
        
        // هل يوجد موقع به عدد كبير من الملاحظات؟
        const hasHighRiskSite = highRiskSites.length > 0;
        
        // حساب أنواع الملاحظات الفريدة
        const uniqueTypes = new Set();
        observations.forEach(o => {
            const type = o.observationType || '';
            if (type) {
                uniqueTypes.add(type);
            }
        });
        const typeCount = uniqueTypes.size;
        const mostCommonType = Array.from(uniqueTypes)[0] || 'لا يوجد';

        const cards = [
            {
                id: 'notes-status',
                title: 'عدد الملاحظات',
                value: total,
                subtitle: `مفتوح: ${open} | مغلق: ${closed}`,
                icon: 'fas fa-clipboard-list',
                color: 'blue',
                gradient: 'from-blue-500 to-blue-600',
                bgGradient: 'from-blue-50 to-blue-100',
                borderColor: 'border-blue-200',
                textColor: 'text-blue-700',
                iconBg: 'bg-blue-100',
                filter: null,
                description: 'إجمالي الملاحظات (مفتوح - مغلق)'
            },
            {
                id: 'risk-levels',
                title: 'معدل الخطورة',
                value: highRisk + mediumRisk + lowRisk,
                subtitle: `عالي: ${highRisk} | متوسط: ${mediumRisk} | بسيط: ${lowRisk}`,
                icon: 'fas fa-exclamation-triangle',
                color: 'red',
                gradient: 'from-red-500 to-red-600',
                bgGradient: 'from-red-50 to-red-100',
                borderColor: 'border-red-200',
                textColor: 'text-red-700',
                iconBg: 'bg-red-100',
                filter: null,
                description: 'توزيع معدلات الخطورة'
            },
            {
                id: 'locations',
                title: 'الموقع / المكان',
                value: observationsInFactory,
                subtitle: mostCommonFactory.length > 30 ? mostCommonFactory.substring(0, 30) + '...' : mostCommonFactory,
                icon: 'fas fa-map-marker-alt',
                color: hasHighRiskSite ? 'red' : 'green',
                gradient: hasHighRiskSite ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600',
                bgGradient: hasHighRiskSite ? 'from-red-50 to-red-100' : 'from-green-50 to-green-100',
                borderColor: hasHighRiskSite ? 'border-red-300' : 'border-green-200',
                textColor: hasHighRiskSite ? 'text-red-700' : 'text-green-700',
                iconBg: hasHighRiskSite ? 'bg-red-100' : 'bg-green-100',
                filter: null,
                description: hasHighRiskSite ? `عدد الملاحظات في المصنع - تنبيه: ${highRiskSites.length} موقع يحتوي على عدد كبير` : 'عدد الملاحظات في المصنع',
                isHighRisk: hasHighRiskSite,
                highRiskSites: highRiskSites
            },
            {
                id: 'note-types',
                title: 'نوع الملاحظة',
                value: typeCount,
                subtitle: mostCommonType.length > 30 ? mostCommonType.substring(0, 30) + '...' : mostCommonType,
                icon: 'fas fa-tags',
                color: 'purple',
                gradient: 'from-purple-500 to-purple-600',
                bgGradient: 'from-purple-50 to-purple-100',
                borderColor: 'border-purple-200',
                textColor: 'text-purple-700',
                iconBg: 'bg-purple-100',
                filter: null,
                description: 'عدد أنواع الملاحظات المختلفة'
            }
        ];

        container.innerHTML = cards.map(card => {
            const isActive = activeFilter && card.filter && JSON.stringify(activeFilter) === JSON.stringify(card.filter);
            const activeClass = isActive ? 'ring-4 ring-offset-2 ring-opacity-50' : '';
            const activeRing = isActive ? `ring-${card.color}-300` : '';
            const clickableClass = card.filter ? 'cursor-pointer' : '';
            const onClickAttr = card.filter ? `onclick="DailyObservations.filterByCard('${card.id}', ${JSON.stringify(card.filter || {})})"` : '';
            
            // إضافة تظليل أحمر للكارت في حالة وجود مواقع خطرة
            const highRiskStyle = card.isHighRisk ? 'box-shadow: 0 0 20px rgba(239, 68, 68, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.1); animation: pulse-red 2s ease-in-out infinite;' : '';
            
            return `
                <div class="stats-card content-card ${clickableClass} transform transition-all duration-300 hover:scale-105 hover:shadow-xl ${activeClass} ${activeRing} border-2 ${card.borderColor} bg-gradient-to-br ${card.bgGradient}" 
                     ${card.filter ? `data-filter='${JSON.stringify(card.filter || {})}'` : ''} 
                     ${onClickAttr}
                     style="position: relative; overflow: hidden; ${highRiskStyle}">
                    <!-- Pattern overlay -->
                    <div class="absolute top-0 right-0 w-32 h-32 opacity-10" style="background: radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px); background-size: 20px 20px;"></div>
                    ${card.isHighRisk ? `
                    <!-- Warning overlay for high-risk sites -->
                    <div class="absolute top-0 right-0 w-full h-full bg-red-500 opacity-5 pointer-events-none"></div>
                    ` : ''}
                    
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-4">
                            <div class="${card.iconBg} p-3 rounded-xl shadow-md">
                                <i class="${card.icon} text-${card.color}-600 text-2xl"></i>
                            </div>
                            ${isActive ? `
                                <div class="flex items-center gap-2 ${card.textColor}">
                                    <i class="fas fa-filter text-sm"></i>
                                    <span class="text-xs font-semibold">مفعل</span>
                                </div>
                            ` : ''}
                            ${card.isHighRisk ? `
                                <div class="flex items-center gap-2 text-red-600 animate-pulse">
                                    <i class="fas fa-exclamation-triangle text-sm"></i>
                                    <span class="text-xs font-bold">تنبيه</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="mb-2">
                            <h3 class="text-sm font-semibold ${card.textColor} mb-1">${card.title}</h3>
                            <p class="text-xs text-gray-600">${card.description}</p>
                        </div>
                        
                        <div class="flex items-end justify-between mt-4">
                            <div>
                                <div class="text-3xl font-bold ${card.textColor}">
                                    ${card.value.toLocaleString('en-US')}
                                </div>
                                ${card.subtitle ? `
                                    <div class="text-xs ${card.textColor} opacity-80 mt-2 font-medium">
                                        ${card.subtitle}
                                    </div>
                                ` : ''}
                            </div>
                            ${total > 0 && card.value !== total ? `
                                <div class="text-xs ${card.textColor} opacity-75">
                                    ${((card.value / total) * 100).toFixed(1)}%
                                </div>
                            ` : ''}
                        </div>
                        
                        ${card.value > 0 && card.filter ? `
                            <div class="mt-4 pt-3 border-t ${card.borderColor} border-opacity-30">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-600">انقر للفلترة</span>
                                    <i class="fas fa-arrow-left text-${card.color}-500"></i>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Progress bar at bottom -->
                    ${total > 0 && card.value > 0 ? `
                        <div class="absolute bottom-0 right-0 left-0 h-1 bg-gray-200">
                            <div class="h-full bg-gradient-to-r ${card.gradient}" style="width: ${(card.value / total) * 100}%"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // إضافة أنماط CSS إضافية إذا لزم الأمر
        this.injectStatsCardsStyles();
        this.injectTableScrollbarStyles();
        
        // إرسال تنبيه لمدير النظام في حالة وجود مواقع خطرة
        if (hasHighRiskSite) {
            this.notifyAdminAboutHighRiskSites(highRiskSites, observationsByFactory).catch(error => {
                Utils?.safeWarn?.('فشل إرسال التنبيه للمدير:', error) || console.warn('فشل إرسال التنبيه للمدير:', error);
            });
        }
    },

    /**
     * إرسال تنبيه لمدير النظام عند زيادة عدد الملاحظات في موقع معين
     * @param {Array} highRiskSites - قائمة المواقع الخطرة
     * @param {Object} observationsByFactory - عدد الملاحظات لكل مصنع
     */
    async notifyAdminAboutHighRiskSites(highRiskSites, observationsByFactory) {
        try {
            // تجنب إرسال نفس التنبيه عدة مرات (فحص localStorage)
            const lastNotificationKey = 'lastHighRiskSitesNotification';
            const lastNotification = localStorage.getItem(lastNotificationKey);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000; // ساعة واحدة

            if (lastNotification) {
                const lastTime = parseInt(lastNotification, 10);
                if (now - lastTime < oneHour) {
                    // تم إرسال تنبيه خلال الساعة الماضية، لا حاجة لإرسال آخر
                    return;
                }
            }

            // البحث عن مديري النظام
            const users = AppState?.appData?.users || [];
            const adminUsers = users.filter(u =>
                u && u.active !== false && (
                    u.role === 'admin' ||
                    u.role === 'مدير النظام' ||
                    (u.permissions && (u.permissions.isAdmin === true || u.permissions.admin === true))
                )
            );

            if (adminUsers.length === 0) {
                Utils?.safeLog?.('⚠️ لا يوجد مديري نظام لإرسال التنبيه لهم') || console.log('⚠️ لا يوجد مديري نظام');
                return;
            }

            // إنشاء رسالة التنبيه
            const sitesDetails = highRiskSites.map(site => {
                const count = observationsByFactory[site] || 0;
                return `  - ${site}: ${count} ملاحظة`;
            }).join('\n');

            const notificationTitle = 'تنبيه: زيادة عدد الملاحظات في مواقع معينة';
            const notificationMessage = `تم اكتشاف مواقع تحتوي على عدد كبير من الملاحظات (أكثر من ${this.OBSERVATIONS_THRESHOLD} ملاحظة):\n\n${sitesDetails}\n\nيرجى مراجعة هذه المواقع وإتخاذ الإجراءات اللازمة.`;

            // إرسال إشعار لكل مدير (بدون انتظار لتجنب مشاكل المهلة)
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest &&
                AppState?.googleConfig?.appsScript?.enabled) {

                // إرسال الإشعارات بشكل غير متزامن دون انتظار لتجنب مشاكل المهلة
                adminUsers.forEach((admin) => {
                    const adminId = admin.id || admin.email || admin.userId;
                    if (!adminId) return;

                    // إرسال بدون await لتجنب مشاكل المهلة - الإشعارات غير حرجة
                    GoogleIntegration.sendRequest({
                        action: 'addNotification',
                        data: {
                            userId: adminId,
                            title: notificationTitle,
                            message: notificationMessage,
                            type: 'observations_high_risk_site',
                            priority: 'high',
                            link: '#daily-observations-section',
                            data: {
                                module: 'daily-observations',
                                action: 'high_risk_sites',
                                highRiskSites: highRiskSites,
                                threshold: this.OBSERVATIONS_THRESHOLD
                            }
                        }
                    }).catch(() => {
                        // تجاهل الأخطاء - الإشعارات غير حرجة ويمكن إرسالها لاحقاً
                    });
                });

                // حفظ وقت آخر إشعار
                localStorage.setItem(lastNotificationKey, now.toString());

                Utils?.safeLog?.('✅ تم إرسال إشعارات للمديرين بخصوص المواقع الخطرة') ||
                console.log('✅ تم إرسال إشعارات للمديرين');
            } else {
                // Fallback: إظهار إشعار مباشر إذا كان المستخدم الحالي مدير
                const currentUser = AppState?.currentUser;
                if (currentUser && (
                    currentUser.role === 'admin' ||
                    currentUser.role === 'مدير النظام' ||
                    (currentUser.permissions && (currentUser.permissions.isAdmin === true || currentUser.permissions.admin === true))
                )) {
                    if (typeof Notification !== 'undefined') {
                        Notification.warning(notificationMessage, 10000);
                    }
                }
            }
        } catch (error) {
            // تجاهل الأخطاء - الإشعارات غير حرجة
            Utils?.safeLog?.('⚠️ خطأ في إرسال تنبيهات المواقع الخطرة (غير حرج):', error) ||
            console.log('⚠️ خطأ في إرسال تنبيهات المواقع الخطرة (غير حرج):', error);
            console.warn('خطأ في إرسال تنبيهات المواقع الخطرة:', error);
        }
    },

    /**
     * حقن أنماط CSS للكروت
     */
    injectStatsCardsStyles() {
        const styleId = 'daily-observations-stats-cards-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes pulse-red {
                0%, 100% {
                    box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                50% {
                    box-shadow: 0 0 30px rgba(239, 68, 68, 0.6), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
            }
            .stats-card {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
            }
            .stats-card:hover {
                transform: translateY(-4px) scale(1.02);
            }
            .stats-card:active {
                transform: translateY(-2px) scale(1.01);
            }
            .stats-card.ring-4 {
                animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            @keyframes pulse-ring {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
            /* أنماط الفلاتر الاحترافية */
            .observations-filters-row {
                position: relative;
            }
            .filters-grid {
                width: 100%;
            }
            .filter-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
                min-width: 140px;
            }
            .filter-label {
                font-size: 12px;
                font-weight: 600;
                color: #4a5568;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
            }
            .filter-label i {
                font-size: 11px;
                color: #667eea;
            }
            .filter-input {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: white;
                font-size: 14px;
                color: #2d3748;
                transition: all 0.2s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            .filter-input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .filter-input:hover {
                border-color: #cbd5e0;
            }
            input[type="date"].filter-input {
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                min-height: 42px;
                line-height: 1.4;
                padding-top: 9px;
                padding-bottom: 9px;
                color: #2d3748;
                color-scheme: light;
                background-color: white;
            }
            input[type="date"].filter-input::-webkit-calendar-picker-indicator {
                cursor: pointer;
                opacity: 0.75;
                filter: grayscale(1);
            }
            .filter-reset-btn {
                width: 100%;
                padding: 10px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .filter-reset-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
            }
            .filter-reset-btn:active {
                transform: translateY(0);
            }
            @media (max-width: 1200px) {
                .filters-grid {
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                }
            }
            @media (max-width: 768px) {
                .filters-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                .observations-filters-row {
                    padding: 12px 16px;
                    margin: 0 -16px 0 -16px;
                    width: calc(100% + 32px);
                }
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * حقن أنماط CSS لشريط التمرير في جدول الملاحظات
     */
    injectTableScrollbarStyles() {
        const styleId = 'daily-observations-table-scrollbar-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* شريط التمرير لجدول الملاحظات */
            .observations-table-wrapper {
                position: relative;
                overflow-x: auto;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
                max-height: 70vh;
                width: 100%;
            }

            /* تخصيص شريط التمرير الأفقي (الأسفل) */
            .observations-table-wrapper::-webkit-scrollbar:horizontal {
                height: 12px;
            }

            .observations-table-wrapper::-webkit-scrollbar-track:horizontal {
                background: var(--bg-secondary, #f3f4f6);
                border-radius: 6px;
                margin: 0 10px;
            }

            .observations-table-wrapper::-webkit-scrollbar-thumb:horizontal {
                background: var(--primary-color, #3b82f6);
                border-radius: 6px;
                border: 2px solid var(--bg-secondary, #f3f4f6);
            }

            .observations-table-wrapper::-webkit-scrollbar-thumb:horizontal:hover {
                background: var(--primary-color-dark, #2563eb);
            }

            /* تخصيص شريط التمرير العمودي (الجانبي) */
            .observations-table-wrapper::-webkit-scrollbar:vertical {
                width: 12px;
            }

            .observations-table-wrapper::-webkit-scrollbar-track:vertical {
                background: var(--bg-secondary, #f3f4f6);
                border-radius: 6px;
                margin: 10px 0;
            }

            .observations-table-wrapper::-webkit-scrollbar-thumb:vertical {
                background: var(--primary-color, #3b82f6);
                border-radius: 6px;
                border: 2px solid var(--bg-secondary, #f3f4f6);
            }

            .observations-table-wrapper::-webkit-scrollbar-thumb:vertical:hover {
                background: var(--primary-color-dark, #2563eb);
            }

            /* شريط التمرير العام (للتوافق مع المتصفحات) */
            .observations-table-wrapper::-webkit-scrollbar {
                width: 12px;
                height: 12px;
            }

            .observations-table-wrapper::-webkit-scrollbar-track {
                background: var(--bg-secondary, #f3f4f6);
                border-radius: 6px;
            }

            .observations-table-wrapper::-webkit-scrollbar-thumb {
                background: var(--primary-color, #3b82f6);
                border-radius: 6px;
                border: 2px solid var(--bg-secondary, #f3f4f6);
            }

            .observations-table-wrapper::-webkit-scrollbar-thumb:hover {
                background: var(--primary-color-dark, #2563eb);
            }

            /* للوضع الداكن */
            [data-theme="dark"] .observations-table-wrapper::-webkit-scrollbar-track {
                background: var(--bg-secondary, #1f2937);
            }

            [data-theme="dark"] .observations-table-wrapper::-webkit-scrollbar-thumb {
                background: var(--primary-color, #60a5fa);
                border-color: var(--bg-secondary, #1f2937);
            }

            [data-theme="dark"] .observations-table-wrapper::-webkit-scrollbar-thumb:hover {
                background: var(--primary-color-dark, #3b82f6);
            }

            /* تحسينات للجوال */
            @media (max-width: 768px) {
                .observations-table-wrapper {
                    max-height: 60vh;
                }

                .observations-table-wrapper::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }

                .observations-table-wrapper::-webkit-scrollbar-thumb {
                    border-width: 1px;
                }
            }

            /* إضافة ظلال عند التمرير */
            .observations-table-wrapper {
                position: relative;
            }

            .observations-table-wrapper::before,
            .observations-table-wrapper::after {
                content: '';
                position: sticky;
                pointer-events: none;
                z-index: 10;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .observations-table-wrapper::before {
                top: 0;
                left: 0;
                right: 0;
                height: 20px;
                background: linear-gradient(to bottom, rgba(0, 0, 0, 0.1), transparent);
            }

            .observations-table-wrapper::after {
                bottom: 0;
                left: 0;
                right: 0;
                height: 20px;
                background: linear-gradient(to top, rgba(0, 0, 0, 0.1), transparent);
            }

            .observations-table-wrapper.scrolled-top::before {
                opacity: 0;
            }

            .observations-table-wrapper:not(.scrolled-top)::before {
                opacity: 1;
            }

            .observations-table-wrapper.scrolled-bottom::after {
                opacity: 0;
            }

            .observations-table-wrapper:not(.scrolled-bottom)::after {
                opacity: 1;
            }
            
            /* ✅ شارة العدد على الفلاتر */
            .filter-count-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 20px;
                padding: 2px 8px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 700;
                margin-right: 4px;
                margin-left: 4px;
                box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * إعداد مستمعي التمرير للجدول
     */
    setupTableScrollListeners(wrapper) {
        if (!wrapper) return;

        const updateScrollState = () => {
            const scrollTop = wrapper.scrollTop;
            const scrollLeft = wrapper.scrollLeft;
            const scrollHeight = wrapper.scrollHeight;
            const scrollWidth = wrapper.scrollWidth;
            const clientHeight = wrapper.clientHeight;
            const clientWidth = wrapper.clientWidth;

            // إدارة حالة التمرير العمودي
            if (scrollTop === 0) {
                wrapper.classList.add('scrolled-top');
            } else {
                wrapper.classList.remove('scrolled-top');
            }

            if (scrollTop + clientHeight >= scrollHeight - 1) {
                wrapper.classList.add('scrolled-bottom');
            } else {
                wrapper.classList.remove('scrolled-bottom');
            }

            // إدارة حالة التمرير الأفقي
            if (scrollLeft === 0) {
                wrapper.classList.add('scrolled-left');
            } else {
                wrapper.classList.remove('scrolled-left');
            }

            if (scrollLeft + clientWidth >= scrollWidth - 1) {
                wrapper.classList.add('scrolled-right');
            } else {
                wrapper.classList.remove('scrolled-right');
            }
        };

        // تحديث الحالة عند التمرير
        wrapper.addEventListener('scroll', updateScrollState);
        
        // تحديث الحالة عند تغيير الحجم
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                updateScrollState();
            });
            resizeObserver.observe(wrapper);
        }

        // تحديث الحالة الأولية
        updateScrollState();
    },

    /**
     * فلترة الملاحظات حسب الكرت المحدد
     */
    filterByCard(cardId, filter) {
        if (!filter || Object.keys(filter).length === 0) {
            // إزالة الفلترة
            this.currentFilter = null;
            this.loadObservationsList();
            const clearFiltersBtn = document.getElementById('clear-filters-btn');
            const filterIndicator = document.getElementById('filter-indicator');
            if (clearFiltersBtn) {
                clearFiltersBtn.style.display = 'none';
            }
            if (filterIndicator) {
                filterIndicator.style.display = 'none';
            }
            return;
        }

        this.currentFilter = { cardId, filter };
        this.loadObservationsList(filter);
        
        // تحديث الكروت لإظهار الكرت النشط
        this.renderStatsCards(null, filter);
        
        // إظهار زر إزالة الفلاتر
        const clearBtn = document.getElementById('clear-filters-btn');
        const indicator = document.getElementById('filter-indicator');
        if (clearBtn) {
            clearBtn.style.display = 'inline-flex';
            clearBtn.onclick = () => {
                this.currentFilter = null;
                this.loadObservationsList();
                this.renderStatsCards();
                clearBtn.style.display = 'none';
                if (indicator) indicator.style.display = 'none';
            };
        }
        
        if (indicator) {
            indicator.style.display = 'block';
            const cardTitle = document.querySelector(`[data-filter='${JSON.stringify(filter)}']`)?.querySelector('h3')?.textContent || 'الفلتر';
            indicator.textContent = `الفلتر النشط: ${cardTitle}`;
        }
    },

    isCurrentUserAdmin() {
        if (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function') {
            return Permissions.isCurrentUserAdmin();
        }
        const userRole = (AppState.currentUser?.role || '').toLowerCase();
        return userRole === 'admin' || userRole === 'مدير النظام';
    },

    /**
     * التحقق من توفر DataManager وحفظ البيانات
     */
    ensureDataManagerAndSave() {
        try {
            if (typeof window !== 'undefined' && window.DataManager && typeof window.DataManager.save === 'function') {
                window.DataManager.save();
                return true;
            } else if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') {
                DataManager.save();
                return true;
            } else {
                Utils.safeWarn('⚠️ DailyObservations: DataManager غير متاح - لم يتم حفظ البيانات');
                return false;
            }
        } catch (error) {
            Utils.safeError('DailyObservations: خطأ في حفظ البيانات:', error);
            return false;
        }
    },

    setupTabs() {
        setTimeout(() => {
            const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabName = btn.getAttribute('data-tab');
                    
                    // إزالة active من جميع الأزرار والمحتوى
                    tabButtons.forEach(b => {
                        b.classList.remove('active');
                        b.style.borderBottomColor = 'transparent';
                        b.style.color = 'var(--text-secondary)';
                    });
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                        content.style.display = 'none';
                    });
                    
                    // إضافة active للتبويب المحدد
                    btn.classList.add('active');
                    btn.style.borderBottomColor = 'var(--primary-color)';
                    btn.style.color = 'var(--primary-color)';
                    
                    const tabContent = document.getElementById(`tab-${tabName}`);
                    if (tabContent) {
                        tabContent.classList.add('active');
                        tabContent.style.display = 'block';
                        
                        // تحميل بيانات التحليل عند فتح التبويب
                        if (tabName === 'data-analysis') {
                            // التحقق من الصلاحيات التفصيلية
                            const hasAccess = typeof Permissions !== 'undefined' 
                                ? Permissions.hasDetailedPermission('daily-observations', 'data-analysis')
                                : this.isCurrentUserAdmin();
                                
                            if (!hasAccess) {
                                Notification.error('ليس لديك صلاحية للوصول إلى تبويب التحليل');
                                // إعادة فتح تبويب السجل
                                const registryTab = document.querySelector('.tab-btn[data-tab="observations-registry"]');
                                if (registryTab) {
                                    registryTab.click();
                                }
                                return;
                            }
                            this.loadDataAnalysis();
                        }
                        
                        // تحميل بيانات أفضل 10 ملاحظات عند فتح التبويب
                        if (tabName === 'top-10-observations') {
                            this.loadTop10Observations();
                        }
                    }
                });
            });
        }, 100);
    },

    async renderDataAnalysis() {
        // محاولة تحميل Chart.js (بدون انتظار - سيتم التحقق لاحقاً)
        this.ensureChartJSLoaded().catch(() => {
            // فشل التحميل - سيتم عرض البيانات بدون رسوم بيانية
            Utils.safeWarn('Chart.js غير متاح - سيتم عرض البيانات بدون رسوم بيانية');
        });
        
        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-chart-line ml-2"></i>
                        تحليل البيانات
                    </h2>
                    <p class="text-sm text-gray-500 mt-2">نظام تحليل البيانات القابل للتعديل والإضافة لأي بنود من سجل الملاحظات (مدير النظام فقط)</p>
                </div>
                <div class="card-body">
                    <div id="data-analysis-container">
                        <!-- قسم الكروت التوضيحية -->
                        <div class="mb-6">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold">
                                    <i class="fas fa-info-circle ml-2 text-blue-600"></i>
                                    الكروت التوضيحية
                                </h3>
                                <button id="manage-cards-btn" class="btn-secondary">
                                    <i class="fas fa-edit ml-2"></i>
                                    إدارة الكروت
                                </button>
                            </div>
                            <div id="info-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <!-- سيتم ملؤها ديناميكياً من localStorage -->
                            </div>
                        </div>

                        <!-- إعدادات التحليل -->
                        <div class="mb-6 border-t pt-6">
                            <h3 class="text-lg font-semibold mb-4">
                                <i class="fas fa-cog ml-2"></i>
                                إعدادات التحليل
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-2">اختر البنود للتحليل</label>
                                    <div id="analysis-items-list" class="space-y-2 max-h-64 overflow-y-auto border rounded p-3">
                                        <!-- سيتم ملؤها ديناميكياً -->
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-2">إضافة بند جديد</label>
                                    <div class="flex gap-2">
                                        <input type="text" id="new-analysis-item" class="form-input flex-1" placeholder="اسم البند">
                                        <button id="add-analysis-item-btn" class="btn-primary">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                    <p class="text-xs text-gray-500 mt-2">
                                        <i class="fas fa-info-circle ml-1"></i>
                                        يمكنك إضافة أي بند من سجل الملاحظات للتحليل (مثل: نوع الملاحظة، مستوى الخطورة، الحالة، إلخ)
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- نتائج التحليل مع الرسوم البيانية -->
                        <div id="analysis-results" class="mt-6 border-t pt-6">
                            <h3 class="text-lg font-semibold mb-4">
                                <i class="fas fa-chart-bar ml-2"></i>
                                نتائج التحليل والرسوم البيانية
                            </h3>
                            <div class="empty-state">
                                <p class="text-gray-500">لا توجد نتائج تحليل. قم بإضافة بنود للتحليل.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * التأكد من تحميل Chart.js
     */
    async ensureChartJSLoaded() {
        // التحقق من أن Chart.js موجود بالفعل
        if (typeof Chart !== 'undefined') {
            return true;
        }

        // التحقق من وجود script Chart.js في الصفحة
        const existingScript = document.querySelector('script[src*="chart.js"], script[src*="chartjs"]');
        if (existingScript) {
            // انتظار تحميل السكربت الموجود
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (typeof Chart !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 100);
                
                // timeout بعد 5 ثوانٍ
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(false);
                }, 5000);
            });
        }

        // محاولة تحميل Chart.js من CDN مع fallback options
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            
            // محاولة من jsdelivr أولاً
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            script.crossOrigin = 'anonymous';
            
            let loaded = false;
            
            const onLoad = () => {
                if (!loaded && typeof Chart !== 'undefined') {
                    loaded = true;
                    resolve(true);
                }
            };
            
            const onError = () => {
                if (loaded) return;
                
                // محاولة fallback من cdnjs
                const fallbackScript = document.createElement('script');
                fallbackScript.type = 'text/javascript';
                fallbackScript.async = true;
                fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
                fallbackScript.crossOrigin = 'anonymous';
                
                let fallbackLoaded = false;
                
                fallbackScript.onload = () => {
                    if (!fallbackLoaded && typeof Chart !== 'undefined') {
                        fallbackLoaded = true;
                        loaded = true;
                        resolve(true);
                    }
                };
                
                fallbackScript.onerror = () => {
                    if (!loaded) {
                        loaded = true;
                        console.warn('فشل تحميل Chart.js من جميع المصادر - سيتم عرض البيانات بدون رسوم بيانية');
                        resolve(false);
                    }
                };
                
                document.head.appendChild(fallbackScript);
            };
            
            script.onload = () => {
                // إعطاء وقت إضافي للتهيئة
                setTimeout(() => {
                    if (!loaded && typeof Chart !== 'undefined') {
                        loaded = true;
                        resolve(true);
                    } else if (!loaded) {
                        onError();
                    }
                }, 500);
            };
            
            script.onerror = onError;
            
            // timeout عام
            setTimeout(() => {
                if (!loaded) {
                    loaded = true;
                    if (typeof Chart !== 'undefined') {
                        resolve(true);
                    } else {
                        // لا نعرض تحذير في console - سيتم التعامل معه بصمت
                        resolve(false);
                    }
                }
            }, 8000);
            
            try {
                // التحقق من وجود document.head قبل الإضافة
                if (document && document.head) {
                    document.head.appendChild(script);
                } else {
                    resolve(false);
                }
            } catch (error) {
                Utils.safeError('خطأ في إضافة script Chart.js:', error);
                resolve(false);
            }
        });
    },

    /**
     * تحميل الكروت التوضيحية
     */
    loadInfoCards() {
        const container = document.getElementById('info-cards-container');
        if (!container) return;

        const cards = JSON.parse(localStorage.getItem('dailyObservations_infoCards') || '[]');
        
        if (cards.length === 0) {
            // إنشاء كروت افتراضية
            const defaultCards = [
                {
                    id: 'card_1',
                    title: 'إجمالي الملاحظات',
                    icon: 'fas fa-clipboard-list',
                    color: 'blue',
                    description: 'عدد الملاحظات المسجلة في النظام',
                    enabled: true
                },
                {
                    id: 'card_2',
                    title: 'ملاحظات مفتوحة',
                    icon: 'fas fa-folder-open',
                    color: 'orange',
                    description: 'الملاحظات التي لم يتم إغلاقها بعد',
                    enabled: true
                },
                {
                    id: 'card_3',
                    title: 'ملاحظات عالية الخطورة',
                    icon: 'fas fa-exclamation-triangle',
                    color: 'red',
                    description: 'الملاحظات ذات مستوى خطورة عالي',
                    enabled: true
                }
            ];
            localStorage.setItem('dailyObservations_infoCards', JSON.stringify(defaultCards));
            return this.loadInfoCards(); // إعادة التحميل
        }

        const enabledCards = cards.filter(card => card.enabled);
        if (enabledCards.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">لا توجد كروت مفعلة. استخدم زر "إدارة الكروت" لإضافة كروت جديدة.</p>';
            return;
        }

        container.innerHTML = enabledCards.map(card => {
            const colorClasses = {
                blue: 'bg-blue-50 border-blue-200 text-blue-800',
                green: 'bg-green-50 border-green-200 text-green-800',
                red: 'bg-red-50 border-red-200 text-red-800',
                orange: 'bg-orange-50 border-orange-200 text-orange-800',
                purple: 'bg-purple-50 border-purple-200 text-purple-800',
                yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800'
            };
            
            const colorClass = colorClasses[card.color] || colorClasses.blue;
            const iconColor = card.color || 'blue';

            return `
                <div class="content-card border-2 ${colorClass}">
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <i class="${card.icon || 'fas fa-info-circle'} text-${iconColor}-600 text-xl"></i>
                            <h4 class="font-semibold">${Utils.escapeHTML(card.title)}</h4>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">${Utils.escapeHTML(card.description || '')}</p>
                    <div class="mt-3 pt-3 border-t border-gray-200">
                        <div id="card-value-${card.id}" class="text-2xl font-bold text-${iconColor}-700">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // حساب قيم الكروت
        this.calculateCardValues();
    },

    /**
     * حساب قيم الكروت التوضيحية
     */
    calculateCardValues() {
        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);
        const observations = observationsRaw.map(item => this.normalizeRecord(item));

        const cards = JSON.parse(localStorage.getItem('dailyObservations_infoCards') || '[]');
        const enabledCards = cards.filter(card => card.enabled);

        enabledCards.forEach(card => {
            const valueEl = document.getElementById(`card-value-${card.id}`);
            if (!valueEl) return;

            let value = 0;
            switch(card.id) {
                case 'card_1':
                    value = observations.length;
                    break;
                case 'card_2':
                    value = observations.filter(obs => obs.status === 'مفتوح' || obs.status === 'جاري').length;
                    break;
                case 'card_3':
                    value = observations.filter(obs => obs.riskLevel === 'عالي').length;
                    break;
                default:
                    // للحقول المخصصة، البحث عن القيمة في البيانات
                    if (card.field) {
                        value = observations.filter(obs => {
                            const fieldValue = obs[card.field];
                            if (card.fieldValue) {
                                return fieldValue === card.fieldValue;
                            }
                            return fieldValue && fieldValue !== '' && fieldValue !== 'غير محدد';
                        }).length;
                    }
            }

            valueEl.textContent = value.toLocaleString('en-US');
        });
    },

    /**
     * عرض نموذج إدارة الكروت
     */
    showManageCardsModal() {
        if (!this.isCurrentUserAdmin()) {
            Notification.error('ليس لديك صلاحية للوصول إلى هذه الميزة');
            return;
        }

        const cards = JSON.parse(localStorage.getItem('dailyObservations_infoCards') || '[]');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-edit ml-2"></i>
                        إدارة الكروت التوضيحية
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <button id="add-new-card-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة كرت جديد
                        </button>
                    </div>
                    <div id="cards-list-container" class="space-y-3">
                        ${cards.map((card, index) => this.renderCardEditForm(card, index)).join('')}
                    </div>
                    ${cards.length === 0 ? '<p class="text-gray-500 text-center py-4">لا توجد كروت. اضغط على زر "إضافة كرت جديد" لإنشاء كرت.</p>' : ''}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إغلاق</button>
                    <button type="button" id="save-cards-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        حفظ التغييرات
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });

        // إضافة كرت جديد
        modal.querySelector('#add-new-card-btn')?.addEventListener('click', () => {
            const newCard = {
                id: `card_${Date.now()}`,
                title: 'كرت جديد',
                icon: 'fas fa-info-circle',
                color: 'blue',
                description: '',
                enabled: true,
                field: '',
                fieldValue: ''
            };
            cards.push(newCard);
            const container = modal.querySelector('#cards-list-container');
            container.innerHTML = cards.map((card, index) => this.renderCardEditForm(card, index)).join('');
            this.bindCardEditEvents(modal);
        });

        // حفظ التغييرات
        modal.querySelector('#save-cards-btn')?.addEventListener('click', () => {
            const updatedCards = [];
            modal.querySelectorAll('.card-edit-form').forEach((formEl, index) => {
                const card = {
                    id: formEl.getAttribute('data-card-id'),
                    title: formEl.querySelector('.card-title-input')?.value || '',
                    icon: formEl.querySelector('.card-icon-input')?.value || 'fas fa-info-circle',
                    color: formEl.querySelector('.card-color-input')?.value || 'blue',
                    description: formEl.querySelector('.card-description-input')?.value || '',
                    enabled: formEl.querySelector('.card-enabled-input')?.checked || false,
                    field: formEl.querySelector('.card-field-input')?.value || '',
                    fieldValue: formEl.querySelector('.card-field-value-input')?.value || ''
                };
                updatedCards.push(card);
            });

            localStorage.setItem('dailyObservations_infoCards', JSON.stringify(updatedCards));
            Notification.success('تم حفظ الكروت بنجاح');
            close();
            this.loadInfoCards();
            this.updateAnalysisResults(); // تحديث النتائج
        });

        this.bindCardEditEvents(modal);
    },

    /**
     * عرض نموذج تعديل كرت
     */
    renderCardEditForm(card, index) {
        const colors = ['blue', 'green', 'red', 'orange', 'purple', 'yellow'];
        const commonIcons = [
            'fas fa-info-circle', 'fas fa-chart-line', 'fas fa-chart-bar', 'fas fa-chart-pie',
            'fas fa-exclamation-triangle', 'fas fa-check-circle', 'fas fa-times-circle',
            'fas fa-clipboard-list', 'fas fa-folder-open', 'fas fa-flag', 'fas fa-bell'
        ];

        return `
            <div class="card-edit-form border rounded-lg p-4 bg-gray-50" data-card-id="${card.id}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold mb-2">العنوان *</label>
                        <input type="text" class="form-input card-title-input" value="${Utils.escapeHTML(card.title || '')}" placeholder="عنوان الكرت">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">الأيقونة</label>
                        <input type="text" class="form-input card-icon-input" value="${Utils.escapeHTML(card.icon || 'fas fa-info-circle')}" placeholder="fas fa-icon">
                        <p class="text-xs text-gray-500 mt-1">استخدم أيقونة Font Awesome</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">اللون</label>
                        <select class="form-input card-color-input">
                            ${colors.map(c => `<option value="${c}" ${card.color === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-2">الحقل للتحليل (اختياري)</label>
                        <input type="text" class="form-input card-field-input" value="${Utils.escapeHTML(card.field || '')}" placeholder="اسم الحقل (مثل: status, riskLevel)">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-semibold mb-2">الوصف</label>
                        <textarea class="form-input card-description-input" rows="2" placeholder="وصف الكرت">${Utils.escapeHTML(card.description || '')}</textarea>
                    </div>
                    <div>
                        <label class="flex items-center">
                            <input type="checkbox" class="card-enabled-input mr-2" ${card.enabled ? 'checked' : ''}>
                            <span class="text-sm">تفعيل الكرت</span>
                        </label>
                    </div>
                    <div class="flex justify-end">
                        <button class="btn-icon btn-icon-danger remove-card-btn" data-card-id="${card.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * ربط أحداث تعديل الكروت
     */
    bindCardEditEvents(modal) {
        modal.querySelectorAll('.remove-card-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cardId = btn.getAttribute('data-card-id');
                if (confirm('هل أنت متأكد من حذف هذا الكرت؟')) {
                    const formEl = modal.querySelector(`.card-edit-form[data-card-id="${cardId}"]`);
                    formEl?.remove();
                }
            });
        });
    },

    async loadDataAnalysis() {
        // التحقق من صلاحيات المدير
        if (!this.isCurrentUserAdmin()) {
            const container = document.getElementById('data-analysis-container');
            if (container) {
                container.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-lock text-red-500 text-4xl mb-4"></i>
                                <p class="text-gray-500">ليس لديك صلاحية للوصول إلى تحليل البيانات</p>
                                <p class="text-sm text-gray-400 mt-2">هذه الميزة متاحة لمدير النظام فقط</p>
                            </div>
                        </div>
                    </div>
                `;
            }
            return;
        }

        const container = document.getElementById('data-analysis-container');
        if (!container) return;

        // تحميل الكروت التوضيحية
        this.loadInfoCards();

        // تحميل بنود التحليل المحفوظة
        const analysisItems = JSON.parse(localStorage.getItem('dailyObservations_analysisItems') || '[]');
        
        // إذا لم تكن هناك بنود محفوظة، إنشاء بنود افتراضية
        if (analysisItems.length === 0) {
            const defaultItems = [
                { id: 'observationType', label: 'نوع الملاحظة', enabled: true },
                { id: 'riskLevel', label: 'معدل الخطورة', enabled: true },
                { id: 'status', label: 'الحالة', enabled: true },
                { id: 'shift', label: 'الوردية', enabled: false },
                { id: 'site', label: 'الموقع', enabled: false }
            ];
            localStorage.setItem('dailyObservations_analysisItems', JSON.stringify(defaultItems));
            return this.loadDataAnalysis(); // إعادة التحميل
        }

        // عرض قائمة البنود
        const itemsList = document.getElementById('analysis-items-list');
        if (itemsList) {
            itemsList.innerHTML = analysisItems.map(item => `
                <div class="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                    <label class="flex items-center cursor-pointer flex-1">
                        <input type="checkbox" class="analysis-item-checkbox mr-2" data-item-id="${item.id}" ${item.enabled ? 'checked' : ''}>
                        <span>${Utils.escapeHTML(item.label)}</span>
                    </label>
                    <button class="btn-icon btn-icon-danger ml-2" onclick="DailyObservations.removeAnalysisItem('${item.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');

            // إضافة مستمعين للأزرار
            itemsList.querySelectorAll('.analysis-item-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const itemId = e.target.getAttribute('data-item-id');
                    this.toggleAnalysisItem(itemId, e.target.checked);
                });
            });
        }

        // ربط زر إدارة الكروت
        const manageCardsBtn = document.getElementById('manage-cards-btn');
        if (manageCardsBtn) {
            manageCardsBtn.addEventListener('click', () => this.showManageCardsModal());
        }

        // تحديث نتائج التحليل
        this.updateAnalysisResults();
    },

    async updateAnalysisResults() {
        const resultsContainer = document.getElementById('analysis-results');
        if (!resultsContainer) return;

        const analysisItems = JSON.parse(localStorage.getItem('dailyObservations_analysisItems') || '[]');
        const enabledItems = analysisItems.filter(item => item.enabled);

        if (enabledItems.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <p class="text-gray-500">لا توجد بنود مفعلة للتحليل.</p>
                </div>
            `;
            return;
        }

        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);
        const observations = observationsRaw.map(item => this.normalizeRecord(item));

        // تحديث قيم الكروت التوضيحية
        this.calculateCardValues();

        // إنشاء HTML مع الرسوم البيانية
        let resultsHTML = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';

        enabledItems.forEach((item, index) => {
            const analysis = this.analyzeByItem(item.id, observations);
            const chartId = `chart-${item.id}-${index}`;
            const chartContainerId = `chart-container-${item.id}-${index}`;
            
            resultsHTML += `
                <div class="content-card">
                    <div class="card-header">
                        <h4 class="font-semibold text-lg">
                            <i class="fas fa-chart-pie ml-2"></i>
                            ${Utils.escapeHTML(item.label)}
                        </h4>
                    </div>
                    <div class="card-body">
                        <!-- الرسم البياني -->
                        <div id="${chartContainerId}" style="position: relative; height: 300px; margin-bottom: 20px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                        <!-- الجدول التفصيلي -->
                        <div class="border-t pt-4">
                            <h5 class="font-semibold mb-3 text-sm text-gray-700">التفاصيل:</h5>
                            <div class="space-y-2">
                                ${analysis.map(stat => `
                                    <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <span class="text-sm">${Utils.escapeHTML(stat.label)}</span>
                                        <div class="flex items-center gap-3">
                                            <span class="font-semibold">${stat.count}</span>
                                            <span class="text-xs text-gray-500">(${stat.percentage}%)</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        resultsHTML += '</div>';
        resultsContainer.innerHTML = resultsHTML;

        // رسم الرسوم البيانية بعد إضافة HTML (مع إعادة محاولة لتحميل Chart.js)
        setTimeout(async () => {
            // التأكد من تحميل Chart.js قبل رسم الرسوم
            const chartLoaded = await this.ensureChartJSLoaded();
            if (chartLoaded && typeof Chart !== 'undefined') {
                this.renderAnalysisCharts(enabledItems, observations);
            } else {
                // عرض رسالة للمستخدم
                const firstChartContainer = resultsContainer.querySelector('[id^="chart-container-"]');
                if (firstChartContainer) {
                    const fallbackMsg = document.createElement('div');
                    fallbackMsg.className = 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4';
                    fallbackMsg.innerHTML = `
                        <div class="flex items-center gap-2">
                            <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                            <p class="text-sm text-yellow-800">
                                <strong>ملاحظة:</strong> لا يمكن تحميل مكتبة الرسوم البيانية حالياً. 
                                البيانات متاحة في الجداول أدناه. يرجى تحديث الصفحة أو التحقق من الاتصال بالإنترنت.
                            </p>
                        </div>
                    `;
                    resultsContainer.insertBefore(fallbackMsg, resultsContainer.firstChild);
                }
            }
        }, 300);
    },

    /**
     * رسم الرسوم البيانية للتحليل
     */
    renderAnalysisCharts(enabledItems, observations) {
        if (typeof Chart === 'undefined') {
            // لا نعرض تحذير في console لأن هذا قد يكون متوقعاً
            // سيتم عرض البيانات في الجداول بدلاً من الرسوم البيانية
            return;
        }

        // تدمير الرسوم البيانية السابقة إن وجدت
        if (this.analysisCharts) {
            Object.values(this.analysisCharts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
        }
        this.analysisCharts = {};

        enabledItems.forEach((item, index) => {
            const chartId = `chart-${item.id}-${index}`;
            const canvas = document.getElementById(chartId);
            if (!canvas) return;

            const analysis = this.analyzeByItem(item.id, observations);
            
            if (analysis.length === 0) {
                const container = document.getElementById(`chart-container-${item.id}-${index}`);
                if (container) {
                    container.innerHTML = '<p class="text-gray-500 text-center py-8">لا توجد بيانات للعرض</p>';
                }
                return;
            }

            // تحديد نوع الرسم البياني حسب عدد العناصر
            const chartType = analysis.length > 6 ? 'bar' : 'doughnut';
            
            // الألوان
            const colorPalette = [
                'rgba(59, 130, 246, 0.8)',  // blue
                'rgba(16, 185, 129, 0.8)',  // green
                'rgba(245, 158, 11, 0.8)',  // amber
                'rgba(239, 68, 68, 0.8)',   // red
                'rgba(139, 92, 246, 0.8)',  // purple
                'rgba(236, 72, 153, 0.8)',  // pink
                'rgba(20, 184, 166, 0.8)',  // teal
                'rgba(251, 146, 60, 0.8)'   // orange
            ];

            const labels = analysis.map(stat => stat.label);
            const data = analysis.map(stat => stat.count);
            const backgroundColors = analysis.map((_, i) => colorPalette[i % colorPalette.length]);

            try {
                const chart = new Chart(canvas, {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            label: item.label,
                            data: data,
                            backgroundColor: backgroundColors,
                            borderColor: backgroundColors.map(c => c.replace('0.8', '1')),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 15,
                                    font: {
                                        size: 12
                                    },
                                    usePointStyle: true
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        ...(chartType === 'bar' ? {
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                }
                            }
                        } : {})
                    }
                });

                this.analysisCharts[chartId] = chart;
            } catch (error) {
                Utils.safeError('خطأ في رسم الرسم البياني:', error);
            }
        });
    },

    /**
     * عرض أفضل 10 ملاحظات
     */
    async renderTop10Observations() {
        // محاولة تحميل Chart.js
        this.ensureChartJSLoaded().catch(() => {
            Utils.safeWarn('Chart.js غير متاح - سيتم عرض البيانات بدون رسوم بيانية');
        });

        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="card-title">
                                <i class="fas fa-trophy ml-2 text-yellow-500"></i>
                                أفضل 10 ملاحظات
                            </h2>
                            <p class="text-sm text-gray-500 mt-2">عرض وتحليل أفضل 10 ملاحظات مع رسوم بيانية قابلة للتعديل والإضافة</p>
                        </div>
                        <button id="add-top10-chart-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة رسم بياني
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- قائمة أفضل 10 ملاحظات -->
                    <div id="top10-observations-list" class="mb-6">
                        <div class="flex items-center justify-center py-8">
                            <div class="text-center">
                                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                                <p class="text-gray-500">جاري تحميل البيانات...</p>
                            </div>
                        </div>
                    </div>

                    <!-- الرسوم البيانية -->
                    <div class="border-t pt-6 mt-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-lg font-semibold">
                                <i class="fas fa-chart-bar ml-2 text-blue-600"></i>
                                الرسوم البيانية
                            </h3>
                            <button id="manage-top10-charts-btn" class="btn-secondary">
                                <i class="fas fa-cog ml-2"></i>
                                إدارة الرسوم البيانية
                            </button>
                        </div>
                        <div id="top10-charts-container" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- سيتم ملؤها ديناميكياً -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * تحميل وعرض أفضل 10 ملاحظات
     */
    async loadTop10Observations() {
        const container = document.getElementById('top10-observations-list');
        if (!container) return;

        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);

        if (observationsRaw.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox text-gray-300 text-6xl mb-4"></i>
                    <p class="text-gray-500 text-lg mb-2">لا توجد ملاحظات مسجلة</p>
                    <p class="text-sm text-gray-400">ابدأ بإضافة ملاحظات جديدة لعرض أفضل 10 ملاحظات</p>
                </div>
            `;
            return;
        }

        // تحويل وتصنيف الملاحظات
        const observations = observationsRaw.map(item => this.normalizeRecord(item));

        // حساب نقاط لكل ملاحظة بناءً على معايير متعددة
        const scoredObservations = observations.map(obs => {
            let score = 0;
            
            // نقاط حسب الخطورة
            if (obs.riskLevel === 'عالي' || obs.riskLevel === 'عالية') score += 30;
            else if (obs.riskLevel === 'متوسط' || obs.riskLevel === 'متوسطة') score += 15;
            else if (obs.riskLevel === 'منخفض' || obs.riskLevel === 'بسيطة' || obs.riskLevel === 'بسيط') score += 5;

            // نقاط حسب الحالة
            if (obs.status === 'مفتوح' || obs.status === 'جديد') score += 20;
            else if (obs.status === 'جاري') score += 10;
            else if (obs.status === 'مغلق') score += 5;

            // نقاط حسب الأيام المتأخرة
            if (obs.overdays && obs.overdays > 0) {
                score += Math.min(obs.overdays * 2, 30); // حد أقصى 30 نقطة
            }

            // نقاط حسب وجود مرفقات
            if (obs.attachments && obs.attachments.length > 0) {
                score += obs.attachments.length * 2;
            }

            // نقاط حسب التاريخ (الأحدث يحصل على نقاط أكثر)
            if (obs.date) {
                const obsDate = new Date(obs.date);
                const now = new Date();
                const daysDiff = Math.floor((now - obsDate) / (1000 * 60 * 60 * 24));
                if (daysDiff <= 7) score += 10; // ملاحظات الأسبوع الماضي
                else if (daysDiff <= 30) score += 5; // ملاحظات الشهر الماضي
            }

            return { ...obs, score };
        });

        // ترتيب حسب النقاط (من الأعلى للأقل)
        scoredObservations.sort((a, b) => b.score - a.score);

        // أخذ أفضل 10
        const top10 = scoredObservations.slice(0, 10);

        // عرض القائمة
        container.innerHTML = `
            <div class="mb-4">
                <h3 class="text-lg font-semibold mb-4">
                    <i class="fas fa-list-ol ml-2"></i>
                    قائمة أفضل 10 ملاحظات
                </h3>
            </div>
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الترتيب</th>
                            <th>رقم الملاحظة</th>
                            <th>الموقع / المكان</th>
                            <th>نوع الملاحظة</th>
                            <th>معدل الخطورة</th>
                            <th>الحالة</th>
                            <th>النقاط</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${top10.map((obs, index) => `
                            <tr class="hover:bg-gray-50 transition-colors">
                                <td>
                                    <div class="flex items-center justify-center">
                                        ${index === 0 ? '<span class="text-2xl">🥇</span>' : ''}
                                        ${index === 1 ? '<span class="text-2xl">🥈</span>' : ''}
                                        ${index === 2 ? '<span class="text-2xl">🥉</span>' : ''}
                                        ${index > 2 ? `<span class="font-bold text-lg text-gray-600">${index + 1}</span>` : ''}
                                    </div>
                                </td>
                                <td>
                                    <span class="font-medium text-blue-600 cursor-pointer hover:underline" onclick="DailyObservations.viewObservation('${obs.id}')">
                                        ${Utils.escapeHTML(obs.isoCode || 'غير محدد')}
                                    </span>
                                </td>
                                <td>
                                    <div class="text-sm font-medium text-gray-800">${Utils.escapeHTML(obs.siteName || '-')}</div>
                                    <div class="text-xs text-gray-500">${Utils.escapeHTML(obs.locationName || '')}</div>
                                </td>
                                <td>${Utils.escapeHTML(obs.observationType || '-')}</td>
                                <td>
                                    <span class="badge badge-${this.getRiskBadgeClass(obs.riskLevel)}">
                                        ${Utils.escapeHTML(obs.riskLevel || '-')}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge badge-${this.getStatusBadgeClass(obs.status)}">
                                        ${Utils.escapeHTML(obs.status || '-')}
                                    </span>
                                </td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-lg ${obs.score >= 50 ? 'text-red-600' : obs.score >= 30 ? 'text-orange-600' : 'text-blue-600'}">
                                            ${obs.score}
                                        </span>
                                        <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div class="h-full ${obs.score >= 50 ? 'bg-red-500' : obs.score >= 30 ? 'bg-orange-500' : 'bg-blue-500'}" 
                                                 style="width: ${Math.min((obs.score / 100) * 100, 100)}%"></div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <button onclick="DailyObservations.viewObservation('${obs.id}')" 
                                            class="btn-icon btn-icon-primary" title="عرض التفاصيل">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // تحميل الرسوم البيانية
        this.loadTop10Charts(observations, top10);

        // ربط الأزرار
        setTimeout(() => {
            const addChartBtn = document.getElementById('add-top10-chart-btn');
            if (addChartBtn) {
                addChartBtn.addEventListener('click', () => this.showAddTop10ChartModal());
            }

            const manageChartsBtn = document.getElementById('manage-top10-charts-btn');
            if (manageChartsBtn) {
                manageChartsBtn.addEventListener('click', () => this.showManageTop10ChartsModal());
            }
        }, 100);
    },

    /**
     * تحميل الرسوم البيانية لأفضل 10 ملاحظات
     */
    async loadTop10Charts(allObservations, top10Observations) {
        const container = document.getElementById('top10-charts-container');
        if (!container) return;

        // الحصول على الرسوم البيانية المحفوظة
        let savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');

        // إذا لم تكن هناك رسوم محفوظة، إنشاء رسوم افتراضية
        if (savedCharts.length === 0) {
            savedCharts = [
                {
                    id: 'chart_risk_distribution',
                    type: 'doughnut',
                    title: 'توزيع الخطورة (أفضل 10)',
                    field: 'riskLevel',
                    enabled: true
                },
                {
                    id: 'chart_status_distribution',
                    type: 'pie',
                    title: 'توزيع الحالة (أفضل 10)',
                    field: 'status',
                    enabled: true
                },
                {
                    id: 'chart_type_distribution',
                    type: 'bar',
                    title: 'توزيع الأنواع (أفضل 10)',
                    field: 'observationType',
                    enabled: true
                },
                {
                    id: 'chart_site_distribution',
                    type: 'bar',
                    title: 'توزيع المواقع (أفضل 10)',
                    field: 'siteName',
                    enabled: false
                }
            ];
            localStorage.setItem('dailyObservations_top10Charts', JSON.stringify(savedCharts));
        }

        const enabledCharts = savedCharts.filter(chart => chart.enabled);

        if (enabledCharts.length === 0) {
            container.innerHTML = `
                <div class="col-span-2">
                    <div class="empty-state">
                        <i class="fas fa-chart-bar text-gray-300 text-4xl mb-4"></i>
                        <p class="text-gray-500">لا توجد رسوم بيانية مفعلة</p>
                        <button onclick="DailyObservations.showAddTop10ChartModal()" class="btn-primary mt-4">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة رسم بياني
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // إنشاء HTML للرسوم البيانية
        let chartsHTML = '';
        enabledCharts.forEach((chartConfig, index) => {
            const chartId = `top10-chart-${chartConfig.id}-${index}`;
            const chartContainerId = `top10-chart-container-${chartConfig.id}-${index}`;
            
            chartsHTML += `
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h4 class="font-semibold text-lg">
                                <i class="fas fa-chart-${chartConfig.type === 'doughnut' || chartConfig.type === 'pie' ? 'pie' : 'bar'} ml-2"></i>
                                ${Utils.escapeHTML(chartConfig.title)}
                            </h4>
                            <div class="flex items-center gap-2">
                                <button onclick="DailyObservations.editTop10Chart('${chartConfig.id}')" 
                                        class="btn-icon btn-icon-secondary" title="تعديل">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="DailyObservations.deleteTop10Chart('${chartConfig.id}')" 
                                        class="btn-icon btn-icon-danger" title="حذف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="${chartContainerId}" style="position: relative; height: 300px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = chartsHTML;

        // رسم الرسوم البيانية
        setTimeout(async () => {
            const chartLoaded = await this.ensureChartJSLoaded();
            if (chartLoaded && typeof Chart !== 'undefined') {
                this.renderTop10Charts(enabledCharts, top10Observations, allObservations);
            }
        }, 300);
    },

    /**
     * رسم الرسوم البيانية لأفضل 10 ملاحظات
     */
    renderTop10Charts(chartConfigs, top10Observations, allObservations) {
        if (typeof Chart === 'undefined') return;

        // تدمير الرسوم البيانية السابقة
        if (this.top10Charts) {
            Object.values(this.top10Charts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
        }
        this.top10Charts = {};

        chartConfigs.forEach((chartConfig, index) => {
            const chartId = `top10-chart-${chartConfig.id}-${index}`;
            const canvas = document.getElementById(chartId);
            if (!canvas) return;

            // تحليل البيانات
            const data = this.analyzeTop10ChartData(chartConfig, top10Observations, allObservations);

            // إعدادات الرسم البياني
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || context.parsed.y || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            };

            let chart;
            if (chartConfig.type === 'doughnut' || chartConfig.type === 'pie') {
                chart = new Chart(canvas, {
                    type: chartConfig.type,
                    data: {
                        labels: data.labels,
                        datasets: [{
                            data: data.values,
                            backgroundColor: [
                                '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
                                '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
                                '#f97316', '#6366f1'
                            ],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: chartOptions
                });
            } else if (chartConfig.type === 'bar') {
                chart = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: chartConfig.title,
                            data: data.values,
                            backgroundColor: '#3b82f6',
                            borderColor: '#2563eb',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        ...chartOptions,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            } else if (chartConfig.type === 'line') {
                chart = new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: chartConfig.title,
                            data: data.values,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: chartOptions
                });
            }

            if (chart) {
                this.top10Charts[chartConfig.id] = chart;
            }
        });
    },

    /**
     * تحليل البيانات للرسم البياني
     */
    analyzeTop10ChartData(chartConfig, top10Observations, allObservations) {
        const field = chartConfig.field;
        const useAllData = chartConfig.useAllData === true;
        const observations = useAllData ? allObservations : top10Observations;

        const counts = {};
        observations.forEach(obs => {
            const value = obs[field] || 'غير محدد';
            counts[value] = (counts[value] || 0) + 1;
        });

        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // أخذ أعلى 10 قيم

        return {
            labels: sorted.map(([label]) => label),
            values: sorted.map(([, count]) => count)
        };
    },

    /**
     * عرض نافذة إضافة رسم بياني جديد
     */
    showAddTop10ChartModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة رسم بياني جديد
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                عنوان الرسم البياني
                            </label>
                            <input type="text" id="top10-chart-title" class="form-input" 
                                   placeholder="مثال: توزيع الخطورة">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                نوع الرسم البياني
                            </label>
                            <select id="top10-chart-type" class="form-input">
                                <option value="doughnut">دائري (Doughnut)</option>
                                <option value="pie">دائري (Pie)</option>
                                <option value="bar">عمودي (Bar)</option>
                                <option value="line">خطي (Line)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                الحقل المراد تحليله
                            </label>
                            <select id="top10-chart-field" class="form-input">
                                <option value="riskLevel">معدل الخطورة</option>
                                <option value="status">الحالة</option>
                                <option value="observationType">نوع الملاحظة</option>
                                <option value="siteName">الموقع</option>
                                <option value="locationName">المكان</option>
                                <option value="shift">الوردية</option>
                                <option value="responsibleDepartment">المسؤول</option>
                                <option value="observerName">صاحب الملاحظة</option>
                            </select>
                        </div>
                        <div>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="top10-chart-use-all-data" class="form-checkbox">
                                <span class="text-sm text-gray-700">استخدام جميع البيانات (وليس فقط أفضل 10)</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">
                        إلغاء
                    </button>
                    <button id="save-top10-chart-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const saveBtn = document.getElementById('save-top10-chart-btn');
        saveBtn.addEventListener('click', () => {
            const title = document.getElementById('top10-chart-title').value.trim();
            const type = document.getElementById('top10-chart-type').value;
            const field = document.getElementById('top10-chart-field').value;
            const useAllData = document.getElementById('top10-chart-use-all-data').checked;

            if (!title) {
                Notification.error('يرجى إدخال عنوان للرسم البياني');
                return;
            }

            const savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');
            const newChart = {
                id: `chart_${Date.now()}`,
                type: type,
                title: title,
                field: field,
                useAllData: useAllData,
                enabled: true
            };

            savedCharts.push(newChart);
            localStorage.setItem('dailyObservations_top10Charts', JSON.stringify(savedCharts));

            modal.remove();
            Notification.success('تم إضافة الرسم البياني بنجاح');
            this.loadTop10Observations();
        });
    },

    /**
     * عرض نافذة إدارة الرسوم البيانية
     */
    showManageTop10ChartsModal() {
        const savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-cog ml-2"></i>
                        إدارة الرسوم البيانية
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-2 max-h-96 overflow-y-auto">
                        ${savedCharts.length === 0 ? `
                            <div class="empty-state py-8">
                                <p class="text-gray-500">لا توجد رسوم بيانية محفوظة</p>
                            </div>
                        ` : savedCharts.map((chart, index) => `
                            <div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                                <div class="flex items-center gap-3 flex-1">
                                    <input type="checkbox" 
                                           class="form-checkbox top10-chart-enable" 
                                           data-chart-id="${chart.id}"
                                           ${chart.enabled ? 'checked' : ''}>
                                    <div class="flex-1">
                                        <div class="font-semibold">${Utils.escapeHTML(chart.title)}</div>
                                        <div class="text-sm text-gray-500">
                                            النوع: ${chart.type} | الحقل: ${chart.field}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onclick="DailyObservations.editTop10Chart('${chart.id}')" 
                                            class="btn-icon btn-icon-secondary" title="تعديل">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="DailyObservations.deleteTop10Chart('${chart.id}')" 
                                            class="btn-icon btn-icon-danger" title="حذف">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // ربط أحداث التفعيل/إلغاء التفعيل
        modal.querySelectorAll('.top10-chart-enable').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const chartId = e.target.getAttribute('data-chart-id');
                const savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');
                const chart = savedCharts.find(c => c.id === chartId);
                if (chart) {
                    chart.enabled = e.target.checked;
                    localStorage.setItem('dailyObservations_top10Charts', JSON.stringify(savedCharts));
                    this.loadTop10Observations();
                }
            });
        });
    },

    /**
     * تعديل رسم بياني
     */
    editTop10Chart(chartId) {
        const savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');
        const chart = savedCharts.find(c => c.id === chartId);
        if (!chart) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل الرسم البياني
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                عنوان الرسم البياني
                            </label>
                            <input type="text" id="edit-top10-chart-title" class="form-input" 
                                   value="${Utils.escapeHTML(chart.title)}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                نوع الرسم البياني
                            </label>
                            <select id="edit-top10-chart-type" class="form-input">
                                <option value="doughnut" ${chart.type === 'doughnut' ? 'selected' : ''}>دائري (Doughnut)</option>
                                <option value="pie" ${chart.type === 'pie' ? 'selected' : ''}>دائري (Pie)</option>
                                <option value="bar" ${chart.type === 'bar' ? 'selected' : ''}>عمودي (Bar)</option>
                                <option value="line" ${chart.type === 'line' ? 'selected' : ''}>خطي (Line)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                الحقل المراد تحليله
                            </label>
                            <select id="edit-top10-chart-field" class="form-input">
                                <option value="riskLevel" ${chart.field === 'riskLevel' ? 'selected' : ''}>معدل الخطورة</option>
                                <option value="status" ${chart.field === 'status' ? 'selected' : ''}>الحالة</option>
                                <option value="observationType" ${chart.field === 'observationType' ? 'selected' : ''}>نوع الملاحظة</option>
                                <option value="siteName" ${chart.field === 'siteName' ? 'selected' : ''}>الموقع</option>
                                <option value="locationName" ${chart.field === 'locationName' ? 'selected' : ''}>المكان</option>
                                <option value="shift" ${chart.field === 'shift' ? 'selected' : ''}>الوردية</option>
                                <option value="responsibleDepartment" ${chart.field === 'responsibleDepartment' ? 'selected' : ''}>المسؤول</option>
                                <option value="observerName" ${chart.field === 'observerName' ? 'selected' : ''}>صاحب الملاحظة</option>
                            </select>
                        </div>
                        <div>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="edit-top10-chart-use-all-data" class="form-checkbox" 
                                       ${chart.useAllData ? 'checked' : ''}>
                                <span class="text-sm text-gray-700">استخدام جميع البيانات (وليس فقط أفضل 10)</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">
                        إلغاء
                    </button>
                    <button id="update-top10-chart-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        حفظ التغييرات
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const updateBtn = document.getElementById('update-top10-chart-btn');
        updateBtn.addEventListener('click', () => {
            const title = document.getElementById('edit-top10-chart-title').value.trim();
            const type = document.getElementById('edit-top10-chart-type').value;
            const field = document.getElementById('edit-top10-chart-field').value;
            const useAllData = document.getElementById('edit-top10-chart-use-all-data').checked;

            if (!title) {
                Notification.error('يرجى إدخال عنوان للرسم البياني');
                return;
            }

            const savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');
            const chartIndex = savedCharts.findIndex(c => c.id === chartId);
            if (chartIndex !== -1) {
                savedCharts[chartIndex] = {
                    ...savedCharts[chartIndex],
                    title: title,
                    type: type,
                    field: field,
                    useAllData: useAllData
                };
                localStorage.setItem('dailyObservations_top10Charts', JSON.stringify(savedCharts));
                modal.remove();
                Notification.success('تم تحديث الرسم البياني بنجاح');
                this.loadTop10Observations();
            }
        });
    },

    /**
     * حذف رسم بياني
     */
    deleteTop10Chart(chartId) {
        if (!confirm('هل أنت متأكد من حذف هذا الرسم البياني؟')) {
            return;
        }

        const savedCharts = JSON.parse(localStorage.getItem('dailyObservations_top10Charts') || '[]');
        const filtered = savedCharts.filter(c => c.id !== chartId);
        localStorage.setItem('dailyObservations_top10Charts', JSON.stringify(filtered));
        Notification.success('تم حذف الرسم البياني بنجاح');
        this.loadTop10Observations();
    },

    analyzeByItem(itemId, observations) {
        const counts = {};
        let total = 0;

        observations.forEach(obs => {
            let value = '';
            
            // دعم الحقول المعرفة مسبقاً
            switch(itemId) {
                case 'observationType':
                case 'نوع الملاحظة':
                    value = obs.observationType || 'غير محدد';
                    break;
                case 'riskLevel':
                case 'معدل الخطورة':
                case 'مستوى الخطورة':
                    value = obs.riskLevel || 'غير محدد';
                    break;
                case 'status':
                case 'الحالة':
                    value = obs.status || 'غير محدد';
                    break;
                case 'shift':
                case 'الوردية':
                    value = obs.shift || 'غير محدد';
                    break;
                case 'site':
                case 'siteName':
                case 'الموقع':
                    value = obs.siteName || 'غير محدد';
                    break;
                case 'responsibleDepartment':
                case 'المسؤول عن التنفيذ':
                case 'الإدارة المسؤولة':
                    value = obs.responsibleDepartment || 'غير محدد';
                    break;
                case 'observerName':
                case 'صاحب الملاحظة':
                    value = obs.observerName || 'غير محدد';
                    break;
                case 'locationName':
                case 'المكان':
                case 'الموقع داخل الموقع':
                    value = obs.locationName || 'غير محدد';
                    break;
                default:
                    // محاولة البحث في جميع الحقول الممكنة
                    // أولاً البحث المباشر
                    if (obs[itemId] !== undefined && obs[itemId] !== null && obs[itemId] !== '') {
                        value = String(obs[itemId]);
                    } else {
                        // البحث بطرق بديلة (camelCase, snake_case, etc.)
                        const normalizedItemId = itemId.toLowerCase().replace(/\s+/g, '');
                        const possibleKeys = Object.keys(obs);
                        const matchedKey = possibleKeys.find(key => 
                            key.toLowerCase().replace(/\s+/g, '') === normalizedItemId
                        );
                        value = matchedKey ? (obs[matchedKey] || 'غير محدد') : 'غير محدد';
                    }
            }
            
            // تنظيف القيمة وتوحيدها
            value = String(value).trim();
            if (!value || value === '' || value === 'null' || value === 'undefined') {
                value = 'غير محدد';
            }
            
            counts[value] = (counts[value] || 0) + 1;
            total++;
        });

        return Object.entries(counts)
            .map(([label, count]) => ({
                label,
                count,
                percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
            }))
            .sort((a, b) => b.count - a.count);
    },

    async addAnalysisItem() {
        if (!this.isCurrentUserAdmin()) {
            Notification.error('ليس لديك صلاحية لإضافة بنود التحليل');
            return;
        }

        const input = document.getElementById('new-analysis-item');
        if (!input) return;

        const label = input.value.trim();
        if (!label) {
            Notification.warning('يرجى إدخال اسم البند');
            return;
        }

        const analysisItems = JSON.parse(localStorage.getItem('dailyObservations_analysisItems') || '[]');
        
        // التحقق من عدم وجود بند بنفس الاسم
        if (analysisItems.some(item => item.label.toLowerCase() === label.toLowerCase())) {
            Notification.warning('يوجد بند بنفس الاسم مسبقاً');
            return;
        }

        const newId = `custom_${Date.now()}`;
        
        analysisItems.push({
            id: newId,
            label: label,
            enabled: true
        });

        localStorage.setItem('dailyObservations_analysisItems', JSON.stringify(analysisItems));
        input.value = '';
        
        await this.loadDataAnalysis();
        // تحديث النتائج والرسوم البيانية
        await this.updateAnalysisResults();
        Notification.success('تم إضافة البند بنجاح');
    },

    toggleAnalysisItem(itemId, enabled) {
        if (!this.isCurrentUserAdmin()) {
            Notification.error('ليس لديك صلاحية لتعديل بنود التحليل');
            return;
        }

        const analysisItems = JSON.parse(localStorage.getItem('dailyObservations_analysisItems') || '[]');
        const item = analysisItems.find(i => i.id === itemId);
        if (item) {
            item.enabled = enabled;
            localStorage.setItem('dailyObservations_analysisItems', JSON.stringify(analysisItems));
            this.updateAnalysisResults(); // سيحدث الرسوم البيانية تلقائياً
        }
    },

    removeAnalysisItem(itemId) {
        if (!this.isCurrentUserAdmin()) {
            Notification.error('ليس لديك صلاحية لحذف بنود التحليل');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا البند؟')) return;

        const analysisItems = JSON.parse(localStorage.getItem('dailyObservations_analysisItems') || '[]');
        const filtered = analysisItems.filter(item => item.id !== itemId);
        localStorage.setItem('dailyObservations_analysisItems', JSON.stringify(filtered));
        
        this.loadDataAnalysis();
        Notification.success('تم حذف البند بنجاح');
    },

    /**
     * الحصول على قيم الفلاتر من الواجهة
     */
    getFilters() {
        return {
            search: (document.getElementById('observation-search')?.value || '').toLowerCase(),
            site: document.getElementById('observation-filter-site')?.value || '',
            location: document.getElementById('observation-filter-location')?.value || '',
            type: document.getElementById('observation-filter-type')?.value || '',
            shift: document.getElementById('observation-filter-shift')?.value || '',
            risk: document.getElementById('observation-filter-risk')?.value || '',
            status: document.getElementById('observation-filter-status')?.value || '',
            observer: document.getElementById('observation-filter-observer')?.value || '',
            responsible: document.getElementById('observation-filter-responsible')?.value || '',
            dateFrom: document.getElementById('observation-date-from')?.value || '',
            dateTo: document.getElementById('observation-date-to')?.value || ''
        };
    },

    /**
     * تحديث شارات العد على الفلاتر النشطة
     */
    updateFilterBadges(observations, filteredObservations, filters) {
        // دالة مساعدة لإزالة شارة موجودة وإضافة شارة جديدة
        const updateFilterLabel = (filterId, filterValue, count) => {
            const filterElement = document.getElementById(filterId);
            if (!filterElement) return;
            
            // البحث عن label المرتبط بهذا الفلتر
            const filterField = filterElement.closest('.filter-field');
            if (!filterField) return;
            
            const label = filterField.querySelector('.filter-label');
            if (!label) return;
            
            // إزالة الشارة الموجودة إن وجدت
            const existingBadge = label.querySelector('.filter-count-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // إذا كان الفلتر نشطاً، إضافة الشارة
            if (filterValue && filterValue.trim() !== '') {
                const badge = document.createElement('span');
                badge.className = 'filter-count-badge';
                badge.title = 'عدد النتائج المفلترة';
                badge.textContent = count;
                
                // إدراج الشارة بعد الأيقونة
                const icon = label.querySelector('i');
                if (icon) {
                    icon.insertAdjacentElement('afterend', badge);
                } else {
                    label.insertBefore(badge, label.firstChild);
                }
            }
        };
        
        // حساب العدد لكل فلتر على حدة (بناءً على الفلاتر الأخرى النشطة)
        const getFilterCount = (filterKey, filterValue) => {
            if (!filterValue || filterValue.trim() === '') return 0;
            
            // إنشاء نسخة من الفلاتر مع تفعيل هذا الفلتر فقط
            const tempFilters = { ...filters };
            tempFilters[filterKey] = filterValue;
            
            // حساب عدد الملاحظات المطابقة
            return this.filterItems(observations, tempFilters).length;
        };
        
        // تحديث كل فلتر مع العدد الصحيح
        updateFilterLabel('observation-filter-site', filters.site, getFilterCount('site', filters.site));
        updateFilterLabel('observation-filter-location', filters.location, getFilterCount('location', filters.location));
        updateFilterLabel('observation-filter-type', filters.type, getFilterCount('type', filters.type));
        updateFilterLabel('observation-filter-shift', filters.shift, getFilterCount('shift', filters.shift));
        updateFilterLabel('observation-filter-risk', filters.risk, getFilterCount('risk', filters.risk));
        updateFilterLabel('observation-filter-status', filters.status, getFilterCount('status', filters.status));
        updateFilterLabel('observation-filter-observer', filters.observer, getFilterCount('observer', filters.observer));
        updateFilterLabel('observation-filter-responsible', filters.responsible, getFilterCount('responsible', filters.responsible));
    },

    /**
     * فلترة الملاحظات حسب الفلاتر المحددة
     */
    filterItems(items, filters) {
        const normalizeDateForFilter = (value) => {
            if (!value) return '';
            const raw = String(value).trim();
            if (!raw) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

            const parsed = new Date(raw);
            if (!Number.isNaN(parsed.getTime())) {
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            const match = raw.match(/(\d{4}-\d{2}-\d{2})/);
            return match ? match[1] : '';
        };

        return items.filter(obs => {
            // البحث النصي
            const matchesSearch = !filters.search ||
                (obs.isoCode || '').toLowerCase().includes(filters.search) ||
                (obs.siteName || '').toLowerCase().includes(filters.search) ||
                (obs.locationName || '').toLowerCase().includes(filters.search) ||
                (obs.observationType || '').toLowerCase().includes(filters.search) ||
                (obs.observerName || '').toLowerCase().includes(filters.search) ||
                (obs.responsibleDepartment || '').toLowerCase().includes(filters.search) ||
                (obs.description || '').toLowerCase().includes(filters.search);

            // الفلاتر - التحقق من القيم الفارغة أيضاً
            const matchesSite = !filters.site || String(obs.siteName || '').trim() === String(filters.site || '').trim();
            const matchesLocation = !filters.location || String(obs.locationName || '').trim() === String(filters.location || '').trim();
            const matchesType = !filters.type || String(obs.observationType || '').trim() === String(filters.type || '').trim();
            const matchesShift = !filters.shift || String(obs.shift || '').trim() === String(filters.shift || '').trim();
            const matchesRisk = !filters.risk || String(obs.riskLevel || '').trim() === String(filters.risk || '').trim();
            const matchesStatus = !filters.status || String(obs.status || '').trim() === String(filters.status || '').trim();
            const matchesObserver = !filters.observer || String(obs.observerName || '').trim() === String(filters.observer || '').trim();
            const matchesResponsible = !filters.responsible || String(obs.responsibleDepartment || '').trim() === String(filters.responsible || '').trim();

            // ✅ فلتر التاريخ (نطاق زمني)
            const obsDate = normalizeDateForFilter(obs.date);
            const matchesDateFrom = !filters.dateFrom || !obsDate || obsDate >= normalizeDateForFilter(filters.dateFrom);
            const matchesDateTo = !filters.dateTo || !obsDate || obsDate <= normalizeDateForFilter(filters.dateTo);
            const matchesDateRange = matchesDateFrom && matchesDateTo;

            return matchesSearch && matchesSite && matchesLocation && matchesType &&
                matchesShift && matchesRisk && matchesStatus && matchesObserver && matchesResponsible && matchesDateRange;
        });
    },

    async loadObservationsList() {
        const container = document.getElementById('observations-table-container');
        if (!container) {
            // إذا لم يكن الحاوي موجوداً، انتظر قليلاً ثم حاول مرة أخرى
            setTimeout(() => this.loadObservationsList(), 100);
            return;
        }

        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);

        // تحديث قيم الفلاتر أولاً
        this.updateFilterOptions();

        // تحديث الكروت الإحصائية
        this.renderStatsCards();

        if (observationsRaw.length === 0) {
            const { t, isRTL } = this.getTranslations();
            container.innerHTML = `<div class="empty-state" style="direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: ${isRTL ? 'right' : 'left'};"><p class="text-gray-500">${t('empty.noObservations')}</p></div>`;
            return;
        }

        // دالة مساعدة لاستخراج الرقم من رقم الملاحظة للترتيب
        const extractObservationNumber = (isoCode) => {
            if (!isoCode) return 0;
            const match = String(isoCode).match(/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        };

        const observations = observationsRaw
            .map((item) => this.normalizeRecord(item))
            .sort((a, b) => {
                // الترتيب حسب رقم الملاحظة من الأقدم للأحدث
                const numA = extractObservationNumber(a.isoCode);
                const numB = extractObservationNumber(b.isoCode);
                return numA - numB;
            });

        // تطبيق الفلاتر
        const filters = this.getFilters();
        const filteredObservations = this.filterItems(observations, filters);
        
        // تحديث شارات العد على الفلاتر النشطة
        this.updateFilterBadges(observations, filteredObservations, filters);

        // التحقق من وجود tbody موجود مسبقاً
        const existingTable = container.querySelector('table');
        const tableBody = existingTable?.querySelector('tbody');

        if (tableBody) {
            // تحديث tbody فقط
            if (filteredObservations.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 40px;">
                            <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">لا توجد نتائج للبحث</p>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = filteredObservations.map((obs) => `
                <tr>
                    <td>${Utils.escapeHTML(obs.isoCode || '')}</td>
                    <td>
                        <div class="text-sm font-medium text-gray-800">${Utils.escapeHTML(obs.siteName || '-')}</div>
                        <div class="text-xs text-gray-500">${Utils.escapeHTML(obs.locationName || '')}</div>
                    </td>
                    <td>${obs.date ? Utils.formatDateTime(obs.date) : '-'}</td>
                    <td>${Utils.escapeHTML(obs.observationType || '-')}</td>
                    <td>${Utils.escapeHTML(obs.shift || '-')}</td>
                    <td>
                        <span class="badge badge-${this.getRiskBadgeClass(obs.riskLevel)}">${Utils.escapeHTML(obs.riskLevel || '-')}</span>
                    </td>
                    <td>
                        <span class="badge badge-${this.getStatusBadgeClass(obs.status)}">${Utils.escapeHTML(obs.status || '-')}</span>
                    </td>
                    <td>${Utils.escapeHTML(obs.observerName || '-')}</td>
                    <td>${this.formatResponsibleTableCell(obs)}</td>
                    <td>${obs.attachments && obs.attachments.length > 0 ? `<i class="fas fa-paperclip text-blue-500" title="${obs.attachments.length} ملف"></i>` : '-'}</td>
                    <td>
                        <button onclick="DailyObservations.viewObservation('${obs.id}')" class="btn-icon btn-icon-primary" title="عرض">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            return;
        }

        // إنشاء الجدول من الصفر
        container.innerHTML = `
            <div class="table-wrapper observations-table-wrapper" style="overflow-x: auto; overflow-y: auto; max-height: 70vh;" dir="rtl">
                <table class="data-table" style="font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
                    <thead>
                        <tr>
                            <th>رقم الملاحظة</th>
                            <th>الموقع / المكان</th>
                            <th>التاريخ والوقت</th>
                            <th>نوع الملاحظة</th>
                            <th>الوردية</th>
                            <th>معدل الخطورة</th>
                            <th>الحالة</th>
                            <th>صاحب الملاحظة</th>
                            <th>المسؤول</th>
                            <th>المرفقات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredObservations.length === 0 ? `
                            <tr>
                                <td colspan="11" style="text-align: center; padding: 40px;">
                                    <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                                    <p class="text-gray-500" style="font-family: 'Cairo', sans-serif;">لا توجد نتائج للبحث</p>
                                </td>
                            </tr>
                        ` : filteredObservations.map((obs) => `
                            <tr>
                                <td style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.isoCode || '')}</td>
                                <td>
                                    <div class="text-sm font-medium text-gray-800" style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.siteName || '-')}</div>
                                    <div class="text-xs text-gray-500" style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.locationName || '')}</div>
                                </td>
                                <td style="font-family: 'Cairo', sans-serif;">${obs.date ? Utils.formatDateTime(obs.date) : '-'}</td>
                                <td style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.observationType || '-')}</td>
                                <td style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.shift || '-')}</td>
                                <td>
                                    <span class="badge badge-${this.getRiskBadgeClass(obs.riskLevel)}" style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.riskLevel || '-')}</span>
                                </td>
                                <td>
                                    <span class="badge badge-${this.getStatusBadgeClass(obs.status)}" style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.status || '-')}</span>
                                </td>
                                <td style="font-family: 'Cairo', sans-serif;">${Utils.escapeHTML(obs.observerName || '-')}</td>
                                <td style="font-family: 'Cairo', sans-serif;">${this.formatResponsibleTableCell(obs)}</td>
                                <td style="font-family: 'Cairo', sans-serif;">${obs.attachments && obs.attachments.length > 0 ? `<i class="fas fa-paperclip text-blue-500" title="${obs.attachments.length} ملف"></i>` : '-'}</td>
                                <td>
                                    <button onclick="DailyObservations.viewObservation('${obs.id}')" class="btn-icon btn-icon-primary" title="عرض" style="font-family: 'Cairo', sans-serif;">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // إضافة مستمعين للتمرير لإدارة حالة الظلال
        setTimeout(() => {
            const wrapper = container.querySelector('.observations-table-wrapper');
            if (wrapper) {
                this.setupTableScrollListeners(wrapper);
            }
        }, 100);
    },

    setupEventListeners() {
        // استخدام setTimeout مع وقت أطول لضمان جاهزية DOM
        setTimeout(() => {
            const addBtn = document.getElementById('add-observation-btn');
            if (addBtn) {
                // إزالة المستمعات السابقة إن وجدت
                addBtn.replaceWith(addBtn.cloneNode(true));
                document.getElementById('add-observation-btn').addEventListener('click', () => this.showForm());
            }

            const exportBtn = document.getElementById('export-observations-excel-btn');
            if (exportBtn) {
                exportBtn.replaceWith(exportBtn.cloneNode(true));
                document.getElementById('export-observations-excel-btn').addEventListener('click', () => this.exportExcel());
            }

            const exportPptBtn = document.getElementById('export-observations-ppt-btn');
            if (exportPptBtn) {
                exportPptBtn.replaceWith(exportPptBtn.cloneNode(true));
                document.getElementById('export-observations-ppt-btn').addEventListener('click', () => this.showExportPptModal());
            }

            const importBtn = document.getElementById('import-observations-excel-btn');
            if (importBtn) {
                importBtn.replaceWith(importBtn.cloneNode(true));
                document.getElementById('import-observations-excel-btn').addEventListener('click', () => this.showImportExcelModal());
            }

            const deleteAllBtn = document.getElementById('delete-all-observations-btn');
            if (deleteAllBtn) {
                deleteAllBtn.replaceWith(deleteAllBtn.cloneNode(true));
                document.getElementById('delete-all-observations-btn').addEventListener('click', () => this.deleteAllObservations());
            }

            const refreshModuleBtn = document.getElementById('daily-observations-refresh-btn');
            if (refreshModuleBtn) {
                refreshModuleBtn.replaceWith(refreshModuleBtn.cloneNode(true));
                document.getElementById('daily-observations-refresh-btn').addEventListener('click', () => this.load());
            }

            // البحث والفلاتر - إعادة ربط جميع الأحداث
            const searchInput = document.getElementById('observation-search');
            if (searchInput) {
                // إزالة المستمعات السابقة
                searchInput.replaceWith(searchInput.cloneNode(true));
                const newSearchInput = document.getElementById('observation-search');
                // ربط أحداث متعددة للبحث
                newSearchInput.addEventListener('input', () => {
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        this.loadObservationsList();
                    }, 300); // تأخير 300ms لتقليل عدد الاستدعاءات
                });
                newSearchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        clearTimeout(this.searchTimeout);
                        this.loadObservationsList();
                    }
                });
            }

            // ربط جميع الفلاتر
            const filterIds = [
                'observation-filter-site',
                'observation-filter-location',
                'observation-filter-type',
                'observation-filter-shift',
                'observation-filter-risk',
                'observation-filter-status',
                'observation-filter-observer',
                'observation-filter-responsible'
            ];

            filterIds.forEach(filterId => {
                const filterElement = document.getElementById(filterId);
                if (filterElement) {
                    filterElement.replaceWith(filterElement.cloneNode(true));
                    const newFilter = document.getElementById(filterId);
                    newFilter.addEventListener('change', () => {
                        this.loadObservationsList();
                    });
                }
            });

            // ✅ ربط فلتر التاريخ (نطاق زمني)
            const dateFromInput = document.getElementById('observation-date-from');
            const dateToInput = document.getElementById('observation-date-to');
            
            if (dateFromInput) {
                dateFromInput.replaceWith(dateFromInput.cloneNode(true));
                const newDateFrom = document.getElementById('observation-date-from');
                newDateFrom.addEventListener('change', () => {
                    this.loadObservationsList();
                });
            }
            
            if (dateToInput) {
                dateToInput.replaceWith(dateToInput.cloneNode(true));
                const newDateTo = document.getElementById('observation-date-to');
                newDateTo.addEventListener('change', () => {
                    this.loadObservationsList();
                });
            }

            // زر إعادة التعيين
            const resetFiltersBtn = document.getElementById('observation-reset-filters');
            if (resetFiltersBtn) {
                resetFiltersBtn.replaceWith(resetFiltersBtn.cloneNode(true));
                document.getElementById('observation-reset-filters').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.resetFilters();
                });
            }

            // ✅ إضافة مستمع لفلتر التاريخ
            const dateFilter = document.getElementById('observation-filter-date');
            if (dateFilter) {
                dateFilter.addEventListener('change', () => {
                    this.loadObservationsList();
                });
            }

            // إضافة مستمع لزر إضافة بند تحليل جديد
            const addAnalysisItemBtn = document.getElementById('add-analysis-item-btn');
            if (addAnalysisItemBtn) {
                addAnalysisItemBtn.addEventListener('click', () => this.addAnalysisItem());
            }

            // إضافة مستمع لإدخال Enter في حقل إضافة بند جديد
            const newAnalysisItemInput = document.getElementById('new-analysis-item');
            if (newAnalysisItemInput) {
                newAnalysisItemInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.addAnalysisItem();
                    }
                });
            }

            // تحميل تحليل البيانات عند فتح التبويب (يتم التعامل معه في setupTabs)
        }, 200);
    },

    /**
     * تحديث قيم الفلاتر ديناميكياً
     */
    updateFilterOptions() {
        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);

        const observations = observationsRaw.map(item => this.normalizeRecord(item));
        
        // جمع القيم الفريدة
        const sites = [...new Set(observations.map(o => o.siteName).filter(Boolean))].sort();
        // حفظ القيم المحددة حالياً قبل تحديث قائمة الأماكن (لربط المكان بالموقع)
        const currentSite = document.getElementById('observation-filter-site')?.value || '';
        const currentLocation = document.getElementById('observation-filter-location')?.value || '';
        // الأماكن: عند اختيار موقع معيّن نعرض فقط الأماكن المرتبطة به، وإلا نعرض الكل
        const observationsForLocations = currentSite
            ? observations.filter(o => String(o.siteName || '').trim() === String(currentSite).trim())
            : observations;
        const locations = [...new Set(observationsForLocations.map(o => o.locationName).filter(Boolean))].sort();
        const types = [...new Set(observations.map(o => o.observationType).filter(Boolean))].sort();
        const shifts = [...new Set(observations.map(o => o.shift).filter(Boolean))].sort();
        const riskLevels = [...new Set(observations.map(o => o.riskLevel).filter(Boolean))].sort();
        const statuses = [...new Set(observations.map(o => o.status).filter(Boolean))].sort();
        const observers = [...new Set(observations.map(o => o.observerName).filter(Boolean))].sort();
        const responsibles = [...new Set(observations.map(o => o.responsibleDepartment).filter(Boolean))].sort();
        const currentType = document.getElementById('observation-filter-type')?.value || '';
        const currentShift = document.getElementById('observation-filter-shift')?.value || '';
        const currentRisk = document.getElementById('observation-filter-risk')?.value || '';
        const currentStatus = document.getElementById('observation-filter-status')?.value || '';
        const currentObserver = document.getElementById('observation-filter-observer')?.value || '';
        const currentResponsible = document.getElementById('observation-filter-responsible')?.value || '';

        // تحديث قائمة المواقع
        const siteFilter = document.getElementById('observation-filter-site');
        if (siteFilter) {
            siteFilter.innerHTML = '<option value="">الكل</option>' +
                sites.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('');
            if (currentSite && sites.includes(currentSite)) {
                siteFilter.value = currentSite;
            }
        }

        // تحديث قائمة الأماكن (فقط الأماكن المرتبطة بالموقع المختار)
        const locationFilter = document.getElementById('observation-filter-location');
        if (locationFilter) {
            locationFilter.innerHTML = '<option value="">الكل</option>' +
                locations.map(l => `<option value="${Utils.escapeHTML(l)}">${Utils.escapeHTML(l)}</option>`).join('');
            if (currentLocation && locations.includes(currentLocation)) {
                locationFilter.value = currentLocation;
            } else {
                locationFilter.value = ''; // إعادة تعيين إلى "الكل" إذا المكان السابق غير مرتبط بالموقع المختار
            }
        }

        // تحديث قائمة الأنواع
        const typeFilter = document.getElementById('observation-filter-type');
        if (typeFilter) {
            typeFilter.innerHTML = '<option value="">الكل</option>' +
                types.map(t => `<option value="${Utils.escapeHTML(t)}">${Utils.escapeHTML(t)}</option>`).join('');
            if (currentType && types.includes(currentType)) {
                typeFilter.value = currentType;
            }
        }

        // تحديث قائمة الورديات
        const shiftFilter = document.getElementById('observation-filter-shift');
        if (shiftFilter) {
            shiftFilter.innerHTML = '<option value="">الكل</option>' +
                shifts.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('');
            if (currentShift && shifts.includes(currentShift)) {
                shiftFilter.value = currentShift;
            }
        }

        // تحديث قائمة معدلات الخطورة
        const riskFilter = document.getElementById('observation-filter-risk');
        if (riskFilter) {
            riskFilter.innerHTML = '<option value="">الكل</option>' +
                riskLevels.map(r => `<option value="${Utils.escapeHTML(r)}">${Utils.escapeHTML(r)}</option>`).join('');
            if (currentRisk && riskLevels.includes(currentRisk)) {
                riskFilter.value = currentRisk;
            }
        }

        // تحديث قائمة الحالات
        const statusFilter = document.getElementById('observation-filter-status');
        if (statusFilter) {
            statusFilter.innerHTML = '<option value="">الكل</option>' +
                statuses.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('');
            if (currentStatus && statuses.includes(currentStatus)) {
                statusFilter.value = currentStatus;
            }
        }

        // تحديث قائمة أصحاب الملاحظات
        const observerFilter = document.getElementById('observation-filter-observer');
        if (observerFilter) {
            observerFilter.innerHTML = '<option value="">الكل</option>' +
                observers.map(o => `<option value="${Utils.escapeHTML(o)}">${Utils.escapeHTML(o)}</option>`).join('');
            if (currentObserver && observers.includes(currentObserver)) {
                observerFilter.value = currentObserver;
            }
        }

        // تحديث قائمة المسؤولين
        const responsibleFilter = document.getElementById('observation-filter-responsible');
        if (responsibleFilter) {
            responsibleFilter.innerHTML = '<option value="">الكل</option>' +
                responsibles.map(r => `<option value="${Utils.escapeHTML(r)}">${Utils.escapeHTML(r)}</option>`).join('');
            if (currentResponsible && responsibles.includes(currentResponsible)) {
                responsibleFilter.value = currentResponsible;
            }
        }
    },

    /**
     * إعادة تعيين جميع الفلاتر
     */
    resetFilters() {
        // إعادة تعيين حقل البحث
        const searchInput = document.getElementById('observation-search');
        if (searchInput) {
            searchInput.value = '';
        }

        // إعادة تعيين جميع الفلاتر
        const filterIds = [
            'observation-filter-site',
            'observation-filter-location',
            'observation-filter-type',
            'observation-filter-shift',
            'observation-filter-risk',
            'observation-filter-status',
            'observation-filter-observer',
            'observation-filter-responsible'
        ];

        filterIds.forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                filterElement.value = '';
            }
        });

        // ✅ إعادة تعيين نطاق التاريخ
        const dateFromInput = document.getElementById('observation-date-from');
        const dateToInput = document.getElementById('observation-date-to');
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';

        // إزالة جميع الشارات
        document.querySelectorAll('.filter-count-badge').forEach(badge => {
            badge.remove();
        });

        // إعادة تحميل القائمة
        this.loadObservationsList();

        // إظهار إشعار
        if (typeof Notification !== 'undefined' && Notification.success) {
            Notification.success('تم إعادة تعيين جميع الفلاتر');
        }
    },

    /**
     * تصدير تقرير PPT (حسب الإدارة المختارة)
     * - الشريحة الأولى: بيانات ثابتة (الإدارة + تاريخ التقرير)
     * - كل ملاحظة: شريحة بنفس تصميم الـ Template
     * - الشريحة الأخيرة: ثابتة
     */
    async showExportPptModal() {
        if (!this.canDailyObservationsFullAdminUi()) {
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('تصدير PPT متاح لمدير النظام فقط');
            }
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const departmentOptions = this.getDepartmentOptions();
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-file-powerpoint ml-2"></i>تصدير تقرير PPT</h2>
                    <button class="modal-close" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <div class="flex items-start justify-between">
                            <p class="text-sm text-blue-800">
                                سيتم تصدير التقرير <strong>حسب الإدارة المختارة</strong> وبنفس تصميم الشرائح (Template) في Google Slides ثم تنزيله بصيغة PPT.
                            </p>
                            <button type="button" class="btn-secondary text-xs ml-2" id="ppt-template-id-settings-btn">
                                <i class="fas fa-cog ml-1"></i>
                                إعدادات Template
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الإدارة *</label>
                            <select id="dailyobs-ppt-department" class="form-input">
                                <option value="">اختر الإدارة</option>
                                ${departmentOptions.map((d) => `<option value="${Utils.escapeHTML(d)}">${Utils.escapeHTML(d)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ التقرير</label>
                            <input id="dailyobs-ppt-report-date" type="date" class="form-input" value="${todayStr}">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">من تاريخ (اختياري)</label>
                            <input id="dailyobs-ppt-from-date" type="date" class="form-input" value="">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">إلى تاريخ (اختياري)</label>
                            <input id="dailyobs-ppt-to-date" type="date" class="form-input" value="">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="dailyobs-ppt-cancel-btn">إلغاء</button>
                    <button type="button" class="btn-primary" id="dailyobs-ppt-export-btn">
                        <i class="fas fa-download ml-2"></i>
                        تصدير
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('#dailyobs-ppt-cancel-btn')?.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        // زر إعدادات Template ID
        modal.querySelector('#ppt-template-id-settings-btn')?.addEventListener('click', async () => {
            close();
            await this.showPptTemplateIdSetupModal();
        });

        modal.querySelector('#dailyobs-ppt-export-btn')?.addEventListener('click', async () => {
            const dept = (modal.querySelector('#dailyobs-ppt-department')?.value || '').trim();
            if (!dept) {
                Notification.warning('يرجى اختيار الإدارة أولاً.');
                return;
            }

            const reportDate = modal.querySelector('#dailyobs-ppt-report-date')?.value || '';
            const fromDate = modal.querySelector('#dailyobs-ppt-from-date')?.value || '';
            const toDate = modal.querySelector('#dailyobs-ppt-to-date')?.value || '';

            await this.exportPptReport({ department: dept, reportDate, fromDate, toDate });
            close();
        });
    },

    _getObservationPrimaryImageUrl(observation) {
        const attachments = Array.isArray(observation?.attachments) ? observation.attachments : [];
        const img = attachments.find((a) => {
            const type = String(a?.type || '').toLowerCase();
            const name = String(a?.name || '').toLowerCase();
            const isImg = type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
            if (!isImg) return false;
            return Boolean(a?.directLink || a?.shareableLink || a?.cloudLink?.url || a?.data);
        });
        if (!img) return '';
        return img.directLink || img.shareableLink || img.cloudLink?.url || img.data || '';
    },

    async exportPptReport({ department, reportDate, fromDate, toDate }) {
        try {
            if (!this.canDailyObservationsFullAdminUi()) {
                if (typeof Notification !== 'undefined' && Notification.error) {
                    Notification.error('تصدير PPT متاح لمدير النظام فقط');
                }
                return;
            }
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                Notification.error('Google Apps Script غير مفعّل. يرجى تفعيله في الإعدادات أولاً.');
                return;
            }

            const observationsRaw = Array.isArray(AppState.appData.dailyObservations)
                ? AppState.appData.dailyObservations
                : [];

            if (observationsRaw.length === 0) {
                Notification.info('لا توجد ملاحظات يومية للتصدير.');
                return;
            }

            const normalized = observationsRaw.map((item) => this.normalizeRecord(item));
            const dept = String(department || '').trim();
            const from = fromDate ? new Date(fromDate) : null;
            const to = toDate ? new Date(toDate) : null;

            const filtered = normalized.filter((obs) => {
                const matchesDept = String(obs.responsibleDepartment || '').trim() === dept;
                if (!matchesDept) return false;
                if (!from && !to) return true;
                const d = obs.date ? new Date(obs.date) : null;
                if (!d || Number.isNaN(d.getTime())) return false;
                if (from && d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
                if (to && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)) return false;
                return true;
            });

            if (filtered.length === 0) {
                Notification.warning('لا توجد ملاحظات مطابقة للإدارة/التاريخ المحدد.');
                return;
            }

            // محاولة الحصول على Template ID المحفوظ
            let savedTemplateId = null;
            try {
                const templateResult = await GoogleIntegration.sendToAppsScript('getDailyObservationsPptTemplateId', {});
                if (templateResult && templateResult.success && templateResult.templateId) {
                    savedTemplateId = templateResult.templateId;
                }
            } catch (e) {
                // تجاهل الخطأ - سيتم التعامل معه لاحقاً
            }

            const payload = {
                department: dept,
                reportDate: reportDate ? new Date(reportDate).toISOString() : new Date().toISOString(),
                fromDate: fromDate ? new Date(fromDate).toISOString() : '',
                toDate: toDate ? new Date(toDate).toISOString() : '',
                observations: filtered.map((o) => ({
                    id: o.id || '',
                    isoCode: o.isoCode || '',
                    siteName: o.siteName || '',
                    locationName: o.locationName || '',
                    date: o.date || '',
                    observationType: o.observationType || '',
                    shift: o.shift || '',
                    riskLevel: o.riskLevel || '',
                    status: o.status || '',
                    observerName: o.observerName || '',
                    responsibleDepartment: o.responsibleDepartment || '',
                    expectedCompletionDate: o.expectedCompletionDate || '',
                    details: o.details || '',
                    correctiveAction: o.correctiveAction || '',
                    imageUrl: this._getObservationPrimaryImageUrl(o)
                }))
            };

            // إضافة Template ID إذا كان موجوداً
            if (savedTemplateId) {
                payload.templateId = savedTemplateId;
            }

            Loading.show('جاري إنشاء تقرير PPT...');
            const result = await GoogleIntegration.sendToAppsScript('exportDailyObservationsPptReport', payload);
            Loading.hide();

            if (!result || result.success === false) {
                const errorMsg = result?.message || 'فشل إنشاء تقرير PPT';
                
                // إذا كان الخطأ متعلقاً بـ Template ID، عرض نافذة الإعداد
                if (errorMsg.includes('Template ID') || errorMsg.includes('DAILY_OBSERVATIONS_PPT_TEMPLATE_ID')) {
                    Notification.warning('يجب إعداد Template ID أولاً');
                    await this.showPptTemplateIdSetupModal();
                    return;
                }
                
                Notification.error(errorMsg);
                return;
            }

            const downloadUrl = result.downloadUrl || result.url || result.viewUrl || '';
            if (downloadUrl) {
                const win = window.open(downloadUrl, '_blank');
                if (!win) {
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }
            }

            Notification.success('تم إنشاء تقرير PPT بنجاح.');
        } catch (error) {
            Loading.hide();
            Utils.safeError('فشل تصدير PPT:', error);
            const errorMsg = error?.message || 'خطأ غير معروف';
            if (errorMsg.includes('Template ID') || errorMsg.includes('DAILY_OBSERVATIONS_PPT_TEMPLATE_ID')) {
                Notification.warning('يجب إعداد Template ID أولاً');
                await this.showPptTemplateIdSetupModal();
            } else {
                Notification.error('فشل تصدير PPT: ' + errorMsg);
            }
        }
    },

    /**
     * عرض نافذة إعداد Template ID لتصدير PPT
     */
    async showPptTemplateIdSetupModal() {
        if (!this.canDailyObservationsFullAdminUi()) {
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('إعدادات قالب PPT متاحة لمدير النظام فقط');
            }
            return;
        }
        // محاولة الحصول على Template ID الحالي
        let currentTemplateId = null;
        let currentTemplateInfo = null;
        
        try {
            const templateResult = await GoogleIntegration.sendToAppsScript('getDailyObservationsPptTemplateId', {});
            if (templateResult && templateResult.success) {
                currentTemplateId = templateResult.templateId;
                currentTemplateInfo = {
                    fileName: templateResult.fileName || '',
                    fileUrl: templateResult.fileUrl || ''
                };
            }
        } catch (e) {
            // تجاهل الخطأ - يعني أن Template ID غير موجود
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-file-powerpoint ml-2"></i>
                        إعداد Template ID لتصدير PPT
                    </h2>
                    <button class="modal-close" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="bg-yellow-50 border border-yellow-200 rounded p-4">
                        <p class="text-sm text-yellow-800 mb-2">
                            <strong>ملاحظة مهمة:</strong> يجب إعداد ملف Google Slides Template قبل تصدير التقارير.
                        </p>
                        <p class="text-sm text-yellow-700">
                            يجب أن يحتوي Template على 3 شرائح على الأقل: شريحة الغلاف، شريحة الملاحظة (سيتم تكرارها)، وشريحة ثابتة.
                        </p>
                    </div>

                    ${currentTemplateId ? `
                        <div class="bg-green-50 border border-green-200 rounded p-4">
                            <p class="text-sm text-green-800 mb-2">
                                <strong>Template ID الحالي:</strong>
                            </p>
                            <p class="text-sm font-mono text-green-700 mb-2">${Utils.escapeHTML(currentTemplateId)}</p>
                            ${currentTemplateInfo.fileName ? `<p class="text-sm text-green-700">الملف: <strong>${Utils.escapeHTML(currentTemplateInfo.fileName)}</strong></p>` : ''}
                            ${currentTemplateInfo.fileUrl ? `<p class="text-sm mt-2"><a href="${Utils.escapeHTML(currentTemplateInfo.fileUrl)}" target="_blank" class="text-blue-600 hover:underline">فتح الملف في Google Slides</a></p>` : ''}
                        </div>
                    ` : `
                        <div class="bg-red-50 border border-red-200 rounded p-4">
                            <p class="text-sm text-red-800">
                                <strong>لم يتم ضبط Template ID بعد.</strong> يرجى إدخال File ID لملف Google Slides Template أدناه.
                            </p>
                        </div>
                    `}

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Template ID (File ID) *
                            <span class="text-xs text-gray-500 font-normal">(من رابط Google Slides)</span>
                        </label>
                        <input 
                            type="text" 
                            id="ppt-template-id-input" 
                            class="form-input font-mono text-sm" 
                            placeholder="أدخل File ID من رابط Google Slides"
                            value="${currentTemplateId ? Utils.escapeHTML(currentTemplateId) : ''}"
                        >
                        <p class="text-xs text-gray-500 mt-2">
                            <i class="fas fa-info-circle ml-1"></i>
                            يمكنك الحصول على File ID من رابط Google Slides:
                            <code class="text-xs bg-gray-100 px-1 rounded">https://docs.google.com/presentation/d/<strong>FILE_ID_HERE</strong>/edit</code>
                        </p>
                    </div>

                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <h4 class="text-sm font-semibold text-blue-900 mb-2">تعليمات إنشاء Template:</h4>
                        <ol class="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                            <li>أنشئ ملف Google Slides جديد</li>
                            <li>الشريحة الأولى: شريحة الغلاف تحتوي على {{DEPARTMENT}} و {{REPORT_DATE}}</li>
                            <li>الشريحة الثانية: شريحة الملاحظة تحتوي على جميع Placeholders مثل {{OBS_NO}}, {{OBS_DATE}}, {{OBS_DETAILS}}, إلخ</li>
                            <li>الشريحة الثالثة: شريحة ثابتة (اختياري)</li>
                            <li>انسخ File ID من رابط الملف وأدخله أعلاه</li>
                        </ol>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" id="ppt-template-id-cancel-btn">إلغاء</button>
                    <button type="button" class="btn-primary" id="ppt-template-id-save-btn">
                        <i class="fas fa-save ml-2"></i>
                        حفظ Template ID
                    </button>
                    ${currentTemplateId ? `
                        <button type="button" class="btn-secondary bg-red-600 hover:bg-red-700" id="ppt-template-id-test-btn">
                            <i class="fas fa-check ml-2"></i>
                            اختبار Template
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('#ppt-template-id-cancel-btn')?.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        // حفظ Template ID
        modal.querySelector('#ppt-template-id-save-btn')?.addEventListener('click', async () => {
            const templateIdInput = modal.querySelector('#ppt-template-id-input');
            const templateId = (templateIdInput?.value || '').trim();

            if (!templateId) {
                Notification.warning('يرجى إدخال Template ID');
                return;
            }

            Loading.show('جاري حفظ Template ID...');
            try {
                const result = await GoogleIntegration.sendToAppsScript('setDailyObservationsPptTemplateId', {
                    templateId: templateId
                });

                Loading.hide();

                if (result && result.success) {
                    Notification.success('تم حفظ Template ID بنجاح');
                    close();
                    // إعادة المحاولة للتصدير إذا كان المستخدم يحاول التصدير
                    const exportModal = document.querySelector('.modal-overlay');
                    if (!exportModal || !exportModal.querySelector('#dailyobs-ppt-export-btn')) {
                        // لا يوجد نافذة تصدير مفتوحة، فقط أغلق
                    }
                } else {
                    Notification.error(result?.message || 'فشل حفظ Template ID');
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('فشل حفظ Template ID:', error);
                Notification.error('فشل حفظ Template ID: ' + (error?.message || 'خطأ غير معروف'));
            }
        });

        // اختبار Template
        if (currentTemplateId) {
            modal.querySelector('#ppt-template-id-test-btn')?.addEventListener('click', async () => {
                Loading.show('جاري التحقق من Template...');
                try {
                    const result = await GoogleIntegration.sendToAppsScript('getDailyObservationsPptTemplateId', {});
                    Loading.hide();

                    if (result && result.success) {
                        Notification.success(`Template صحيح ومتاح: ${result.fileName || result.templateId}`);
                    } else {
                        Notification.error(result?.message || 'Template ID غير صحيح');
                    }
                } catch (error) {
                    Loading.hide();
                    Utils.safeError('فشل التحقق من Template:', error);
                    Notification.error('فشل التحقق من Template: ' + (error?.message || 'خطأ غير معروف'));
                }
            });
        }
    },

    resetFormState() {
        this.state.selectedSiteId = '';
        this.state.selectedSiteName = '';
        this.state.availablePlaces = [];
        this.state.selectedPlaceId = '';
        this.state.isCustomLocationSelected = false;
        this.state.customLocationName = '';
        this.state.currentAttachments = [];
        this.state.editingId = null;
        this.state.activeModal = null;
        this.state.isLoadingPlaces = false;
    },

    getAllSites() {
        const rawSites = Array.isArray(AppState.appData.observationSites)
            ? AppState.appData.observationSites
            : [];
        const normalizedDbSites = rawSites
            .map((site, index) => this.normalizeSite(site, index))
            .filter(Boolean);

        const fallbackSites = this.DEFAULT_SITES.map((site, index) => ({
            id: site.id || this.slugify(`${site.name}-${index}`),
            name: site.name,
            places: Array.isArray(site.places)
                ? site.places.map((place, idx) => this.normalizePlace(place, idx, site.id || site.name))
                : []
        }));

        const combined = [...normalizedDbSites];

        fallbackSites.forEach((fallbackSite) => {
            if (!combined.some((site) => site.id === fallbackSite.id)) {
                combined.push(fallbackSite);
            }
        });

        return combined;
    },

    normalizeSite(site, index = 0) {
        if (!site) return null;
        
        // ✅ إصلاح: التأكد من وجود places حتى لو كانت مصفوفة فارغة
        if (!Array.isArray(site.places)) {
            site.places = [];
        }
        const id = site.id || site.siteId || this.slugify(`${site.name || site.title || 'site'}-${index}`);
        const name = site.name || site.title || site.label || '';
        if (!id || !name) return null;

        const placesSource = Array.isArray(site.places)
            ? site.places
            : Array.isArray(site.locations)
                ? site.locations
                : Array.isArray(site.children)
                    ? site.children
                    : Array.isArray(site.areas)
                        ? site.areas
                        : [];

        const places = placesSource
            .map((place, idx) => this.normalizePlace(place, idx, id))
            .filter(Boolean);

        return { id, name, places };
    },

    normalizePlace(place, index = 0, siteId = '') {
        if (!place) return null;
        const id = place.id || place.value || place.placeId || this.slugify(`${siteId || 'site'}-place-${index}`);
        const name = place.name || place.label || place.title || place.placeName || place.locationName || '';
        if (!id || !name) return null;
        return { id, name };
    },

    slugify(value) {
        if (!value) return '';
        return String(value)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\\u0600-\\u06FF\\s-]+/g, '')
            .replace(/\\s+/g, '-');
    },

    async ensureSheetJS() {
        if (typeof XLSX !== 'undefined') return;
        if (this.sheetJsPromise) {
            await this.sheetJsPromise;
            return;
        }
        this.sheetJsPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
            script.onerror = () => {
                // محاولة استخدام CDN بديل
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
                script.onerror = () => {
                    Utils.safeError('فشل تحميل مكتبة SheetJS');
                    Notification?.error?.('تعذر تحميل مكتبة Excel. يرجى المحاولة لاحقاً.');
                    this.sheetJsPromise = null;
                    reject(new Error('Failed to load XLSX library'));
                };
            };
            script.onload = () => resolve();
            document.head.appendChild(script);
        });
        await this.sheetJsPromise;
    },

    normalizeComparisonText(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\u0600-\u06FFA-Za-z0-9\s]/g, '');
    },

    findSiteMatch(name) {
        if (!name) return null;
        const target = this.normalizeComparisonText(name);
        return this.getAllSites().find((site) => this.normalizeComparisonText(site.name) === target) || null;
    },

    findPlaceMatch(site, placeName) {
        if (!site || !placeName) return null;
        const target = this.normalizeComparisonText(placeName);
        return (site.places || []).find((place) => this.normalizeComparisonText(place.name) === target) || null;
    },

    normalizeShiftValue(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const lower = text.toLowerCase();
        if (['الأولى', 'الاولى', 'first', 'shift 1', '1', 'one'].includes(lower)) return 'الأولى';
        if (['الثانية', 'second', 'shift 2', '2', 'two'].includes(lower)) return 'الثانية';
        if (['الثالثة', 'third', 'shift 3', '3', 'three'].includes(lower)) return 'الثالثة';
        return text;
    },

    normalizeRiskLevelValue(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const lower = text.toLowerCase();
        if (['منخفض', 'منخفضة', 'low', 'l'].includes(lower)) return 'منخفض';
        if (['متوسط', 'متوسطة', 'medium', 'moderate', 'm'].includes(lower)) return 'متوسط';
        if (['عالي', 'عالية', 'مرتفع', 'high', 'h'].includes(lower)) return 'عالي';
        return text;
    },

    normalizeObservationTypeValue(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const lower = text.toLowerCase();
        if (['وضع غير آمن', 'unsafe condition'].includes(lower)) return 'وضع غير آمن';
        if (['تصرف غير آمن', 'unsafe act'].includes(lower)) return 'تصرف غير آمن';
        if (['مقترح', 'اقتراح', 'suggestion', 'proposal'].includes(lower)) return 'مقترح';
        if (['أخرى', 'اخرى', 'other'].includes(lower)) return 'أخرى';
        return text;
    },

    parseExcelDateValue(value, { isDateOnly = false } = {}) {
        if (value === undefined || value === null || value === '') return '';

        // 1) Already a Date
        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) return '';
            const date = new Date(value);
            if (isDateOnly) date.setHours(0, 0, 0, 0);
            return date.toISOString();
        }

        // Helper: convert Arabic-Indic digits to ASCII
        const normalizeDigits = (input) => String(input || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

        // Helper: Excel serial date fallback (1900 system). Base: 1899-12-30 (handles Excel leap-year bug)
        // ملاحظة: يتم اعتبار التواريخ من Excel كتوقيت محلي وليس UTC
        const excelSerialToISO = (serial) => {
            if (typeof serial !== 'number' || Number.isNaN(serial)) return '';
            // Heuristic: reject obviously non-Excel ranges (but allow fractional times)
            if (serial < 1 || serial > 600000) return '';
            // حساب التاريخ من Excel serial number
            // Excel يخزن التاريخ كعدد الأيام من 1899-12-30
            const totalDays = Math.floor(serial);
            const timeFraction = serial - totalDays;
            // حساب التاريخ (بدون الوقت)
            const baseDate = new Date(1899, 11, 30); // 30 ديسمبر 1899 (التوقيت المحلي)
            const date = new Date(baseDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
            // إضافة الوقت من الجزء الكسري
            if (timeFraction > 0) {
                const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                date.setHours(hours, minutes, seconds, 0);
            }
            if (Number.isNaN(date.getTime())) return '';
            if (isDateOnly) date.setHours(0, 0, 0, 0);
            return date.toISOString();
        };

        // 2) Numbers (Excel serial / epoch)
        if (typeof value === 'number') {
            // Prefer SheetJS parser when available
            if (typeof XLSX !== 'undefined' && XLSX.SSF?.parse_date_code) {
                const parsed = XLSX.SSF.parse_date_code(value);
                if (parsed) {
                    // استخدام التوقيت المحلي بدلاً من UTC لأن تواريخ Excel تُفترض بالتوقيت المحلي
                    const date = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
                    if (!Number.isNaN(date.getTime())) {
                        if (isDateOnly) date.setHours(0, 0, 0, 0);
                        return date.toISOString();
                    }
                }
            }

            // Fallback: Excel serial
            const asExcel = excelSerialToISO(value);
            if (asExcel) return asExcel;

            // Fallback: epoch milliseconds
            if (value > 1e11) {
                const d = new Date(value);
                if (!Number.isNaN(d.getTime())) {
                    if (isDateOnly) d.setHours(0, 0, 0, 0);
                    return d.toISOString();
                }
            }
        }

        // 3) Strings: handle common Excel/Arabic formats
        const rawText = String(value).trim();
        if (!rawText) return '';
        const text = normalizeDigits(rawText);

        // Numeric string: could be Excel serial or epoch
        if (/^\d+(\.\d+)?$/.test(text)) {
            const num = Number(text);
            const asExcel = excelSerialToISO(num);
            if (asExcel) return asExcel;
            if (num > 1e11) {
                const d = new Date(num);
                if (!Number.isNaN(d.getTime())) {
                    if (isDateOnly) d.setHours(0, 0, 0, 0);
                    return d.toISOString();
                }
            }
        }

        // yyyy-mm-dd [time]
        let m = text.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/);
        if (m) {
            const year = Number(m[1]);
            const month = Number(m[2]);
            const day = Number(m[3]);
            const hh = Number(m[4] || 0);
            const mm = Number(m[5] || 0);
            const ss = Number(m[6] || 0);
            const d = new Date(year, month - 1, day, hh, mm, ss);
            if (!Number.isNaN(d.getTime())) {
                if (isDateOnly) d.setHours(0, 0, 0, 0);
                return d.toISOString();
            }
        }

        // dd/mm/yyyy or dd-mm-yyyy [time]  (default: D/M/Y)
        m = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/);
        if (m) {
            const a = Number(m[1]);
            const b = Number(m[2]);
            let year = Number(m[3]);
            if (year < 100) year += 2000;

            // Heuristic for ambiguous cases: assume D/M unless clearly M/D (when day > 12)
            let day = a;
            let month = b;
            if (a <= 12 && b > 12) {
                // looks like M/D
                month = a;
                day = b;
            }

            const hh = Number(m[4] || 0);
            const mm = Number(m[5] || 0);
            const ss = Number(m[6] || 0);
            const d = new Date(year, month - 1, day, hh, mm, ss);
            if (!Number.isNaN(d.getTime())) {
                if (isDateOnly) d.setHours(0, 0, 0, 0);
                return d.toISOString();
            }
        }

        // dd-MMM-yy or dd-MMMM-yyyy (e.g. 27-May-25, 27-May-2025) [time]
        m = text.match(/^(\d{1,2})[\s\-\/\.]([A-Za-z]{3,9})[\s\-\/\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/);
        if (m) {
            const day = Number(m[1]);
            const monthName = String(m[2] || '').toLowerCase();
            let year = Number(m[3]);
            if (year < 100) year += (year >= 70 ? 1900 : 2000);

            const monthMap = {
                jan: 0, january: 0,
                feb: 1, february: 1,
                mar: 2, march: 2,
                apr: 3, april: 3,
                may: 4,
                jun: 5, june: 5,
                jul: 6, july: 6,
                aug: 7, august: 7,
                sep: 8, sept: 8, september: 8,
                oct: 9, october: 9,
                nov: 10, november: 10,
                dec: 11, december: 11
            };

            const month = monthMap[monthName];
            if (month !== undefined) {
                const hh = Number(m[4] || 0);
                const mm = Number(m[5] || 0);
                const ss = Number(m[6] || 0);
                const d = new Date(year, month, day, hh, mm, ss);
                if (!Number.isNaN(d.getTime())) {
                    if (isDateOnly) d.setHours(0, 0, 0, 0);
                    return d.toISOString();
                }
            }
        }

        // Last resort: native parsing (handles ISO and some locale strings)
        const parsedDate = new Date(text);
        if (!Number.isNaN(parsedDate.getTime())) {
            if (isDateOnly) parsedDate.setHours(0, 0, 0, 0);
            return parsedDate.toISOString();
        }

        return '';
    },

    lookupSiteName(siteId) {
        if (!siteId) return '';
        const site = this.getAllSites().find((item) => item.id === siteId);
        return site ? site.name : '';
    },

    lookupPlaceName(siteId, placeId) {
        if (!siteId || !placeId) return '';
        const site = this.getAllSites().find((item) => item.id === siteId);
        if (!site) return '';
        const place = site.places.find((item) => item.id === placeId);
        return place ? place.name : '';
    },

    /** أماكن الموقع من الذاكرة المحلية فوراً (بدون انتظار شبكة) */
    getPlacesForSiteSync(siteId) {
        if (!siteId) return [];
        const site = this.getAllSites().find((item) => item.id === siteId);
        if (site && Array.isArray(site.places) && site.places.length > 0) {
            return site.places;
        }

        const rawSites = Array.isArray(AppState.appData.observationSites)
            ? AppState.appData.observationSites
            : [];
        const dbSite = rawSites.find((item) => item.id === siteId || item.siteId === siteId);
        if (dbSite) {
            const placesSource = Array.isArray(dbSite.places)
                ? dbSite.places
                : Array.isArray(dbSite.locations)
                    ? dbSite.locations
                    : [];
            return placesSource.map((place, idx) => this.normalizePlace(place, idx, siteId)).filter(Boolean);
        }

        return site && Array.isArray(site.places) ? site.places : [];
    },

    async fetchPlacesForSite(siteId) {
        return this.getPlacesForSiteSync(siteId);
    },

    /** اسم العرض لصاحب الملاحظة من المستخدم الحالي */
    getLoggedInObserverName() {
        const u = AppState.currentUser || {};
        const name = (u.name || u.fullName || u.displayName || '').toString().trim();
        if (name) return name;
        const email = (u.email || '').toString().trim();
        if (email) return email.split('@')[0] || email;
        return '';
    },

    /** خيارات select لحقل صاحب الملاحظة: افتراضياً اسم المستخدم الحالي عند إضافة ملاحظة جديدة */
    buildObservationOwnerSelectOptionsHtml(normalizedData) {
        const members = this.getSafetyTeamMembers();
        const accountName = this.getLoggedInObserverName();
        const isNew = !normalizedData;
        const savedName = (normalizedData && String(normalizedData.observerName || '').trim()) || '';
        const parts = ['<option value="">— اختر من القائمة —</option>'];

        if (isNew && accountName) {
            const esc = Utils.escapeHTML(accountName);
            parts.push(`<option value="${esc}" selected data-observer-account="1">حسابك الحالي (${esc})</option>`);
        }

        const seen = new Set();
        if (isNew && accountName) seen.add(accountName.toLowerCase());

        members.forEach((member) => {
            const n = (member.name || '').trim();
            if (!n) return;
            const key = n.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            const esc = Utils.escapeHTML(n);
            const sel = !isNew && savedName === n ? ' selected' : '';
            parts.push(`<option value="${esc}"${sel}>${esc}</option>`);
        });

        if (!isNew && savedName && !members.some((m) => (m.name || '').trim() === savedName)) {
            const esc = Utils.escapeHTML(savedName);
            parts.splice(1, 0, `<option value="${esc}" selected>${esc}</option>`);
        }

        return parts.join('');
    },

    getDepartmentOptions() {
        const set = new Set();

        const companySettings = AppState.companySettings || {};

        const formDepartments = Array.isArray(companySettings.formDepartments)
            ? companySettings.formDepartments
            : (typeof companySettings.formDepartments === 'string'
                ? companySettings.formDepartments.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
                : []);

        formDepartments.forEach((department) => {
            const value = (department || '').toString().trim();
            if (value) set.add(value);
        });

        const legacyDepartments = Array.isArray(companySettings.departments)
            ? companySettings.departments
            : (typeof companySettings.departments === 'string'
                ? companySettings.departments.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
                : []);

        legacyDepartments.forEach((department) => {
            const value = (department || '').toString().trim();
            if (value) set.add(value);
        });

        if (Array.isArray(AppState.companySettings?.departments)) {
            AppState.companySettings.departments.forEach((department) => {
                const value = (department || '').toString().trim();
                if (value) set.add(value);
            });
        }

        (AppState.appData.employees || []).forEach((employee) => {
            const value = (employee.department || '').trim();
            if (value) set.add(value);
        });

        (AppState.appData.nearmiss || []).forEach((record) => {
            const value = (record.department || record.responsibleDepartment || '').trim();
            if (value) set.add(value);
        });

        (AppState.appData.incidents || []).forEach((record) => {
            const value = (record.affectedDepartment || record.department || '').trim();
            if (value) set.add(value);
        });

        (AppState.appData.dailyObservations || []).forEach((record) => {
            const value = (record.responsibleDepartment || '').trim();
            if (value) set.add(value);
        });

        return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));
    },

    /** مصدر واحد: Training.getSafetyTeamMembers (يُحمَّل training.js قبل dailyobservations.js في index.html) */
    getSafetyTeamMembers() {
        try {
            if (typeof Training !== 'undefined' && typeof Training.getSafetyTeamMembers === 'function') {
                return Training.getSafetyTeamMembers();
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ خطأ في getSafetyTeamMembers:', error);
        }
        return [];
    },

    isSystemManager() {
        if (!AppState.currentUser) return false;
        const role = (AppState.currentUser.role || '').toLowerCase();
        return role === 'admin' || role === 'مدير';
    },

    getSystemManagers() {
        const managers = [];
        (AppState.appData.users || []).forEach((user) => {
            const role = (user.role || '').toLowerCase();
            if (role === 'admin' || role === 'مدير') {
                const name = user.name || user.fullName || user.email || '';
                if (name) {
                    managers.push({ id: user.id || user.email || name, name });
                }
            }
        });
        return managers.length > 0 ? managers : [{ id: 'admin', name: AppState.currentUser?.name || 'مدير النظام' }];
    },

    async handleAttachmentSelection(fileList, previewContainer) {
        if (!fileList || fileList.length === 0) return;
        for (const file of Array.from(fileList)) {
            if (!this.isSupportedAttachmentType(file.type)) {
                Notification.warning(`صيغة الملف ${file.name} غير مدعومة. يسمح فقط بملفات JPG و PNG و PDF.`);
                continue;
            }

            if (file.size > this.MAX_ATTACHMENT_SIZE) {
                Notification.warning(`حجم الملف ${file.name} يتجاوز الحد المسموح به (10MB).`);
                continue;
            }

            try {
                const base64 = await this.convertFileToBase64(file);
                this.state.currentAttachments.push({
                    id: Utils.generateId('ATT'),
                    name: file.name,
                    type: file.type || this.detectMimeType(file.name),
                    size: file.size,
                    data: base64
                });
            } catch (error) {
                Utils.safeError('Failed to process attachment:', error);
                Notification.error(`تعذر تحميل الملف ${file.name}`);
            }
        }

        this.updateAttachmentsPreview(previewContainer);
    },

    isSupportedAttachmentType(type = '') {
        if (!type) return true;
        return ['image/jpeg', 'image/png', 'application/pdf'].some((allowed) => type.toLowerCase() === allowed);
    },

    updateAttachmentsPreview(container) {
        if (!container) return;

        if (!Array.isArray(this.state.currentAttachments) || this.state.currentAttachments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.9375rem; padding: 1rem;">لم يتم إضافة مرفقات.</p>';
            // إخفاء صف الصورة إذا لم تكن هناك صور
            const form = container.closest('form');
            if (form) {
                const imageRow = form.querySelector('#observation-image-row');
                if (imageRow) {
                    imageRow.classList.add('hidden');
                }
            }
            return;
        }

        container.innerHTML = this.state.currentAttachments.map((attachment) => this.buildAttachmentPreviewCard(attachment)).join('');

        // عرض الصور في صف الصورة
        const form = container.closest('form');
        if (form) {
            const imageRow = form.querySelector('#observation-image-row');
            const imageDisplay = form.querySelector('#observation-image-display');
            if (imageRow && imageDisplay) {
                const images = this.state.currentAttachments.filter(att => (att.type || '').startsWith('image/'));
                if (images.length > 0) {
                    imageRow.classList.remove('hidden');
                    imageDisplay.innerHTML = images.map(img => `
                        <div style="display: inline-block; margin: 0.5rem; text-align: center;">
                            <img src="${img.data}" alt="${Utils.escapeHTML(img.name || '')}" style="max-width: 250px; max-height: 200px; border-radius: 12px; border: 2px solid var(--border-color); cursor: pointer; transition: transform 0.3s ease;" onclick="window.open('${img.data}', '_blank')" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center;">${Utils.escapeHTML(img.name || '')}</p>
                        </div>
                    `).join('');
                } else {
                    imageRow.classList.add('hidden');
                }
            }
        }

        container.querySelectorAll('[data-remove-attachment]').forEach((button) => {
            button.addEventListener('click', () => {
                const attachmentId = button.getAttribute('data-remove-attachment');
                this.state.currentAttachments = this.state.currentAttachments.filter((item) => item.id !== attachmentId);
                this.updateAttachmentsPreview(container);
            });
        });

        container.querySelectorAll('[data-open-attachment]').forEach((button) => {
            button.addEventListener('click', () => {
                const attachmentId = button.getAttribute('data-open-attachment');
                const attachment = this.state.currentAttachments.find((item) => item.id === attachmentId);
                if (attachment && attachment.data) {
                    window.open(attachment.data, '_blank');
                }
            });
        });
    },

    buildAttachmentPreviewCard(attachment) {
        const isImage = (attachment.type || '').startsWith('image/');
        const sizeLabel = attachment.size ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB` : '';
        const name = Utils.escapeHTML(attachment.name || 'مرفق بدون اسم');

        if (isImage) {
            return `
                <div class="attachment-item">
                    <img src="${attachment.data}" alt="${name}" class="attachment-image">
                    <button type="button" data-remove-attachment="${attachment.id}" class="attachment-remove" aria-label="حذف المرفق">
                        <i class="fas fa-times"></i>
                    </button>
                    <div style="padding: 0.75rem; background: var(--bg-secondary); border-top: 2px solid var(--border-color);">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                            <span style="font-size: 0.8125rem; color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${name}</span>
                            ${sizeLabel ? `<span style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">${sizeLabel}</span>` : ''}
                        </div>
                        <button type="button" data-open-attachment="${attachment.id}" style="margin-top: 0.5rem; width: 100%; padding: 0.5rem; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 0.8125rem; cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.background='#004C8C'" onmouseout="this.style.background='var(--primary-color, #003865)'">
                            <i class="fas fa-search-plus" style="margin-left: 0.5rem;"></i>عرض الصورة
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="attachment-item" style="display: flex; align-items: flex-start; gap: 1rem; padding: 1rem;">
                <div style="flex-shrink: 0; width: 48px; height: 48px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <p style="font-size: 0.9375rem; font-weight: 600; color: var(--text-primary); margin: 0 0 0.25rem 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</p>
                    ${sizeLabel ? `<p style="font-size: 0.8125rem; color: var(--text-secondary); margin: 0 0 0.75rem 0;">${sizeLabel}</p>` : '<p style="margin-bottom: 0.75rem;"></p>'}
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" data-open-attachment="${attachment.id}" style="flex: 1; padding: 0.625rem; background: var(--primary-color); color: white; border: none; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.background='#004C8C'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='var(--primary-color, #003865)'; this.style.transform='translateY(0)'">
                            <i class="fas fa-eye" style="margin-left: 0.5rem;"></i>عرض
                        </button>
                        <button type="button" data-remove-attachment="${attachment.id}" style="flex: 1; padding: 0.625rem; background: #ef4444; color: white; border: none; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease;" onmouseover="this.style.background='#dc2626'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='#ef4444'; this.style.transform='translateY(0)'">
                            <i class="fas fa-trash" style="margin-left: 0.5rem;"></i>حذف
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    normalizeRecord(record = {}) {
        if (!record || typeof record !== 'object') return {
            id: '',
            isoCode: '',
            siteId: '',
            siteName: '',
            placeId: '',
            locationName: '',
            observationType: '',
            date: '',
            shift: '',
            details: '',
            correctiveAction: '',
            responsibleDepartment: '',
            riskLevel: '',
            observerName: '',
            expectedCompletionDate: '',
            status: 'مفتوح',
            overdays: 0,
            timestamp: '',
            reviewedBy: '',
            remarks: '',
            attachments: [],
            afterExecutionImages: [], // ✅ صور بعد التنفيذ
            createdAt: '',
            updatedAt: '',
            workflowStage: '',
            submittedBy: '',
            submittedByEmail: '',
            submittedAt: '',
            specialistReviewedBy: '',
            specialistReviewedAt: '',
            specialistComments: '',
            managerApprovedBy: '',
            managerApprovedAt: '',
            managerComments: '',
            departmentActionBy: '',
            departmentActionAt: '',
            rejectionReason: '',
            assignedToName: '',
            assignedToEmail: ''
        };

        const siteId = record.siteId || record.site || record.locationSiteId || '';
        const placeId = record.placeId || record.locationId || record.place || '';
        const locationName = record.locationName || record.placeName || record.location || record.customLocationName || '';
        const dateValue = record.dateTime || record.date || record.observationDate || '';
        const expectedDateValue = record.expectedCompletionDate || record.targetCompletionDate || record.dueDate || '';
        const details = record.details || record.description || record.observationDetails || '';
        
        // ✅ FIX: Force attachments to be an array (handle backend returning strings)
        let rawAttachments = record.attachments || record.files || record.images;
        if (!rawAttachments) {
            rawAttachments = [];
        } else if (typeof rawAttachments === 'string') {
            // If it's a string (e.g. "Name - URL"), wrap it in an array
            rawAttachments = [rawAttachments];
        } else if (!Array.isArray(rawAttachments)) {
            // If it's an object, wrap it in an array
            rawAttachments = [rawAttachments];
        }
        
        const observationType = this.normalizeObservationTypeValue(record.observationType || record.type || '');
        const shiftValue = this.normalizeShiftValue(record.shift || record.workShift || '');
        const riskLevel = this.normalizeRiskLevelValue(record.riskLevel || record.risk || '');
        const statusValue = this.normalizeStatus(record.status);

        // ✅ FIX: Parse afterExecutionImages if it's a JSON string
        let rawAfterExecutionImages = record.afterExecutionImages || [];
        if (typeof rawAfterExecutionImages === 'string') {
            try {
                rawAfterExecutionImages = JSON.parse(rawAfterExecutionImages);
            } catch (e) {
                rawAfterExecutionImages = [];
            }
        } else if (!Array.isArray(rawAfterExecutionImages)) {
            rawAfterExecutionImages = [rawAfterExecutionImages];
        }

        // تطبيع التواريخ بشكل آمن (بدون رمي أخطاء عند وجود تنسيقات غير مدعومة)
        const dateIso = this.parseExcelDateValue(dateValue) || '';
        const expectedIso = this.parseExcelDateValue(expectedDateValue, { isDateOnly: true }) || '';

        const createdAtIso = this.parseExcelDateValue(record.createdAt) || '';
        const updatedAtIso = this.parseExcelDateValue(record.updatedAt || record.modifiedAt || record.createdAt) || '';
        const timestampIso = this.parseExcelDateValue(record.timestamp || record.createdAt) || createdAtIso || new Date().toISOString();

        // حساب Overdays إذا لم يكن موجوداً
        let overdays = record.overdays;
        if (overdays === undefined || overdays === null) {
            if (dateIso) {
                const obsDate = new Date(dateIso);
                if (!Number.isNaN(obsDate.getTime())) {
                    const now = new Date();
                    overdays = Math.floor((now.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (overdays < 0) overdays = 0;
                } else {
                    overdays = 0;
                }
            } else {
                overdays = 0;
            }
        }

        // الـ id لا يُغيّر أبداً — يُستخدم كما هو من قاعدة البيانات
        const recordId = record.id || record.observationId || '';
        // isoCode: إما المحفوظ أو اشتقاق من أرقام id فقط (بدون تغيير أي أرقام)
        const isoCodeValue = record.isoCode || record.code || (recordId ? getObservationIsoCodeFromId(recordId) : '');
        return {
            id: recordId,
            isoCode: isoCodeValue,
            siteId,
            siteName: record.siteName || this.lookupSiteName(siteId),
            placeId,
            locationName: locationName || this.lookupPlaceName(siteId, placeId),
            observationType,
            date: dateIso,
            shift: shiftValue,
            details,
            correctiveAction: record.correctiveAction || record.preventiveAction || '',
            responsibleDepartment: record.responsibleDepartment || record.responsible || record.department || '',
            riskLevel,
            observerName: record.observerName || record.owner || record.supervisor || '',
            expectedCompletionDate: expectedIso,
            status: statusValue,
            overdays: overdays,
            timestamp: timestampIso,
            reviewedBy: record.reviewedBy || '',
            remarks: record.remarks || '',
            attachments: this.normalizeAttachments(rawAttachments),
            afterExecutionImages: rawAfterExecutionImages, // ✅ صور بعد التنفيذ (تم تطبيعها أعلاه)
            createdAt: createdAtIso || timestampIso || new Date().toISOString(),
            updatedAt: updatedAtIso || createdAtIso || timestampIso || new Date().toISOString(),
            workflowStage: record.workflowStage || '',
            submittedBy: record.submittedBy || '',
            submittedByEmail: record.submittedByEmail || '',
            submittedAt: record.submittedAt || '',
            specialistReviewedBy: record.specialistReviewedBy || '',
            specialistReviewedAt: record.specialistReviewedAt || '',
            specialistComments: record.specialistComments || '',
            managerApprovedBy: record.managerApprovedBy || '',
            managerApprovedAt: record.managerApprovedAt || '',
            managerComments: record.managerComments || '',
            departmentActionBy: record.departmentActionBy || '',
            departmentActionAt: record.departmentActionAt || '',
            rejectionReason: record.rejectionReason || '',
            assignedToName: record.assignedToName || '',
            assignedToEmail: record.assignedToEmail || ''
        };
    },

    normalizeAttachments(rawAttachments = []) {
        if (!Array.isArray(rawAttachments)) {
            if (rawAttachments && typeof rawAttachments === 'object') {
                return [this.normalizeAttachment(rawAttachments, 0)].filter(Boolean);
            }
            return [];
        }

        return rawAttachments
            .map((attachment, index) => this.normalizeAttachment(attachment, index))
            .filter(Boolean);
    },

    normalizeAttachment(entry, index = 0) {
        if (!entry) return null;
        let data = '';
        let name = '';
        let type = '';
        let size = 0;
        let id = '';

        if (typeof entry === 'string') {
            // ✅ FIX: Parse "Name - URL" format commonly saved by backend
            const match = entry.match(/^(.+?)\s*-\s*(https?:\/\/.+)$/);
            if (match) {
                name = match[1].trim();
                data = match[2].trim();
            } else {
                data = entry;
                name = `مرفق-${index + 1}`;
            }
            type = this.detectMimeType(name, data);
            id = Utils.generateId('ATT');
        } else if (typeof entry === 'object') {
            let rawData = entry.data || entry.base64 || entry.url || '';
            
            // ✅ FIX: Clean data if it follows "Name - URL" pattern
            const match = typeof rawData === 'string' ? rawData.match(/^(.+?)\s*-\s*(https?:\/\/.+)$/) : null;
            data = match ? match[2].trim() : rawData;
            name = entry.name || (match ? match[1].trim() : '') || `مرفق-${index + 1}`;
            
            type = entry.type || entry.mimeType || this.detectMimeType(name, data);
            size = entry.size || entry.fileSize || (data ? this.calculateBase64Size(data) : 0);
            id = entry.id || Utils.generateId('ATT');
        }

        if (!data) return null;

        return {
            id,
            name,
            type,
            size,
            data
        };
    },

    detectMimeType(name = '', data = '') {
        const lowerName = (name || '').toLowerCase();
        if (lowerName.endsWith('.pdf')) return 'application/pdf';
        if (lowerName.endsWith('.png')) return 'image/png';
        if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';

        if (this.isDataUrl(data)) {
            const match = data.match(/^data:([^;]+);/);
            if (match && match[1]) {
                return match[1];
            }
        }

        return 'application/octet-stream';
    },

    calculateBase64Size(base64 = '') {
        if (!base64) return 0;
        const cleaned = base64.split(',')[1] || base64;
        const padding = (cleaned.match(/=+$/) || [''])[0].length;
        return (cleaned.length * 3) / 4 - padding;
    },

    isDataUrl(value = '') {
        return typeof value === 'string' && value.startsWith('data:');
    },

    formatDateTimeLocal(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    },

    /**
     * تعبئة قائمة الأماكن الفرعية فوراً من بيانات المواقع المحمّلة (بدون انتظار أو رسالة «جاري التحميل»)
     */
    loadPlacesForSite(siteId, selectEl, customLocationWrapper, customLocationInput, stepTwoContainer, selectedPlaceId = '', fallbackLocationName = '') {
        if (!selectEl) return;
        this.state.isLoadingPlaces = true;
        try {
            const places = this.getPlacesForSiteSync(siteId);
            this.state.availablePlaces = places;

            if (!places || places.length === 0) {
                selectEl.innerHTML = '<option value="__custom__">لا توجد أماكن مسجلة - أدخل مكاناً يدوياً</option>';
                selectEl.disabled = false;
                selectEl.value = '__custom__';
                this.state.selectedPlaceId = '';
                this.state.isCustomLocationSelected = true;
                if (fallbackLocationName) {
                    customLocationInput.value = fallbackLocationName;
                    this.state.customLocationName = fallbackLocationName;
                }
                customLocationWrapper.classList.remove('hidden');
                stepTwoContainer.classList.remove('hidden');
                return;
            }

            const options = [
                '<option value="">اختر المكان</option>',
                ...places.map((place) => `
                    <option value="${Utils.escapeHTML(place.id)}" data-name="${Utils.escapeHTML(place.name)}">${Utils.escapeHTML(place.name)}</option>
                `),
                '<option value="__custom__">مكان آخر (إدخال يدوي)</option>'
            ];
            selectEl.innerHTML = options.join('');
            selectEl.disabled = false;

            if (selectedPlaceId && places.some((place) => place.id === selectedPlaceId)) {
                selectEl.value = selectedPlaceId;
                this.state.selectedPlaceId = selectedPlaceId;
                stepTwoContainer.classList.remove('hidden');
            } else if (!selectedPlaceId && fallbackLocationName) {
                const matched = places.find((place) => place.name === fallbackLocationName);
                if (matched) {
                    selectEl.value = matched.id;
                    this.state.selectedPlaceId = matched.id;
                    stepTwoContainer.classList.remove('hidden');
                } else {
                    selectEl.value = '__custom__';
                    customLocationInput.value = fallbackLocationName;
                    customLocationWrapper.classList.remove('hidden');
                    stepTwoContainer.classList.remove('hidden');
                    this.state.customLocationName = fallbackLocationName;
                    this.state.isCustomLocationSelected = true;
                }
            }
        } catch (error) {
            Utils.safeError('Failed to load places:', error);
            Notification.error('تعذر تحميل الأماكن المرتبطة بالموقع');
            selectEl.innerHTML = '<option value="__custom__">حدث خطأ - استخدم الإدخال اليدوي</option>';
            selectEl.disabled = false;
            selectEl.value = '__custom__';
            this.state.selectedPlaceId = '';
            this.state.isCustomLocationSelected = true;
            customLocationWrapper.classList.remove('hidden');
            stepTwoContainer.classList.remove('hidden');
        } finally {
            this.state.isLoadingPlaces = false;
        }
    },

    getRiskBadgeClass(level = '') {
        const normalized = this.normalizeRiskLevelValue(level);
        switch ((normalized || '').trim()) {
            case 'عالي':
                return 'danger';
            case 'متوسط':
                return 'warning';
            case 'منخفض':
                return 'success';
            default:
                return 'secondary';
        }
    },

    getStatusBadgeClass(status = '') {
        const raw = String(status || '').trim();
        const lower = raw.toLowerCase();
        if (['مفتوح', 'مفتوحة', 'متوحة', 'open', 'opened'].includes(lower)) return 'warning';
        if (['جاري', 'جاري التنفيذ', 'قيد التنفيذ', 'قيد المعالجة', 'in progress', 'ongoing', 'progress', 'active'].includes(lower)) return 'info';
        if (['مغلق', 'محلول', 'محلولة', 'منجز', 'مكتمل', 'closed', 'done', 'completed', 'resolved'].includes(lower)) return 'success';
        return 'secondary';
    },

    normalizeStatus(status = '') {
        const raw = String(status || '').trim();
        if (!raw) return 'مفتوح';
        const lower = raw.toLowerCase();
        if (['مفتوح', 'مفتوحة', 'متوحة', 'open', 'opened'].includes(lower)) return 'مفتوح';
        if (['جاري', 'جاري التنفيذ', 'قيد التنفيذ', 'قيد المعالجة', 'in progress', 'ongoing', 'progress', 'active'].includes(lower)) return 'جاري';
        if (['مغلق', 'محلول', 'محلولة', 'منجز', 'مكتمل', 'closed', 'done', 'completed', 'resolved'].includes(lower)) return 'مغلق';
        return raw;
    },

    async showForm(data = null) {
        const normalizedData = data ? this.normalizeRecord(data) : null;
        this.resetFormState();
        if (normalizedData) {
            this.state.editingId = normalizedData.id;
            this.state.currentAttachments = Array.isArray(normalizedData.attachments)
                ? normalizedData.attachments.map((attachment) => Object.assign({}, attachment))
                : [];
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay observation-form-overlay';
        modal.innerHTML = `
            <div class="modal-content observation-form-modal">
                <div class="modal-header observation-form-header">
                    <h2 class="modal-title observation-form-title">${normalizedData ? 'تعديل الملاحظة اليومية' : 'إضافة ملاحظة يومية'}</h2>
                    <button class="modal-close observation-form-close" aria-label="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body observation-form-body">
                    <form id="observation-form" class="observation-form space-y-6">
                        <div class="observation-form-step observation-step-1">
                            <div class="step-header">
                                <h3 class="step-title">
                                    <i class="fas fa-map-marker-alt step-icon"></i>
                                    الخطوة 1: اختيار الموقع
                                </h3>
                                <p class="step-description">اختر الموقع ثم المكان المرتبط به من قاعدة البيانات.</p>
                            </div>
                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label for="observation-site" class="form-label required">اسم الموقع / المكان</label>
                                    <select id="observation-site" class="form-input form-select" required>
                                        <option value="">اختر الموقع</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="observation-place" class="form-label required">المكان داخل الموقع</label>
                                    <select id="observation-place" class="form-input form-select" required disabled>
                                        <option value="">اختر الموقع أولاً</option>
                                    </select>
                                </div>
                            </div>
                            <div id="custom-location-wrapper" class="form-group hidden">
                                <label for="custom-location-input" class="form-label">مكان آخر (إدخال يدوي)</label>
                                <input type="text" id="custom-location-input" class="form-input" placeholder="مثال: خط الإنتاج 3">
                            </div>
                        </div>

                        <div id="observation-step-2" class="observation-form-step observation-step-2 hidden">
                            <div class="step-header">
                                <h3 class="step-title">
                                    <i class="fas fa-clipboard-list step-icon"></i>
                                    الخطوة 2: تفاصيل الملاحظة
                                </h3>
                                <p class="step-description">أدخل تفاصيل الملاحظة، الإجراءات التصحيحية والمعلومات المرتبطة.</p>
                            </div>

                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label for="observation-type" class="form-label required">نوع الملاحظة</label>
                                    <select id="observation-type" class="form-input form-select" required>
                                        <option value="">اختر النوع</option>
                                        ${this.OBSERVATION_TYPES.map((type) => `
                                            <option value="${Utils.escapeHTML(type.value)}">${Utils.escapeHTML(type.label)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="observation-date" class="form-label required">تاريخ ووقت الملاحظة</label>
                                    <input type="datetime-local" id="observation-date" class="form-input form-datetime" required>
                                </div>
                            </div>

                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label class="form-label">الوردية</label>
                                    <select id="observation-shift" class="form-input form-select">
                                        <option value="">اختر الوردية</option>
                                        ${this.SHIFTS.map((shift) => `
                                            <option value="${Utils.escapeHTML(shift)}">${Utils.escapeHTML(shift)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">معدل الخطورة</label>
                                    <select id="observation-risk" class="form-input form-select" required>
                                        <option value="">اختر معدل الخطورة</option>
                                        ${this.RISK_LEVELS.map((risk) => `
                                            <option value="${Utils.escapeHTML(risk)}">${Utils.escapeHTML(risk)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label class="form-label required">المسؤول عن التنفيذ</label>
                                    <select id="observation-responsible" class="form-input form-select" required>
                                        <option value="">اختر الإدارة</option>
                                        ${this.getDepartmentOptions().map((department) => `
                                            <option value="${Utils.escapeHTML(department)}">${Utils.escapeHTML(department)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">الحالة</label>
                                    <select id="observation-status" class="form-input form-select" required>
                                        <option value="">اختر الحالة</option>
                                        ${this.STATUS_OPTIONS.map((status) => `
                                            <option value="${Utils.escapeHTML(status)}">${Utils.escapeHTML(status)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label class="form-label" for="observation-owner">اسم صاحب الملاحظة</label>
                                    <select id="observation-owner" class="form-input form-select" aria-describedby="observation-owner-hint">
                                        ${this.buildObservationOwnerSelectOptionsHtml(normalizedData)}
                                    </select>
                                    <p id="observation-owner-hint" class="text-xs opacity-80 mt-1" style="color: var(--text-secondary, #64748b);">
                                        ${normalizedData ? 'يمكنك تغيير الاسم من القائمة إن لزم.' : 'يُعرض افتراضياً اسم حسابك الحالي؛ اختر اسماً آخر من القائمة إذا سجّلت نيابة عن زميل.'}
                                    </p>
                                </div>
                                <div class="form-group">
                                    <label for="observation-expected-date" class="form-label">التاريخ المتوقع للتنفيذ</label>
                                    <input type="date" id="observation-expected-date" class="form-input form-date">
                                </div>
                            </div>

                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label class="form-label">Overdays</label>
                                    <input type="text" id="observation-overdays" class="form-input form-readonly" readonly placeholder="سيتم الحساب تلقائياً">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Timestamp</label>
                                    <input type="text" id="observation-timestamp" class="form-input form-readonly" readonly placeholder="سيتم التعبئة تلقائياً">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">تفاصيل الملاحظة / التصرف غير الآمن</label>
                                <textarea id="observation-details" class="form-input form-textarea" rows="5" required placeholder="أدخل تفاصيل الملاحظة بالكامل...">${normalizedData ? Utils.escapeHTML(normalizedData.details || '') : ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label class="form-label">الإجراء التصحيحي / الوقائي</label>
                                <textarea id="observation-corrective" class="form-input form-textarea" rows="5" placeholder="صف الإجراء المطلوب أو المنفذ...">${normalizedData ? Utils.escapeHTML(normalizedData.correctiveAction || '') : ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label for="observation-attachments" class="form-label form-label-file">
                                    <i class="fas fa-paperclip form-label-icon"></i>
                                    الصورة التوضيحية للملاحظة (اختياري)
                                </label>
                                <div class="file-input-wrapper">
                                    <input type="file" id="observation-attachments" class="form-input form-file" accept=".jpg,.jpeg,.png,.pdf" multiple>
                                    <div class="file-input-hint">
                                        <i class="fas fa-info-circle"></i>
                                        يمكن رفع أكثر من ملف بصيغ JPG أو PNG أو PDF (بحد أقصى 10MB لكل ملف)
                                    </div>
                                </div>
                                <div id="observation-attachments-preview" class="attachments-preview"></div>
                            </div>

                            <div id="observation-image-row" class="form-group hidden">
                                <label class="form-label">الصورة المرفوعة</label>
                                <div id="observation-image-display" class="image-display-container">
                                    <p class="image-display-placeholder">لم يتم رفع أي صورة بعد</p>
                                </div>
                            </div>

                            ${this.isSystemManager() ? `
                            <div class="form-grid form-grid-2">
                                <div class="form-group">
                                    <label class="form-label required">Reviewed by</label>
                                    <select id="observation-reviewed-by" class="form-input form-select" required>
                                        <option value="">اختر مدير النظام</option>
                                        ${this.getSystemManagers().map((manager) => `
                                            <option value="${Utils.escapeHTML(manager.name || manager)}">${Utils.escapeHTML(manager.name || manager)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Remarks (مدير النظام فقط)</label>
                                <textarea id="observation-remarks" class="form-input form-textarea" rows="4" placeholder="ملاحظات المدير...">${normalizedData ? Utils.escapeHTML(normalizedData.remarks || '') : ''}</textarea>
                            </div>
                            ` : ''}
                        </div>
                    </form>
                </div>
                <div class="modal-footer observation-form-footer">
                    <button type="button" class="btn-secondary observation-btn-cancel" id="cancel-observation-btn">إلغاء</button>
                    <button type="button" id="save-observation-btn" class="btn-primary observation-btn-save">
                        <i class="fas fa-save ml-2"></i>
                        حفظ
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.state.activeModal = modal;

        const form = modal.querySelector('#observation-form');
        const siteSelect = form.querySelector('#observation-site');
        const placeSelect = form.querySelector('#observation-place');
        const customLocationWrapper = form.querySelector('#custom-location-wrapper');
        const customLocationInput = form.querySelector('#custom-location-input');
        const attachmentsInput = form.querySelector('#observation-attachments');
        const attachmentsPreview = form.querySelector('#observation-attachments-preview');
        const stepTwoContainer = form.querySelector('#observation-step-2');

        const sites = this.getAllSites();
        if (sites.length === 0) {
            siteSelect.innerHTML = '<option value="">لا توجد مواقع متاحة</option>';
            siteSelect.disabled = true;
            Notification.warning('لم يتم إعداد المواقع بعد. يرجى إضافة المواقع من الإعدادات.');
        } else {
            siteSelect.innerHTML = ['<option value="">اختر الموقع</option>', ...sites.map((site) => `
                <option value="${Utils.escapeHTML(site.id)}">${Utils.escapeHTML(site.name)}</option>
            `)].join('');
            siteSelect.disabled = false;
        }

        // تعيين Timestamp تلقائياً عند إنشاء ملاحظة جديدة
        if (!normalizedData) {
            const timestampInput = form.querySelector('#observation-timestamp');
            if (timestampInput) {
                timestampInput.value = Utils.formatDateTime(new Date().toISOString());
            }
        }

        // دالة لحساب Overdays
        const updateOverdays = () => {
            const dateInput = form.querySelector('#observation-date');
            const overdaysInput = form.querySelector('#observation-overdays');
            if (dateInput && overdaysInput && dateInput.value) {
                const observationDate = new Date(dateInput.value);
                const currentDate = new Date();
                const daysDiff = Math.floor((currentDate.getTime() - observationDate.getTime()) / (1000 * 60 * 60 * 24));
                overdaysInput.value = daysDiff > 0 ? `${daysDiff} يوم` : '0 يوم';
            }
        };

        if (normalizedData) {
            if (sites.some((site) => site.id === normalizedData.siteId)) {
                siteSelect.value = normalizedData.siteId;
                this.state.selectedSiteId = normalizedData.siteId;
                this.state.selectedSiteName = this.lookupSiteName(normalizedData.siteId);
            }

            const dateInput = form.querySelector('#observation-date');
            if (dateInput && normalizedData.date) {
                dateInput.value = this.formatDateTimeLocal(normalizedData.date);
                updateOverdays();
            }

            form.querySelector('#observation-type').value = normalizedData.observationType || '';
            form.querySelector('#observation-shift').value = normalizedData.shift || '';
            form.querySelector('#observation-risk').value = normalizedData.riskLevel || '';
            form.querySelector('#observation-responsible').value = normalizedData.responsibleDepartment || '';
            form.querySelector('#observation-status').value = normalizedData.status || '';
            const ownerSel = form.querySelector('#observation-owner');
            const obsName = String(normalizedData.observerName || '').trim();
            if (ownerSel && obsName) {
                if (!Array.from(ownerSel.options).some((o) => o.value === obsName)) {
                    const opt = document.createElement('option');
                    opt.value = obsName;
                    opt.textContent = obsName;
                    ownerSel.insertBefore(opt, ownerSel.children[1] || null);
                }
                ownerSel.value = obsName;
            }

            const overdaysInput = form.querySelector('#observation-overdays');
            if (overdaysInput && normalizedData.overdays !== undefined) {
                overdaysInput.value = `${normalizedData.overdays} يوم`;
            }

            const timestampInput = form.querySelector('#observation-timestamp');
            if (timestampInput) {
                timestampInput.value = normalizedData.timestamp ? Utils.formatDateTime(normalizedData.timestamp) : Utils.formatDateTime(normalizedData.createdAt || new Date().toISOString());
            }

            if (this.isSystemManager()) {
                const reviewedBySelect = form.querySelector('#observation-reviewed-by');
                if (reviewedBySelect && normalizedData.reviewedBy) {
                    reviewedBySelect.value = normalizedData.reviewedBy;
                }
                const remarksInput = form.querySelector('#observation-remarks');
                if (remarksInput && normalizedData.remarks) {
                    remarksInput.value = normalizedData.remarks;
                }
            }

            if (normalizedData.expectedCompletionDate) {
                const expectedDateInput = form.querySelector('#observation-expected-date');
                if (expectedDateInput) {
                    expectedDateInput.value = normalizedData.expectedCompletionDate.slice(0, 10);
                }
            }

            if (Array.isArray(normalizedData.attachments) && normalizedData.attachments.length > 0) {
                this.updateAttachmentsPreview(attachmentsPreview);
                // عرض الصور في صف الصورة
                const imageRow = form.querySelector('#observation-image-row');
                const imageDisplay = form.querySelector('#observation-image-display');
                if (imageRow && imageDisplay) {
                    const images = normalizedData.attachments.filter(att => (att.type || '').startsWith('image/'));
                    if (images.length > 0) {
                        imageRow.classList.remove('hidden');
                        imageDisplay.innerHTML = images.map(img => `
                            <div class="inline-block m-2">
                                <img src="${img.data}" alt="${Utils.escapeHTML(img.name || '')}" class="max-w-xs max-h-48 rounded border cursor-pointer" onclick="window.open('${img.data}', '_blank')">
                            </div>
                        `).join('');
                    }
                }
            } else {
                attachmentsPreview.innerHTML = '<p class="text-sm text-gray-500">لم يتم إضافة مرفقات.</p>';
            }
        } else {
            attachmentsPreview.innerHTML = '<p class="text-sm text-gray-500">لم يتم إضافة مرفقات بعد.</p>';
        }

        // إضافة event listener لتحديث Overdays عند تغيير التاريخ
        const dateInput = form.querySelector('#observation-date');
        if (dateInput) {
            dateInput.addEventListener('change', updateOverdays);
            dateInput.addEventListener('input', updateOverdays);
        }

        siteSelect.addEventListener('change', (event) => {
            const siteId = event.target.value;
            this.state.selectedSiteId = siteId;
            this.state.selectedSiteName = this.lookupSiteName(siteId);
            this.state.selectedPlaceId = '';
            this.state.customLocationName = '';
            this.state.isCustomLocationSelected = false;
            customLocationInput.value = '';
            customLocationWrapper.classList.add('hidden');
            stepTwoContainer.classList.add('hidden');

            if (!siteId) {
                placeSelect.innerHTML = '<option value="">اختر الموقع أولاً</option>';
                placeSelect.disabled = true;
                return;
            }

            this.loadPlacesForSite(siteId, placeSelect, customLocationWrapper, customLocationInput, stepTwoContainer);
        });

        placeSelect.addEventListener('change', (event) => {
            const value = event.target.value;
            if (!value) {
                this.state.selectedPlaceId = '';
                this.state.isCustomLocationSelected = false;
                customLocationWrapper.classList.add('hidden');
                customLocationInput.value = '';
                stepTwoContainer.classList.add('hidden');
                return;
            }

            if (value === '__custom__') {
                this.state.selectedPlaceId = '';
                this.state.isCustomLocationSelected = true;
                this.state.customLocationName = customLocationInput.value.trim();
                customLocationWrapper.classList.remove('hidden');
                stepTwoContainer.classList.remove('hidden');
                customLocationInput.focus();
                return;
            }

            const selectedOption = event.target.selectedOptions[0];
            this.state.selectedPlaceId = value;
            this.state.isCustomLocationSelected = false;
            this.state.customLocationName = selectedOption ? (selectedOption.getAttribute('data-name') || selectedOption.textContent.trim()) : '';
            customLocationWrapper.classList.add('hidden');
            customLocationInput.value = '';
            stepTwoContainer.classList.remove('hidden');
        });

        if (attachmentsInput) {
            attachmentsInput.addEventListener('change', async (event) => {
                await this.handleAttachmentSelection(event.target.files, attachmentsPreview);
                attachmentsInput.value = '';
            });
        }

        const removeModal = () => {
            modal.remove();
            this.resetFormState();
        };

        modal.querySelector('.modal-close').addEventListener('click', removeModal);
        modal.querySelector('#cancel-observation-btn').addEventListener('click', removeModal);

        const saveBtn = modal.querySelector('#save-observation-btn');
        // حماية من الضغط المتعدد
        saveBtn.addEventListener('click', async () => {
            // منع النقر المتكرر
            if (saveBtn && saveBtn.disabled) {
                Notification.warning('جاري الحفظ... الرجاء الانتظار');
                return;
            }

            // تعطيل الزر لمنع النقر المتكرر
            let originalText = '';
            if (saveBtn) {
                originalText = saveBtn.innerHTML;
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
            }

            try {
                await this.handleSubmit(form, normalizedData?.id || null, modal);
                
                // استعادة الزر بعد النجاح
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
            } catch (error) {
                // استعادة الزر في حالة الخطأ
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
                throw error;
            }
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                removeModal();
            }
        });

        if (normalizedData && normalizedData.siteId) {
            this.loadPlacesForSite(
                normalizedData.siteId,
                placeSelect,
                customLocationWrapper,
                customLocationInput,
                stepTwoContainer,
                normalizedData.placeId,
                normalizedData.locationName
            );
            if (normalizedData.placeId) {
                placeSelect.value = normalizedData.placeId;
                placeSelect.dispatchEvent(new Event('change'));
            } else if (normalizedData.locationName) {
                placeSelect.value = '__custom__';
                customLocationWrapper.classList.remove('hidden');
                customLocationInput.value = normalizedData.locationName;
                this.state.customLocationName = normalizedData.locationName;
                this.state.isCustomLocationSelected = true;
                stepTwoContainer.classList.remove('hidden');
            }
        }
    },

    async handleSubmit(form, editId = null, modal) {
        if (!form) return;

        const siteSelect = form.querySelector('#observation-site');
        const placeSelect = form.querySelector('#observation-place');
        const customLocationInput = form.querySelector('#custom-location-input');
        const typeSelect = form.querySelector('#observation-type');
        const dateInput = form.querySelector('#observation-date');
        const shiftSelect = form.querySelector('#observation-shift');
        const riskSelect = form.querySelector('#observation-risk');
        const responsibleSelect = form.querySelector('#observation-responsible');
        const statusSelect = form.querySelector('#observation-status');
        const ownerSelect = form.querySelector('#observation-owner');
        const expectedDateInput = form.querySelector('#observation-expected-date');
        const detailsInput = form.querySelector('#observation-details');
        const correctiveInput = form.querySelector('#observation-corrective');
        const overdaysInput = form.querySelector('#observation-overdays');
        const timestampInput = form.querySelector('#observation-timestamp');
        const reviewedBySelect = form.querySelector('#observation-reviewed-by');
        const remarksInput = form.querySelector('#observation-remarks');

        const siteId = siteSelect?.value || '';
        if (!siteId) {
            Notification.warning('يرجى اختيار الموقع.');
            return;
        }

        let locationName = '';
        let placeId = '';

        if (!placeSelect) {
            Notification.warning('يرجى اختيار المكان داخل الموقع.');
            return;
        }

        const placeValue = placeSelect.value;
        if (!placeValue) {
            Notification.warning('يرجى اختيار المكان داخل الموقع.');
            return;
        }

        if (placeValue === '__custom__') {
            locationName = (customLocationInput?.value || '').trim();
            if (!locationName) {
                Notification.warning('يرجى إدخال اسم المكان.');
                customLocationInput?.focus();
                return;
            }
            placeId = '';
        } else {
            placeId = placeValue;
            const selectedOption = placeSelect.selectedOptions[0];
            locationName = selectedOption ? (selectedOption.getAttribute('data-name') || selectedOption.textContent.trim()) : '';
        }

        const observationType = typeSelect?.value || '';
        if (!observationType) {
            Notification.warning('يرجى اختيار نوع الملاحظة.');
            return;
        }

        const details = (detailsInput?.value || '').trim();
        if (!details) {
            Notification.warning('يرجى إدخال تفاصيل الملاحظة.');
            return;
        }

        const responsibleDepartment = responsibleSelect?.value || '';
        if (!responsibleDepartment) {
            Notification.warning('يرجى اختيار المسؤول عن التنفيذ.');
            return;
        }

        const riskLevel = riskSelect?.value || '';
        if (!riskLevel) {
            Notification.warning('يرجى اختيار معدل الخطورة.');
            return;
        }

        let status = (statusSelect?.value || '').trim();
        if (!editId) {
            status = 'مفتوح';
        } else if (!status) {
            Notification.warning('يرجى اختيار الحالة.');
            return;
        }

        const dateValue = dateInput?.value || '';
        if (!dateValue) {
            Notification.warning('يرجى تحديد تاريخ الملاحظة ووقتها.');
            return;
        }

        // ✅ إصلاح: استخدام تحويل صحيح لـ datetime-local
        const isoDateString = Utils.dateTimeLocalToISO(dateValue);
        const isoDate = isoDateString ? new Date(isoDateString) : new Date(dateValue);
        if (Number.isNaN(isoDate.getTime())) {
            Notification.warning('تنسيق التاريخ غير صحيح.');
            return;
        }

        const expectedDateValue = expectedDateInput?.value || '';
        let expectedIso = '';
        if (expectedDateValue) {
            const expectedDate = new Date(expectedDateValue);
            if (Number.isNaN(expectedDate.getTime())) {
                Notification.warning('تنسيق التاريخ المتوقع غير صحيح.');
                return;
            }
            expectedIso = new Date(expectedDateValue).toISOString();
        }

        const now = new Date().toISOString();
        const existingRecord = editId
            ? AppState.appData.dailyObservations.find((observation) => observation.id === editId)
            : null;
        const currentUser = AppState.currentUser || {};
        const ownerPick = (ownerSelect?.value || '').trim();
        const observerNameResolved = ownerPick
            || (editId ? String(existingRecord?.observerName || '').trim() : '')
            || this.getLoggedInObserverName()
            || '';
        if (!observerNameResolved) {
            Notification.warning('يرجى تحديد اسم صاحب الملاحظة (من القائمة أو من بيانات حسابك).');
            return;
        }

        // تعديل: نحتفظ بنفس id دون تغيير. جديد: نولّد id ثم نشتق isoCode من أرقامه فقط
        const recordId = editId || generateDailyObservationId(AppState.appData.dailyObservations || []);
        const isoCode = editId
            ? (existingRecord?.isoCode || getObservationIsoCodeFromId(recordId))
            : getObservationIsoCodeFromId(recordId);

        // حساب Overdays (الوقت الحالي - تاريخ تسجيل الملاحظة)
        const observationDate = isoDate;
        const currentDate = new Date();
        const daysDiff = Math.floor((currentDate.getTime() - observationDate.getTime()) / (1000 * 60 * 60 * 24));
        const overdays = daysDiff > 0 ? daysDiff : 0;

        // Timestamp - يتم تعبئته تلقائياً عند إنشاء الملاحظة
        const timestamp = existingRecord?.timestamp || now;

        // Reviewed by و Remarks - فقط للمدير
        const reviewedBy = this.isSystemManager() && reviewedBySelect ? (reviewedBySelect.value || '') : (existingRecord?.reviewedBy || '');
        const remarks = this.isSystemManager() && remarksInput ? (remarksInput.value || '').trim() : (existingRecord?.remarks || '');

        let attachments = (this.state.currentAttachments || []).map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size || this.calculateBase64Size(attachment.data),
            data: attachment.data
        }));

        const payload = {
            id: recordId,
            isoCode,
            siteId,
            siteName: this.lookupSiteName(siteId),
            placeId,
            locationName,
            observationType,
            date: isoDate.toISOString(),
            shift: shiftSelect?.value || '',
            details,
            correctiveAction: (correctiveInput?.value || '').trim(),
            responsibleDepartment,
            riskLevel,
            observerName: observerNameResolved,
            expectedCompletionDate: expectedIso,
            status,
            overdays: overdays,
            timestamp: timestamp,
            reviewedBy: reviewedBy,
            remarks: remarks,
            attachments: attachments,
            createdAt: existingRecord?.createdAt || now,
            updatedAt: now,
            workflowStage: editId ? (existingRecord?.workflowStage || 'pending_specialist') : 'pending_specialist',
            submittedBy: editId ? (existingRecord?.submittedBy || '') : ((currentUser.name || '').trim() || observerNameResolved),
            submittedByEmail: editId ? (existingRecord?.submittedByEmail || '') : ((currentUser.email || '').trim()),
            submittedAt: editId ? (existingRecord?.submittedAt || now) : now,
            specialistReviewedBy: editId ? (existingRecord?.specialistReviewedBy || '') : '',
            specialistReviewedAt: editId ? (existingRecord?.specialistReviewedAt || '') : '',
            specialistComments: editId ? (existingRecord?.specialistComments || '') : '',
            managerApprovedBy: editId ? (existingRecord?.managerApprovedBy || '') : '',
            managerApprovedAt: editId ? (existingRecord?.managerApprovedAt || '') : '',
            managerComments: editId ? (existingRecord?.managerComments || '') : '',
            departmentActionBy: editId ? (existingRecord?.departmentActionBy || '') : '',
            departmentActionAt: editId ? (existingRecord?.departmentActionAt || '') : '',
            rejectionReason: editId ? (existingRecord?.rejectionReason || '') : ''
        };

        // تعطيل زر الحفظ لمنع الضغط المتكرر
        const saveBtn = modal.querySelector('#save-observation-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحفظ...';
        }

        try {
            // 1. حفظ البيانات فوراً في الذاكرة
            const normalizedRecord = this.normalizeRecord(payload);
            if (editId) {
                const index = AppState.appData.dailyObservations.findIndex((observation) => observation.id === editId);
                if (index !== -1) {
                    AppState.appData.dailyObservations[index] = normalizedRecord;
                }
            } else {
                AppState.appData.dailyObservations.push(normalizedRecord);
            }

            // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
            modal.remove();
            this.resetFormState();
            
            // 3. عرض رسالة نجاح فورية
            Notification.success(editId ? 'تم تحديث الملاحظة بنجاح' : 'تم تسجيل الملاحظة بنجاح');
            
            // 4. تحديث القائمة فوراً (مع الحفاظ على الفلتر الحالي إن وجد)
            const currentFilter = this.currentFilter?.filter || null;
            this.loadObservationsList(currentFilter);
            
            // تحديث الكروت التوضيحية والرسوم البيانية إذا كان تبويب التحليل مفتوحاً
            if (this.isCurrentUserAdmin()) {
                const analysisTab = document.getElementById('tab-data-analysis');
                if (analysisTab && analysisTab.style.display !== 'none') {
                    this.calculateCardValues();
                    this.updateAnalysisResults();
                }
            }
            
            // 5. تنفيذ العمليات الثقيلة في الخلفية بدون انتظار
            this.saveInBackground(payload, normalizedRecord, editId).catch(error => {
                Utils.safeError('خطأ في العمليات الخلفية:', error);
                Notification.warning('تم حفظ الملاحظة محلياً، لكن حدث خطأ في المزامنة');
            });

        } catch (error) {
            // إعادة تفعيل زر الحفظ في حالة الخطأ
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'حفظ';
            }
            Utils.safeError('خطأ في حفظ الملاحظة:', error);
            Notification.error('حدث خطأ أثناء حفظ الملاحظة: ' + error.message);
        }
    },

    // دالة جديدة لتنفيذ العمليات الثقيلة في الخلفية
    async saveInBackground(payload, normalizedRecord, editId) {
        try {
            let attachmentsUpdated = false;
            
            // معالجة المرفقات ورفعها إلى Google Drive
            if (payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) {
                Loading.show('جاري رفع المرفقات إلى Google Drive...');
                try {
                    Utils.safeLog('DailyObservations: قبل processAttachments - عدد المرفقات: ' + payload.attachments.length);
                    if (payload.attachments.length > 0) {
                        Utils.safeLog('DailyObservations: أول مرفق قبل المعالجة:', {
                            name: payload.attachments[0].name,
                            hasData: !!payload.attachments[0].data,
                            hasDirectLink: !!payload.attachments[0].directLink
                        });
                    }
                    
                    const processedAttachments = await GoogleIntegration.processAttachments?.(
                        payload.attachments,
                        'DailyObservations'
                    );
                    
                    if (processedAttachments && processedAttachments.length > 0) {
                        // تحديث المرفقات في السجل
                        normalizedRecord.attachments = processedAttachments;
                        const index = AppState.appData.dailyObservations.findIndex((obs) => obs.id === normalizedRecord.id);
                        if (index !== -1) {
                            AppState.appData.dailyObservations[index].attachments = processedAttachments;
                            attachmentsUpdated = true;
                            
                            Utils.safeLog('DailyObservations: تم تحديث المرفقات في السجل - عدد المرفقات: ' + processedAttachments.length);
                            
                            // التحقق من وجود الروابط
                            processedAttachments.forEach((att, i) => {
                                const link = att.directLink || att.shareableLink;
                                Utils.safeLog(`DailyObservations: المرفق ${i + 1}: ${att.name} - رابط: ${link ? link.substring(0, 60) + '...' : 'لا يوجد رابط!'}`);
                            });
                        }
                    }
                    
                    Utils.safeLog('DailyObservations: بعد processAttachments - عدد المرفقات: ' + (processedAttachments?.length || 0));
                } catch (uploadError) {
                    Utils.safeError('خطأ في رفع المرفقات:', uploadError);
                    Notification.warning('فشل رفع بعض المرفقات - سيتم المحاولة لاحقاً');
                } finally {
                    Loading.hide();
                }
            }

            // حفظ البيانات محلياً
            try {
                if (typeof window !== 'undefined' && window.DataManager && typeof window.DataManager.save === 'function') {
                    window.DataManager.save();
                } else if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') {
                    DataManager.save();
                } else {
                    Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات محلياً');
                }
            } catch (saveError) {
                Utils.safeError('خطأ في حفظ البيانات محلياً:', saveError);
            }

            // المزامنة مع Google Sheets
            Loading.show('جاري المزامنة مع السحابة...');
            try {
                await GoogleIntegration.autoSave('DailyObservations', AppState.appData.dailyObservations);

                if (!editId && normalizedRecord?.id) {
                    GoogleIntegration.callBackend('notifyObservationWorkflowEvent', {
                        event: 'new_pending_specialist',
                        observationId: normalizedRecord.id
                    }).catch(function () {});
                }
                
                // إذا تم تحديث المرفقات، نتحقق من الحفظ في Google Sheets
                if (attachmentsUpdated) {
                    Utils.safeLog('DailyObservations: تم حفظ البيانات مع المرفقات المحدثة إلى Google Sheets');
                    Notification.success('تم رفع المرفقات ومزامنتها بنجاح');
                }
            } catch (syncError) {
                Utils.safeError('خطأ في المزامنة:', syncError);
                Notification.warning('فشلت المزامنة مع Google Sheets - سيتم المحاولة لاحقاً');
            } finally {
                Loading.hide();
            }

            // إرسال الإشعارات
            if (!editId && AppState.notificationEmails && AppState.notificationEmails.length > 0) {
                try {
                    this.sendEmailNotifications({
                        type: 'ملاحظة يومية',
                        title: `تم تسجيل ملاحظة جديدة: ${normalizedRecord.observationType}`,
                        message: `الموقع: ${normalizedRecord.siteName}\nالمكان: ${normalizedRecord.locationName}\nالنوع: ${normalizedRecord.observationType}\nالخطورة: ${normalizedRecord.riskLevel}\nالتفاصيل: ${normalizedRecord.details?.substring(0, 120)}...`,
                        date: Utils.formatDateTime(normalizedRecord.date)
                    });
                } catch (emailError) {
                    Utils.safeError('خطأ في إرسال الإشعارات:', emailError);
                }
            }

        } catch (error) {
            Utils.safeError('خطأ في العمليات الخلفية:', error);
            throw error;
        }
    },

    async viewObservation(id) {
        // ✅ فتح النموذج فوراً بالبيانات المحلية (لا انتظار)
        const observationRaw = AppState.appData.dailyObservations.find((o) => o.id === id);
        if (!observationRaw) {
            Notification.error('الملاحظة غير موجودة');
            return;
        }
        if (typeof this.isDailyObservationVisibleToCurrentUser === 'function' && !this.isDailyObservationVisibleToCurrentUser(observationRaw)) {
            Notification.error('لا صلاحية لعرض هذه الملاحظة');
            return;
        }

        const observation = this.normalizeRecord(observationRaw);
        
        // ✅ تسجيل للتتبع
        Utils.safeLog('📎 viewObservation: عدد المرفقات المحلية = ' + (observation.attachments?.length || 0));
        Utils.safeLog('📎 viewObservation: عدد صور بعد التنفيذ = ' + (observation.afterExecutionImages?.length || 0));

        // ✅ فتح النموذج أولاً (فوري) باستخدام البيانات المحلية
        const modal = this.createObservationModal(observation);
        document.body.appendChild(modal);
        this.attachWorkflowPanelListeners(modal);

        // ✅ تحديث البيانات من Backend في الخلفية (بدون انتظار)
        this.updateObservationDataFromBackend(id, modal).catch(error => {
            Utils.safeWarn('خطأ في تحديث تفاصيل الملاحظة من Backend:', error);
        });
    },

    /**
     * ✅ إنشاء نموذج عرض الملاحظة (دالة منفصلة للاستخدام الفوري)
     */
    createObservationModal(observation) {
        // تحليل السجل الزمني والتحديثات والتعليقات
        let timeLog = [];
        let updates = [];
        let comments = [];

        try {
            if (observation.timeLog) {
                timeLog = typeof observation.timeLog === 'string' ? JSON.parse(observation.timeLog) : observation.timeLog;
            }
        } catch (e) {
            timeLog = [];
        }

        try {
            if (observation.updates) {
                updates = typeof observation.updates === 'string' ? JSON.parse(observation.updates) : observation.updates;
            }
        } catch (e) {
            updates = [];
        }

        try {
            if (observation.comments) {
                comments = typeof observation.comments === 'string' ? JSON.parse(observation.comments) : observation.comments;
            }
        } catch (e) {
            comments = [];
        }

        const wfPathHtml = this.buildWorkflowPathHtml(observation);
        const wfBannerHtml = this.buildWorkflowBannerHtml(observation);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.setAttribute('data-observation-id', observation.id);
        modal.setAttribute('dir', 'rtl');
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; border-radius: 20px 20px 0 0;">
                    <h2 class="modal-title" style="color: white; font-size: 24px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: 'Cairo', sans-serif;">
                        <i class="fas fa-clipboard-check" style="font-size: 28px;"></i>
                        تفاصيل الملاحظة
                    </h2>
                    <button class="modal-close" aria-label="إغلاق" style="color: white; font-size: 24px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 30px; background: #f8f9fa; max-height: calc(90vh - 200px); overflow-y: auto; direction: rtl; text-align: right;">
                    <div class="space-y-5">
                        <div class="obs-detail-inline-alerts" data-obs-inline-alerts="" role="region" aria-label="تنبيهات الملاحظة"></div>
                        ${wfPathHtml}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">رقم الملاحظة:</strong>
                                <span class="text-gray-900">${Utils.escapeHTML(observation.isoCode || '-')}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">التاريخ والوقت:</strong>
                                <span class="text-gray-900">${observation.date ? Utils.formatDateTime(observation.date) : '-'}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">الموقع:</strong>
                                <span class="text-gray-900">${Utils.escapeHTML(observation.siteName || '-')}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">المكان:</strong>
                                <span class="text-gray-900">${Utils.escapeHTML(observation.locationName || '-')}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">نوع الملاحظة:</strong>
                                ${this.canEditObservationFieldsInDetail(observation) ? `
                                <select id="observation-type-select" class="form-input" style="width: 100%; margin-top: 4px;" onchange="DailyObservations.handleFieldChange('${observation.id}', 'observationType', this.value, this)">
                                    <option value="">-- اختر النوع --</option>
                                    ${this.getObservationTypes().map(type => `<option value="${type}" ${observation.observationType === type ? 'selected' : ''}>${type}</option>`).join('')}
                                </select>
                                ` : `<span class="text-gray-900">${Utils.escapeHTML(observation.observationType || '-')}</span>`}
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">الوردية:</strong>
                                <span class="text-gray-900">${Utils.escapeHTML(observation.shift || '-')}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">معدل الخطورة:</strong>
                                ${this.canEditObservationFieldsInDetail(observation) ? `
                                <select id="observation-risk-select" class="form-input" style="width: 100%; margin-top: 4px;" onchange="DailyObservations.handleFieldChange('${observation.id}', 'riskLevel', this.value, this)">
                                    <option value="">-- اختر المعدل --</option>
                                    ${this.getRiskLevels().map(level => `<option value="${level}" ${observation.riskLevel === level ? 'selected' : ''}>${level}</option>`).join('')}
                                </select>
                                ` : `<span class="text-gray-900">${Utils.escapeHTML(observation.riskLevel || '-')}</span>`}
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">الحالة التشغيلية:</strong>
                                <div class="flex items-center gap-2 mt-2">
                                    ${this.canEditObservationStatusInDetail(observation) ? `
                                    <select id="observation-status-select" class="form-input" style="flex: 1; min-width: 150px;" onchange="DailyObservations.handleStatusChange('${observation.id}', this.value)">
                                        ${this.STATUS_OPTIONS.map(s => `<option value="${s}" ${observation.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                                    </select>
                                    ` : `<span class="text-gray-900">${Utils.escapeHTML(observation.status || '-')}</span>`}
                                <span class="badge badge-${this.getStatusBadgeClass(observation.status)}">${Utils.escapeHTML(observation.status || '-')}</span>
                                </div>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">المسؤول عن التنفيذ:</strong>
                                ${this.canEditObservationFieldsInDetail(observation) ? `
                                <select id="observation-responsible-select" class="form-input" style="width: 100%; margin-top: 4px;" onchange="DailyObservations.handleFieldChange('${observation.id}', 'responsibleDepartment', this.value, this)">
                                    <option value="">-- اختر المسؤول --</option>
                                    ${this.getDepartments().map(dept => `<option value="${dept}" ${observation.responsibleDepartment === dept ? 'selected' : ''}>${dept}</option>`).join('')}
                                </select>
                                ` : `<span class="text-gray-900">${Utils.escapeHTML(observation.responsibleDepartment || '-')}</span>`}
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">مسؤول المتابعة المعيّن:</strong>
                                <span class="text-gray-900">${observation.assignedToName || observation.assignedToEmail ? Utils.escapeHTML(this.formatAssigneePublicDisplay(observation)) : '-'}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">صاحب الملاحظة:</strong>
                                <span class="text-gray-900">${Utils.escapeHTML(observation.observerName || '-')}</span>
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">التاريخ المتوقع للتنفيذ:</strong>
                                ${this.canEditObservationFieldsInDetail(observation) ? `
                                <input type="date" id="observation-expected-date-input" class="form-input" style="width: 100%; margin-top: 4px;" value="${observation.expectedCompletionDate ? observation.expectedCompletionDate.split('T')[0] : ''}" onchange="DailyObservations.handleFieldChange('${observation.id}', 'expectedCompletionDate', this.value, this)" />
                                ` : `<span class="text-gray-900">${observation.expectedCompletionDate ? Utils.formatDate(observation.expectedCompletionDate) : '-'}</span>`}
                            </div>
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">Overdays:</strong>
                                <span class="text-gray-900">${observation.overdays !== undefined ? `${observation.overdays} يوم` : '-'}</span>
                            </div>
                            ${observation.reviewedBy ? `
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <strong class="text-gray-700 block mb-1">Reviewed by:</strong>
                                <span class="text-gray-900">${Utils.escapeHTML(observation.reviewedBy)}</span>
                            </div>
                            ` : ''}
                        </div>

                        <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                            <strong class="text-gray-700 block mb-3 text-lg">تفاصيل الملاحظة:</strong>
                            ${this.canEditObservationFieldsInDetail(observation) ? `
                            <textarea id="observation-details-textarea" class="form-input" style="width: 100%; min-height: 120px; margin-top: 8px; font-family: 'Cairo', sans-serif;" onchange="DailyObservations.handleFieldChange('${observation.id}', 'details', this.value, this)">${Utils.escapeHTML(observation.details || '')}</textarea>
                            ` : `<p class="mt-2 leading-7 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap text-gray-800">${Utils.escapeHTML(observation.details || '')}</p>`}
                        </div>

                        <div class="bg-white p-5 rounded-lg border border-blue-200 shadow-sm">
                            <strong class="text-blue-700 block mb-3 text-lg">الإجراء التصحيحي / الوقائي:</strong>
                            ${this.canEditObservationFieldsInDetail(observation) ? `
                            <textarea id="observation-corrective-textarea" class="form-input" style="width: 100%; min-height: 120px; margin-top: 8px; font-family: 'Cairo', sans-serif;" onchange="DailyObservations.handleFieldChange('${observation.id}', 'correctiveAction', this.value, this)">${Utils.escapeHTML(observation.correctiveAction || '')}</textarea>
                            ` : `<p class="mt-2 leading-7 bg-blue-50 border border-blue-200 rounded-lg p-4 whitespace-pre-wrap text-gray-800">${observation.correctiveAction ? Utils.escapeHTML(observation.correctiveAction) : '<span class="text-gray-400 italic">لا يوجد إجراء تصحيحي مسجل</span>'}</p>`}
                        </div>

                        ${observation.remarks ? `
                        <div class="bg-white p-5 rounded-lg border border-yellow-200 shadow-sm">
                            <strong class="text-yellow-700 block mb-3 text-lg">Remarks (مدير النظام):</strong>
                            <p class="mt-2 leading-7 bg-yellow-50 border border-yellow-200 rounded-lg p-4 whitespace-pre-wrap text-gray-800">${Utils.escapeHTML(observation.remarks)}</p>
                        </div>
                        ` : ''}

                        ${Array.isArray(observation.attachments) && observation.attachments.length > 0 ? `
                        <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                            <strong class="text-gray-700 block mb-3 text-lg">المرفقات:</strong>
                            <div data-section="attachments" class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                ${observation.attachments.map((attachment) => {
            const isImage = (attachment.type || '').startsWith('image/');
            const name = Utils.escapeHTML(attachment.name || 'مرفق');
            if (isImage) {
                return `
                                            <div class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <img src="${attachment.data}" alt="${name}" class="w-full h-48 object-cover cursor-pointer" onclick="window.open('${attachment.data}', '_blank')">
                                                <div class="px-3 py-2 bg-gray-50 text-xs text-gray-700">${name}</div>
                                            </div>
                                        `;
            }
            return `
                                        <div class="border rounded-lg p-3 bg-gray-50 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
                                            <i class="fas fa-file-pdf text-2xl text-red-500"></i>
                                            <div class="flex-1">
                                                <p class="text-sm font-semibold text-gray-800">${name}</p>
                                                <button type="button" class="btn-secondary btn-xs mt-2" onclick="window.open('${attachment.data}', '_blank')">
                                                    <i class="fas fa-eye ml-1"></i>عرض
                                                </button>
                                            </div>
                                        </div>
                                    `;
        }).join('')}
                            </div>
                        </div>
                        ` : ''}

                        <!-- ✅ قسم صور بعد التنفيذ (إضافة جديدة) -->
                        ${(this._isSafetyManager() || this._isSafetyOfficer() || this.canShowAssignResponsiblePanel(observation)) ? `
                        <div class="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-xl border-2 border-emerald-300 shadow-md">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold text-emerald-800" style="font-family: 'Cairo', sans-serif;">
                                    <i class="fas fa-camera ml-2 text-emerald-600"></i>
                                    صور بعد التنفيذ
                                </h3>
                                <span class="text-xs text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full" style="font-family: 'Cairo', sans-serif;">
                                    <i class="fas fa-shield-alt ml-1"></i>
                                    متاح لمسؤول الإدارة/أخصائي السلامة/مدير السلامة
                                </span>
                            </div>

                            <div id="after-execution-photos-container-${observation.id}" class="mb-4">
                                ${this._buildAfterExecutionPhotosHtml(observation.afterExecutionImages)}
                            </div>

                            <div class="border-t-2 border-emerald-200 pt-4">
                                <label class="block text-sm font-medium text-emerald-800 mb-2" style="font-family: 'Cairo', sans-serif;">
                                    <i class="fas fa-upload ml-1"></i>
                                    رفع صورة جديدة بعد التنفيذ
                                </label>
                                <!-- معاينة الصورة -->
                                <div id="after-execution-preview-container-${observation.id}" class="mb-3" style="display: none;">
                                    <div class="relative inline-block">
                                        <img id="after-execution-preview-${observation.id}" class="max-w-full h-48 object-contain rounded-lg border-2 border-emerald-300 shadow-sm" style="display: none;" />
                                        <button type="button" class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600" onclick="document.getElementById('after-execution-preview-container-${observation.id}').style.display='none'">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                                <!-- حقل رفع الملف - رفع تلقائي عند الاختيار -->
                                <input type="file"
                                       id="after-execution-photo-input-${observation.id}"
                                       accept="image/*"
                                       capture="environment"
                                       class="form-input w-full"
                                       style="font-family: 'Cairo', sans-serif;"
                                       onchange="DailyObservations.handleAfterExecutionPhotoUpload('${observation.id}', this)" />
                                <p class="text-xs text-emerald-600 mt-2" style="font-family: 'Cairo', sans-serif;">
                                    <i class="fas fa-info-circle ml-1"></i>
                                    سيتم حفظ الصورة تلقائياً مع تاريخ ووقت الرفع واسم المستخدم
                                </p>
                            </div>
                        </div>
                        ` : ''}

                        <!-- التحديثات -->
                        <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold"><i class="fas fa-sync-alt ml-2"></i>التحديثات (${updates.length})</h3>
                                <button class="btn-primary btn-sm" onclick="DailyObservations.showAddUpdateModal('${observation.id}')">
                                    <i class="fas fa-plus ml-1"></i>إضافة تحديث
                                </button>
                            </div>
                            ${updates.length > 0 ? `
                                <div class="space-y-3">
                                    ${updates.map(update => `
                                        <div class="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                                            <div class="flex items-center justify-between">
                                                <span class="text-sm font-semibold">${Utils.escapeHTML(update.user || '')}</span>
                                                <span class="text-xs text-gray-500">${update.timestamp ? Utils.formatDate(update.timestamp) : ''}</span>
                                            </div>
                                            <p class="text-sm text-gray-700 mt-1">${Utils.escapeHTML(update.update || '')}</p>
                                            ${update.progress !== undefined ? `
                                                <div class="mt-2">
                                                    <div class="flex items-center justify-between text-xs mb-1">
                                                        <span>التقدم</span>
                                                        <span>${update.progress}%</span>
                                                    </div>
                                                    <div class="w-full bg-gray-200 rounded-full h-2">
                                                        <div class="bg-blue-500 h-2 rounded-full" style="width: ${update.progress}%"></div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<p class="text-gray-500 text-sm">لا توجد تحديثات</p>'}
                        </div>
                        
                        <!-- التعليقات -->
                        <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-lg font-semibold"><i class="fas fa-comments ml-2"></i>التعليقات (${comments.length})</h3>
                                <button class="btn-primary btn-sm" onclick="DailyObservations.showAddCommentModal('${observation.id}')">
                                    <i class="fas fa-plus ml-1"></i>إضافة تعليق
                                </button>
                            </div>
                            ${comments.length > 0 ? `
                                <div class="space-y-3">
                                    ${comments.map(comment => `
                                        <div class="border-l-4 border-green-500 pl-4 py-2 bg-gray-50 rounded">
                                            <div class="flex items-center justify-between">
                                                <span class="text-sm font-semibold">${Utils.escapeHTML(comment.user || '')}</span>
                                                <span class="text-xs text-gray-500">${comment.timestamp ? Utils.formatDate(comment.timestamp) : ''}</span>
                                            </div>
                                            <p class="text-sm text-gray-700 mt-1">${Utils.escapeHTML(comment.comment || '')}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '<p class="text-gray-500 text-sm">لا توجد تعليقات</p>'}
                        </div>
                        
                        <!-- السجل الزمني -->
                        <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                            <h3 class="text-lg font-semibold mb-4"><i class="fas fa-history ml-2"></i>السجل الزمني</h3>
                            ${this.buildObservationTimelineHtml(timeLog)}
                        </div>
                        ${wfBannerHtml}
                    </div>
                </div>
                <div class="modal-footer form-actions-centered" style="padding: 20px 30px; background: #f8f9fa; border-top: 1px solid #e5e7eb; border-radius: 0 0 20px 20px;">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="margin: 0 5px;">
                        <i class="fas fa-times ml-2"></i>إغلاق
                    </button>
                    <button type="button" onclick="DailyObservations.exportPDF('${observation.id}');" class="btn-secondary" style="margin: 0 5px;">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    ${this.canDailyObservationsFullAdminUi() ? `
                    <button type="button" onclick="DailyObservations.openEditFromDetailModal('${observation.id}')" class="btn-primary" style="margin: 0 5px;">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                    <button type="button" onclick="DailyObservations.deleteObservation('${observation.id}'); this.closest('.modal-overlay').remove();" class="btn-secondary" style="background-color: #dc3545; color: white; border-color: #dc3545; margin: 0 5px;">
                        <i class="fas fa-trash ml-2"></i>حذف
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        return modal;
    },

    /**
     * ✅ تحديث بيانات الملاحظة من Backend في الخلفية
     */
    async updateObservationDataFromBackend(observationId, modal) {
        try {
            const ctx = typeof this.buildObservationsRequestContext === 'function' ? this.buildObservationsRequestContext() : null;
            const response = await GoogleIntegration.callBackend('getObservation', {
                observationId: observationId,
                observationsRequestContext: ctx
            });
            if (response.success && response.data) {
                const index = AppState.appData.dailyObservations.findIndex(o => o.id === observationId);
                if (index !== -1) {
                    AppState.appData.dailyObservations[index] = response.data;
                } else {
                    AppState.appData.dailyObservations.push(response.data);
                }

                // ✅ تسجيل للتتبع
                const updatedObs = this.normalizeRecord(response.data);
                Utils.safeLog('📎 updateObservationDataFromBackend: عدد المرفقات من Backend = ' + (updatedObs.attachments?.length || 0));
                Utils.safeLog('📎 updateObservationDataFromBackend: عدد صور بعد التنفيذ = ' + (updatedObs.afterExecutionImages?.length || 0));

                // ✅ تحديث النموذج إذا كان مفتوحاً - بدون استبدال لتجنب الوميض
                if (modal && modal.getAttribute('data-observation-id') === observationId) {
                    // تحديث المحتوى فقط دون استبدال المودال
                    this.updateObservationModalContent(modal, updatedObs);
                }
            } else if (response && !response.success && response.message) {
                this.showObservationDetailInlineAlert(observationId, 'warning', response.message);
            }
        } catch (error) {
            Utils.safeWarn('خطأ في تحديث تفاصيل الملاحظة من Backend:', error);
            const errMsg = (error && error.message) ? error.message : String(error);
            this.showObservationDetailInlineAlert(observationId, 'error', errMsg);
        }
    },

    /**
     * ✅ تحديث محتوى المودال بدون استبدال (لتجنب الوميض)
     */
    updateObservationModalContent(modal, observation) {
        try {
            // تحديث الحقول الفردية فقط
            const updateField = (selector, value) => {
                const el = modal.querySelector(selector);
                if (el && value !== undefined && value !== null) {
                    el.textContent = String(value);
                }
            };

            // تحديث القيم الأساسية
            updateField('[data-field="isoCode"]', observation.isoCode);
            updateField('[data-field="siteName"]', observation.siteName);
            updateField('[data-field="locationName"]', observation.locationName);
            updateField('[data-field="observationType"]', observation.observationType);
            updateField('[data-field="shift"]', observation.shift);
            updateField('[data-field="riskLevel"]', observation.riskLevel);
            updateField('[data-field="status"]', observation.status);
            updateField('[data-field="responsibleDepartment"]', observation.responsibleDepartment);
            updateField('[data-field="observerName"]', observation.observerName);
            updateField('[data-field="expectedCompletionDate"]', observation.expectedCompletionDate ? Utils.formatDate(observation.expectedCompletionDate) : '-');
            updateField('[data-field="overdays"]', observation.overdays !== undefined ? `${observation.overdays} يوم` : '-');
            updateField('[data-field="details"]', observation.details);
            updateField('[data-field="correctiveAction"]', observation.correctiveAction);

            // ✅ تحديث المرفقات إذا وجدت
            const attachmentsSection = modal.querySelector('[data-section="attachments"]');
            const attachmentsParent = attachmentsSection ? attachmentsSection.parentElement : null;
            
            Utils.safeLog('📎 updateObservationModalContent: عدد المرفقات = ' + (observation.attachments?.length || 0));
            Utils.safeLog('📎 updateObservationModalContent: attachmentsSection موجود = ' + !!attachmentsSection);
            
            if (Array.isArray(observation.attachments) && observation.attachments.length > 0) {
                if (attachmentsSection) {
                    // تحديث المرفقات الموجودة
                    attachmentsSection.innerHTML = `
                            <strong class="text-gray-700 block mb-3 text-lg">المرفقات:</strong>
                            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                ${observation.attachments.map((attachment) => {
                                    const isImage = (attachment.type || '').startsWith('image/');
                                    const name = Utils.escapeHTML(attachment.name || 'مرفق');
                                    if (isImage) {
                                        return `
                                            <div class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <img src="${attachment.data}" alt="${name}" class="w-full h-48 object-cover cursor-pointer" onclick="window.open('${attachment.data}', '_blank')">
                                                <div class="px-3 py-2 bg-gray-50 text-xs text-gray-700">${name}</div>
                                            </div>
                                        `;
                                    }
                                    return `
                                        <div class="border rounded-lg p-3 bg-gray-50 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
                                            <i class="fas fa-file-pdf text-2xl text-red-500"></i>
                                            <div class="flex-1">
                                                <p class="text-sm font-semibold text-gray-800">${name}</p>
                                                <button type="button" class="btn-secondary btn-xs mt-2" onclick="window.open('${attachment.data}', '_blank')">
                                                    <i class="fas fa-eye ml-1"></i>عرض
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    Utils.safeLog('✅ updateObservationModalContent: تم تحديث المرفقات بنجاح');
                }
            } else if (attachmentsParent) {
                // إزالة قسم المرفقات إذا لم تكن هناك مرفقات
                Utils.safeLog('ℹ️ updateObservationModalContent: لا توجد مرفقات، إزالة القسم');
                attachmentsParent.remove();
            }

            // تحديث صور بعد التنفيذ إذا وجدت
            if (observation.afterExecutionImages && Array.isArray(observation.afterExecutionImages)) {
                const photosContainer = modal.querySelector(`#after-execution-photos-container-${observation.id}`);
                if (photosContainer) {
                    photosContainer.innerHTML = this._buildAfterExecutionPhotosHtml(observation.afterExecutionImages);
                }
            }

            // تحديث التحديثات والتعليقات
            this.updateModalSection(modal, 'updates', observation.updates);
            this.updateModalSection(modal, 'comments', observation.comments);
            this.updateModalSection(modal, 'timeLog', observation.timeLog);
        } catch (error) {
            Utils.safeWarn('خطأ في updateObservationModalContent:', error);
        }
    },

    /**
     * ✅ تحديث قسم في المودال
     */
    updateModalSection(modal, sectionName, data) {
        // يمكن توسيع هذه الدالة لتحديث أقسام محددة
        // حالياً نتركها كمكان للتوسع المستقبلي
    },

    async handleStatusChange(observationId, newStatus) {
        Loading.show();
        try {
            const result = await GoogleIntegration.callBackend('updateObservationStatus', {
                observationId: observationId,
                statusData: {
                    status: newStatus,
                    updatedBy: AppState.currentUser?.name || 'System'
                }
            });

            if (result.success) {
                // تحديث البيانات في AppState
                const index = AppState.appData.dailyObservations.findIndex(o => o.id === observationId);
                if (index !== -1) {
                    AppState.appData.dailyObservations[index].status = newStatus;
                }
                
                // حفظ البيانات
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                Notification.success('تم تحديث الحالة بنجاح');
                // إعادة فتح النافذة لإظهار التحديثات
                await this.viewObservation(observationId);
            } else {
                const errMsg = result.message || 'حدث خطأ';
                if (!this.showObservationDetailInlineAlert(observationId, 'error', errMsg)) {
                    Notification.error(errMsg);
                }
            }
        } catch (error) {
            const errMsg = 'حدث خطأ: ' + (error.message || error);
            if (!this.showObservationDetailInlineAlert(observationId, 'error', errMsg)) {
                Notification.error(errMsg);
            }
        } finally {
            Loading.hide();
        }
    },

    /**
     * تحديث قسم التحديثات في الواجهة مباشرة
     */
    refreshUpdatesSection(observationId) {
        try {
            // البحث عن modal الملاحظة (الذي يحتوي على "تفاصيل الملاحظة")
            const allModals = document.querySelectorAll('.modal-overlay');
            let observationModal = null;
            
            for (const modal of allModals) {
                const title = modal.querySelector('.modal-title');
                if (title && title.textContent.includes('تفاصيل الملاحظة')) {
                    observationModal = modal;
                    break;
                }
            }
            
            if (!observationModal) return;

            // البحث عن قسم التحديثات - البحث عن جميع الأقسام مع class bg-white p-5
            const allSections = observationModal.querySelectorAll('.bg-white.p-5');
            let updatesSection = null;
            
            for (const section of allSections) {
                const heading = section.querySelector('h3');
                if (heading && heading.textContent.includes('التحديثات')) {
                    updatesSection = section;
                    break;
                }
            }

            if (!updatesSection) return;

            // الحصول على الملاحظة من AppState
            const observation = AppState.appData.dailyObservations.find(o => o.id === observationId);
            if (!observation) return;

            // تحليل التحديثات
            let updates = [];
            try {
                if (observation.updates) {
                    updates = Array.isArray(observation.updates) ? observation.updates : 
                             (typeof observation.updates === 'string' ? JSON.parse(observation.updates) : []);
                }
            } catch (e) {
                updates = [];
            }

            // تحديث العنوان
            const heading = updatesSection.querySelector('h3');
            if (heading) {
                heading.innerHTML = `<i class="fas fa-sync-alt ml-2"></i>التحديثات (${updates.length})`;
            }

            // البحث عن container التحديثات
            let updatesContainer = updatesSection.querySelector('.space-y-3');
            if (!updatesContainer) {
                updatesContainer = updatesSection.querySelector('p.text-gray-500');
            }

            if (updates.length > 0) {
                const updatesHTML = `
                    <div class="space-y-3">
                        ${updates.map(update => `
                            <div class="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-semibold">${Utils.escapeHTML(update.user || '')}</span>
                                    <span class="text-xs text-gray-500">${update.timestamp ? Utils.formatDate(update.timestamp) : ''}</span>
                                </div>
                                <p class="text-sm text-gray-700 mt-1">${Utils.escapeHTML(update.update || '')}</p>
                                ${update.progress !== undefined ? `
                                    <div class="mt-2">
                                        <div class="flex items-center justify-between text-xs mb-1">
                                            <span>التقدم</span>
                                            <span>${update.progress}%</span>
                                        </div>
                                        <div class="w-full bg-gray-200 rounded-full h-2">
                                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${update.progress}%"></div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;

                if (updatesContainer) {
                    if (updatesContainer.tagName === 'P') {
                        updatesContainer.outerHTML = updatesHTML;
                    } else {
                        updatesContainer.innerHTML = updatesHTML;
                    }
                } else {
                    // إضافة container جديد بعد العنوان
                    const headingDiv = heading?.closest('.flex.items-center.justify-between') || heading?.parentElement;
                    if (headingDiv) {
                        const container = document.createElement('div');
                        container.innerHTML = updatesHTML;
                        headingDiv.insertAdjacentElement('afterend', container);
                    }
                }
            } else {
                if (updatesContainer) {
                    if (updatesContainer.tagName === 'P') {
                        updatesContainer.textContent = 'لا توجد تحديثات';
                        updatesContainer.className = 'text-gray-500 text-sm';
                    } else {
                        updatesContainer.innerHTML = '<p class="text-gray-500 text-sm">لا توجد تحديثات</p>';
                    }
                } else {
                    // إضافة رسالة "لا توجد تحديثات"
                    const headingDiv = heading?.closest('.flex.items-center.justify-between') || heading?.parentElement;
                    if (headingDiv) {
                        const emptyMsg = document.createElement('p');
                        emptyMsg.className = 'text-gray-500 text-sm';
                        emptyMsg.textContent = 'لا توجد تحديثات';
                        headingDiv.insertAdjacentElement('afterend', emptyMsg);
                    }
                }
            }
        } catch (error) {
            Utils.safeError('خطأ في تحديث قسم التحديثات:', error);
        }
    },

    /**
     * تحديث قسم التعليقات في الواجهة مباشرة
     */
    refreshCommentsSection(observationId) {
        try {
            // البحث عن modal الملاحظة (الذي يحتوي على "تفاصيل الملاحظة")
            const allModals = document.querySelectorAll('.modal-overlay');
            let observationModal = null;
            
            for (const modal of allModals) {
                const title = modal.querySelector('.modal-title');
                if (title && title.textContent.includes('تفاصيل الملاحظة')) {
                    observationModal = modal;
                    break;
                }
            }
            
            if (!observationModal) return;

            // البحث عن قسم التعليقات - البحث عن جميع الأقسام مع class bg-white p-5
            const allSections = observationModal.querySelectorAll('.bg-white.p-5');
            let commentsSection = null;
            
            for (const section of allSections) {
                const heading = section.querySelector('h3');
                if (heading && heading.textContent.includes('التعليقات')) {
                    commentsSection = section;
                    break;
                }
            }

            if (!commentsSection) return;

            // الحصول على الملاحظة من AppState
            const observation = AppState.appData.dailyObservations.find(o => o.id === observationId);
            if (!observation) return;

            // تحليل التعليقات
            let comments = [];
            try {
                if (observation.comments) {
                    comments = Array.isArray(observation.comments) ? observation.comments : 
                              (typeof observation.comments === 'string' ? JSON.parse(observation.comments) : []);
                }
            } catch (e) {
                comments = [];
            }

            // تحديث العنوان
            const heading = commentsSection.querySelector('h3');
            if (heading) {
                heading.innerHTML = `<i class="fas fa-comments ml-2"></i>التعليقات (${comments.length})`;
            }

            // البحث عن container التعليقات
            let commentsContainer = commentsSection.querySelector('.space-y-3');
            if (!commentsContainer) {
                commentsContainer = commentsSection.querySelector('p.text-gray-500');
            }

            if (comments.length > 0) {
                const commentsHTML = `
                    <div class="space-y-3">
                        ${comments.map(comment => `
                            <div class="border-l-4 border-green-500 pl-4 py-2 bg-gray-50 rounded">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-semibold">${Utils.escapeHTML(comment.user || '')}</span>
                                    <span class="text-xs text-gray-500">${comment.timestamp ? Utils.formatDate(comment.timestamp) : ''}</span>
                                </div>
                                <p class="text-sm text-gray-700 mt-1">${Utils.escapeHTML(comment.comment || '')}</p>
                            </div>
                        `).join('')}
                    </div>
                `;

                if (commentsContainer) {
                    if (commentsContainer.tagName === 'P') {
                        commentsContainer.outerHTML = commentsHTML;
                    } else {
                        commentsContainer.innerHTML = commentsHTML;
                    }
                } else {
                    // إضافة container جديد بعد العنوان
                    const headingDiv = heading?.closest('.flex.items-center.justify-between') || heading?.parentElement;
                    if (headingDiv) {
                        const container = document.createElement('div');
                        container.innerHTML = commentsHTML;
                        headingDiv.insertAdjacentElement('afterend', container);
                    }
                }
            } else {
                if (commentsContainer) {
                    if (commentsContainer.tagName === 'P') {
                        commentsContainer.textContent = 'لا توجد تعليقات';
                        commentsContainer.className = 'text-gray-500 text-sm';
                    } else {
                        commentsContainer.innerHTML = '<p class="text-gray-500 text-sm">لا توجد تعليقات</p>';
                    }
                } else {
                    // إضافة رسالة "لا توجد تعليقات"
                    const headingDiv = heading?.closest('.flex.items-center.justify-between') || heading?.parentElement;
                    if (headingDiv) {
                        const emptyMsg = document.createElement('p');
                        emptyMsg.className = 'text-gray-500 text-sm';
                        emptyMsg.textContent = 'لا توجد تعليقات';
                        headingDiv.insertAdjacentElement('afterend', emptyMsg);
                    }
                }
            }
        } catch (error) {
            Utils.safeError('خطأ في تحديث قسم التعليقات:', error);
        }
    },

    /**
     * تحديث قسم السجل الزمني في الواجهة مباشرة
     */
    refreshTimeLogSection(observationId) {
        try {
            // البحث عن modal الملاحظة (الذي يحتوي على "تفاصيل الملاحظة")
            const allModals = document.querySelectorAll('.modal-overlay');
            let observationModal = null;
            
            for (const modal of allModals) {
                const title = modal.querySelector('.modal-title');
                if (title && title.textContent.includes('تفاصيل الملاحظة')) {
                    observationModal = modal;
                    break;
                }
            }
            
            if (!observationModal) return;

            // البحث عن قسم السجل الزمني - البحث عن جميع الأقسام مع class bg-white p-5
            const allSections = observationModal.querySelectorAll('.bg-white.p-5');
            let timeLogSection = null;
            
            for (const section of allSections) {
                const heading = section.querySelector('h3');
                if (heading && heading.textContent.includes('السجل الزمني')) {
                    timeLogSection = section;
                    break;
                }
            }

            if (!timeLogSection) return;

            // الحصول على الملاحظة من AppState
            const observation = AppState.appData.dailyObservations.find(o => o.id === observationId);
            if (!observation) return;

            const timeLogHTML = this.buildObservationTimelineHtml(observation.timeLog);
            const heading = timeLogSection.querySelector('h3');
            const afterHeading = heading ? heading.nextElementSibling : null;
            if (afterHeading) {
                afterHeading.outerHTML = timeLogHTML;
            } else if (heading) {
                heading.insertAdjacentHTML('afterend', timeLogHTML);
            }
        } catch (error) {
            Utils.safeError('خطأ في تحديث قسم السجل الزمني:', error);
        }
    },

    async showAddUpdateModal(observationId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">إضافة تحديث</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="update-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">التحديث *</label>
                            <textarea id="update-text" required class="form-input" rows="4" placeholder="اكتب التحديث..."></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">نسبة التقدم (%)</label>
                            <input type="number" id="update-progress" class="form-input" min="0" max="100" value="0">
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>إضافة التحديث
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#update-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updateText = modal.querySelector('#update-text').value.trim();
            const progress = parseInt(modal.querySelector('#update-progress').value) || 0;

            if (!updateText) {
                Notification.error('يرجى إدخال التحديث');
                return;
            }

            // إغلاق النافذة فوراً
            modal.remove();

            // الحصول على الملاحظة
            const observationIndex = AppState.appData.dailyObservations.findIndex(o => o.id === observationId);
            if (observationIndex === -1) {
                Notification.error('الملاحظة غير موجودة');
                return;
            }

            const observation = AppState.appData.dailyObservations[observationIndex];
            
            // إنشاء التحديث الجديد
            const newUpdate = {
                id: 'UPD-' + Date.now().toString(),
                user: AppState.currentUser?.name || 'System',
                update: updateText,
                progress: progress,
                timestamp: new Date().toISOString()
            };

            // تحليل التحديثات الحالية
            let updates = [];
            try {
                if (observation.updates) {
                    updates = typeof observation.updates === 'string' ? JSON.parse(observation.updates) : observation.updates;
                }
            } catch (e) {
                updates = [];
            }

            // إضافة التحديث الجديد
            updates.push(newUpdate);
            observation.updates = updates;

            // تحديث السجل الزمني
            let timeLog = [];
            try {
                if (observation.timeLog) {
                    timeLog = typeof observation.timeLog === 'string' ? JSON.parse(observation.timeLog) : observation.timeLog;
                }
            } catch (e) {
                timeLog = [];
            }
            timeLog.push({
                action: 'update_added',
                user: AppState.currentUser?.name || 'System',
                timestamp: new Date().toISOString(),
                roleLabel: 'تحديث التنفيذ',
                actionDetail: 'تم إضافة تحديث على سير التنفيذ',
                note: 'تحديث التنفيذ: تم إضافة تحديث على سير التنفيذ'
            });
            observation.timeLog = timeLog;
            observation.updatedAt = new Date().toISOString();

            // تحديث الواجهة فوراً
            this.refreshUpdatesSection(observationId);
            this.refreshTimeLogSection(observationId);

            // حفظ البيانات محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // حفظ في الخلفية (بدون انتظار)
            GoogleIntegration.callBackend('addObservationUpdate', {
                observationId: observationId,
                user: AppState.currentUser?.name || 'System',
                update: updateText,
                progress: progress
            }).catch(error => {
                Utils.safeError('خطأ في حفظ التحديث في الخلفية:', error);
                Notification.error('حدث خطأ أثناء حفظ التحديث في الخلفية');
            });

            Notification.success('تم إضافة التحديث بنجاح');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async showAddCommentModal(observationId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">إضافة تعليق</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="comment-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">التعليق *</label>
                            <textarea id="comment-text" required class="form-input" rows="4" placeholder="اكتب التعليق..."></textarea>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>إضافة التعليق
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#comment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const commentText = modal.querySelector('#comment-text').value.trim();

            if (!commentText) {
                Notification.error('يرجى إدخال التعليق');
                return;
            }

            // إغلاق النافذة فوراً
            modal.remove();

            // الحصول على الملاحظة
            const observationIndex = AppState.appData.dailyObservations.findIndex(o => o.id === observationId);
            if (observationIndex === -1) {
                Notification.error('الملاحظة غير موجودة');
                return;
            }

            const observation = AppState.appData.dailyObservations[observationIndex];
            
            // إنشاء التعليق الجديد
            const newComment = {
                id: 'CMT-' + Date.now().toString(),
                user: AppState.currentUser?.name || 'System',
                comment: commentText,
                timestamp: new Date().toISOString()
            };

            // تحليل التعليقات الحالية
            let comments = [];
            try {
                if (observation.comments) {
                    comments = typeof observation.comments === 'string' ? JSON.parse(observation.comments) : observation.comments;
                }
            } catch (e) {
                comments = [];
            }

            // إضافة التعليق الجديد
            comments.push(newComment);
            observation.comments = comments;

            // تحديث السجل الزمني
            let timeLog = [];
            try {
                if (observation.timeLog) {
                    timeLog = typeof observation.timeLog === 'string' ? JSON.parse(observation.timeLog) : observation.timeLog;
                }
            } catch (e) {
                timeLog = [];
            }
            timeLog.push({
                action: 'comment_added',
                user: AppState.currentUser?.name || 'System',
                timestamp: new Date().toISOString(),
                roleLabel: 'تعليق',
                actionDetail: 'تم إضافة تعليق على الملاحظة',
                note: 'تعليق: تم إضافة تعليق على الملاحظة'
            });
            observation.timeLog = timeLog;
            observation.updatedAt = new Date().toISOString();

            // تحديث الواجهة فوراً
            this.refreshCommentsSection(observationId);
            this.refreshTimeLogSection(observationId);

            // حفظ البيانات محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // حفظ في الخلفية (بدون انتظار)
            GoogleIntegration.callBackend('addObservationComment', {
                observationId: observationId,
                user: AppState.currentUser?.name || 'System',
                comment: commentText
            }).catch(error => {
                Utils.safeError('خطأ في حفظ التعليق في الخلفية:', error);
                Notification.error('حدث خطأ أثناء حفظ التعليق في الخلفية');
            });

            Notification.success('تم إضافة التعليق بنجاح');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async deleteObservation(id) {
        if (!id) {
            Notification.error('معرف الملاحظة غير موجود');
            return;
        }
        if (!this.canDailyObservationsFullAdminUi()) {
            Notification.error('حذف الملاحظة متاح لمدير النظام فقط');
            return;
        }

        const observation = AppState.appData.dailyObservations.find((o) => o.id === id);
        if (!observation) {
            Notification.error('الملاحظة غير موجودة');
            return;
        }

        // تأكيد الحذف
        const confirmed = confirm('هل أنت متأكد من حذف هذه الملاحظة؟\n\nهذا الإجراء لا يمكن التراجع عنه.');
        if (!confirmed) {
            return;
        }

        try {
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                Notification.error('يجب تفعيل Google Integration أولاً');
                return;
            }

            // استدعاء API للحذف باستخدام GoogleIntegration
            const result = await GoogleIntegration.sendRequest({
                action: 'deleteObservation',
                data: { observationId: id }
            });

            if (result && result.success) {
                // حذف من AppState
                AppState.appData.dailyObservations = AppState.appData.dailyObservations.filter((o) => o.id !== id);
                
                // حفظ التغييرات
                if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') {
                    await DataManager.save();
                }

                // إعادة تحميل القائمة
                this.loadObservationsList();
                
                // تحديث الكروت الإحصائية
                this.renderStatsCards();

                Notification.success('تم حذف الملاحظة بنجاح');
            } else {
                Notification.error(result?.message || 'فشل حذف الملاحظة');
            }
        } catch (error) {
            Utils.safeError('خطأ في حذف الملاحظة:', error);
            const errorMessage = error?.message || error?.toString() || 'خطأ غير معروف';
            Notification.error('حدث خطأ أثناء حذف الملاحظة: ' + errorMessage);
        }
    },

    async deleteAllObservations() {
        if (!this.canDailyObservationsFullAdminUi()) {
            Notification.error('هذه الميزة متاحة لمدير النظام فقط');
            return;
        }

        const observationsRaw = Array.isArray(AppState.appData.dailyObservations)
            ? AppState.appData.dailyObservations
            : [];
        
        const totalCount = observationsRaw.length;

        if (totalCount === 0) {
            Notification.info('لا توجد ملاحظات للحذف');
            return;
        }

        // تأكيد الحذف مع تحذير قوي
        const confirmed = confirm(
            `⚠️ تحذير: أنت على وشك حذف جميع الملاحظات!\n\n` +
            `عدد الملاحظات التي سيتم حذفها: ${totalCount}\n\n` +
            `هذا الإجراء لا يمكن التراجع عنه.\n\n` +
            `هل أنت متأكد تماماً من حذف جميع الملاحظات؟`
        );

        if (!confirmed) {
            return;
        }

        // تأكيد إضافي
        const doubleConfirmed = confirm(
            `⚠️ تأكيد نهائي:\n\n` +
            `سيتم حذف ${totalCount} ملاحظة نهائياً.\n\n` +
            `اضغط "موافق" للمتابعة أو "إلغاء" للإلغاء.`
        );

        if (!doubleConfirmed) {
            return;
        }

        try {
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                Notification.error('يجب تفعيل Google Integration أولاً');
                return;
            }

            // استدعاء API للحذف باستخدام GoogleIntegration
            const result = await GoogleIntegration.sendRequest({
                action: 'deleteAllObservations',
                data: {}
            });

            if (result && result.success) {
                // حذف من AppState
                AppState.appData.dailyObservations = [];
                
                // حفظ التغييرات
                if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') {
                    await DataManager.save();
                }

                // إعادة تحميل القائمة
                this.loadObservationsList();
                
                // تحديث الكروت الإحصائية
                this.renderStatsCards();

                Notification.success(`تم حذف جميع الملاحظات بنجاح (${totalCount} ملاحظة)`);
            } else {
                Notification.error(result?.message || 'فشل حذف جميع الملاحظات');
            }
        } catch (error) {
            Utils.safeError('خطأ في حذف جميع الملاحظات:', error);
            const errorMessage = error?.message || error?.toString() || 'خطأ غير معروف';
            Notification.error('حدث خطأ أثناء حذف جميع الملاحظات: ' + errorMessage);
        }
    },

    async sendEmailNotifications(notificationData) {
        // في الإنتاج، يجب إرسال إيميلات علية
        // هنا سنعرض قطعة من الكود في Console وإشعار للمستخدم
        Utils.safeLog('إرسال إشعارات لإيميلات:', AppState.notificationEmails);
        Utils.safeLog('بيانات الإشعار:', notificationData);

        // يمكن إضافة تكامل مع خدمة إرسال إيميلات هنا
        // مثلاً: SendGrid, Mailgun, AWS SES, ...

        if (AppState.notificationEmails && AppState.notificationEmails.length > 0) {
            Notification.success(`تم إرسال إشعار إلى ${AppState.notificationEmails.length} إيميل`);
        }
    },

    async exportExcel() {
        const observationsRaw = typeof this.getDailyObservationsVisibleToCurrentUser === 'function'
            ? this.getDailyObservationsVisibleToCurrentUser()
            : (Array.isArray(AppState.appData.dailyObservations) ? AppState.appData.dailyObservations : []);

        if (observationsRaw.length === 0) {
            Notification?.info?.('لا توجد ملاحظات يومية لتصديرها.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            try {
                await this.ensureSheetJS();
            } catch (error) {
                return;
            }
        }

        try {
            const observations = observationsRaw.map((item) => this.normalizeRecord(item));
            const excelData = observations.map((obs) => ({
                'رقم الملاحظة': obs.isoCode || '',
                'اسم الموقع': obs.siteName || '',
                'المكان داخل الموقع': obs.locationName || '',
                'نوع الملاحظة': obs.observationType || '',
                'التاريخ والوقت': obs.date ? Utils.formatDateTime(obs.date) : '',
                'الوردية': obs.shift || '',
                'تفاصيل الملاحظة': obs.details || '',
                'الإجراء التصحيحي / الوقائي': obs.correctiveAction || '',
                'المسؤول عن التنفيذ': obs.responsibleDepartment || '',
                'معدل الخطورة': obs.riskLevel || '',
                'اسم صاحب الملاحظة': obs.observerName || '',
                'التاريخ المتوقع للتنفيذ': obs.expectedCompletionDate ? Utils.formatDate(obs.expectedCompletionDate) : '',
                'الحالة': obs.status || '',
                'عدد المرفقات': Array.isArray(obs.attachments) ? obs.attachments.length : 0,
                'أسماء المرفقات': Array.isArray(obs.attachments) ? obs.attachments.map((attachment) => attachment.name).join(', ') : ''
            }));

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'DailyObservations');

            const fileName = `Daily_Observations_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            Notification?.success?.('تم تصدير سجل الملاحظات اليومية إلى Excel بنجاح.');
        } catch (error) {
            Utils.safeError('فشل تصدير الملاحظات اليومية إلى Excel:', error);
            Notification?.error?.('فشل تصدير الملاحظات اليومية: ' + error.message);
        }
    },

    async showImportExcelModal() {
        if (!this.canDailyObservationsFullAdminUi()) {
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('استيراد الملاحظات متاح لمدير النظام فقط');
            }
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-file-excel ml-2"></i>استيراد الملاحظات اليومية من ملف Excel</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <p class="text-sm text-blue-800 mb-2"><strong>تعليمات الاستيراد:</strong></p>
                        <p class="text-sm text-blue-700">يجب أن يحتوي ملف Excel على الأعمدة التالية (باللغة العربية أو الإنجليزية):</p>
                        <ul class="text-sm text-blue-700 list-disc mr-6 mt-2 space-y-1">
                            <li>اسم الموقع / Site Name</li>
                            <li>المكان داخل الموقع / Location</li>
                            <li>نوع الملاحظة / Observation Type</li>
                            <li>تاريخ الملاحظة / Observation Date (يمكن أن يكون مع الوقت)</li>
                            <li>الوردية / Shift</li>
                            <li>تفاصيل الملاحظة / Details</li>
                            <li>الإجراء التصحيحي / Corrective Action</li>
                            <li>المسؤول عن التنفيذ / Responsible Department</li>
                            <li>معدل الخطورة / Risk Level</li>
                            <li>اسم صاحب الملاحظة / Observer Name</li>
                            <li>التاريخ المتوقع للتنفيذ / Expected Completion Date</li>
                            <li>الحالة / Status</li>
                            <li>رقم الملاحظة (اختياري)</li>
                        </ul>
                        <p class="text-xs text-blue-700 mt-3">إذا تم العثور على أسماء مواقع/أماكن مطابقة لإعدادات النظام فسيتم ربطها تلقائياً، وإلا سيتم حفظ الأسماء كما هي.</p>
                    </div>
                    <div>
                        <label for="observation-excel-file-input" class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-file-excel ml-2"></i>
                            اختر ملف Excel (.xlsx, .xls)
                        </label>
                        <input type="file" id="observation-excel-file-input" accept=".xlsx,.xls" class="form-input">
                    </div>
                    <div id="observation-import-preview" class="hidden">
                        <h3 class="text-sm font-semibold mb-2">معاينة البيانات (أول 5 صفوف):</h3>
                        <div class="max-h-60 overflow-auto border rounded">
                            <table class="data-table text-xs">
                                <thead id="observation-preview-head"></thead>
                                <tbody id="observation-preview-body"></tbody>
                            </table>
                        </div>
                        <p id="observation-preview-count" class="text-sm text-gray-600 mt-2"></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button id="observation-import-confirm-btn" class="btn-primary" disabled>
                        <i class="fas fa-upload ml-2"></i>استيراد البيانات
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const fileInput = modal.querySelector('#observation-excel-file-input');
        const confirmBtn = modal.querySelector('#observation-import-confirm-btn');
        const previewContainer = modal.querySelector('#observation-import-preview');
        const previewHead = modal.querySelector('#observation-preview-head');
        const previewBody = modal.querySelector('#observation-preview-body');
        const previewCount = modal.querySelector('#observation-preview-count');

        let importedRows = [];

        const resetPreview = () => {
            importedRows = [];
            if (previewContainer) previewContainer.classList.add('hidden');
            if (previewHead) previewHead.innerHTML = '';
            if (previewBody) previewBody.innerHTML = '';
            if (previewCount) previewCount.textContent = '';
            if (confirmBtn) confirmBtn.disabled = true;
        };

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });

        const handleFileChange = async (event) => {
            const file = event.target.files?.[0];
            resetPreview();
            if (!file) return;

            if (typeof XLSX === 'undefined') {
                try {
                    await this.ensureSheetJS();
                } catch (error) {
                    return;
                }
            }

            try {
                Loading.show();
                const rows = await this.readObservationExcelFile(file);
                importedRows = rows;
                this.renderObservationImportPreview(rows, {
                    previewContainer,
                    previewHead,
                    previewBody,
                    previewCount,
                    confirmBtn
                });
                Loading.hide();
            } catch (error) {
                Loading.hide();
                Utils.safeError('فشل قراءة ملف الملاحظات اليومية:', error);
                Notification?.error?.('فشل قراءة الملف: ' + error.message);
            }
        };

        if (fileInput) {
            fileInput.addEventListener('change', handleFileChange);
        }

        confirmBtn?.addEventListener('click', async () => {
            if (importedRows.length === 0) {
                Notification?.warning?.('يرجى اختيار ملف يحتوي على بيانات قبل الاستيراد.');
                return;
            }
            await this.processImportedObservations(importedRows, modal);
        });
    },

    async readObservationExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                    if (!Array.isArray(jsonData) || jsonData.length === 0) {
                        reject(new Error('الملف فارغ أو لا يحتوي على بيانات قابلة للمعالجة.'));
                        return;
                    }
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    renderObservationImportPreview(rows, { previewContainer, previewHead, previewBody, previewCount, confirmBtn }) {
        if (!Array.isArray(rows) || rows.length === 0) {
            Notification?.warning?.('لم يتم العثور على بيانات في الملف.');
            return;
        }
        const headers = Object.keys(rows[0]);
        if (previewHead) {
            previewHead.innerHTML = `<tr>${headers.map((header) => `<th class="px-2 py-1">${Utils.escapeHTML(String(header))}</th>`).join('')}</tr>`;
        }
        if (previewBody) {
            previewBody.innerHTML = rows.slice(0, 5).map((row) => `
                <tr>
                    ${headers.map((header) => `<td class="px-2 py-1">${Utils.escapeHTML(String(row[header] ?? ''))}</td>`).join('')}
                </tr>
            `).join('');
        }
        if (previewCount) {
            previewCount.textContent = `إجمالي الصفوف: ${rows.length}`;
        }
        previewContainer?.classList.remove('hidden');
        if (confirmBtn) confirmBtn.disabled = false;
    },

    async processImportedObservations(rows, modal) {
        if (!Array.isArray(rows) || rows.length === 0) {
            Notification?.warning?.('لم يتم العثور على بيانات صالحة للاستيراد.');
            return;
        }

        if (!Array.isArray(AppState.appData.dailyObservations)) {
            AppState.appData.dailyObservations = [];
        }

        Loading.show();
        let successCount = 0;
        let skippedCount = 0;
        const errors = [];

        try {
            for (let index = 0; index < rows.length; index += 1) {
                const row = rows[index];
                try {
                    // تخطي الصفوف الفارغة
                    const hasData = Object.values(row || {}).some(val => {
                        const strVal = String(val || '').trim();
                        return strVal.length > 0;
                    });

                    if (!hasData) {
                        skippedCount += 1;
                        continue;
                    }

                    const record = this.mapImportedObservationRow(row);
                    if (!record) {
                        skippedCount += 1;
                        errors.push(`صف ${index + 2}: فشل في تحويل البيانات`);
                        continue;
                    }

                    const duplicate = AppState.appData.dailyObservations.find((item) => {
                        const normalized = this.normalizeRecord(item);
                        if (record.isoCode && normalized.isoCode && record.isoCode === normalized.isoCode) return true;
                        return normalized.id === record.id;
                    });

                    if (duplicate) {
                        skippedCount += 1;
                        continue;
                    }

                    AppState.appData.dailyObservations.push(record);
                    successCount += 1;
                } catch (error) {
                    skippedCount += 1;
                    const errorMsg = error.message || error.toString() || 'خطأ غير معروف';
                    errors.push(`صف ${index + 2}: ${errorMsg}`);
                    Utils.safeWarn(`خطأ في استيراد صف ${index + 2}:`, error);
                }
            }
        } catch (globalError) {
            Utils.safeError('خطأ عام في عملية الاستيراد:', globalError);
            errors.push(`خطأ عام: ${globalError.message || globalError.toString()}`);
        }

        try {
            if (successCount > 0) {
                // حفظ البيانات باستخدام window.DataManager
                try {
                    if (typeof window !== 'undefined' && window.DataManager && typeof window.DataManager.save === 'function') {
                        window.DataManager.save();
                    } else if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') {
                        DataManager.save();
                    } else {
                        Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات محلياً');
                    }
                } catch (saveError) {
                    Utils.safeError('خطأ في حفظ البيانات محلياً:', saveError);
                }
                
                // المزامنة مع Google Sheets
                try {
                    await GoogleIntegration.autoSave('DailyObservations', AppState.appData.dailyObservations);
                } catch (syncError) {
                    Utils.safeError('خطأ في المزامنة مع Google Sheets:', syncError);
                }
            }
        } catch (error) {
            Utils.safeError('فشل حفظ البيانات بعد الاستيراد:', error);
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('تم استيراد بعض السجلات لكن فشل حفظها: ' + (error.message || error.toString()));
            }
        }

        Loading.hide();

        if (successCount > 0) {
            Notification?.success?.(`تم استيراد ${successCount} ملاحظة يومية${skippedCount ? `، وتم تجاهل ${skippedCount} صف` : ''}.`);
        } else if (skippedCount > 0) {
            Notification?.warning?.('لم يتم استيراد أي صف بسبب أخطاء في البيانات.');
        }

        if (errors.length > 0) {
            Utils.safeWarn('أخطاء استيراد الملاحظات اليومية:', errors);
            const errorPreview = errors.slice(0, 5).join('\n');
            Notification?.error?.(`أخطاء أثناء الاستيراد:\n${errorPreview}${errors.length > 5 ? '\n...' : ''}`);
        }

        modal.remove();
        this.resetFormState();
        this.loadObservationsList();
    },

    mapImportedObservationRow(row) {
        if (!row || typeof row !== 'object') return null;

        const normalizedKeyMap = new Map();
        const lowerKeyMap = new Map();
        Object.entries(row || {}).forEach(([key, value]) => {
            if (key === undefined || key === null) return;
            const keyString = String(key).trim();
            if (!keyString) return;
            normalizedKeyMap.set(keyString, value);
            lowerKeyMap.set(keyString.toLowerCase(), value);
        });

        const getValue = (keys) => {
            for (const key of keys) {
                const trimmedKey = String(key || '').trim();
                if (!trimmedKey) continue;

                if (normalizedKeyMap.has(trimmedKey)) {
                    const rawValue = normalizedKeyMap.get(trimmedKey);
                    const stringValue = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
                    if (stringValue) return stringValue;
                }

                const lowerKey = trimmedKey.toLowerCase();
                if (lowerKeyMap.has(lowerKey)) {
                    const rawValue = lowerKeyMap.get(lowerKey);
                    const stringValue = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
                    if (stringValue) return stringValue;
                }
            }
            return '';
        };

        // Like getValue, but preserves the original cell type (number/Date/etc) for robust date parsing.
        const getRawValue = (keys) => {
            for (const key of keys) {
                const trimmedKey = String(key || '').trim();
                if (!trimmedKey) continue;

                if (normalizedKeyMap.has(trimmedKey)) {
                    const rawValue = normalizedKeyMap.get(trimmedKey);
                    if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') return rawValue;
                }

                const lowerKey = trimmedKey.toLowerCase();
                if (lowerKeyMap.has(lowerKey)) {
                    const rawValue = lowerKeyMap.get(lowerKey);
                    if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') return rawValue;
                }
            }
            return '';
        };

        const extractUrlsFromCell = (cellValue) => {
            if (cellValue === undefined || cellValue === null) return [];

            // Try to pull hyperlink targets from common SheetJS-like shapes
            if (typeof cellValue === 'object') {
                const candidate =
                    cellValue?.url ||
                    cellValue?.link ||
                    cellValue?.href ||
                    cellValue?.hyperlink ||
                    cellValue?.l?.Target ||
                    cellValue?.l?.target ||
                    cellValue?.Target ||
                    cellValue?.target ||
                    cellValue?.v ||
                    cellValue?.text ||
                    '';
                if (candidate && typeof candidate === 'string') {
                    return extractUrlsFromCell(candidate);
                }
                return [];
            }

            const text = String(cellValue || '').trim();
            if (!text) return [];

            const urls = [];
            const re = /https?:\/\/[^\s"'<>]+/gi;
            let m;
            while ((m = re.exec(text)) !== null) {
                const rawUrl = m[0];
                const cleaned = rawUrl.replace(/[)\],.;،؛]+$/g, '').trim();
                if (cleaned) urls.push(cleaned);
            }
            return Array.from(new Set(urls));
        };

        const buildLinkAttachments = (raw, baseLabel = 'مرفق') => {
            const urls = extractUrlsFromCell(raw);
            if (!urls.length) return [];
            return urls.map((url, idx) => {
                const type = this.detectMimeType(url, url);
                const ext = type === 'application/pdf'
                    ? '.pdf'
                    : (type === 'image/png' ? '.png' : (type === 'image/jpeg' ? '.jpg' : ''));
                return {
                    id: Utils.generateId('ATT'),
                    name: `${baseLabel}-${idx + 1}${ext}`,
                    type,
                    size: 0,
                    data: url
                };
            });
        };

        const isoCode = getValue(['رقم الملاحظة', 'كود ISO', 'ISO', 'ISO Code', 'Code']);
        let siteNameInput = getValue([
            'اسم الموقع',
            'اسم الموقع / المكان',
            'اسم الموقع/ المكان',
            'اسم الموقع/المكان',
            'اسم الموقع والمكان',
            'الموقع',
            'الموقع / المكان',
            'Site',
            'Site Name',
            'Site / Location',
            'Site/Location',
            'Site/Location Name',
            'Site Location',
            'Site Location Name',
            'Location Site',
            'Location/Site'
        ]);
        const placeNameInput = getValue([
            'المكان',
            'المكان داخل الموقع',
            'اسم المكان',
            'المنطقة',
            'Location',
            'Location Name',
            'Place',
            'Area',
            'Place Name'
        ]);
        const observationTypeInput = getValue([
            'نوع الملاحظة',
            'نوع الملاحظة / التصرف',
            'Observation Type',
            'Observation Type / Category',
            'Type',
            'Observation',
            'Observation Category'
        ]);
        let detailsInput = getValue([
            'تفاصيل الملاحظة',
            'تفاصيل الملاحظة / التصرف غير الآمن',
            'تفاصيل الملاحظة/التصرف غير الآمن',
            'تفاصيل الملاحظة والتصرف غير الآمن',
            'الوصف',
            'وصف الملاحظة',
            'Details',
            'Observation Details',
            'Observation Detail',
            'Observation/Unsafe Act Details',
            'Observation / Unsafe Act Details',
            'Description',
            'Observation Description',
            'Description of Observation',
            'Unsafe Act Details',
            'Observation / Unsafe Act Description'
        ]);
        const correctiveInput = getValue([
            'الإجراء التصحيحي',
            'الإجراء التصحيحي / الوقائي',
            'الإجراء التصحيحي/ الوقائي',
            'الإجراء التصحيحي الوقائي',
            'Corrective Action',
            'Preventive Action',
            'Corrective/Preventive Action',
            'Corrective & Preventive Action'
        ]);
        const responsibleInput = getValue([
            'المسؤول عن التنفيذ',
            'الجهة المسؤولة',
            'Responsible Department',
            'Responsible Dept',
            'Department',
            'Responsible',
            'Responsible Person',
            'Responsible for Implementation'
        ]);
        const riskInput = getValue([
            'معدل الخطورة',
            'درجة الخطورة',
            'مستوى الخطورة',
            'Risk Level',
            'Risk',
            'Risk Rating',
            'Risk Level Rating'
        ]);
        const observerInput = getValue([
            'اسم صاحب الملاحظة',
            'الملاحظ',
            'صاحب الملاحظة',
            'Observer Name',
            'Observer',
            'Reporter Name'
        ]);
        const statusInput = getValue([
            'الحالة',
            'Status',
            'Observation Status'
        ]);
        const shiftInput = getValue([
            'الوردية',
            'Shift',
            'Shift Name'
        ]);

        const timestampRaw = getRawValue(['طابع زمني', 'Timestamp', 'Time Stamp', 'time stamp', 'تاريخ ووقت الإدخال', 'Entry Timestamp']);
        const dateRaw = getRawValue([
            'تاريخ الملاحظة',
            'التاريخ',
            'تاريخ ووقت الملاحظة',
            'التاريخ والوقت',
            'Observation Date',
            'Observation DateTime',
            'Date',
            'DateTime'
        ]) || timestampRaw;
        const expectedRaw = getRawValue(['التاريخ المتوقع للتنفيذ', 'Expected Completion Date', 'Due Date', 'التاريخ المتوقع', 'Expected Date']);

        const attachmentsRaw = getRawValue([
            'الصوره التوضيحية للملاحظة',
            'الصورة التوضيحية للملاحظة',
            'صوره',
            'صورة',
            'Image',
            'Image URL',
            'Image Url',
            'Photo',
            'Photo URL',
            'Attachment',
            'Attachments',
            'المرفقات',
            'مرفق',
            'الرابط',
            'رابط',
            'Link',
            'URL',
            'Drive Link',
            'Google Drive Link'
        ]);

        // تحسين التحقق من الحقول الأساسية - السماح بوجود أي من الحقول المطلوبة
        if (!siteNameInput && !detailsInput) {
            // محاولة البحث عن أي حقل يحتوي على معلومات الموقع أو التفاصيل
            const hasAnyData = Object.values(row).some(val => {
                const strVal = String(val || '').trim();
                return strVal.length > 3; // أي قيمة تحتوي على أكثر من 3 أحرف
            });

            if (!hasAnyData) {
                throw new Error('الصف يفتقر إلى الحقول الأساسية (اسم الموقع أو تفاصيل الملاحظة).');
            }

            // إذا كان هناك بيانات لكن لا يوجد اسم موقع أو تفاصيل، نستخدم القيم الافتراضية
            if (!siteNameInput) {
                siteNameInput = 'موقع غير محدد';
            }
            if (!detailsInput) {
                detailsInput = 'لا توجد تفاصيل';
            }
        }

        const siteMatch = this.findSiteMatch(siteNameInput);
        const siteId = siteMatch ? siteMatch.id : '';
        const siteName = siteMatch ? siteMatch.name : siteNameInput;

        const placeMatch = siteMatch ? this.findPlaceMatch(siteMatch, placeNameInput) : null;
        const placeId = placeMatch ? placeMatch.id : '';
        const locationName = placeMatch ? placeMatch.name : placeNameInput;

        let observationType = this.normalizeObservationTypeValue(observationTypeInput);
        const shift = this.normalizeShiftValue(shiftInput);
        const riskLevel = this.normalizeRiskLevelValue(riskInput);
        let status = this.normalizeStatus(statusInput);

        const dateIso = this.parseExcelDateValue(dateRaw) || this.parseExcelDateValue(timestampRaw) || new Date().toISOString();
        const expectedIso = this.parseExcelDateValue(expectedRaw, { isDateOnly: true });
        const importedAttachments = buildLinkAttachments(attachmentsRaw, 'رابط');

        // استخدام القيم الافتراضية إذا كانت مفقودة
        if (!detailsInput) {
            detailsInput = 'لا توجد تفاصيل';
        }
        if (!observationType) {
            observationType = 'أخرى';
        }
        if (!status) {
            status = 'مفتوح';
        }

        const recordId = generateDailyObservationId(AppState.appData.dailyObservations || []);
        const iso = isoCode || getObservationIsoCodeFromId(recordId);
        const now = new Date().toISOString();

        const payload = {
            id: recordId,
            isoCode: iso,
            siteId,
            siteName,
            placeId,
            locationName,
            observationType,
            date: dateIso || now,
            shift,
            details: detailsInput,
            correctiveAction: correctiveInput,
            responsibleDepartment: responsibleInput,
            riskLevel,
            observerName: observerInput,
            expectedCompletionDate: expectedIso,
            status,
            attachments: importedAttachments,
            createdAt: now,
            updatedAt: now
        };

        return this.normalizeRecord(payload);
    },

    async exportPDF(id) {
        const observationRaw = AppState.appData.dailyObservations.find((o) => o.id === id);
        if (!observationRaw) {
            Notification.error('الملاحظة غير موجودة');
            return;
        }

        const observation = this.normalizeRecord(observationRaw);

        try {
            Loading.show();

            const formCode = observation.isoCode || (observation.id ? getObservationIsoCodeFromId(observation.id) : '') || 'OBS-UNKNOWN';
            const title = 'نموذج الملاحظات اليومية';

            // جمع الصور من attachments
            const images = [];
            const otherFiles = [];
            
            if (Array.isArray(observation.attachments) && observation.attachments.length > 0) {
                observation.attachments.forEach((attachment) => {
                    const isImage = (attachment.type || '').startsWith('image/') || 
                                   (attachment.name || '').match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
                    // استخدام shareableLink أولاً للحصول على رابط بصيغة view?usp=drive_link
                    const imgSrc = attachment.shareableLink || attachment.directLink || attachment.cloudLink?.url || attachment.data || '';
                    
                    if (isImage && imgSrc) {
                        images.push({
                            src: imgSrc,
                            name: Utils.escapeHTML(attachment.name || 'صورة')
                        });
                    } else {
                        otherFiles.push({
                            name: Utils.escapeHTML(attachment.name || 'مرفق'),
                            link: imgSrc || attachment.data || ''
                        });
                    }
                });
            }

            // بناء قسم الصور بشكل منسق في إطارات مربعة
            let imagesSection = '';
            if (images.length > 0) {
                imagesSection = `
                    <div class="section-title" style="margin-top: 20px; margin-bottom: 15px; font-size: 16px; font-weight: 600;">المرفقات (الصور):</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        ${images.map((img, index) => `
                            <div style="border: 2px solid #ddd; border-radius: 8px; padding: 10px; background: #f9f9f9; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <img src="${img.src}" alt="${img.name}" style="max-width: 100%; max-height: 250px; width: auto; height: auto; border-radius: 4px; object-fit: contain; display: block; margin: 0 auto;">
                                <p style="margin-top: 8px; font-size: 12px; color: #666; word-break: break-word;">${img.name}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // إضافة الملفات الأخرى (غير الصور)
            let otherFilesSection = '';
            if (otherFiles.length > 0) {
                otherFilesSection = `
                    <div class="section-title" style="margin-top: 20px; margin-bottom: 15px; font-size: 16px; font-weight: 600;">المرفقات (ملفات أخرى):</div>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
                        ${otherFiles.map((file) => `
                            <div style="border: 1px solid #ddd; padding: 10px; border-radius: 8px; background: #f9f9f9;">
                                <i class="fas fa-file ml-2"></i>
                                <span>${file.name}</span>
                                ${file.link ? `<a href="${file.link}" target="_blank" style="margin-right: 10px; color: #3b82f6; text-decoration: none;">عرض</a>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const attachmentsHtml = imagesSection + otherFilesSection;

            const content = `
                    <table>
                        <tr><th>رقم الملاحظة</th><td>${Utils.escapeHTML(observation.isoCode || '')}</td></tr>
                    <tr><th>الموقع</th><td>${Utils.escapeHTML(observation.siteName || '')}</td></tr>
                    <tr><th>المكان</th><td>${Utils.escapeHTML(observation.locationName || '')}</td></tr>
                    <tr><th>التاريخ والوقت</th><td>${observation.date ? Utils.formatDateTime(observation.date) : '-'}</td></tr>
                        <tr><th>نوع الملاحظة</th><td>${Utils.escapeHTML(observation.observationType || '')}</td></tr>
                    <tr><th>الوردية</th><td>${Utils.escapeHTML(observation.shift || '')}</td></tr>
                    <tr><th>معدل الخطورة</th><td>${Utils.escapeHTML(observation.riskLevel || '')}</td></tr>
                        <tr><th>الحالة</th><td>${Utils.escapeHTML(observation.status || '')}</td></tr>
                    <tr><th>المسؤول عن التنفيذ</th><td>${Utils.escapeHTML(observation.responsibleDepartment || '')}</td></tr>
                    <tr><th>صاحب الملاحظة</th><td>${Utils.escapeHTML(observation.observerName || '')}</td></tr>
                    <tr><th>التاريخ المتوقع للتنفيذ</th><td>${observation.expectedCompletionDate ? Utils.formatDate(observation.expectedCompletionDate) : '-'}</td></tr>
                    </table>
                    
                <div class="section-title">تفاصيل الملاحظة:</div>
                <div class="description">${Utils.escapeHTML(observation.details || '')}</div>
                    
                    ${observation.correctiveAction ? `
                    <div class="section-title">الإجراء التصحيحي / الوقائي:</div>
                        <div class="description">${Utils.escapeHTML(observation.correctiveAction)}</div>
                    ` : ''}
                    
                    ${attachmentsHtml}
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(
                    formCode,
                    title,
                    content,
                    false,
                    true,
                    { qrData: JSON.stringify({ id: observation.id, type: 'DailyObservation' }) },
                    observation.createdAt,
                    observation.updatedAt
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>ملاحظة يومية</title></head><body dir="rtl" style="font-family: Arial, sans-serif;">${content}</body></html>`;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        Loading.hide();
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح بالنوافذ المنبثقة لعرض التقرير.');
            }
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ في تصدير PDF: ' + error.message);
        }
    },

    async convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async convertImageToBase64(file) {
        return this.convertFileToBase64(file);
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
try {
    if (typeof window !== 'undefined') {
        window.DailyObservations = DailyObservations;
        
        // إشعار عند تحميل الموديول بنجاح
        if (AppState?.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('✅ DailyObservations module loaded and available on window.DailyObservations');
        }
    }
} catch (error) {
    Utils?.safeError?.('❌ خطأ في تصدير DailyObservations:', error);
    // محاولة التصدير مرة أخرى حتى في حالة الخطأ
    if (typeof window !== 'undefined' && typeof DailyObservations !== 'undefined') {
        window.DailyObservations = DailyObservations;
    }
}