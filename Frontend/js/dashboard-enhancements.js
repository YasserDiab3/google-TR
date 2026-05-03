/**
 * ========================================
 * تحسينات JavaScript للوحة التحكم
 * Enhanced Dashboard Interactions
 * ========================================
 */

(function () {
    'use strict';

    const __isDev = (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.search.includes('dev=true'));
    const log = (...args) => {
        try {
            if (window.Utils && typeof window.Utils.safeLog === 'function') {
                window.Utils.safeLog(...args);
                return;
            }
        } catch (e) { /* ignore */ }
        if (__isDev) {
            try { console.log(...args); } catch (e) { /* ignore */ }
        }
    };

    // الانتظار حتى يتم تحميل DOM و CSS
    function waitForCSSAndInit() {
        // التحقق من تحميل CSS
        const stylesheets = Array.from(document.styleSheets);
        let cssLoaded = true;
        
        for (let i = 0; i < stylesheets.length; i++) {
            try {
                // محاولة الوصول إلى CSS rules - إذا فشل، الملف لم يتم تحميله بعد
                stylesheets[i].cssRules || stylesheets[i].rules;
            } catch (e) {
                cssLoaded = false;
                break;
            }
        }
        
        if (cssLoaded || document.readyState === 'complete') {
            // استخدام requestAnimationFrame لتأخير التنفيذ حتى يتم render CSS
            requestAnimationFrame(() => {
                initDashboardEnhancements();
            });
        } else {
            // إعادة المحاولة بعد تأخير قصير
            setTimeout(waitForCSSAndInit, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForCSSAndInit);
    } else {
        waitForCSSAndInit();
    }

    function initDashboardEnhancements() {
        // تفعيل التأثيرات التفاعلية
        enhanceKPICards();
        enhanceContentCards();
        // Disabled addParallaxEffect() to prevent scroll-linked positioning warnings
        // This causes performance issues with asynchronous panning in Firefox
        // addParallaxEffect();
        addCountUpAnimation();
        addProgressIndicators();
        addHoverSoundEffects();
        addCardFlipEffect();
        addGlowEffect();
    }

    /**
     * تحسين بطاقات KPI بتأثيرات تفاعلية
     */
    function enhanceKPICards() {
        const kpiCards = document.querySelectorAll('.kpi-card');

        kpiCards.forEach((card, index) => {
            // إضافة تأثير الظهور التدريجي
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';

            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);

            // تأثير التتبع بالماوس (3D Tilt)
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;

                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)';
            });

            // تأثير النقر
            card.addEventListener('click', function (e) {
                // إضافة تأثير الموجة (Ripple Effect)
                const ripple = document.createElement('div');
                ripple.style.position = 'absolute';
                ripple.style.borderRadius = '50%';
                ripple.style.background = 'rgba(255, 255, 255, 0.5)';
                ripple.style.width = '20px';
                ripple.style.height = '20px';
                ripple.style.pointerEvents = 'none';
                ripple.style.animation = 'rippleEffect 0.6s ease-out';

                const rect = card.getBoundingClientRect();
                ripple.style.left = (e.clientX - rect.left - 10) + 'px';
                ripple.style.top = (e.clientY - rect.top - 10) + 'px';

                card.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            });
        });

        // إضافة تأثير Ripple في CSS
        if (!document.getElementById('ripple-animation-style')) {
            const style = document.createElement('style');
            style.id = 'ripple-animation-style';
            style.textContent = `
                @keyframes rippleEffect {
                    0% {
                        transform: scale(0);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(20);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * تحسين بطاقات المحتوى
     * لا يُطبَّق على قسم التقارير والإحصائيات أو مؤشرات السلامة (منع وميض).
     */
    function enhanceContentCards() {
        const contentCards = document.querySelectorAll('.content-card');
        const noEnhanceClasses = ['reports-statistics-section', 'safety-metrics-section'];

        contentCards.forEach((card, index) => {
            const skip = noEnhanceClasses.some(c => card.classList.contains(c));
            if (skip) return;

            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';

            setTimeout(() => {
                card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, (index + 5) * 100);

            card.addEventListener('mouseenter', function () {
                this.style.boxShadow = '0 20px 60px rgba(102, 126, 234, 0.2), 0 5px 20px rgba(102, 126, 234, 0.15)';
            });

            card.addEventListener('mouseleave', function () {
                this.style.boxShadow = '';
            });
        });
    }

    /**
     * إضافة تأثير Parallax للخلفية
     */
    function addParallaxEffect() {
        const dashboardSection = document.getElementById('dashboard-section');
        if (!dashboardSection) return;

        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallaxElements = dashboardSection.querySelectorAll('.kpi-card, .content-card');

            parallaxElements.forEach((element, index) => {
                const speed = (index % 3 + 1) * 0.05;
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        });
    }

    /**
     * إضافة تأثير العد التصاعدي للأرقام
     */
    function addCountUpAnimation() {
        const kpiValues = document.querySelectorAll('.kpi-value');

        const observerOptions = {
            threshold: 0.5,
            rootMargin: '0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.animated) {
                    animateValue(entry.target);
                    entry.target.dataset.animated = 'true';
                }
            });
        }, observerOptions);

        kpiValues.forEach(value => observer.observe(value));
    }

    /**
     * تحريك القيمة من 0 إلى القيمة النهائية
     */
    function animateValue(element) {
        const text = element.textContent.trim();
        const hasPercent = text.includes('%');
        const numericValue = parseFloat(text.replace(/[^\d.-]/g, ''));

        if (isNaN(numericValue)) return;

        const duration = 2000;
        const steps = 60;
        const stepValue = numericValue / steps;
        const stepDuration = duration / steps;
        let currentValue = 0;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            currentValue += stepValue;

            if (currentStep >= steps) {
                currentValue = numericValue;
                clearInterval(timer);
            }

            const displayValue = Math.round(currentValue);
            element.textContent = hasPercent ? `${displayValue}%` : displayValue;
        }, stepDuration);
    }

    /**
     * إضافة مؤشرات التقدم للبطاقات
     */
    function addProgressIndicators() {
        const kpiCards = document.querySelectorAll('.kpi-card');

        kpiCards.forEach(card => {
            // إضافة شريط تقدم في الأسفل
            const progressBar = document.createElement('div');
            progressBar.style.position = 'absolute';
            progressBar.style.bottom = '0';
            progressBar.style.left = '0';
            progressBar.style.height = '3px';
            progressBar.style.width = '0%';
            progressBar.style.background = 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)';
            progressBar.style.transition = 'width 1s ease-out';
            progressBar.style.borderRadius = '0 0 24px 24px';

            card.appendChild(progressBar);

            // تحريك شريط التقدم عند الظهور
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            progressBar.style.width = '100%';
                        }, 300);
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(card);
        });
    }

    /**
     * إضافة تأثيرات صوتية عند التمرير (اختياري)
     */
    function addHoverSoundEffects() {
        // يمكن إضافة أصوات خفيفة عند التفاعل مع البطاقات
        // هذه الميزة اختيارية ويمكن تفعيلها حسب الحاجة

        const kpiCards = document.querySelectorAll('.kpi-card');

        kpiCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                // يمكن إضافة صوت خفيف هنا
                // playSound('hover.mp3');
            });
        });
    }

    /**
     * إضافة تأثير القلب للبطاقات عند النقر المزدوج
     */
    function addCardFlipEffect() {
        const kpiCards = document.querySelectorAll('.kpi-card');

        kpiCards.forEach(card => {
            card.addEventListener('dblclick', function () {
                this.style.transform = 'rotateY(180deg)';

                setTimeout(() => {
                    this.style.transform = 'rotateY(0deg)';
                }, 600);
            });
        });
    }

    /**
     * إضافة تأثير التوهج للعناصر المهمة
     * لا يُطبَّق على كروت التقارير والإحصائيات أو مؤشرات السلامة (منع وميض).
     */
    function addGlowEffect() {
        const importantElements = document.querySelectorAll('.kpi-danger, .kpi-warning');
        const noGlowContainers = document.querySelectorAll('.reports-statistics-section, .safety-metrics-section');

        importantElements.forEach(element => {
            const insideNoGlow = Array.from(noGlowContainers).some(container => container.contains(element));
            if (insideNoGlow) return;
            setInterval(() => {
                element.style.boxShadow = '0 0 30px rgba(245, 87, 108, 0.5)';
                setTimeout(() => {
                    element.style.boxShadow = '';
                }, 1000);
            }, 3000);
        });
    }

    /**
     * إضافة مؤشر التحميل للبطاقات
     */
    function addLoadingIndicators() {
        const cards = document.querySelectorAll('.kpi-card, .content-card');

        cards.forEach(card => {
            // إضافة skeleton loader
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-loader';
            skeleton.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
                border-radius: inherit;
                z-index: 10;
            `;

            card.style.position = 'relative';
            card.appendChild(skeleton);

            // إزالة skeleton بعد التحميل
            setTimeout(() => {
                skeleton.style.opacity = '0';
                setTimeout(() => skeleton.remove(), 300);
            }, 1000);
        });
    }

    /**
     * إضافة تأثيرات الجسيمات في الخلفية
     */
    function addParticleEffect() {
        const dashboardSection = document.getElementById('dashboard-section');
        if (!dashboardSection) return;

        const particlesContainer = document.createElement('div');
        particlesContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            pointer-events: none;
            z-index: 0;
        `;

        // إنشاء جسيمات متحركة
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: float ${Math.random() * 10 + 10}s ease-in-out infinite;
                animation-delay: ${Math.random() * 5}s;
            `;
            particlesContainer.appendChild(particle);
        }

        dashboardSection.insertBefore(particlesContainer, dashboardSection.firstChild);

        // إضافة animation للجسيمات
        if (!document.getElementById('particle-animation-style')) {
            const style = document.createElement('style');
            style.id = 'particle-animation-style';
            style.textContent = `
                @keyframes float {
                    0%, 100% {
                        transform: translate(0, 0);
                    }
                    25% {
                        transform: translate(20px, -20px);
                    }
                    50% {
                        transform: translate(-20px, 20px);
                    }
                    75% {
                        transform: translate(20px, 20px);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * إضافة مؤشر التقدم الدائري
     */
    function addCircularProgress() {
        const kpiCards = document.querySelectorAll('.kpi-card');

        kpiCards.forEach(card => {
            const icon = card.querySelector('.kpi-icon');
            if (!icon) return;

            // إنشاء SVG للتقدم الدائري
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100');
            svg.setAttribute('height', '100');
            svg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-90deg);
                pointer-events: none;
            `;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '50');
            circle.setAttribute('cy', '50');
            circle.setAttribute('r', '45');
            circle.setAttribute('fill', 'none');
            circle.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
            circle.setAttribute('stroke-width', '3');
            circle.setAttribute('stroke-dasharray', '283');
            circle.setAttribute('stroke-dashoffset', '283');
            circle.style.transition = 'stroke-dashoffset 2s ease-out';

            svg.appendChild(circle);
            icon.style.position = 'relative';
            icon.appendChild(svg);

            // تحريك التقدم
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            circle.setAttribute('stroke-dashoffset', '0');
                        }, 500);
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(card);
        });
    }

    // مرجع للـ interval للتنظيف
    let realtimeDataInterval = null;

    /**
     * تحديث الوقت الحقيقي
     */
    function updateRealTimeData() {
        // تنظيف الـ interval القديم إذا كان موجوداً
        if (realtimeDataInterval) {
            clearInterval(realtimeDataInterval);
            realtimeDataInterval = null;
        }

        realtimeDataInterval = setInterval(() => {
            // يمكن تحديث البيانات في الوقت الفعلي هنا
            // مثال: تحديث عدد المستخدمين النشطين
            const activeUsersElement = document.getElementById('active-users');
            if (activeUsersElement) {
                // تحديث القيمة بشكل عشوائي للتوضيح
                // في التطبيق الفعلي، يجب جلب البيانات من الخادم
            }
        }, 5000);
    }

    /**
     * تنظيف جميع الموارد
     */
    function cleanupDashboardEnhancements() {
        if (realtimeDataInterval) {
            clearInterval(realtimeDataInterval);
            realtimeDataInterval = null;
        }
        log('✅ تم تنظيف موارد Dashboard enhancements');
    }

    // تصدير دالة التنظيف للاستخدام الخارجي
    if (typeof window !== 'undefined') {
        window.cleanupDashboardEnhancements = cleanupDashboardEnhancements;
    }

    // تفعيل التحسينات الإضافية
    setTimeout(() => {
        addParticleEffect();
        addCircularProgress();
        updateRealTimeData();
    }, 1000);

    log('✨ Dashboard enhancements loaded successfully!');
})();
