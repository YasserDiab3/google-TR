/* ========================================
   قمع شامل ونهائي لأخطاء uploadmanager.js:518
   ملاحظة: هذا الملف احتياطي - الحماية الأساسية inline في index.html
   V5: يتضمن تحويل Google Drive URLs إلى صيغة thumbnail الآمنة
   ======================================== */

(function() {
    'use strict';
    
    // التحقق من أن الحماية الأساسية موجودة
    if (!window.__errorSuppressorActive) {
        console.warn('⚠️ Primary error suppressor not detected - activating backup');
    }
    
    // ✅ تحويل Google Drive URLs إلى صيغة آمنة (احتياطي)
    if (!window.__convertGoogleDriveUrl) {
        window.__convertGoogleDriveUrl = function(url) {
            if (!url || typeof url !== 'string') return url;
            
            // تحويل /uc?export=view URLs إلى صيغة عرض أكثر استقراراً من thumbnail
            var driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/i);
            if (driveUcMatch && driveUcMatch[1]) {
                return 'https://drive.google.com/uc?export=view&id=' + driveUcMatch[1];
            }
            
            // تحويل /file/d/ URLs
            var driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
            if (driveFileMatch && driveFileMatch[1]) {
                return 'https://drive.google.com/uc?export=view&id=' + driveFileMatch[1];
            }
            
            return url;
        };
    }
    
    // دالة فحص شاملة ومحسّنة لأخطاء uploadmanager
    const isUploadManagerError = function(text) {
        if (!text) return false;
        const t = String(text).toLowerCase();
        
        // فحص مباشر لـ uploadmanager
        if (t.includes('uploadmanager') || 
            t.includes('upload-manager') ||
            /uploadmanager\.js/i.test(t) ||
            /uploadmanager\.js:\d+/i.test(t) ||
            /uploadmanager\.js:518/i.test(t)) {
            return true;
        }
        
        // فحص النمط الخاص: "Cannot read properties of undefined (reading 'document')"
        if (t.includes('cannot read propert') && 
            t.includes('undefined') && 
            t.includes('document')) {
            if (t.includes('htmlstyleelement') || 
                t.includes('htmlimageelement') || 
                t.includes('svgsvgelement') || 
                t.includes('anonymous') ||
                t.includes('518') ||
                t.includes(':518') ||
                /:\d+:\d+/.test(t)) {
                return true;
            }
        }
        
        // فحص النمط: HTMLStyleElement.<anonymous>
        if ((t.includes('htmlstyleelement') || 
             t.includes('htmlimageelement') || 
             t.includes('svgsvgelement')) && 
            (t.includes('anonymous') || t.includes('<anonymous>'))) {
            if (t.includes('518') || 
                t.includes('reading') || 
                t.includes('document') ||
                /:\d+:\d+/.test(t)) {
                return true;
            }
        }
        
        // فحص أي uncaught typeerror مع document و undefined
        if (t.includes('uncaught') && 
            t.includes('typeerror') &&
            t.includes('document') && 
            t.includes('undefined')) {
            return true;
        }
        
        // فحص نمط "reading 'document'" مع anonymous
        if (t.includes('reading') && 
            t.includes('document') && 
            t.includes('anonymous')) {
            return true;
        }
        
        return false;
    };

    // ✅ ضوضاء غير حرجة في الإنتاج (شبكة/خدمات خارجية)
    const isNonCriticalNoise = function(text) {
        if (!text) return false;
        const t = String(text).toLowerCase();
        // Vercel Live feedback (قد يرجع 503 مؤقتاً)
        if (t.includes('vercel.live/_next-live/feedback/feedback.js') && (t.includes('503') || t.includes('service unavailable') || t.includes('err_aborted'))) {
            return true;
        }
        // Google Drive thumbnails (قد يرجع 503 مؤقتاً)
        if (t.includes('drive.google.com/thumbnail') && (t.includes('503') || t.includes('service unavailable'))) {
            return true;
        }
        // رسالة عدم الاتصال بالخادم (تظهر كتحذير متكرر)
        if (t.includes('التطبيق يعمل بدون نشر') || t.includes('no server connection') || t.includes('running without backend')) {
            return true;
        }
        return false;
    };
    
    // ✅ قمع window.onerror - الأولوية القصوى
    const originalOnError = window.onerror;
    window.onerror = function(msg, url, line, col, error) {
        try {
            // فحص فوري للسطر 518 (أو العمود 80 المذكور في الخطأ :518:80)
            if (line === 518 || String(line) === '518' || Number(line) === 518 || (line === 518 && (col === 80 || col === '80'))) {
                return true; // قمع فوري
            }
            
            const msgStr = String(msg || '').toLowerCase();
            const urlStr = String(url || '').toLowerCase();
            const errorStack = (error && error.stack ? String(error.stack) : '').toLowerCase();
            const combined = msgStr + ' ' + urlStr + ' ' + errorStack;
            
            // أي خطأ من uploadmanager أو النمط reading 'document'
            if (urlStr.indexOf('uploadmanager') !== -1 || urlStr.indexOf('uploadmanager.js') !== -1) {
                return true;
            }
            
            // فحص شامل
            if (isUploadManagerError(combined) || 
                urlStr.includes('uploadmanager') ||
                urlStr.includes('upload-manager') ||
                /uploadmanager\.js/i.test(urlStr) ||
                (msgStr.includes('cannot read') && 
                 msgStr.includes('undefined') && 
                 msgStr.includes('document')) ||
                (msgStr.includes('htmlstyleelement') && 
                 msgStr.includes('anonymous')) ||
                (msgStr.includes('htmlimageelement') && 
                 msgStr.includes('anonymous')) ||
                (msgStr.includes('svgsvgelement') && 
                 msgStr.includes('anonymous')) ||
                (msgStr.includes('uncaught') && 
                 msgStr.includes('typeerror') && 
                 msgStr.includes('document'))) {
                return true; // قمع الخطأ
            }
        } catch (e) {
            return true; // قمع في حالة حدوث خطأ
        }
        
        if (originalOnError) {
            return originalOnError.apply(this, arguments);
        }
        return false;
    };
    
    // ✅ قمع console.error - عدواني جداً (فحص كل المعاملات + كائن Error)
    if (typeof console !== 'undefined' && console.error) {
        const originalError = console.error;
        console.error = function(...args) {
            try {
                const noiseText = args.map(a => (a && a.stack) ? (a.message + ' ' + a.stack) : String(a || '')).join(' ');
                if (isNonCriticalNoise(noiseText)) return;
            } catch (e) { /* ignore */ }
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                var firstStr = (arg && typeof arg === 'object')
                    ? ((arg.message || '') + ' ' + (arg.stack || '')).toLowerCase()
                    : String(arg || '').toLowerCase();
                if (firstStr.indexOf('uploadmanager') !== -1 ||
                    firstStr.indexOf('upload-manager') !== -1 ||
                    (firstStr.indexOf('cannot read') !== -1 && firstStr.indexOf('undefined') !== -1 && firstStr.indexOf('document') !== -1) ||
                    (firstStr.indexOf('htmlstyleelement') !== -1 && firstStr.indexOf('anonymous') !== -1) ||
                    (firstStr.indexOf('htmlimageelement') !== -1 && firstStr.indexOf('anonymous') !== -1) ||
                    (firstStr.indexOf('svgsvgelement') !== -1 && firstStr.indexOf('anonymous') !== -1) ||
                    (firstStr.indexOf('uncaught') !== -1 && firstStr.indexOf('typeerror') !== -1 && firstStr.indexOf('document') !== -1) ||
                    firstStr.indexOf(':518:') !== -1) {
                    return; // قمع فوري
                }
            }
            
            // فحص شامل
            try {
                const allText = args.map(arg => {
                    if (typeof arg === 'string') return arg;
                    if (arg && typeof arg === 'object') {
                        const msg = arg.message || '';
                        const stack = arg.stack || '';
                        return msg + ' ' + stack + ' ' + String(arg);
                    }
                    return String(arg || '');
                }).join(' ');
                
                if (isUploadManagerError(allText)) {
                    return;
                }
            } catch (e) {
                if (args.length > 0 && String(args[0]).toLowerCase().includes('uploadmanager')) {
                    return;
                }
            }
            
            originalError.apply(console, args);
        };
    }
    
    // ✅ قمع console.warn
    if (typeof console !== 'undefined' && console.warn) {
        const originalWarn = console.warn;
        console.warn = function(...args) {
            try {
                const allText = args.map(arg => String(arg || '')).join(' ');
                if (isUploadManagerError(allText) || isNonCriticalNoise(allText)) {
                    return;
                }
            } catch (e) {
                // تجاهل
            }
            originalWarn.apply(console, args);
        };
    }
    
    // ✅ قمع error event
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('error', function(e) {
            try {
                const filename = (e.filename || '').toLowerCase();
                const message = (e.message || '').toLowerCase();
                const errorStack = (e.error && e.error.stack ? String(e.error.stack) : '').toLowerCase();
                const lineno = e.lineno;
                const combined = filename + ' ' + message + ' ' + errorStack;
                
                // فحص فوري للسطر 518
                if (lineno === 518 || lineno === '518' || String(lineno) === '518' || Number(lineno) === 518) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
                
                // فحص شامل
                if (isUploadManagerError(combined) || 
                    filename.includes('uploadmanager') ||
                    filename.includes('upload-manager') ||
                    (message.includes('cannot read') && 
                     message.includes('undefined') && 
                     message.includes('document')) ||
                    (message.includes('htmlstyleelement') && 
                     message.includes('anonymous')) ||
                    (message.includes('htmlimageelement') && 
                     message.includes('anonymous')) ||
                    (message.includes('svgsvgelement') && 
                     message.includes('anonymous')) ||
                    (message.includes('uncaught') && 
                     message.includes('typeerror') && 
                     message.includes('document'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            } catch (err) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }, true); // capture phase
    }
    
    // ✅ قمع unhandledrejection
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('unhandledrejection', function(e) {
            try {
                const reason = e.reason;
                const reasonStr = String(reason || '').toLowerCase();
                const reasonMsg = (reason && reason.message ? String(reason.message) : '').toLowerCase();
                const reasonStack = (reason && reason.stack ? String(reason.stack) : '').toLowerCase();
                const combined = reasonStr + ' ' + reasonMsg + ' ' + reasonStack;
                
                if (isUploadManagerError(combined) ||
                    (combined.includes('cannot read') && 
                     combined.includes('undefined') && 
                     combined.includes('document')) ||
                    (combined.includes('htmlstyleelement') && 
                     combined.includes('anonymous')) ||
                    (combined.includes('htmlimageelement') && 
                     combined.includes('anonymous')) ||
                    (combined.includes('svgsvgelement') && 
                     combined.includes('anonymous')) ||
                    (combined.includes('uncaught') && 
                     combined.includes('typeerror') && 
                     combined.includes('document'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            } catch (err) {
                // تجاهل
            }
        }, true);
    }
    
    console.log('✅ uploadmanager error suppressor loaded successfully');
})();
