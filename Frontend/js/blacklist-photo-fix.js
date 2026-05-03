/**
 * إصلاح مشكلة عدم ظهور الصور في موديول المخالفات - تبويب الممنوعين من الدخول
 * 
 * المشكلة: الصور مخزنة كـ Base64 في Google Sheets ولا تظهر بشكل صحيح
 * 
 * الحل: إضافة دالة لتحويل Base64 إلى رابط Google Drive عند التحميل
 * أو عرض Base64 بشكل صحيح في الواجهة
 */

// ============================================
// 1. إضافة دالة تحويل Base64 في Frontend
// ============================================

// في violations.js - دالة لتحويل Base64 إلى URL مؤقت للعرض
function convertBase64ToUrl(base64String) {
    if (!base64String) return null;
    
    // إذا كان الرابط URL عادي (يبدأ بـ http)، نعيده كما هو
    if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
        return base64String;
    }
    
    // إذا كان Base64 (يبدأ بـ data:)، نستخدمه كما هو
    if (base64String.startsWith('data:')) {
        return base64String;
    }
    
    // إذا كان Base64 بدون prefix، نضيفه
    if (base64String.length > 100) { // احتمال أنه Base64
        return 'data:image/jpeg;base64,' + base64String;
    }
    
    return null;
}

// ============================================
// 2. تعديل دالة عرض الصور في البطاقات
// ============================================

/**
 * تعديل renderBlacklistCards() للتعامل مع Base64 بشكل صحيح
 */
function renderBlacklistCardsFixed(records) {
    return records.map(record => {
        // تحويل Base64 إلى URL صالح
        const photoUrl = convertBase64ToUrl(record.photo);
        
        return `
            <div class="card">
                <div class="relative z-10">
                    <div class="p-4">
                        <div class="flex items-start justify-between mb-3">
                            <div class="flex items-center gap-3">
                                ${photoUrl ? `
                                    <img src="${Utils.escapeHTML(photoUrl)}" alt="صورة"
                                        data-photo-url="${Utils.escapeHTML(photoUrl)}"
                                        class="w-16 h-16 rounded-full object-cover border-2 border-red-200 dark:border-red-800 cursor-pointer shadow-sm"
                                        onclick="Violations.viewBlacklistPhoto(this.dataset.photoUrl)"
                                        title="انقر لعرض الصورة"
                                        onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center border-2 border-red-200 dark:border-red-800\\'><i class=\\'fas fa-user text-red-500 dark:text-red-400 text-2xl\\'></i></div>';">
                                ` : `
                                    <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center border-2 border-red-200 dark:border-red-800">
                                        <i class="fas fa-user text-red-500 dark:text-red-400 text-2xl"></i>
                                    </div>
                                `}
                                <div>
                                    <h3 class="font-bold text-gray-800 dark:text-gray-100 text-lg">${Utils.escapeHTML(record.fullName || 'غير محدد')}</h3>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">#${record.serialNumber || '-'}</p>
                                </div>
                            </div>
                            <!-- أزرار التعديل والحذف -->
                        </div>
                        <!-- بقية البيانات -->
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// 3. تعديل renderBlacklistTable() للتعامل مع Base64
// ============================================

function renderBlacklistTableFixed(records) {
    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>م</th>
                    <th>تاريخ المنع</th>
                    <th>المصنع</th>
                    <th>الموقع</th>
                    <th>الاسم رباعي</th>
                    <th>رقم البطاقة</th>
                    <th>الوظيفة</th>
                    <th>الشركة - المقاول</th>
                    <th>الإدارة</th>
                    <th>القائم بالمنع</th>
                    <th>محرر البيانات</th>
                    <th>الصورة</th>
                    <th>سبب المنع</th>
                    <th>ملاحظات</th>
                    <th>الإجراءات</th>
                </tr>
            </thead>
            <tbody>
                ${records.map(record => {
                    const photoUrl = convertBase64ToUrl(record.photo);
                    return `
                        <tr>
                            <td>${record.serialNumber || '-'}</td>
                            <td>${record.banDate ? Utils.formatDate(record.banDate) : '-'}</td>
                            <td>${Utils.escapeHTML(record.factory || '-')}</td>
                            <td>${Utils.escapeHTML(record.location || '-')}</td>
                            <td>${Utils.escapeHTML(record.fullName || '-')}</td>
                            <td>${Utils.escapeHTML(record.idNumber || '-')}</td>
                            <td>${Utils.escapeHTML(record.job || '-')}</td>
                            <td>${Utils.escapeHTML(record.contractor || '-')}</td>
                            <td>${Utils.escapeHTML(record.department || '-')}</td>
                            <td>${Utils.escapeHTML(record.bannedBy || '-')}</td>
                            <td>${Utils.escapeHTML(record.editor || '-')}</td>
                            <td>
                                ${photoUrl ? 
                                    `<img src="${Utils.escapeHTML(photoUrl)}" alt="صورة" 
                                        data-photo-url="${Utils.escapeHTML(photoUrl)}"
                                        class="w-12 h-12 object-cover rounded cursor-pointer"
                                        onclick="Violations.viewBlacklistPhoto(this.dataset.photoUrl)" 
                                        title="انقر لعرض الصورة"
                                        onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2212%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">` 
                                    : '-'}
                            </td>
                            <td class="max-w-xs truncate" title="${Utils.escapeHTML(record.banReason || '')}">
                                ${Utils.escapeHTML((record.banReason || '-').substring(0, 50))}${(record.banReason || '').length > 50 ? '...' : ''}
                            </td>
                            <td class="max-w-xs truncate" title="${Utils.escapeHTML(record.notes || '')}">
                                ${Utils.escapeHTML((record.notes || '-').substring(0, 30))}${(record.notes || '').length > 30 ? '...' : ''}
                            </td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <button onclick="Violations.viewBlacklistDetails('${record.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="Violations.editBlacklistRecord('${record.id}')" class="btn-icon btn-icon-warning" title="تعديل">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="Violations.deleteBlacklistRecord('${record.id}')" class="btn-icon btn-icon-danger" title="حذف">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ============================================
// 4. إضافة debug console لمراقبة البيانات
// ============================================

function debugBlacklistPhotos() {
    console.log('=== Debug Blacklist Photos ===');
    
    if (!AppState.appData || !AppState.appData.blacklistRegister) {
        console.error('❌ لا توجد بيانات Blacklist');
        return;
    }
    
    const records = AppState.appData.blacklistRegister;
    console.log(`📊 إجمالي السجلات: ${records.length}`);
    
    // فحص أول 5 سجلات
    records.slice(0, 5).forEach((record, index) => {
        console.log(`\n📷 سجل #${index + 1}: ${record.fullName}`);
        
        if (!record.photo) {
            console.log('  ❌ لا توجد صورة');
        } else if (record.photo.startsWith('data:')) {
            console.log('  ⚠️ الصورة Base64');
            console.log('  📏 حجم Base64:', record.photo.length, 'حرف');
            console.log('  🔍 أول 50 حرف:', record.photo.substring(0, 50));
        } else if (record.photo.startsWith('http')) {
            console.log('  ✅ الصورة URL');
            console.log('  🔗 الرابط:', record.photo);
        } else {
            console.log('  ❓ نوع غير معروف');
            console.log('  🔍 القيمة:', record.photo.substring(0, 100));
        }
    });
}

// ============================================
// 5. دالة لتحديث جميع الصور من Base64 إلى Google Drive URLs
// ============================================

async function migrateBlacklistPhotosToDrive() {
    console.log('=== بدء تحويل الصور من Base64 إلى Google Drive ===');
    
    if (!AppState.appData || !AppState.appData.blacklistRegister) {
        console.error('❌ لا توجد بيانات Blacklist');
        return;
    }
    
    const records = AppState.appData.blacklistRegister;
    let convertedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        // إذا كانت الصورة Base64
        if (record.photo && record.photo.startsWith('data:')) {
            console.log(`\n🔄 معالجة سجل #${i + 1}: ${record.fullName}`);
            
            try {
                const uploadResult = await GoogleIntegration.uploadFileToDrive(
                    record.photo,
                    `blacklist_${record.id}_${Date.now()}.jpg`,
                    'image/jpeg',
                    'Blacklist_Register'
                );
                
                if (uploadResult && uploadResult.success) {
                    const newUrl = uploadResult.directLink || uploadResult.shareableLink;
                    console.log(`  ✅ تم التحويل: ${newUrl}`);
                    
                    // تحديث السجل
                    record.photo = newUrl;
                    convertedCount++;
                } else {
                    console.error(`  ❌ فشل الرفع:`, uploadResult);
                    failedCount++;
                }
            } catch (error) {
                console.error(`  ❌ خطأ في الرفع:`, error);
                failedCount++;
            }
            
            // انتظار قصير لتجنب rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log('\n=== نتيجة التحويل ===');
    console.log(`✅ تم تحويل: ${convertedCount} صورة`);
    console.log(`❌ فشل: ${failedCount} صورة`);
    console.log(`📊 إجمالي: ${records.length} سجل`);
    
    // حفظ التغييرات
    if (convertedCount > 0) {
        console.log('💾 حفظ التغييرات...');
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            await window.DataManager.save();
            console.log('✅ تم الحفظ بنجاح');
        }
    }
}

// ============================================
// 6. تشغيل debug تلقائياً عند تحميل البيانات
// ============================================

// إضافة هذا في نهاية loadBlacklistDataAsync()
function loadBlacklistDataAsyncWithDebug() {
    // ... الكود الأصلي ...
    
    // بعد تحميل البيانات
    setTimeout(() => {
        console.log('🔍 Running automatic photo debug...');
        debugBlacklistPhotos();
    }, 1000);
}
