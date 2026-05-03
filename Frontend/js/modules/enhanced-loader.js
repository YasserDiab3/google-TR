/**
 * Enhanced Loading Screen
 * شاشة تحميل محسنة مع شريط تقدم وإحصائيات
 */

const EnhancedLoader = {
    // حالة التحميل
    loadingState: {
        total: 0,
        loaded: 0,
        currentStep: '',
        startTime: null,
        errors: []
    },

    // عناصر DOM
    elements: {
        overlay: null,
        progressBar: null,
        progressText: null,
        statusText: null,
        timeText: null,
        errorContainer: null
    },

    /**
     * تهيئة شاشة التحميل
     */
    init() {
        this.createLoadingScreen();
        this.loadingState.startTime = Date.now();
    },

    /**
     * إنشاء عناصر شاشة التحميل
     */
    createLoadingScreen() {
        // البحث عن شاشة التحميل الموجودة
        this.elements.overlay = document.getElementById('loading-overlay');
        
        if (!this.elements.overlay) {
            console.error('❌ شاشة التحميل غير موجودة!');
            return;
        }

        // تحديث محتوى شاشة التحميل
        const spinner = this.elements.overlay.querySelector('.loading-spinner');
        if (spinner) {
            spinner.innerHTML = `
                <i class="fas fa-spinner fa-spin text-5xl text-blue-600 mb-4"></i>
                <div class="loading-content" style="width: 100%; max-width: 500px;">
                    <p class="text-lg font-semibold text-gray-700 mb-4" id="loading-status-text">جاري تحميل النظام...</p>
                    
                    <!-- شريط التقدم -->
                    <div class="progress-container" style="width: 100%; background: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden; margin-bottom: 12px;">
                        <div id="loading-progress-bar" class="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); transition: width 0.3s ease; border-radius: 9999px;"></div>
                    </div>
                    
                    <!-- نص التقدم -->
                    <div class="flex justify-between items-center text-sm text-gray-600 mb-3">
                        <span id="loading-progress-text">0%</span>
                        <span id="loading-time-text">0s</span>
                    </div>
                    
                    <!-- الخطوة الحالية -->
                    <div class="current-step" style="text-align: center; font-size: 0.875rem; color: #6b7280; min-height: 20px;">
                        <span id="loading-current-step"></span>
                    </div>
                    
                    <!-- حاوية الأخطاء -->
                    <div id="loading-error-container" style="margin-top: 16px; display: none;">
                        <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p class="text-sm text-red-600 font-semibold mb-2">
                                <i class="fas fa-exclamation-triangle ml-1"></i>
                                حدثت بعض المشاكل أثناء التحميل:
                            </p>
                            <ul id="loading-error-list" class="text-xs text-red-500 list-disc list-inside"></ul>
                        </div>
                    </div>
                </div>
            `;
        }

        // حفظ المراجع للعناصر
        this.elements.progressBar = document.getElementById('loading-progress-bar');
        this.elements.progressText = document.getElementById('loading-progress-text');
        this.elements.statusText = document.getElementById('loading-status-text');
        this.elements.timeText = document.getElementById('loading-time-text');
        this.elements.currentStepText = document.getElementById('loading-current-step');
        this.elements.errorContainer = document.getElementById('loading-error-container');
        this.elements.errorList = document.getElementById('loading-error-list');
    },

    /**
     * عرض شاشة التحميل (معطل - التحميل في الخلفية)
     */
    show(totalSteps = 100) {
        // لا نعرض شاشة التحميل - التحميل في الخلفية
        // نحدث الحالة فقط للاستخدام الداخلي
        this.loadingState.total = totalSteps;
        this.loadingState.loaded = 0;
        this.loadingState.startTime = Date.now();
        this.loadingState.errors = [];
        this.updateProgress();
        
        // التأكد من إخفاء الشاشة حتى لو تم استدعاء show()
        if (this.elements.overlay) {
            this.elements.overlay.style.display = 'none';
            this.elements.overlay.style.visibility = 'hidden';
        }
    },

    /**
     * إخفاء شاشة التحميل
     */
    hide() {
        if (this.elements.overlay) {
            // إخفاء فوري لتقليل تأخير ظهور الواجهة (كان 500ms)
            this.elements.overlay.style.display = 'none';
        }
    },

    /**
     * تحديث التقدم
     */
    updateProgress(step = null, message = null) {
        if (step !== null) {
            this.loadingState.loaded = Math.min(step, this.loadingState.total);
        }

        if (message !== null) {
            this.loadingState.currentStep = message;
        }

        // حساب النسبة المئوية
        const percentage = Math.round((this.loadingState.loaded / this.loadingState.total) * 100);

        // تحديث شريط التقدم
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percentage}%`;
        }

        // تحديث نص التقدم
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${percentage}%`;
        }

        // تحديث الوقت المنقضي
        if (this.elements.timeText && this.loadingState.startTime) {
            const elapsed = Math.round((Date.now() - this.loadingState.startTime) / 1000);
            this.elements.timeText.textContent = `${elapsed}s`;
        }

        // تحديث الخطوة الحالية
        if (this.elements.currentStepText && this.loadingState.currentStep) {
            this.elements.currentStepText.innerHTML = `<i class="fas fa-sync fa-spin ml-1"></i> ${this.loadingState.currentStep}`;
        }
    },

    /**
     * تحديث حالة التحميل
     */
    setStatus(message) {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = message;
        }
    },

    /**
     * زيادة التقدم
     */
    increment(amount = 1, message = null) {
        this.loadingState.loaded = Math.min(
            this.loadingState.loaded + amount,
            this.loadingState.total
        );
        
        if (message) {
            this.loadingState.currentStep = message;
        }
        
        this.updateProgress();
    },

    /**
     * إضافة خطأ
     */
    addError(error) {
        this.loadingState.errors.push(error);
        
        if (this.elements.errorContainer && this.elements.errorList) {
            this.elements.errorContainer.style.display = 'block';
            
            const li = document.createElement('li');
            li.textContent = error;
            li.className = 'mb-1';
            this.elements.errorList.appendChild(li);
        }
    },

    /**
     * إنهاء التحميل بنجاح
     */
    complete(message = 'تم التحميل بنجاح!') {
        this.setStatus(message);
        this.updateProgress(this.loadingState.total, '✓ تم');
        
        // إظهار أيقونة النجاح
        const spinner = this.elements.overlay?.querySelector('.fa-spinner');
        if (spinner) {
            spinner.className = 'fas fa-check-circle text-5xl text-green-600 mb-4';
        }
        
        // إخفاء بعد ثانية
        setTimeout(() => this.hide(), 1000);
    },

    /**
     * إنهاء التحميل بخطأ
     */
    fail(message = 'فشل التحميل!') {
        this.setStatus(message);
        
        // إظهار أيقونة الخطأ
        const spinner = this.elements.overlay?.querySelector('.fa-spinner');
        if (spinner) {
            spinner.className = 'fas fa-times-circle text-5xl text-red-600 mb-4';
        }
    },

    /**
     * إعادة تعيين
     */
    reset() {
        this.loadingState = {
            total: 0,
            loaded: 0,
            currentStep: '',
            startTime: Date.now(),
            errors: []
        };
        
        if (this.elements.errorContainer) {
            this.elements.errorContainer.style.display = 'none';
        }
        
        if (this.elements.errorList) {
            this.elements.errorList.innerHTML = '';
        }
    },

    /**
     * الحصول على الإحصائيات
     */
    getStats() {
        const elapsed = this.loadingState.startTime 
            ? (Date.now() - this.loadingState.startTime) / 1000 
            : 0;
        
        return {
            percentage: Math.round((this.loadingState.loaded / this.loadingState.total) * 100),
            loaded: this.loadingState.loaded,
            total: this.loadingState.total,
            elapsed: elapsed.toFixed(2),
            errors: this.loadingState.errors.length,
            currentStep: this.loadingState.currentStep
        };
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.EnhancedLoader = EnhancedLoader;
}
