/**
 * sheet-bulk-import.js — معالج استيراد مركزي من Excel (بما فيه تصدير Google Sheets)
 * إلى Postgres عبر نفس RPC المستخدم في التطبيق (saveToSheet + upsert).
 */
const SheetBulkImport = {
    SHEET_ALIASES: {
        safetyAlerts: 'SafetyAlerts',
        LegalInventory: 'LegalInventory',
        EmployeePPEMatrixByCode: 'PPEMatrix',
        PTWRegistry: 'PTWRegistry',
        PTW_MAP_COORDINATES: 'PTW_MAP_SITES',
        TrainingAttendance: 'TrainingAttendance',
        TrainingAnalysisData: 'TrainingAnalysisData',
    },

    FORCE_UPSERT_SHEETS: new Set(['PTW', 'PTWRegistry']),

    IMPORT_ORDER_PRIORITY: [
        'Users',
        'Employees',
        'ApprovedContractors',
        'Contractors',
        'Training',
        'Incidents',
        'NearMiss',
        'Violations',
        'ChemicalSafety',
        'ClinicVisits',
        'DailyObservations',
        'FireEquipment',
        'PTW',
        'PTWRegistry',
    ],

    CHUNK_SIZE: 80,

    REPLACE_ROW_WARN: 2500,

    _manifest: null,
    _lastAnalysis: null,
    _focusSheet: '',

    resolveSheetName(raw) {
        const s = String(raw || '').trim();
        if (!s) return s;
        return Object.prototype.hasOwnProperty.call(this.SHEET_ALIASES, s)
            ? this.SHEET_ALIASES[s]
            : s;
    },

    isSheetAllowed(tabName) {
        const raw = String(tabName || '').trim();
        if (!raw || !this._manifest || !Array.isArray(this._manifest.allowedSheets)) return false;
        const allowed = this._manifest.allowedSheets;
        const set = new Set(allowed);
        if (set.has(raw)) return true;
        const resolved = this.resolveSheetName(raw);
        if (set.has(resolved)) return true;
        for (let i = 0; i < allowed.length; i++) {
            if (this.resolveSheetName(allowed[i]) === resolved) return true;
        }
        return false;
    },

    sortSheetsForImport(names) {
        const pri = this.IMPORT_ORDER_PRIORITY;
        const rank = (n) => {
            const r = this.resolveSheetName(n);
            const i = pri.indexOf(r);
            return i === -1 ? 10000 + r.charCodeAt(0) : i;
        };
        return [...names].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
    },

    _headersJsonHref() {
        try {
            return new URL('js/modules/data/sheet-headers.generated.json', window.location.href).href;
        } catch (e) {
            return 'js/modules/data/sheet-headers.generated.json';
        }
    },

    async loadManifest() {
        if (this._manifest) return this._manifest;
        const url = this._headersJsonHref();
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`تعذر تحميل ملف تعريف الأعمدة (${res.status}). تأكد من وجود sheet-headers.generated.json`);
        }
        this._manifest = await res.json();
        return this._manifest;
    },

    setFocusSheet(sheetName) {
        this._focusSheet = String(sheetName || '').trim();
        const sel = document.getElementById('bulk-import-template-select');
        const mul = document.getElementById('bulk-import-template-multi');
        if (sel && this._focusSheet) {
            sel.value = this._focusSheet;
        }
        if (mul && this._focusSheet) {
            Array.from(mul.options).forEach((opt) => {
                opt.selected = opt.value === this._focusSheet;
            });
        }
    },

    /**
     * فتح الإعدادات مع تبويب الاستيراد (من مديولات أخرى).
     */
    open(options) {
        const sheet = options && (options.focusSheet || options.sheetName);
        try {
            sessionStorage.setItem(
                'hse_bulk_import_nav',
                JSON.stringify({
                    focusSheet: sheet ? String(sheet).trim() : '',
                    ts: Date.now(),
                }),
            );
        } catch (e) {
            Utils.safeWarn('SheetBulkImport.open sessionStorage:', e);
        }
        if (typeof UI !== 'undefined' && typeof UI.showSection === 'function') {
            UI.showSection('settings');
        } else {
            Notification.warning('تعذر فتح الإعدادات');
        }
    },

    handlePendingDeepLink() {
        let raw = null;
        try {
            raw = sessionStorage.getItem('hse_bulk_import_nav');
            if (raw) sessionStorage.removeItem('hse_bulk_import_nav');
        } catch (e) {
            return;
        }
        if (!raw) return;
        let p = null;
        try {
            p = JSON.parse(raw);
        } catch (e) {
            return;
        }
        const tabBtn = document.querySelector('.tab-btn[data-tab="bulk-import-excel"]');
        if (tabBtn) {
            tabBtn.click();
        }
        if (p.focusSheet) {
            setTimeout(() => this.setFocusSheet(p.focusSheet), 50);
        }
    },

    _ensureXlsx() {
        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متاحة. حدّث الصفحة وحاول مرة أخرى.');
            return false;
        }
        return true;
    },

    buildTemplateRows(sheetName) {
        const cols =
            (this._manifest &&
                this._manifest.headersMap &&
                this._manifest.headersMap[sheetName]) ||
            [];
        if (!cols.length) {
            return [
                ['id'],
                ['(لا توجد أعمدة في القالب — حدّث Backend/Headers.gs ثم شغّل tools/generate-schema-sql.mjs)'],
            ];
        }
        const example = cols.map(() => '');
        if (cols[0] === 'id') example[0] = 'example-id';
        const noteRow = cols.map(() => '');
        noteRow[0] = '(صف توضيحي — احذفه أو استبدله قبل الاستيراد)';
        return [cols.slice(), noteRow];
    },

    downloadTemplateOne(sheetName) {
        if (!this._ensureXlsx()) return;
        const name = String(sheetName || '').trim();
        if (!name) {
            Notification.warning('اختر جدولاً من القائمة');
            return;
        }
        const wb = XLSX.utils.book_new();
        const rows = this.buildTemplateRows(name);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const tab = name.length > 31 ? name.slice(0, 31) : name;
        XLSX.utils.book_append_sheet(wb, ws, tab);
        XLSX.writeFile(wb, `قالب_${name}.xlsx`);
        Notification.success('تم تنزيل القالب');
    },

    downloadTemplateMulti() {
        if (!this._ensureXlsx()) return;
        const mul = document.getElementById('bulk-import-template-multi');
        if (!mul) return;
        const picked = Array.from(mul.selectedOptions)
            .map((o) => o.value)
            .filter(Boolean);
        if (!picked.length) {
            Notification.warning('حدّد جدولاً واحداً أو أكثر (Ctrl+نقر للمتعدد)');
            return;
        }
        const wb = XLSX.utils.book_new();
        const used = new Set();
        for (let i = 0; i < picked.length; i++) {
            const name = picked[i];
            let tab = name.length > 31 ? name.slice(0, 31) : name;
            let n = tab;
            let k = 2;
            while (used.has(n)) {
                const suffix = `_${k}`;
                n = (tab.slice(0, Math.max(1, 31 - suffix.length)) + suffix).slice(0, 31);
                k++;
            }
            used.add(n);
            const rows = this.buildTemplateRows(name);
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, n);
        }
        XLSX.writeFile(wb, `قوالب_استيراد_${new Date().toISOString().slice(0, 10)}.xlsx`);
        Notification.success('تم تنزيل ملف القوالب');
    },

    renderPanelHtml() {
        return `
<div class="settings-group mt-6">
  <div class="settings-group-header">
    <h2 class="settings-group-title">
      <i class="fas fa-file-import text-emerald-600 ml-2"></i>
      استيراد شامل من Excel / Google Sheets
    </h2>
    <p class="settings-group-subtitle">
      صدّر ملف Google Sheets كـ Excel (.xlsx) أو جهّز ملفاً متعدد الأوراق بأسماء جداول مطابقة للنظام، ثم استورد إلى قاعدة البيانات عبر الخادم.
    </p>
  </div>
  <div class="settings-group-content space-y-6">
    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title"><i class="fas fa-download ml-2"></i>قوالب جاهزة (تنسيق وأعمدة)</h2>
      </div>
      <div class="card-body space-y-4">
        <p class="text-sm text-gray-600">
          الصف الأول = أسماء الأعمدة كما في قاعدة البيانات. الصف الثاني مثال توضيحي — احذفه أو استبدله قبل الاستيراد.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">قالب لجدول واحد</label>
            <select id="bulk-import-template-select" class="form-input w-full"></select>
            <button type="button" id="bulk-import-download-one-btn" class="btn-secondary mt-2">
              <i class="fas fa-file-excel ml-2"></i>تحميل قالب .xlsx
            </button>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">قوالب متعددة (ورقة لكل جدول)</label>
            <select id="bulk-import-template-multi" class="form-input w-full" multiple size="8"></select>
            <p class="text-xs text-gray-500 mt-1">استخدم Ctrl/Cmd + النقر لتحديد أكثر من جدول</p>
            <button type="button" id="bulk-import-download-multi-btn" class="btn-secondary mt-2">
              <i class="fas fa-copy ml-2"></i>تحميل ملف قوالب متعدد
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title"><i class="fas fa-upload ml-2"></i>رفع ملف واستيراد</h2>
      </div>
      <div class="card-body space-y-4">
        <div class="flex flex-wrap gap-4 items-center">
          <input type="file" id="bulk-import-file" accept=".xlsx,.xls" class="form-input max-w-md" />
          <button type="button" id="bulk-import-preview-btn" class="btn-secondary">
            <i class="fas fa-eye ml-2"></i>معاينة الأوراق
          </button>
        </div>
        <div class="flex flex-wrap gap-6 items-start">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="bulk-import-mode" id="bulk-import-mode-upsert" value="upsert" checked class="rounded border-gray-300" />
            <span>دمج / تحديث (<code class="text-xs">upsert</code>) — آمن للدفعات</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="bulk-import-mode" id="bulk-import-mode-replace" value="replace" class="rounded border-gray-300" />
            <span class="text-red-700 font-semibold">استبدال كامل للجدول (يُفرّغ الجدول ثم يكتب الصفوف المرسلة فقط)</span>
          </label>
        </div>
        <p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          جداول PTW و PTWRegistry تُستورد دائماً بوضع الدمج (upsert) لتجنب حذف السجل بالخطأ عند إرسال دفعة واحدة.
        </p>
        <div id="bulk-import-preview-wrap" class="hidden overflow-x-auto border rounded-lg">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100">
              <tr>
                <th class="p-2 text-right">ورقة الملف</th>
                <th class="p-2 text-right">مسموح</th>
                <th class="p-2 text-right">صفوف بيانات</th>
                <th class="p-2 text-right">أعمدة غير متوقعة</th>
                <th class="p-2 text-center">استيراد</th>
              </tr>
            </thead>
            <tbody id="bulk-import-preview-body"></tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" id="bulk-import-run-btn" class="btn-primary" disabled>
            <i class="fas fa-play ml-2"></i>بدء الاستيراد للأوراق المحددة
          </button>
          <span id="bulk-import-progress" class="text-sm text-gray-600"></span>
        </div>
        <pre id="bulk-import-log" class="text-xs bg-gray-900 text-green-100 p-3 rounded max-h-48 overflow-auto hidden whitespace-pre-wrap"></pre>
      </div>
    </div>
  </div>
</div>`;
    },

    async populateTemplateSelectors() {
        await this.loadManifest();
        const sel = document.getElementById('bulk-import-template-select');
        const mul = document.getElementById('bulk-import-template-multi');
        if (!sel || !mul) return;
        const sheets = (this._manifest.allowedSheets || []).slice();
        sel.innerHTML =
            '<option value="">— اختر جدولاً —</option>' +
            sheets.map((s) => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('');
        mul.innerHTML = sheets.map((s) => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('');
        if (this._focusSheet && sheets.includes(this._focusSheet)) {
            sel.value = this._focusSheet;
            Array.from(mul.options).forEach((opt) => {
                opt.selected = opt.value === this._focusSheet;
            });
        }
    },

    analyzeWorkbook(wb) {
        const sheetsOut = [];
        for (let i = 0; i < wb.SheetNames.length; i++) {
            const tabName = wb.SheetNames[i];
            const ws = wb.Sheets[tabName];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
            const nonEmpty = rows.filter((row) => {
                const vals = Object.values(row);
                return vals.some((v) => String(v).trim() !== '');
            });
            const resolved = this.resolveSheetName(tabName);
            const allowed = this.isSheetAllowed(tabName);
            const expected =
                (this._manifest.headersMap && this._manifest.headersMap[tabName]) ||
                (this._manifest.headersMap && this._manifest.headersMap[resolved]);
            let unknownCols = [];
            if (expected && expected.length && nonEmpty.length) {
                const keys = Object.keys(nonEmpty[0]);
                const expSet = new Set(expected);
                unknownCols = keys.filter((k) => !expSet.has(k));
            }
            sheetsOut.push({
                tabName,
                rowCount: nonEmpty.length,
                allowed,
                rows: nonEmpty,
                unknownCols,
                resolved,
            });
        }
        return sheetsOut;
    },

    renderPreviewTable(analysis) {
        const tbody = document.getElementById('bulk-import-preview-body');
        const wrap = document.getElementById('bulk-import-preview-wrap');
        const runBtn = document.getElementById('bulk-import-run-btn');
        if (!tbody || !wrap) return;
        tbody.innerHTML = analysis
            .map((a, idx) => {
                const unk = a.unknownCols.length
                    ? Utils.escapeHTML(a.unknownCols.slice(0, 6).join(', ')) +
                      (a.unknownCols.length > 6 ? '…' : '')
                    : '—';
                const chk =
                    a.allowed && a.rowCount > 0
                        ? `<input type="checkbox" class="bulk-import-sheet-chk rounded border-gray-300" data-idx="${idx}" checked />`
                        : `<input type="checkbox" class="bulk-import-sheet-chk rounded border-gray-300" data-idx="${idx}" disabled />`;
                return `<tr>
          <td class="p-2 border-t">${Utils.escapeHTML(a.tabName)}</td>
          <td class="p-2 border-t">${a.allowed ? '<span class="text-green-600">نعم</span>' : '<span class="text-red-600">لا</span>'}</td>
          <td class="p-2 border-t">${a.rowCount}</td>
          <td class="p-2 border-t text-xs">${unk}</td>
          <td class="p-2 border-t text-center">${chk}</td>
        </tr>`;
            })
            .join('');
        wrap.classList.remove('hidden');
        if (runBtn) {
            const any = analysis.some((a) => a.allowed && a.rowCount > 0);
            runBtn.disabled = !any;
        }
    },

    _logLine(msg) {
        const el = document.getElementById('bulk-import-log');
        if (!el) return;
        el.classList.remove('hidden');
        el.textContent += msg + '\n';
        el.scrollTop = el.scrollHeight;
    },

    async runImport() {
        if (!this._ensureXlsx()) return;
        if (!this._lastAnalysis || !this._lastAnalysis.length) {
            Notification.warning('اضغط «معاينة الأوراق» أولاً');
            return;
        }
        const replaceMode = document.getElementById('bulk-import-mode-replace')?.checked === true;

        const chks = document.querySelectorAll('.bulk-import-sheet-chk:checked:not(:disabled)');
        const indices = Array.from(chks)
            .map((c) => parseInt(c.getAttribute('data-idx'), 10))
            .filter((n) => !Number.isNaN(n));

        if (!indices.length) {
            Notification.warning('لم يتم تحديد ورقة مسموحة تحتوي بيانات');
            return;
        }

        const ordered = this.sortSheetsForImport(
            indices.map((i) => this._lastAnalysis[i].tabName),
        );
        const indexByTab = {};
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            indexByTab[this._lastAnalysis[idx].tabName] = idx;
        }

        const progressEl = document.getElementById('bulk-import-progress');
        const log = document.getElementById('bulk-import-log');
        if (log) {
            log.textContent = '';
            log.classList.remove('hidden');
        }

        if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration._isBackendRpcConfigured()) {
            Notification.error('الخادم الخلفي غير مهيأ — راجع تبويب التكامل ورابط hse-api');
            return;
        }

        const spreadsheetId = AppState.googleConfig?.sheets?.spreadsheetId?.trim();
        const isSupabaseRpc =
            typeof GoogleIntegration._isSupabaseRpcUrl === 'function' &&
            GoogleIntegration._isSupabaseRpcUrl();

        for (let o = 0; o < ordered.length; o++) {
            const tab = ordered[o];
            const idx = indexByTab[tab];
            const item = this._lastAnalysis[idx];
            if (!item || !item.allowed || item.rowCount === 0) continue;

            let upsert = replaceMode ? false : true;
            if (this.FORCE_UPSERT_SHEETS.has(item.resolved) || this.FORCE_UPSERT_SHEETS.has(item.tabName)) {
                upsert = true;
            }

            if (!upsert && item.rows.length > this.REPLACE_ROW_WARN) {
                Notification.warning(
                    `تخطّي ${item.tabName}: وضع الاستبدال لعدد صفوف كبير (${item.rows.length}) قد يفشل — استخدم الدمج أو قسّم الملف.`,
                );
                this._logLine(`SKIP ${item.tabName}: too many rows for replace in browser`);
                continue;
            }

            if (!upsert && item.rows.length === 0) continue;

            const sheetName = item.tabName.trim();

            try {
                if (progressEl) {
                    progressEl.textContent = `جاري ${sheetName} (${o + 1}/${ordered.length})…`;
                }

                if (upsert) {
                    const chunk = this.CHUNK_SIZE;
                    for (let start = 0; start < item.rows.length; start += chunk) {
                        const part = item.rows.slice(start, start + chunk);
                        const result = await GoogleIntegration.sendRequest({
                            action: 'saveToSheet',
                            data: {
                                sheetName,
                                data: part,
                                upsert: true,
                                ...(!isSupabaseRpc && spreadsheetId ? { spreadsheetId } : {}),
                            },
                        });
                        if (!result || !result.success) {
                            throw new Error(result?.message || 'فشل saveToSheet');
                        }
                        if (progressEl) {
                            progressEl.textContent = `${sheetName}: ${Math.min(start + chunk, item.rows.length)}/${item.rows.length}`;
                        }
                    }
                } else {
                    const result = await GoogleIntegration.sendRequest({
                        action: 'saveToSheet',
                        data: {
                            sheetName,
                            data: item.rows,
                            upsert: false,
                            ...(!isSupabaseRpc && spreadsheetId ? { spreadsheetId } : {}),
                        },
                    });
                    if (!result || !result.success) {
                        throw new Error(result?.message || 'فشل saveToSheet');
                    }
                }

                this._logLine(`OK ${sheetName}: ${item.rows.length} صف`);
                if (typeof AuditLog !== 'undefined' && AuditLog.log) {
                    AuditLog.log('bulk_sheet_import', 'SheetBulkImport', null, {
                        sheetName,
                        rows: item.rows.length,
                        upsert,
                    });
                }
            } catch (err) {
                Utils.safeError('bulk import', err);
                this._logLine(`ERR ${sheetName}: ${err.message || err}`);
                Notification.error(`فشل استيراد ${sheetName}: ${err.message || err}`);
            }
        }

        if (progressEl) progressEl.textContent = 'اكتمل';
        Notification.success('انتهى تشغيل الاستيراد — راجع السجل أدناه');
    },

    bindDom() {
        const downloadOne = document.getElementById('bulk-import-download-one-btn');
        const downloadMulti = document.getElementById('bulk-import-download-multi-btn');
        const previewBtn = document.getElementById('bulk-import-preview-btn');
        const runBtn = document.getElementById('bulk-import-run-btn');
        const fileInput = document.getElementById('bulk-import-file');

        if (downloadOne) {
            downloadOne.addEventListener('click', () => {
                const sel = document.getElementById('bulk-import-template-select');
                const v = sel && sel.value;
                this.downloadTemplateOne(v);
            });
        }
        if (downloadMulti) {
            downloadMulti.addEventListener('click', () => this.downloadTemplateMulti());
        }

        if (previewBtn && fileInput) {
            previewBtn.addEventListener('click', async () => {
                if (!this._ensureXlsx()) return;
                const f = fileInput.files && fileInput.files[0];
                if (!f) {
                    Notification.warning('اختر ملفاً أولاً');
                    return;
                }
                try {
                    if (typeof Loading !== 'undefined') Loading.show('جاري قراءة الملف…');
                    await this.loadManifest();
                    const buf = await f.arrayBuffer();
                    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
                    this._lastAnalysis = this.analyzeWorkbook(wb);
                    this.renderPreviewTable(this._lastAnalysis);
                } catch (e) {
                    Utils.safeError('معاينة الاستيراد', e);
                    Notification.error('فشلت المعاينة: ' + (e.message || e));
                } finally {
                    if (typeof Loading !== 'undefined') Loading.hide();
                }
            });
        }

        if (runBtn) {
            runBtn.addEventListener('click', async () => {
                const replaceMode = document.getElementById('bulk-import-mode-replace')?.checked === true;
                if (replaceMode) {
                    const ok = confirm(
                        'تأكيد: وضع «استبدال كامل» يحذف كل الصفوف الحالية في الجدول على الخادم ثم يكتب فقط البيانات الموجودة في الملف.\n\nهل تريد المتابعة؟',
                    );
                    if (!ok) return;
                }
                try {
                    if (typeof Loading !== 'undefined') Loading.show('جاري الاستيراد…');
                    await this.runImport();
                } finally {
                    if (typeof Loading !== 'undefined') Loading.hide();
                }
            });
        }

        this.populateTemplateSelectors().catch((e) => {
            Utils.safeError('populateTemplateSelectors', e);
            Notification.error('تعذر تحميل قائمة الجداول للقوالب');
        });
    },
};

window.SheetBulkImport = SheetBulkImport;
