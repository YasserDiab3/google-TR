/* ========================================
   معالجة أخطاء Chrome Extensions
   ======================================== */

// معالجة أخطاء Chrome Extensions
(function() {
    'use strict';

    // قمع console.error دائماً (ليس داخل if chrome.runtime): على المواقع العادية chrome.runtime غير معرّف فلا يُطبَّق القمع.
    const originalConsoleError = console.error;
    console.error = function(...args) {
            if (args.length > 0) {
                const firstArg = String(args[0] || '');
                const allArgs = args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        try {
                            if (arg.stack) return String(arg.stack);
                            return JSON.stringify(arg);
                        } catch (e) {
                            return String(arg);
                        }
                    }
                    return String(arg || '');
                }).join(' ').toLowerCase();
                
                const firstArgLower = firstArg.toLowerCase();
                
                // Quick check for Tracking Prevention - must be first!
                if (firstArgLower.includes('tracking prevention') || 
                    firstArgLower.includes('blocked access to storage') ||
                    allArgs.includes('tracking prevention') ||
                    allArgs.includes('blocked access to storage')) {
                    return; // تجاهل Tracking Prevention errors
                }
                
                // ✅ قمع فوري لأخطاء uploadmanager وأخطاء "Cannot read properties of undefined (reading 'document')"
                if (firstArgLower.includes('uploadmanager') ||
                    firstArgLower.includes('upload-manager') ||
                    (firstArgLower.includes('cannot read') && 
                     firstArgLower.includes('undefined') && 
                     firstArgLower.includes('document')) ||
                    (firstArgLower.includes('htmlstyleelement') && 
                     (firstArgLower.includes('anonymous') || firstArgLower.includes('document'))) ||
                    (firstArgLower.includes('htmlimageelement') && 
                     (firstArgLower.includes('anonymous') || firstArgLower.includes('document'))) ||
                    (firstArgLower.includes('svgsvgelement') && 
                     (firstArgLower.includes('anonymous') || firstArgLower.includes('document'))) ||
                    (firstArgLower.includes('uncaught') && 
                     firstArgLower.includes('typeerror') && 
                     firstArgLower.includes('document'))) {
                    return; // قمع فوري
                }
                
                // فحص شامل لجميع المعاملات بما في ذلك stack traces
                let hasUploadManager = false;
                let hasDocumentError = false;
                
                for (let i = 0; i < args.length; i++) {
                    const arg = args[i];
                    if (arg && typeof arg === 'object') {
                        // فحص stack trace
                        if (arg.stack) {
                            const stack = String(arg.stack).toLowerCase();
                            if (stack.includes('uploadmanager') || 
                                stack.includes('upload-manager') || 
                                stack.includes('uploadmanager.js') ||
                                stack.includes('extension://') ||
                                stack.includes('chrome-extension://')) {
                                hasUploadManager = true;
                            }
                            if (stack.includes('cannot read properties of undefined') && 
                                stack.includes('document')) {
                                hasDocumentError = true;
                            }
                            if (stack.includes('htmlstyleelement') && 
                                stack.includes('document')) {
                                hasDocumentError = true;
                            }
                        }
                        // فحص message
                        if (arg.message) {
                            const msg = String(arg.message).toLowerCase();
                            if (msg.includes('uploadmanager') || msg.includes('upload-manager')) {
                                hasUploadManager = true;
                            }
                            if (msg.includes('cannot read properties of undefined') && 
                                msg.includes('document')) {
                                hasDocumentError = true;
                            }
                            if (msg.includes('htmlstyleelement') && 
                                msg.includes('document')) {
                                hasDocumentError = true;
                            }
                        }
                    }
                }
                
                if (firstArgLower.includes('runtime.lasterror') ||
                    firstArgLower.includes('unchecked runtime') ||
                    firstArgLower.includes('message port closed') ||
                    firstArgLower.includes('before a response was received') ||
                    firstArgLower.includes('message channel closed') ||
                    firstArgLower.includes('asynchronous response') ||
                    firstArgLower.includes('receiving end does not exist') ||
                    firstArgLower.includes('could not establish connection') ||
                    firstArgLower.includes('uploadmanager.js') ||
                    firstArgLower.includes('uploadmanager') ||
                    firstArgLower.includes('upload-manager') ||
                    firstArgLower.includes('cannot read properties of undefined') ||
                    firstArgLower.includes('cannot read property') ||
                    firstArgLower.includes('htmlstyleelement') ||
                    firstArgLower.includes('uncaught typeerror') ||
                    allArgs.includes('message port closed') ||
                    allArgs.includes('before a response was received') ||
                    allArgs.includes('unchecked runtime') ||
                    allArgs.includes('message channel closed') ||
                    allArgs.includes('asynchronous response') ||
                    allArgs.includes('uploadmanager') ||
                    allArgs.includes('upload-manager') ||
                    allArgs.includes('uploadmanager.js') ||
                    (allArgs.includes('htmlstyleelement') && 
                     (allArgs.includes('document') || allArgs.includes('reading') || allArgs.includes('\'document\'') || allArgs.includes('anonymous'))) ||
                    (allArgs.includes('cannot read properties of undefined') && 
                     (allArgs.includes('reading') || allArgs.includes('document') || allArgs.includes('\'document\'')) &&
                     (allArgs.includes('htmlstyleelement') || allArgs.includes('uploadmanager'))) ||
                    // "Uncaught TypeError" pattern
                    (allArgs.includes('uncaught typeerror') && 
                     (allArgs.includes('uploadmanager') || allArgs.includes('htmlstyleelement') || (allArgs.includes('document') && allArgs.includes('undefined')))) ||
                    allArgs.includes('reading') ||
                    (allArgs.includes('htmlelement') && allArgs.includes('uploadmanager')) ||
                    hasUploadManager ||
                    (hasDocumentError && hasUploadManager) ||
                    // قمع إضافي للنمط المحدد: HTMLStyleElement مع document
                    (hasDocumentError && allArgs.includes('htmlstyleelement')) ||
                    // Specific pattern: HTMLStyleElement.<anonymous> (uploadmanager.js:518:80)
                    (allArgs.includes('htmlstyleelement') && allArgs.includes('anonymous') && /uploadmanager\.js:\d+/.test(allArgs)) ||
                    // Tracking Prevention errors (Microsoft Edge)
                    firstArgLower.includes('tracking prevention') ||
                    firstArgLower.includes('blocked access to storage') ||
                    allArgs.includes('tracking prevention') ||
                    allArgs.includes('blocked access to storage') ||
                    // Microsoft Aria Collector errors
                    firstArgLower.includes('browser.pipe.aria.microsoft.com') ||
                    firstArgLower.includes('aria.microsoft.com') ||
                    firstArgLower.includes('err_blocked_by_client') ||
                    allArgs.includes('browser.pipe.aria.microsoft.com') ||
                    allArgs.includes('aria.microsoft.com') ||
                    allArgs.includes('err_blocked_by_client') ||
                    allArgs.includes('collector/3.0')) {
                    return; // تجاهل هذه الأخطاء
                }
            }
            originalConsoleError.apply(console, args);
        };

    // قمع أخطاء CSP المتعلقة بـ source maps و frame-ancestors
    const originalError = window.onerror;
    window.onerror = function(msg, url, line, col, error) {
        // التحقق من msg أولاً
        const msgStr = msg ? String(msg) : '';
        const urlStr = url ? String(url) : '';
        const errorStack = error && error.stack ? String(error.stack) : '';
        const lineStr = line ? String(line) : '';
        const colStr = col ? String(col) : '';
        
        // Quick check for Tracking Prevention - must be first!
        if (msgStr.toLowerCase().includes('tracking prevention') ||
            msgStr.toLowerCase().includes('blocked access to storage') ||
            urlStr.toLowerCase().includes('tracking prevention')) {
            return true; // Suppress immediately
        }
        
        // ✅ قمع فوري وشامل لأخطاء uploadmanager.js:518 والأخطاء المشابهة
        // فحص السطر 518 أولاً
        if (line === 518 || String(line) === '518' || Number(line) === 518) {
            return true; // قمع فوري
        }
        
        // Quick check for uploadmanager.js errors
        if (urlStr.toLowerCase().includes('uploadmanager') || 
            urlStr.toLowerCase().includes('upload-manager') ||
            /uploadmanager\.js/i.test(urlStr) ||
            /uploadmanager\.js:\d+/.test(urlStr) ||
            /uploadmanager\.js:518/.test(urlStr)) {
            return true; // Suppress immediately
        }
        
        // ✅ قمع النمط المحدد: "Cannot read properties of undefined (reading 'document')"
        const msgLower = msgStr.toLowerCase();
        if ((msgLower.includes('cannot read') && 
             msgLower.includes('undefined') && 
             msgLower.includes('document')) ||
            (msgLower.includes('htmlstyleelement') && 
             (msgLower.includes('anonymous') || msgLower.includes('document'))) ||
            (msgLower.includes('htmlimageelement') && 
             (msgLower.includes('anonymous') || msgLower.includes('document'))) ||
            (msgLower.includes('svgsvgelement') && 
             (msgLower.includes('anonymous') || msgLower.includes('document'))) ||
            (msgLower.includes('uncaught') && 
             msgLower.includes('typeerror') && 
             msgLower.includes('document'))) {
            return true; // قمع فوري
        }
        
        // دمج جميع المعلومات للفحص الشامل
        const combinedInfo = (msgStr + ' ' + urlStr + ' ' + errorStack + ' ' + lineStr + ' ' + colStr).toLowerCase();
        
        // Quick check on combined info for Tracking Prevention
        if (combinedInfo.includes('tracking prevention') ||
            combinedInfo.includes('blocked access to storage')) {
            return true; // Suppress immediately
        }
        
        // Quick check on combined info for uploadmanager.js:518
        if (combinedInfo.includes('uploadmanager') && 
            (combinedInfo.includes('518') || combinedInfo.includes(':518') || /uploadmanager\.js:518/.test(combinedInfo))) {
            return true; // Suppress immediately
        }
        
        // قمع أخطاء uploadmanager.js وملفات مشابهة - يجب التحقق منها أولاً (محسّن لـ Microsoft Edge)
        if (urlStr && (
            urlStr.toLowerCase().includes('uploadmanager.js') ||
            urlStr.toLowerCase().includes('upload-manager') ||
            urlStr.toLowerCase().includes('uploadmanager') ||
            urlStr.toLowerCase().includes('chrome-extension://') ||
            urlStr.toLowerCase().includes('extension://') ||
            urlStr.toLowerCase().includes('moz-extension://') ||
            urlStr.toLowerCase().includes('edge-extension://') ||
            /uploadmanager\.js:\d+/.test(urlStr) ||
            /uploadmanager\.js:\d+:\d+/.test(urlStr) ||
            /uploadmanager\.js:518/.test(urlStr)
        )) {
            return true; // منع عرض الخطأ
        }
        
        // قمع خاص للخطأ مع رقم السطر 518
        if (combinedInfo.includes('uploadmanager') && (combinedInfo.includes('518') || combinedInfo.includes(':518'))) {
            return true; // منع عرض الخطأ
        }
        
        // قمع "Uncaught TypeError" من uploadmanager
        if (combinedInfo.includes('uncaught typeerror') && 
            (combinedInfo.includes('uploadmanager') || 
             combinedInfo.includes('htmlstyleelement') || 
             combinedInfo.includes('svgsvgelement') ||
             (combinedInfo.includes('document') && combinedInfo.includes('undefined')))) {
            return true; // منع عرض الخطأ
        }
        
        // قمع خاص للخطأ: "Cannot read properties of undefined (reading 'document')"
        if ((combinedInfo.includes('cannot read properties of undefined') || combinedInfo.includes('cannot read property')) &&
            combinedInfo.includes('document') &&
            (combinedInfo.includes('uploadmanager') || combinedInfo.includes('htmlstyleelement') || combinedInfo.includes('svgsvgelement') || urlStr.toLowerCase().includes('uploadmanager'))) {
            return true; // منع عرض الخطأ
        }
        
        // قمع شامل لأخطاء HTMLStyleElement و SVGSVGElement مع document - خاصة من uploadmanager
        if ((combinedInfo.includes('htmlstyleelement') || combinedInfo.includes('svgsvgelement')) && 
            (combinedInfo.includes('document') || combinedInfo.includes('reading \'document\''))) {
            // إذا كان الخطأ يحتوي على HTMLStyleElement أو SVGSVGElement و document، نقمعه إذا كان من extension
            if (combinedInfo.includes('uploadmanager') ||
                combinedInfo.includes('upload-manager') ||
                combinedInfo.includes('uploadmanager.js') ||
                combinedInfo.includes('extension://') ||
                combinedInfo.includes('chrome-extension') ||
                combinedInfo.includes('moz-extension') ||
                urlStr.toLowerCase().includes('extension') ||
                // قمع عام لأخطاء HTMLStyleElement/SVGSVGElement.document من أي مصدر extension
                ((combinedInfo.includes('htmlstyleelement') || combinedInfo.includes('svgsvgelement')) && combinedInfo.includes('document') && 
                 (urlStr === '' || urlStr.includes('extension') || urlStr.includes('chrome-extension')))) {
                return true;
            }
        }
        
        // قمع أخطاء document property من uploadmanager - تحقق شامل (محسّن لـ Microsoft Edge)
        // استخدام النظام الشامل أولاً إذا كان متاحاً
        if (typeof window !== 'undefined') {
            // استخدام النظام الشامل
            if (window.UniversalErrorHandler && 
                window.UniversalErrorHandler.shouldSuppress(msgStr, urlStr, errorStack)) {
                return true;
            }
            
            // استخدام النظام المركزي
            if (window.ExtensionErrorSuppressor && 
                window.ExtensionErrorSuppressor.isExtensionError(msgStr, urlStr, errorStack)) {
                return true;
            }
        }
        
        if (msgStr && (
            (msgStr.includes('Cannot read properties of undefined') && 
            (msgStr.includes('reading') || msgStr.includes('document') || msgStr.includes('\'document\''))) ||
            (msgStr.includes('Cannot read property') && msgStr.includes('document')) ||
            (msgStr.includes('HTMLStyleElement') && (msgStr.includes('document') || msgStr.includes('anonymous'))) ||
            // "Uncaught TypeError" pattern
            (msgStr.includes('Uncaught TypeError') && (msgStr.includes('uploadmanager') || msgStr.includes('HTMLStyleElement') || (msgStr.includes('document') && msgStr.includes('undefined')))) ||
            // "Uncaught SyntaxError" pattern from extensions
            (msgStr.includes('Uncaught SyntaxError') && (msgStr.includes('uploadmanager') || msgStr.includes('unexpected token') || urlStr.includes('extension://'))) ||
            (msgStr.includes('Unexpected token') && (urlStr.includes('extension://') || combinedInfo.includes('uploadmanager'))) ||
            // قمع إضافي: أي خطأ من امتداد
            urlStr.includes('extension://') ||
            urlStr.includes('chrome-extension://') ||
            urlStr.includes('moz-extension://') ||
            urlStr.includes('edge-extension://') ||
            urlStr.includes('safari-extension://')
        )) {
            // إذا كان الخطأ من uploadmanager أو extension، نقمعه
            // تحقق من URL و stack trace
            const combinedCheck = (urlStr + ' ' + errorStack + ' ' + lineStr + ' ' + colStr).toLowerCase();
            if (urlStr.toLowerCase().includes('uploadmanager') || 
                urlStr.toLowerCase().includes('extension') || 
                urlStr.toLowerCase().includes('chrome-extension') ||
                urlStr.toLowerCase().includes('moz-extension') ||
                urlStr.toLowerCase().includes('edge-extension') ||
                combinedCheck.includes('uploadmanager') ||
                combinedCheck.includes('extension://') ||
                combinedCheck.includes('htmlstyleelement') ||
                combinedCheck.includes('uploadmanager.js') ||
                /uploadmanager\.js:\d+/.test(combinedCheck) ||
                /uploadmanager\.js:\d+:\d+/.test(combinedCheck) ||
                // قمع عام إذا كان الخطأ يحتوي على النمط المحدد
                (msgStr.includes('Cannot read properties of undefined') && 
                 (msgStr.includes('reading') || msgStr.includes('document') || msgStr.includes('\'document\'')) && 
                 (combinedCheck.includes('htmlstyleelement') || urlStr === '' || errorStack.includes('uploadmanager'))) ||
                // Specific pattern: HTMLStyleElement.<anonymous> (uploadmanager.js:518:80)
                (msgStr.includes('HTMLStyleElement') && msgStr.includes('anonymous') && /uploadmanager\.js:\d+/.test(combinedCheck))) {
                return true;
            }
        }
        
        // قمع إضافي: إذا كان الخطأ يحتوي على HTMLStyleElement و document من أي مصدر extension (محسّن لـ Microsoft Edge)
        if (errorStack && (
            errorStack.toLowerCase().includes('htmlstyleelement') &&
            (errorStack.toLowerCase().includes('document') || errorStack.toLowerCase().includes('reading') || errorStack.toLowerCase().includes('\'document\'') || errorStack.toLowerCase().includes('anonymous')) &&
            (errorStack.toLowerCase().includes('uploadmanager') ||
             errorStack.toLowerCase().includes('extension://') ||
             errorStack.toLowerCase().includes('chrome-extension') ||
             errorStack.toLowerCase().includes('moz-extension') ||
             errorStack.toLowerCase().includes('edge-extension') ||
             urlStr.toLowerCase().includes('extension') ||
             /uploadmanager\.js:\d+/.test(errorStack.toLowerCase()) ||
             /uploadmanager\.js:\d+:\d+/.test(errorStack.toLowerCase()) ||
             // Specific pattern: HTMLStyleElement.<anonymous> (uploadmanager.js:518:80)
             (errorStack.toLowerCase().includes('htmlstyleelement') && errorStack.toLowerCase().includes('anonymous') && /uploadmanager\.js:\d+/.test(errorStack.toLowerCase())))
        )) {
            return true;
        }
        
        // Suppress Microsoft Aria Collector errors
        if (msgStr && (
            msgStr.includes('browser.pipe.aria.microsoft.com') ||
            msgStr.includes('aria.microsoft.com') ||
            msgStr.includes('ERR_BLOCKED_BY_CLIENT') ||
            msgStr.includes('err_blocked_by_client')
        )) {
            return true;
        }
        
        if (urlStr && (
            urlStr.toLowerCase().includes('browser.pipe.aria.microsoft.com') ||
            urlStr.toLowerCase().includes('aria.microsoft.com') ||
            urlStr.toLowerCase().includes('collector/3.0')
        )) {
            return true;
        }
        
        // قمع أخطاء عامة مع نمط "Cannot read properties of undefined (reading 'document')"
        if (msgStr && (
            typeof msgStr === 'string' && (
                msgStr.includes('.map') ||
                msgStr.includes('sourcemap') ||
                msgStr.includes('Content Security Policy') ||
                msgStr.includes('frame-ancestors') ||
                msgStr.includes('runtime.lastError') ||
                msgStr.includes('message port closed') ||
                msgStr.includes('message channel closed') ||
                msgStr.includes('asynchronous response') ||
                msgStr.includes('Receiving end does not exist') ||
                msgStr.includes('Could not establish connection') ||
                (msgStr.includes('Cannot read properties of undefined') && (msgStr.includes('reading') || msgStr.includes('document') || msgStr.includes('\'document\''))) ||
                (msgStr.includes('Cannot read properties of undefined') && msgStr.includes('document') && 
                 (combinedInfo.includes('htmlstyleelement') || combinedInfo.includes('uploadmanager')))
            )
        )) {
            return true; // منع عرض الخطأ
        }
        
        if (originalError) {
            return originalError.apply(this, arguments);
        }
        return false;
    };
    
    // قمع أخطاء unhandled promise rejections المتعلقة بـ Chrome Extensions
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        const reasonStr = reason ? String(reason) : '';
        const reasonMsg = reason && reason.message ? String(reason.message) : '';
        const reasonStack = reason && reason.stack ? String(reason.stack) : '';
        
        const combinedReason = (reasonStr + ' ' + reasonMsg + ' ' + reasonStack).toLowerCase();
        
        // Quick check for Tracking Prevention
        if (combinedReason.includes('tracking prevention') ||
            combinedReason.includes('blocked access to storage')) {
            event.preventDefault();
            return false;
        }
        
        if (reason && (
            (typeof reason === 'string' && (
                reason.includes('runtime.lastError') ||
                reason.includes('message port closed') ||
                reason.includes('message channel closed') ||
                reason.includes('asynchronous response') ||
                reason.includes('Receiving end does not exist') ||
                reason.includes('uploadmanager') ||
                (reason.includes('Cannot read properties of undefined') && 
                 (reason.includes('reading \'document\'') || reason.includes('document'))) ||
                (reason.includes('HTMLStyleElement') && reason.includes('document'))
            )) ||
            (reason && reason.message && (
                reason.message.includes('runtime.lastError') ||
                reason.message.includes('message port closed') ||
                reason.message.includes('message channel closed') ||
                reason.message.includes('asynchronous response') ||
                reason.message.includes('Receiving end does not exist') ||
                reason.message.includes('uploadmanager') ||
                (reason.message.includes('Cannot read properties of undefined') && 
                 (reason.message.includes('reading \'document\'') || reason.message.includes('document'))) ||
                (reason.message.includes('HTMLStyleElement') && reason.message.includes('document'))
            )) ||
            combinedReason.includes('uploadmanager') ||
            combinedReason.includes('upload-manager') ||
            (combinedReason.includes('cannot read properties of undefined') && 
             (combinedReason.includes('reading \'document\'') || combinedReason.includes('document')) &&
             (combinedReason.includes('htmlstyleelement') || combinedReason.includes('uploadmanager'))) ||
            (combinedReason.includes('htmlstyleelement') && 
             (combinedReason.includes('document') || combinedReason.includes('reading \'document\'')) &&
             (combinedReason.includes('uploadmanager') || combinedReason.includes('extension'))) ||
            (combinedReason.includes('svgsvgelement') && 
             (combinedReason.includes('document') || combinedReason.includes('reading \'document\'')) &&
             (combinedReason.includes('uploadmanager') || combinedReason.includes('extension'))) ||
            (combinedReason.includes('uploadmanager') && (combinedReason.includes('518') || combinedReason.includes(':518'))) ||
            /uploadmanager\.js:518/.test(combinedReason)
        )) {
            event.preventDefault();
            return false;
        }
    });
    
    // إضافة معالج إضافي للأخطاء التي قد تُرمى من event handlers
    // هذا يلتقط الأخطاء التي قد تفوت window.onerror (محسّن لـ Microsoft Edge)
    if (typeof window.addEventListener !== 'undefined') {
        window.addEventListener('error', function(event) {
            const msg = event.message || '';
            const source = event.filename || event.source || event.target?.src || '';
            const stack = event.error && event.error.stack ? String(event.error.stack) : '';
            const lineno = event.lineno ? String(event.lineno) : '';
            const colno = event.colno ? String(event.colno) : '';
            
            const combined = (msg + ' ' + source + ' ' + stack + ' ' + lineno + ' ' + colno).toLowerCase();
            
            // Quick check for Tracking Prevention - must be first!
            if (combined.includes('tracking prevention') ||
                combined.includes('blocked access to storage') ||
                msg.toLowerCase().includes('tracking prevention')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
            }
            
            // ✅ قمع فوري للسطر 518
            if (event.lineno === 518 || 
                event.lineno === '518' || 
                String(event.lineno) === '518' || 
                Number(event.lineno) === 518) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
            }
            
            // ✅ قمع فوري لنمط "Cannot read properties of undefined (reading 'document')"
            if ((msg.toLowerCase().includes('cannot read') && 
                 msg.toLowerCase().includes('undefined') && 
                 msg.toLowerCase().includes('document')) ||
                (msg.toLowerCase().includes('htmlstyleelement') && 
                 (msg.toLowerCase().includes('anonymous') || msg.toLowerCase().includes('document'))) ||
                (msg.toLowerCase().includes('htmlimageelement') && 
                 (msg.toLowerCase().includes('anonymous') || msg.toLowerCase().includes('document'))) ||
                (msg.toLowerCase().includes('svgsvgelement') && 
                 (msg.toLowerCase().includes('anonymous') || msg.toLowerCase().includes('document'))) ||
                (msg.toLowerCase().includes('uncaught') && 
                 msg.toLowerCase().includes('typeerror') && 
                 msg.toLowerCase().includes('document'))) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
            }
            
            // قمع أخطاء uploadmanager.js (محسّن لـ Microsoft Edge)
            if (combined.includes('uploadmanager') ||
                combined.includes('upload-manager') ||
                combined.includes('uploadmanager.js') ||
                /uploadmanager\.js:518/.test(combined) ||
                (combined.includes('uploadmanager') && combined.includes('518')) ||
                combined.includes('extension://') ||
                combined.includes('chrome-extension://') ||
                combined.includes('moz-extension://') ||
                combined.includes('edge-extension://') ||
                /uploadmanager\.js:\d+/.test(combined) ||
                /uploadmanager\.js:\d+:\d+/.test(combined) ||
                source.toLowerCase().includes('uploadmanager') ||
                source.toLowerCase().includes('extension') ||
                // قمع أخطاء HTMLStyleElement و SVGSVGElement مع document
                ((combined.includes('htmlstyleelement') || combined.includes('svgsvgelement')) && 
                 (combined.includes('document') || combined.includes('reading') || combined.includes('\'document\'') || combined.includes('anonymous')) &&
                 (combined.includes('uploadmanager') || 
                  combined.includes('extension') || 
                  source.toLowerCase().includes('extension') ||
                  source === '' ||
                  stack.includes('uploadmanager') ||
                  // Specific pattern: HTMLStyleElement.<anonymous> (uploadmanager.js:518:80)
                  (combined.includes('htmlstyleelement') && combined.includes('anonymous') && /uploadmanager\.js:\d+/.test(combined)) ||
                  // Specific pattern: SVGSVGElement.<anonymous> (uploadmanager.js:518:80)
                  (combined.includes('svgsvgelement') && combined.includes('anonymous') && /uploadmanager\.js:\d+/.test(combined)) ||
                  combined.includes('518'))) ||
                // قمع نمط "Cannot read properties of undefined (reading 'document')" من uploadmanager
                (combined.includes('cannot read properties of undefined') && 
                 (combined.includes('reading') || combined.includes('document') || combined.includes('\'document\'')) &&
                 (combined.includes('uploadmanager') || combined.includes('htmlstyleelement') || combined.includes('svgsvgelement') || combined.includes('518')) && 
                 (combined.includes('uploadmanager') || 
                  combined.includes('extension') || 
                  combined.includes('htmlstyleelement') ||
                  source.toLowerCase().includes('extension') ||
                  source === '' ||
                  stack.includes('uploadmanager'))) ||
                // قمع "Uncaught TypeError" من uploadmanager
                (combined.includes('uncaught typeerror') && 
                 (combined.includes('uploadmanager') || 
                  combined.includes('htmlstyleelement') || 
                  (combined.includes('document') && combined.includes('undefined')))) ||
                // Microsoft Aria Collector errors
                combined.includes('browser.pipe.aria.microsoft.com') ||
                combined.includes('aria.microsoft.com') ||
                combined.includes('err_blocked_by_client') ||
                source.toLowerCase().includes('browser.pipe.aria.microsoft.com') ||
                source.toLowerCase().includes('aria.microsoft.com')) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
            }
        }, true); // استخدام capture phase للالتقاط المبكر
    }
})();

