/**
 * DOM Safety Utilities
 * أدوات السلامة للتعامل مع DOM
 * 
 * يوفر هذا الملف دوال آمنة للتعامل مع DOM
 * لمنع أخطاء "Cannot read properties of null/undefined"
 * 
 * @version 1.0.0
 * @author HSE System
 */

(function() {
    'use strict';

    // Logger آمن
    const safeLog = (...args) => {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.safeLog === 'function') {
                Utils.safeLog(...args);
            } else if (typeof AppState !== 'undefined' && AppState.debugMode) {
                console.log(...args);
            }
        } catch (e) { /* ignore */ }
    };

    const safeWarn = (...args) => {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.safeWarn === 'function') {
                Utils.safeWarn(...args);
            } else {
                console.warn(...args);
            }
        } catch (e) { /* ignore */ }
    };

    const safeError = (...args) => {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.safeError === 'function') {
                Utils.safeError(...args);
            } else {
                console.error(...args);
            }
        } catch (e) { /* ignore */ }
    };

    /**
     * DOM Safety Utilities Object
     */
    const DOMSafety = {
        /**
         * التحقق من أن DOM جاهز
         * @returns {boolean}
         */
        isDOMReady() {
            return document.readyState === 'complete' || document.readyState === 'interactive';
        },

        /**
         * انتظار جاهزية DOM
         * @returns {Promise<void>}
         */
        waitForDOM() {
            return new Promise((resolve) => {
                if (this.isDOMReady()) {
                    resolve();
                } else {
                    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
                }
            });
        },

        /**
         * التحقق من أن العنصر موجود في DOM
         * @param {Element|null} element 
         * @returns {boolean}
         */
        isInDOM(element) {
            return element && element instanceof Element && document.contains(element);
        },

        /**
         * الحصول على عنصر بـ ID بشكل آمن
         * @param {string} id - معرف العنصر
         * @param {boolean} warnIfMissing - تحذير إذا لم يوجد العنصر
         * @returns {Element|null}
         */
        getElementById(id, warnIfMissing = false) {
            try {
                if (!id || typeof id !== 'string') {
                    if (warnIfMissing) safeWarn('⚠️ DOMSafety.getElementById: id غير صالح');
                    return null;
                }
                const element = document.getElementById(id);
                if (!element) {
                    if (warnIfMissing) safeWarn(`⚠️ DOMSafety.getElementById: العنصر "${id}" غير موجود`);
                    return null;
                }
                if (!document.contains(element)) {
                    if (warnIfMissing) safeWarn(`⚠️ DOMSafety.getElementById: العنصر "${id}" ليس في DOM`);
                    return null;
                }
                return element;
            } catch (error) {
                safeError('❌ DOMSafety.getElementById error:', error);
                return null;
            }
        },

        /**
         * البحث عن عنصر بـ selector بشكل آمن
         * @param {string} selector - CSS selector
         * @param {Element|Document} context - السياق (افتراضي: document)
         * @param {boolean} warnIfMissing - تحذير إذا لم يوجد العنصر
         * @returns {Element|null}
         */
        querySelector(selector, context = document, warnIfMissing = false) {
            try {
                if (!selector || typeof selector !== 'string') {
                    if (warnIfMissing) safeWarn('⚠️ DOMSafety.querySelector: selector غير صالح');
                    return null;
                }
                
                // التحقق من context
                if (!context) {
                    if (warnIfMissing) safeWarn('⚠️ DOMSafety.querySelector: context غير موجود');
                    return null;
                }
                
                // التحقق من أن context في DOM (إذا لم يكن document)
                if (context !== document && !document.contains(context)) {
                    if (warnIfMissing) safeWarn('⚠️ DOMSafety.querySelector: context ليس في DOM');
                    return null;
                }

                const element = context.querySelector(selector);
                if (!element) {
                    if (warnIfMissing) safeWarn(`⚠️ DOMSafety.querySelector: لم يُعثر على "${selector}"`);
                    return null;
                }
                return element;
            } catch (error) {
                safeError('❌ DOMSafety.querySelector error:', error);
                return null;
            }
        },

        /**
         * البحث عن عناصر متعددة بـ selector بشكل آمن
         * @param {string} selector - CSS selector
         * @param {Element|Document} context - السياق (افتراضي: document)
         * @returns {Element[]}
         */
        querySelectorAll(selector, context = document) {
            try {
                if (!selector || typeof selector !== 'string') {
                    return [];
                }
                if (!context) {
                    return [];
                }
                if (context !== document && !document.contains(context)) {
                    return [];
                }
                return Array.from(context.querySelectorAll(selector));
            } catch (error) {
                safeError('❌ DOMSafety.querySelectorAll error:', error);
                return [];
            }
        },

        /**
         * تحديث innerHTML بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} html - HTML المراد تعيينه
         * @returns {boolean} - نجح التحديث أم لا
         */
        setInnerHTML(elementOrId, html) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element) {
                    safeWarn('⚠️ DOMSafety.setInnerHTML: العنصر غير موجود');
                    return false;
                }
                
                if (!document.contains(element)) {
                    safeWarn('⚠️ DOMSafety.setInnerHTML: العنصر ليس في DOM');
                    return false;
                }
                
                element.innerHTML = html || '';
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.setInnerHTML error:', error);
                return false;
            }
        },

        /**
         * تحديث textContent بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} text - النص المراد تعيينه
         * @returns {boolean}
         */
        setTextContent(elementOrId, text) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                element.textContent = text || '';
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.setTextContent error:', error);
                return false;
            }
        },

        /**
         * تعيين قيمة input بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} value - القيمة المراد تعيينها
         * @returns {boolean}
         */
        setValue(elementOrId, value) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                if ('value' in element) {
                    element.value = value || '';
                    return true;
                }
                return false;
            } catch (error) {
                safeError('❌ DOMSafety.setValue error:', error);
                return false;
            }
        },

        /**
         * الحصول على قيمة input بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} defaultValue - القيمة الافتراضية
         * @returns {string}
         */
        getValue(elementOrId, defaultValue = '') {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return defaultValue;
                }
                
                if ('value' in element) {
                    return element.value || defaultValue;
                }
                return defaultValue;
            } catch (error) {
                safeError('❌ DOMSafety.getValue error:', error);
                return defaultValue;
            }
        },

        /**
         * إضافة class بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {...string} classNames - أسماء الـ classes
         * @returns {boolean}
         */
        addClass(elementOrId, ...classNames) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                classNames.forEach(className => {
                    if (className && typeof className === 'string') {
                        element.classList.add(className);
                    }
                });
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.addClass error:', error);
                return false;
            }
        },

        /**
         * إزالة class بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {...string} classNames - أسماء الـ classes
         * @returns {boolean}
         */
        removeClass(elementOrId, ...classNames) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                classNames.forEach(className => {
                    if (className && typeof className === 'string') {
                        element.classList.remove(className);
                    }
                });
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.removeClass error:', error);
                return false;
            }
        },

        /**
         * تبديل class بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} className - اسم الـ class
         * @param {boolean} force - إجبار الإضافة/الإزالة (اختياري)
         * @returns {boolean}
         */
        toggleClass(elementOrId, className, force) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !className) {
                    return false;
                }
                
                if (force !== undefined) {
                    element.classList.toggle(className, force);
                } else {
                    element.classList.toggle(className);
                }
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.toggleClass error:', error);
                return false;
            }
        },

        /**
         * تعيين style بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} property - خاصية CSS
         * @param {string} value - القيمة
         * @returns {boolean}
         */
        setStyle(elementOrId, property, value) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !property) {
                    return false;
                }
                
                element.style[property] = value;
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.setStyle error:', error);
                return false;
            }
        },

        /**
         * تعيين عدة styles بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {Object} styles - كائن يحتوي على الـ styles
         * @returns {boolean}
         */
        setStyles(elementOrId, styles) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !styles) {
                    return false;
                }
                
                Object.entries(styles).forEach(([property, value]) => {
                    element.style[property] = value;
                });
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.setStyles error:', error);
                return false;
            }
        },

        /**
         * إضافة event listener بشكل آمن مع إمكانية الإلغاء
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} eventType - نوع الحدث
         * @param {Function} handler - المعالج
         * @param {Object} options - خيارات addEventListener
         * @returns {Function|null} - دالة لإزالة الـ listener
         */
        addEventListener(elementOrId, eventType, handler, options = {}) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !eventType || typeof handler !== 'function') {
                    return null;
                }
                
                element.addEventListener(eventType, handler, options);
                
                // إرجاع دالة لإزالة الـ listener
                return () => {
                    try {
                        element.removeEventListener(eventType, handler, options);
                    } catch (e) { /* ignore */ }
                };
            } catch (error) {
                safeError('❌ DOMSafety.addEventListener error:', error);
                return null;
            }
        },

        /**
         * إزالة event listener بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} eventType - نوع الحدث
         * @param {Function} handler - المعالج
         * @param {Object} options - خيارات removeEventListener
         * @returns {boolean}
         */
        removeEventListener(elementOrId, eventType, handler, options = {}) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !eventType || typeof handler !== 'function') {
                    return false;
                }
                
                element.removeEventListener(eventType, handler, options);
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.removeEventListener error:', error);
                return false;
            }
        },

        /**
         * إضافة listener باستخدام AbortController
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} eventType - نوع الحدث
         * @param {Function} handler - المعالج
         * @param {AbortController} abortController - AbortController للإلغاء
         * @returns {boolean}
         */
        addAbortableListener(elementOrId, eventType, handler, abortController) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !eventType || typeof handler !== 'function') {
                    return false;
                }
                
                if (!abortController || !(abortController instanceof AbortController)) {
                    safeWarn('⚠️ DOMSafety.addAbortableListener: abortController غير صالح');
                    // نضيف listener عادي كـ fallback
                    element.addEventListener(eventType, handler);
                    return true;
                }
                
                element.addEventListener(eventType, handler, { signal: abortController.signal });
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.addAbortableListener error:', error);
                return false;
            }
        },

        /**
         * تنفيذ دالة بعد جاهزية DOM
         * @param {Function} callback - الدالة المراد تنفيذها
         */
        onDOMReady(callback) {
            if (typeof callback !== 'function') return;
            
            if (this.isDOMReady()) {
                callback();
            } else {
                document.addEventListener('DOMContentLoaded', callback, { once: true });
            }
        },

        /**
         * تنفيذ دالة بعد وجود عنصر معين في DOM
         * @param {string} selector - CSS selector للعنصر
         * @param {Function} callback - الدالة المراد تنفيذها (تستقبل العنصر)
         * @param {number} timeout - الحد الأقصى للانتظار (بالميلي ثانية)
         * @returns {Promise<Element|null>}
         */
        async waitForElement(selector, callback = null, timeout = 5000) {
            return new Promise((resolve) => {
                const startTime = Date.now();
                
                const check = () => {
                    const element = document.querySelector(selector);
                    if (element) {
                        if (typeof callback === 'function') {
                            try {
                                callback(element);
                            } catch (e) {
                                safeError('❌ waitForElement callback error:', e);
                            }
                        }
                        resolve(element);
                        return;
                    }
                    
                    if (Date.now() - startTime >= timeout) {
                        safeWarn(`⚠️ DOMSafety.waitForElement: timeout انتظار العنصر "${selector}"`);
                        resolve(null);
                        return;
                    }
                    
                    requestAnimationFrame(check);
                };
                
                check();
            });
        },

        /**
         * إخفاء عنصر بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @returns {boolean}
         */
        hide(elementOrId) {
            return this.setStyle(elementOrId, 'display', 'none');
        },

        /**
         * إظهار عنصر بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} displayValue - قيمة display (افتراضي: 'block')
         * @returns {boolean}
         */
        show(elementOrId, displayValue = 'block') {
            return this.setStyle(elementOrId, 'display', displayValue);
        },

        /**
         * تبديل إظهار/إخفاء عنصر بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @returns {boolean}
         */
        toggle(elementOrId) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                const currentDisplay = getComputedStyle(element).display;
                element.style.display = currentDisplay === 'none' ? 'block' : 'none';
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.toggle error:', error);
                return false;
            }
        },

        /**
         * التحقق من أن عنصر مخفي
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @returns {boolean}
         */
        isHidden(elementOrId) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element) return true;
                
                return getComputedStyle(element).display === 'none' || 
                       element.offsetParent === null ||
                       element.hidden;
            } catch (error) {
                return true;
            }
        },

        /**
         * إزالة عنصر من DOM بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @returns {boolean}
         */
        remove(elementOrId) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                element.remove();
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.remove error:', error);
                return false;
            }
        },

        /**
         * الحصول على attribute بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} attributeName - اسم الـ attribute
         * @param {string} defaultValue - القيمة الافتراضية
         * @returns {string|null}
         */
        getAttribute(elementOrId, attributeName, defaultValue = null) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !attributeName) {
                    return defaultValue;
                }
                
                return element.getAttribute(attributeName) ?? defaultValue;
            } catch (error) {
                return defaultValue;
            }
        },

        /**
         * تعيين attribute بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} attributeName - اسم الـ attribute
         * @param {string} value - القيمة
         * @returns {boolean}
         */
        setAttribute(elementOrId, attributeName, value) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !attributeName) {
                    return false;
                }
                
                element.setAttribute(attributeName, value);
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.setAttribute error:', error);
                return false;
            }
        },

        /**
         * إزالة attribute بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} attributeName - اسم الـ attribute
         * @returns {boolean}
         */
        removeAttribute(elementOrId, attributeName) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !attributeName) {
                    return false;
                }
                
                element.removeAttribute(attributeName);
                return true;
            } catch (error) {
                safeError('❌ DOMSafety.removeAttribute error:', error);
                return false;
            }
        },

        /**
         * التحقق من وجود class
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {string} className - اسم الـ class
         * @returns {boolean}
         */
        hasClass(elementOrId, className) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element) || !className) {
                    return false;
                }
                
                return element.classList.contains(className);
            } catch (error) {
                return false;
            }
        },

        /**
         * تعطيل عنصر input/button بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {boolean} disabled - تعطيل أو تفعيل
         * @returns {boolean}
         */
        setDisabled(elementOrId, disabled = true) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                if ('disabled' in element) {
                    element.disabled = disabled;
                    return true;
                }
                return false;
            } catch (error) {
                return false;
            }
        },

        /**
         * Focus على عنصر بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @returns {boolean}
         */
        focus(elementOrId) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                if (typeof element.focus === 'function') {
                    element.focus();
                    return true;
                }
                return false;
            } catch (error) {
                return false;
            }
        },

        /**
         * Blur عنصر بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @returns {boolean}
         */
        blur(elementOrId) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                if (typeof element.blur === 'function') {
                    element.blur();
                    return true;
                }
                return false;
            } catch (error) {
                return false;
            }
        },

        /**
         * Scroll إلى عنصر بشكل آمن
         * @param {Element|string} elementOrId - العنصر أو معرفه
         * @param {ScrollIntoViewOptions} options - خيارات scrollIntoView
         * @returns {boolean}
         */
        scrollIntoView(elementOrId, options = { behavior: 'smooth', block: 'center' }) {
            try {
                let element = elementOrId;
                if (typeof elementOrId === 'string') {
                    element = this.getElementById(elementOrId);
                }
                
                if (!element || !document.contains(element)) {
                    return false;
                }
                
                element.scrollIntoView(options);
                return true;
            } catch (error) {
                return false;
            }
        }
    };

    // تصدير للاستخدام العام
    window.DOMSafety = DOMSafety;

    // إنشاء اختصارات للدوال الشائعة
    window.$ = window.$ || ((selector, context) => {
        if (typeof selector === 'string') {
            if (selector.startsWith('#') && !selector.includes(' ') && !selector.includes('.')) {
                return DOMSafety.getElementById(selector.substring(1));
            }
            return DOMSafety.querySelector(selector, context);
        }
        return selector;
    });

    window.$$ = window.$$ || ((selector, context) => {
        return DOMSafety.querySelectorAll(selector, context);
    });

    safeLog('✅ تم تحميل DOM Safety Utilities');

})();
