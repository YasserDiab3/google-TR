/**
 * Service Worker for HSE Management System
 * يدير التخزين المؤقت للملفات لتحسين الأداء
 */

/**
 * مضيفات إضافية تُفعّل سجلات تشخيص Service Worker (إلى جانب localhost)
 * ضع هنا نطاق المعاينة/الاختبار الثابت، مثال: 'preview.example.com'
 */
const SW_DEV_EXTRA_HOSTS = [
    // 'preview.example.com',
    // 'staging.example.com',
];

/**
 * لاحقات مضيف: يُطابق إن كان المضيف يساوي اللاحقة أو ينتهي بـ .لاحقة
 * مثال: '.internal' يطابق 'app.internal' و 'x.y.internal'
 */
const SW_DEV_HOST_SUFFIXES = [
    // 'pages.dev',
    // 'staging.example.com',
];

function isSwDev() {
    try {
        const h = self.location.hostname;
        const q = String(self.location.search || '');
        if (h === 'localhost' || h === '127.0.0.1') return true;
        if (q.includes('dev=true')) return true;
        if (SW_DEV_EXTRA_HOSTS.length && SW_DEV_EXTRA_HOSTS.includes(h)) return true;
        for (let i = 0; i < SW_DEV_HOST_SUFFIXES.length; i++) {
            const s = SW_DEV_HOST_SUFFIXES[i];
            if (!s) continue;
            if (h === s || h.endsWith('.' + s) || (s.startsWith('.') && h.endsWith(s))) {
                return true;
            }
        }
        // معاينات Vercel: غالباً يحتوي المضيف على -git- ضمن *.vercel.app (ليس نشر الإنتاج الافتراضي)
        if (h.endsWith('.vercel.app') && h.includes('-git-')) return true;
        return false;
    } catch (_) {
        return false;
    }
}

// في الإنتاج: كتم console لتقليل الضوضاء؛ في التطوير المحلي تبقى السجلات للتشخيص
(function () {
    if (isSwDev()) return;
    const noop = function () {};
    console.log = noop;
    console.error = noop;
    console.warn = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
})();

// Bump cache version to force clients to pick up latest JS/CSS updates (زيادة عند كل نشر لظهور التحديثات)
// يجب تحديث __SW_REGISTER_QUERY في index.html بنفس اللاحقة عند تغيير الإصدار لتسريع اكتشاف service-worker.js
// Service Worker Version: 20260501 — isSwDev: مضيفات إضافية + معاينة Vercel
const CACHE_VERSION = 'hse-app-v1.0.18-20260501';
const CACHE_NAME = `hse-cache-${CACHE_VERSION}`;

/** أقصى حجم لعنصر في الكاش (بايت) — يحدّ تخزين ملفات CDN الضخمة */
const MAX_CACHE_ENTRY_BYTES = 1.25 * 1024 * 1024;

function responseOkToCache(response) {
    if (!response || !response.ok || response.status !== 200) return false;
    const len = response.headers.get('content-length');
    if (len != null) {
        const n = parseInt(len, 10);
        if (!Number.isNaN(n) && n > MAX_CACHE_ENTRY_BYTES) return false;
    }
    return true;
}

async function safeCachePut(cache, request, response) {
    if (!responseOkToCache(response)) return;
    try {
        await cache.put(request, response.clone());
    } catch (e) {}
}

// تحديد المسار الأساسي بناءً على موقع Service Worker
const BASE_PATH = self.location.pathname.includes('/Frontend/') ? '/Frontend' : '';

console.log('[Service Worker] المسار الأساسي:', BASE_PATH);

// عند تثبيت SW فقط — قائمة مختصرة؛ الموديولات الأخرى تُحمَّل عند الطلب (شبكة أولاً) دون دفعة تحميل ضخمة
// الحد الأدنى للتثبيت السريع؛ app-utils والموديولات تُحمَّل عند الطلب (شبكة أولاً) لتفادي كاش قديم في precache
const CORE_CACHE_FILES = [
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/icons/icon-192x192.png`,
    `${BASE_PATH}/icons/icon-384x384.png`,
    `${BASE_PATH}/icons/icon-512x512.png`,
    `${BASE_PATH}/js/app-bootstrap.js`,
    `${BASE_PATH}/js/modules/lazy-loader.js`,
    `${BASE_PATH}/js/modules/enhanced-loader.js`
];

// الموديولات التي سيتم تخزينها مؤقتاً عند الطلب
const MODULE_CACHE_FILES = [
    `${BASE_PATH}/js/modules/modules-loader.js`,
    `${BASE_PATH}/js/modules/sync-improvements.js`,
    `${BASE_PATH}/js/modules/error-handling.js`,
    `${BASE_PATH}/js/modules/dynamic-module-loader.js`
];

// استراتيجيات التخزين المؤقت
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',      // التخزين المؤقت أولاً
    NETWORK_FIRST: 'network-first',  // الشبكة أولاً
    CACHE_ONLY: 'cache-only',        // التخزين المؤقت فقط
    NETWORK_ONLY: 'network-only'     // الشبكة فقط
};

/**
 * حدث التثبيت
 */
self.addEventListener('install', (event) => {
    if (isSwDev()) console.log('[Service Worker] تثبيت Service Worker...');

    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                if (isSwDev()) console.log('[Service Worker] تخزين الملفات الأساسية...');
                await Promise.all(
                    CORE_CACHE_FILES.map((url) =>
                        cache
                            .add(new Request(url, { cache: 'reload' }))
                            .catch((err) => {
                                if (isSwDev()) {
                                    console.warn('[Service Worker] تخطّي ملف precache:', url, err);
                                }
                            })
                    )
                );
                if (isSwDev()) console.log('[Service Worker] انتهى التثبيت (قد يكون precache جزئياً)');
            } catch (error) {
                if (isSwDev()) console.error('[Service Worker] فشل فتح الكاش أثناء التثبيت:', error);
            } finally {
                await self.skipWaiting();
            }
        })()
    );
});

/**
 * حدث التنشيط
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] تنشيط Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                // حذف التخزينات المؤقتة القديمة
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('hse-cache-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[Service Worker] حذف التخزين المؤقت القديم:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] تم التنشيط بنجاح');
                return self.clients.claim();
            })
    );
});

/**
 * حدث الطلب (Fetch)
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    try {
        const url = new URL(request.url);
        
        // تجاهل الطلبات غير HTTP/HTTPS (مثل file://)
        if (!request.url.startsWith('http')) {
            return;
        }
        
        // تجاهل الصور المحلية (file://) لتجنب OpaqueResponseBlocking
        if (request.destination === 'image' && (url.protocol === 'file:' || url.hostname === '')) {
            return;
        }
        
        // تجاهل أي طلبات من file:// protocol لتجنب OpaqueResponseBlocking
        if (url.protocol === 'file:') {
            return;
        }
        
        // تجاهل طلبات POST, PUT, DELETE وغيرها - تمريرها مباشرة للشبكة
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return;
        }
        
        // تجاهل الطلبات التي تحتوي على headers خاصة بالمصادقة
        // للتأكد من عدم التداخل مع بيانات الجلسة
        if (request.headers.get('X-Skip-Service-Worker') === 'true') {
            return;
        }
        
        // للـ CDN resources، السماح بالمرور مباشرة إذا فشل Service Worker
        // هذا يمنع حجب الموارد المهمة مثل Font Awesome و Tailwind CSS و Chart.js
        if (isCDNResource(url)) {
            // معالجة خاصة لـ Chart.js - السماح بالمرور مباشرة إذا فشل Service Worker
            const isChartJS = url.pathname.includes('chart.js') || 
                             url.pathname.includes('chartjs') || 
                             url.pathname.includes('Chart.js');
            
            // استخدام fetch مباشرة مع fallback للكاش
            event.respondWith(
                (async () => {
                    try {
                        // محاولة من الكاش أولاً (فقط إذا لم يكن Chart.js - لتجنب مشاكل CORS)
                        if (!isChartJS) {
                            try {
                                const cache = await caches.open(CACHE_NAME);
                                const cached = await cache.match(request);
                                
                                if (cached) {
                                    // تحديث في الخلفية
                                    fetch(request).then(response => {
                                        if (response && response.ok && responseOkToCache(response)) {
                                            cache.put(request, response.clone()).catch(() => {});
                                        }
                                    }).catch(() => {});
                                    return cached;
                                }
                            } catch (cacheError) {
                                // تجاهل أخطاء الكاش، نتابع مع الشبكة
                            }
                        }
                        
                        // محاولة من الشبكة
                        try {
                            const fetchOptions = {
                                mode: 'cors',
                                credentials: 'omit',
                                cache: isChartJS ? 'no-cache' : 'default'
                            };
                            
                            const response = await fetch(request, fetchOptions);
                            if (response && response.ok) {
                                // تخزين في الكاش (فقط إذا لم يكن Chart.js)
                                if (!isChartJS) {
                                    try {
                                        const cache = await caches.open(CACHE_NAME);
                                        await safeCachePut(cache, request, response);
                                    } catch (e) {}
                                }
                                return response;
                            }
                        } catch (networkError) {
                            // تجاهل خطأ الشبكة، نتابع مع fallback
                        }
                        
                        // محاولة fallback URLs (مهم جداً لـ Chart.js)
                        const fallbackUrls = getCDNFallbackUrls(request.url);
                        for (const fallbackUrl of fallbackUrls) {
                            try {
                                const fallbackResponse = await fetch(fallbackUrl, {
                                    mode: 'cors',
                                    credentials: 'omit',
                                    cache: 'no-cache'
                                });
                                if (fallbackResponse && fallbackResponse.ok) {
                                    // لا نخزن Chart.js في الكاش لتجنب مشاكل CORS
                                    if (!isChartJS) {
                                        try {
                                            const cache = await caches.open(CACHE_NAME);
                                            await safeCachePut(cache, request, fallbackResponse);
                                        } catch (e) {}
                                    }
                                    return fallbackResponse;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        // إذا فشل كل شيء، محاولة أخيرة بدون service worker
                        // خاصة مهمة لـ Chart.js
                        try {
                            return await fetch(request, { 
                                mode: 'cors',
                                credentials: 'omit',
                                cache: 'no-cache'
                            });
                        } catch (finalError) {
                            // إذا فشل كل شيء، إرجاع استجابة خطأ بدلاً من رفض الوعد
                            // هذا يمنع "ServiceWorker passed a promise that rejected"
                            // لكن لـ Chart.js، نفضل عدم إرجاع خطأ بل السماح للمتصفح بالتعامل معه
                            if (isChartJS) {
                                // لـ Chart.js، نعيد محاولة مباشرة بدون service worker
                                // هذا يسمح للمتصفح بالتعامل مع الخطأ بشكل طبيعي
                                return fetch(request.clone(), { 
                                    mode: 'cors',
                                    credentials: 'omit',
                                    cache: 'no-cache'
                                }).catch(() => {
                                    // إذا فشل كل شيء، نعيد استجابة فارغة بدلاً من رفض الوعد
                                    return new Response(null, {
                                        status: 503,
                                        statusText: 'Service Unavailable'
                                    });
                                });
                            }
                            return new Response(null, {
                                status: 503,
                                statusText: 'Service Unavailable'
                            });
                        }
                    } catch (error) {
                        // معالجة أي أخطاء غير متوقعة - إرجاع استجابة بدلاً من رفض الوعد
                        try {
                            return await fetch(request, { 
                                mode: 'cors',
                                credentials: 'omit',
                                cache: 'no-cache'
                            });
                        } catch (fetchError) {
                            return new Response(null, {
                                status: 503,
                                statusText: 'Service Unavailable'
                            });
                        }
                    }
                })()
            );
            return;
        }
        
        // تحديد الاستراتيجية بناءً على نوع الملف
        let strategy;
        // index.html وملفات الـ shell الحرجة: الشبكة أولاً لضمان ظهور التحديثات فوراً بعد النشر
        if (isShellOrCriticalFile(url.pathname)) {
            strategy = CACHE_STRATEGIES.NETWORK_FIRST;
        } else if (isModuleFile(url.pathname)) {
            // الموديولات ومسار js/modules أولاً (قبل isCoreFile) — كثير من الملفات مدرجة في CORE_CACHE_FILES
            // وإلا تُخدم CACHE_FIRST وتبقى نسخ قديمة رغم وجود ?v= على index
            strategy = CACHE_STRATEGIES.NETWORK_FIRST;
        } else if (isCoreFile(url.pathname)) {
            // الملفات الأساسية الأخرى: التخزين المؤقت أولاً
            strategy = CACHE_STRATEGIES.CACHE_FIRST;
        } else if (isAPIRequest(url)) {
            // طلبات API: الشبكة أولاً (لكن لا نخزنها في Cache)
            strategy = CACHE_STRATEGIES.NETWORK_ONLY;
        } else {
            // ملاحظة: CDN resources يتم معالجتها في البداية (السطر 147-200)
            // لذلك لا نحتاج لمعالجتها هنا
            // افتراضي: الشبكة أولاً
            strategy = CACHE_STRATEGIES.NETWORK_FIRST;
        }
        
        // استخدام respondWith مع معالجة الأخطاء
        event.respondWith(
            handleRequest(request, strategy).catch((error) => {
                // معالجة أي أخطاء غير متوقعة
                if (request.destination === 'document') {
                    return new Response('التطبيق غير متاح حالياً. يُرجى المحاولة لاحقاً.', {
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                        status: 500,
                        statusText: 'Internal Server Error'
                    });
                }
                
                return new Response(null, { 
                    status: 500,
                    statusText: 'Internal Server Error'
                });
            })
        );
    } catch (error) {
        // معالجة أخطاء URL parsing أو أي أخطاء أخرى
        event.respondWith(
            new Response(null, { 
                status: 500,
                statusText: 'Internal Server Error'
            })
        );
    }
});

/**
 * معالجة الطلب حسب الاستراتيجية
 */
async function handleRequest(request, strategy) {
    try {
        switch (strategy) {
            case CACHE_STRATEGIES.CACHE_FIRST:
                return await cacheFirst(request);
            
            case CACHE_STRATEGIES.NETWORK_FIRST:
                return await networkFirst(request);
            
            case CACHE_STRATEGIES.CACHE_ONLY:
                return await cacheOnly(request);
            
            case CACHE_STRATEGIES.NETWORK_ONLY:
                return await networkOnly(request);
            
            default:
                return await networkFirst(request);
        }
    } catch (error) {
        // معالجة أي أخطاء غير متوقعة
        if (request.destination === 'document') {
            return new Response('التطبيق غير متاح حالياً. يُرجى المحاولة لاحقاً.', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 500,
                statusText: 'Internal Server Error'
            });
        }
        
        return new Response(null, { 
            status: 500,
            statusText: 'Internal Server Error'
        });
    }
}

/**
 * استراتيجية: التخزين المؤقت أولاً
 */
async function cacheFirst(request) {
    // تجاهل طلبات POST, PUT, DELETE وغيرها - لا يمكن تخزينها في Cache
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
            return await fetch(request);
        } catch (error) {
            // إرجاع استجابة خطأ بدلاً من رمي الخطأ
            return new Response(null, { status: 500, statusText: 'Network Error' });
        }
    }
    
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        
        if (cached) {
            // إرجاع من التخزين المؤقت
            // للـ CDN resources، تحديث الكاش في الخلفية
            if (isCDNResource(new URL(request.url))) {
                // تحديث في الخلفية بدون انتظار
                fetch(request).then(response => {
                    if (response && response.ok && responseOkToCache(response)) {
                        cache.put(request, response.clone()).catch(() => {});
                    }
                }).catch(() => {
                    // تجاهل أخطاء التحديث في الخلفية
                });
            }
            return cached;
        }
    } catch (cacheError) {
        // تجاهل أخطاء فتح Cache، سنحاول من الشبكة
    }
    
    // محاولة الحصول من الشبكة
    try {
        const response = await fetch(request);
        
        // التحقق من نجاح الاستجابة
        if (!response || !response.ok) {
            // إذا كانت الاستجابة غير ناجحة، إرجاع استجابة خطأ مناسبة
            if (request.destination === 'document') {
                return new Response('التطبيق غير متاح حالياً. يُرجى المحاولة لاحقاً.', {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    status: response?.status || 500
                });
            }
            // للخطوط والموارد الأخرى، إرجاع استجابة 404
            return new Response(null, { 
                status: response?.status || 404,
                statusText: response?.statusText || 'Not Found'
            });
        }
        
        // تخزين الاستجابة فقط إذا كانت GET/HEAD وناجحة
        if (response && response.status === 200 && (request.method === 'GET' || request.method === 'HEAD')) {
            // التأكد من أن الاستجابة قابلة للتخزين
            if (response.type === 'basic' || response.type === 'cors') {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    await safeCachePut(cache, request, response);
                } catch (cacheError) {
                    // تجاهل أخطاء التخزين المؤقت
                }
            }
        }
        
        return response;
    } catch (error) {
        // معالجة أخطاء الشبكة بشكل صحيح
        // إرجاع صفحة خطأ إذا كانت HTML
        if (request.destination === 'document') {
            return new Response('التطبيق غير متاح حالياً. يُرجى المحاولة لاحقاً.', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 503,
                statusText: 'Service Unavailable'
            });
        }
        
        // للـ CDN resources، محاولة fallback URLs قبل إرجاع الخطأ
        const url = new URL(request.url);
        if (isCDNResource(url)) {
            const fallbackUrls = getCDNFallbackUrls(request.url);
            for (const fallbackUrl of fallbackUrls) {
                try {
                    const fallbackRequest = new Request(fallbackUrl, request);
                    const fallbackResponse = await fetch(fallbackRequest);
                    
                    if (fallbackResponse && fallbackResponse.ok) {
                        // تخزين الاستجابة من fallback
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await safeCachePut(cache, request, fallbackResponse);
                        } catch (cacheError) {
                            // تجاهل أخطاء التخزين المؤقت
                        }
                        
                        return fallbackResponse;
                    }
                } catch (fallbackError) {
                    // تجاهل أخطاء fallback، ننتقل للـ fallback التالي
                    continue;
                }
            }
            
            // إذا فشل كل شيء، السماح للطلب بالمرور مباشرة للشبكة
            // هذا يمنع حجب الموارد
            try {
                const directResponse = await fetch(request, { cache: 'no-cache' });
                if (directResponse && directResponse.ok) {
                    return directResponse;
                }
            } catch (directError) {
                // تجاهل الأخطاء
            }
        }
        
        // للخطوط والموارد الأخرى، إرجاع استجابة 404 بدلاً من رمي الخطأ
        // هذا يمنع uncaught promise rejections
        return new Response(null, { 
            status: 404,
            statusText: 'Not Found'
        });
    }
}

/**
 * استراتيجية: الشبكة أولاً (محسّنة للموديولات)
 */
async function networkFirst(request) {
    // تجاهل طلبات POST, PUT, DELETE وغيرها - لا يمكن تخزينها في Cache
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fetch(request);
    }
    
    const url = new URL(request.url);
    const isModule = isModuleFile(url.pathname);
    const isLocalScript =
        url.origin === self.location.origin &&
        (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs'));
    const isLocalCss =
        url.origin === self.location.origin && url.pathname.endsWith('.css');
    
    // للموديولات وأي سكربت/نمط محلي: التحقق من الخادم (تجاوز كاش المتصفح/الوسيط)
    const fetchOptions = isModule || isLocalScript || isLocalCss ? {
        cache: 'no-cache',
        headers: {
            'Cache-Control': 'no-cache'
        }
    } : {};
    
    try {
        // محاولة الحصول من الشبكة أولاً
        const response = await fetch(request, fetchOptions);
        
        // التحقق من نجاح الاستجابة
        if (response && response.ok && response.status === 200) {
            // تخزين الاستجابة فقط إذا كانت GET/HEAD وناجحة
            if (request.method === 'GET' || request.method === 'HEAD') {
                // التأكد من أن الاستجابة قابلة للتخزين
                if (response.type === 'basic' || response.type === 'cors') {
                    try {
                        const cache = await caches.open(CACHE_NAME);
                        await safeCachePut(cache, request, response);
                    } catch (cacheError) {
                        // تجاهل أخطاء التخزين المؤقت
                    }
                }
            }
            
            return response;
        } else {
            // إذا كانت الاستجابة غير ناجحة، نتحقق من الكاش
            throw new Error('Network response not OK');
        }
    } catch (error) {
        // الرجوع إلى التخزين المؤقت عند الفشل (فقط للطلبات GET/HEAD)
        try {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request);
            
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            // تجاهل أخطاء Cache
        }
        
        // ملاحظة: CDN resources يتم معالجتها في البداية (السطر 147-200)
        // لذلك لن تصل CDN resources إلى هنا أبداً
        // هذا الكود للطلبات الأخرى فقط
        
        // إرجاع استجابة خطأ
        return new Response(null, { 
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * استراتيجية: التخزين المؤقت فقط
 */
async function cacheOnly(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }
        
        // إرجاع استجابة 404 بدلاً من رمي خطأ
        return new Response(null, { 
            status: 404,
            statusText: 'Not Found in Cache'
        });
    } catch (error) {
        // معالجة أخطاء فتح Cache
        return new Response(null, { 
            status: 500,
            statusText: 'Cache Error'
        });
    }
}

/**
 * استراتيجية: الشبكة فقط
 */
async function networkOnly(request) {
    try {
        return await fetch(request);
    } catch (error) {
        // إرجاع استجابة خطأ بدلاً من رمي الخطأ
        if (request.destination === 'document') {
            return new Response('التطبيق غير متاح حالياً. يُرجى المحاولة لاحقاً.', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 503,
                statusText: 'Service Unavailable'
            });
        }
        
        return new Response(null, { 
            status: 500,
            statusText: 'Network Error'
        });
    }
}

/**
 * التحقق من أن الملف من نوع shell/حرج (index.html أو JS الأساسي) لاستخدام الشبكة أولاً لظهور التحديثات
 */
function isShellOrCriticalFile(pathname) {
    const p = pathname.replace(BASE_PATH, '') || pathname;
    if (p === '/' || p === '/index.html' || p.endsWith('/index.html')) return true;
    // Vercel يخدم الواجهة من الجذر: الملفات الحرجة تحت js/modules وليس js/app-ui.js مباشرة
    if (p.endsWith('.css')) return true;
    if (p.endsWith('/js/app-bootstrap.js')) return true;
    if (/\/js\/modules\/app-ui\.js$/i.test(p)) return true;
    if (/\/js\/modules\/app-utils\.js$/i.test(p)) return true;
    if (/\/js\/modules\/i18n-core\.js$/i.test(p)) return true;
    if (/\/js\/modules\/services\/data-manager\.js$/i.test(p)) return true;
    if (/\/js\/modules\/modules\/settings\.js$/i.test(p)) return true;
    return p.endsWith('/js/app-ui.js') || p.endsWith('/js/app-bootstrap.js') || p.endsWith('/js/app-utils.js');
}

/**
 * التحقق من أن الملف أساسي
 */
function isCoreFile(pathname) {
    return CORE_CACHE_FILES.some(file => {
        // إزالة BASE_PATH من file للمقارنة
        const fileWithoutBase = file.replace(BASE_PATH, '');
        return pathname.endsWith(fileWithoutBase) || pathname.endsWith(file);
    });
}

/**
 * التحقق من أن الملف موديول
 */
function isModuleFile(pathname) {
    return MODULE_CACHE_FILES.some(file => {
        const fileWithoutBase = file.replace(BASE_PATH, '');
        return pathname.endsWith(fileWithoutBase) || pathname.endsWith(file);
    }) || pathname.includes('/js/modules/');
}

/**
 * التحقق من أن الطلب API
 */
function isAPIRequest(url) {
    return url.hostname.includes('script.google.com') ||
           url.hostname.includes('googleapis.com') ||
           url.pathname.includes('/api/');
}

/**
 * الحصول على روابط Fallback لموارد CDN
 */
function getCDNFallbackUrls(originalUrl) {
    const fallbackUrls = [];
    const url = new URL(originalUrl);
    
    // Font Awesome fallbacks
    if (url.hostname.includes('cdnjs') && url.pathname.includes('font-awesome')) {
        // jsDelivr fallback
        fallbackUrls.push('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css');
        // unpkg fallback
        fallbackUrls.push('https://unpkg.com/@fortawesome/fontawesome-free@6.5.1/css/all.min.css');
    } else if (url.hostname.includes('jsdelivr') && url.pathname.includes('font-awesome')) {
        // unpkg fallback
        fallbackUrls.push('https://unpkg.com/@fortawesome/fontawesome-free@6.5.1/css/all.min.css');
        // cdnjs fallback
        fallbackUrls.push('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');
    } else if (url.hostname.includes('unpkg') && url.pathname.includes('font-awesome')) {
        // jsDelivr fallback
        fallbackUrls.push('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css');
        // cdnjs fallback
        fallbackUrls.push('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');
    }
    
    // Chart.js fallbacks
    if (url.pathname.includes('chart.js') || url.pathname.includes('chartjs') || url.pathname.includes('Chart.js')) {
        // استخراج الإصدار من URL بشكل أكثر دقة
        let version = '4.4.1'; // الإصدار الافتراضي
        const versionMatch = url.pathname.match(/chart\.js[@\/]([\d.]+)/i) || 
                            url.pathname.match(/Chart\.js\/([\d.]+)/i);
        if (versionMatch && versionMatch[1]) {
            version = versionMatch[1];
        }
        
        if (url.hostname.includes('jsdelivr')) {
            // cdnjs fallback
            fallbackUrls.push(`https://cdnjs.cloudflare.com/ajax/libs/Chart.js/${version}/chart.umd.min.js`);
        } else if (url.hostname.includes('unpkg')) {
            // jsDelivr fallback
            fallbackUrls.push(`https://cdn.jsdelivr.net/npm/chart.js@${version}/dist/chart.umd.min.js`);
            // cdnjs fallback
            fallbackUrls.push(`https://cdnjs.cloudflare.com/ajax/libs/Chart.js/${version}/chart.umd.min.js`);
        } else if (url.hostname.includes('cdnjs')) {
            // jsDelivr fallback
            fallbackUrls.push(`https://cdn.jsdelivr.net/npm/chart.js@${version}/dist/chart.umd.min.js`);
        } else {
            // إذا كان من مصدر آخر، إضافة fallbacks (بدون unpkg بسبب مشاكل CORS)
            fallbackUrls.push(`https://cdn.jsdelivr.net/npm/chart.js@${version}/dist/chart.umd.min.js`);
            fallbackUrls.push(`https://cdnjs.cloudflare.com/ajax/libs/Chart.js/${version}/chart.umd.min.js`);
        }
    }
    
    // Google Fonts fallbacks (عادة لا تحتاج fallback، لكن يمكن إضافتها)
    if (url.hostname.includes('fonts.googleapis.com')) {
        // Google Fonts عادة موثوقة، لكن يمكن إضافة fallback محلي إذا لزم الأمر
    }
    
    return fallbackUrls;
}

/**
 * التحقق من أن المورد من CDN
 */
function isCDNResource(url) {
    return url.hostname.includes('cdn.') ||
           url.hostname.includes('cdnjs.') ||
           url.hostname.includes('jsdelivr.net') ||
           url.hostname.includes('unpkg.com') ||
           url.hostname.includes('fonts.googleapis.com') ||
           url.hostname.includes('fonts.gstatic.com');
}

/**
 * حدث الرسالة (Message)
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                console.log('[Service Worker] تم مسح التخزين المؤقت');
                return self.clients.matchAll();
            }).then((clients) => {
                clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' }));
            }).catch((error) => {
                // معالجة أخطاء مسح Cache
            })
        );
    }
});

/**
 * معالجة الأخطاء غير المعالجة ورفض الوعود
 */
self.addEventListener('error', (event) => {
    // منع عرض الأخطاء في Console
    event.preventDefault();
});

self.addEventListener('unhandledrejection', (event) => {
    // منع عرض رفض الوعود غير المعالجة في Console
    event.preventDefault();
});
