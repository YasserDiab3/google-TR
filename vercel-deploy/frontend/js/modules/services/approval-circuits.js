/**
 * Approval Circuits Service
 * Handles approval workflow circuits and user management
 */

const ApprovalCircuits = {
    _ensureStore() {
        if (!AppState.companySettings) {
            AppState.companySettings = {};
        }
        if (!AppState.companySettings.approvalCircuits || typeof AppState.companySettings.approvalCircuits !== 'object') {
            AppState.companySettings.approvalCircuits = {};
        }
        return AppState.companySettings.approvalCircuits;
    },

    _normalizeOwnerKey(ownerId) {
        if (!ownerId || ownerId === '__default__') {
            return '__default__';
        }
        return String(ownerId);
    },

    getAll() {
        return this._ensureStore();
    },

    getCircuit(ownerId) {
        const circuits = this.getAll();
        const key = this._normalizeOwnerKey(ownerId);
        return circuits[key] || null;
    },

    getCircuitForUser(userId) {
        const circuits = this.getAll();
        const key = this._normalizeOwnerKey(userId);
        if (key !== '__default__' && circuits[key]) {
            return circuits[key];
        }
        return circuits.__default__ || null;
    },

    listOwners() {
        const circuits = this.getAll();
        return Object.keys(circuits);
    },

    createEmptyCircuit(ownerId = '__default__') {
        return {
            id: Utils.generateId('CIR'),
            ownerId: this._normalizeOwnerKey(ownerId),
            name: ownerId === '__default__' ? 'الدائرة الافتراضية العامة' : '',
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    saveCircuit(circuit) {
        if (!circuit || !circuit.ownerId) return;
        const circuits = this.getAll();
        const key = this._normalizeOwnerKey(circuit.ownerId);
        circuits[key] = Object.assign({}, circuit, {
            ownerId: key,
            updatedAt: new Date().toISOString()
        });
        DataManager.saveCompanySettings();
        DataManager.save();
    },

    deleteCircuit(ownerId) {
        const circuits = this.getAll();
        const key = this._normalizeOwnerKey(ownerId);
        if (circuits[key]) {
            delete circuits[key];
            DataManager.saveCompanySettings();
            DataManager.save();
        }
    },

    getUsersList() {
        const users = Array.isArray(AppState.appData.users) ? [...AppState.appData.users] : [];
        return users.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }));
    },

    getUserById(userId) {
        if (!userId) return null;
        const users = Array.isArray(AppState.appData.users) ? AppState.appData.users : [];
        return users.find(user => user && (user.id === userId || user.email === userId));
    },

    toCandidate(user) {
        if (!user) return null;
        return {
            id: user.id || user.email || '',
            name: user.name || user.fullName || user.displayName || user.email || '',
            email: user.email || '',
            role: user.role || ''
        };
    },

    buildUserSnapshot(user) {
        if (!user) return null;
        return {
            id: user.id || '',
            name: user.name || user.fullName || user.displayName || '',
            email: user.email || '',
            role: user.role || ''
        };
    },

    _createApprovalFromStep(step, order = 0, ownerId = '__default__') {
        const userIds = Array.isArray(step?.userIds) ? step.userIds.filter(Boolean) : [];
        const candidates = userIds
            .map(id => this.toCandidate(this.getUserById(id)))
            .filter(Boolean);

        const singleCandidate = candidates.length === 1 ? candidates[0] : null;

        return {
            role: step?.name || step?.role || '',
            required: step?.required !== false,
            status: 'pending',
            order,
            approverId: singleCandidate?.id || '',
            approver: singleCandidate?.name || '',
            approverEmail: singleCandidate?.email || '',
            candidates,
            history: [],
            assignedAt: singleCandidate ? new Date().toISOString() : '',
            assignedBy: null,
            isSafetyOfficer: step?.isSafetyOfficer === true,
            circuitOwnerId: ownerId
        };
    },

    enrichApprovals(approvals = [], ownerId = '__default__') {
        return approvals.map((approval, index) => this._attachMetadataToApproval(approval, index, ownerId));
    },

    _attachMetadataToApproval(approval, order = 0, ownerId = '__default__') {
        const normalized = Object.assign({}, approval);
        normalized.order = typeof normalized.order === 'number' ? normalized.order : order;
        normalized.status = normalized.status || (normalized.approved ? 'approved' : normalized.rejected ? 'rejected' : 'pending');
        normalized.required = normalized.required !== false;
        normalized.circuitOwnerId = normalized.circuitOwnerId || ownerId;

        if (Array.isArray(normalized.candidates)) {
            normalized.candidates = normalized.candidates
                .map(candidate => {
                    if (!candidate) return null;
                    if (candidate.id && candidate.name && candidate.email !== undefined) {
                        return candidate;
                    }
                    return this.toCandidate(this.getUserById(candidate.id || candidate));
                })
                .filter(Boolean);
        } else {
            normalized.candidates = [];
        }

        if (normalized.approverId && !normalized.approver) {
            const user = this.getUserById(normalized.approverId);
            if (user) {
                normalized.approver = user.name || '';
                normalized.approverEmail = user.email || '';
            }
        }

        if (!normalized.approverId && normalized.approverEmail) {
            const candidate = normalized.candidates.find(c => c.email && c.email.toLowerCase() === normalized.approverEmail.toLowerCase());
            if (candidate) {
                normalized.approverId = candidate.id;
            }
        }

        normalized.history = Array.isArray(normalized.history) ? normalized.history : [];
        normalized.assignedAt = normalized.assignedAt || '';
        normalized.assignedBy = normalized.assignedBy || null;

        return normalized;
    },

    generateApprovalsForUser(userId) {
        const circuit = this.getCircuitForUser(userId);
        if (!circuit || !Array.isArray(circuit.steps) || circuit.steps.length === 0) {
            if (typeof PTW !== 'undefined' && PTW.getDefaultApprovals) {
                return {
                    approvals: this.enrichApprovals(PTW.getDefaultApprovals(), '__default__'),
                    circuitOwnerId: '__default__',
                    circuitName: 'الدائرة الافتراضية العامة'
                };
            }
            return { approvals: [], circuitOwnerId: '__default__', circuitName: 'الدائرة الافتراضية العامة' };
        }

        const steps = [...circuit.steps].sort((a, b) => (a.order || 0) - (b.order || 0));
        const approvals = steps.map((step, index) => this._attachMetadataToApproval(
            this._createApprovalFromStep(step, index, circuit.ownerId || '__default__'),
            index,
            circuit.ownerId || '__default__'
        ));

        return {
            approvals,
            circuitOwnerId: circuit.ownerId || '__default__',
            circuitName: circuit.name || ''
        };
    },

    buildHistoryEntry(action, details = {}) {
        return Object.assign({
            id: Utils.generateId('APRLOG'),
            action,
            timestamp: new Date().toISOString()
        }, details);
    },

    /**
     * عرض مدير مسارات الاعتماد في واجهة المستخدم
     * @param {string} moduleType - نوع الوحدة (ptw, etc.)
     * @returns {string} HTML content for the approval circuits manager
     */
    renderManager(moduleType = 'ptw') {
        try {
            const circuits = this.getAll();
            const owners = this.listOwners();
            const users = this.getUsersList();

            // إذا لم تكن هناك دوائر، اعرض رسالة توضيحية
            if (!owners || owners.length === 0 || (owners.length === 1 && owners[0] === '__default__' && !circuits.__default__)) {
                return `
                    <div class="text-center py-8">
                        <div class="bg-purple-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-route text-purple-400 text-2xl"></i>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">إدارة مسارات الاعتماد</h3>
                        <p class="text-gray-500 text-sm max-w-md mx-auto mb-4">
                            يمكنك إدارة تكوينات مسارات الاعتماد وتحديد الموافقين من خلال قسم الإعدادات.
                        </p>
                        <a href="javascript:void(0)" onclick="if(typeof AppUI !== 'undefined' && typeof Settings !== 'undefined') { AppUI.switchModule('settings'); setTimeout(() => { const settingsTab = document.querySelector('[data-tab=\"approval-circuits\"]'); if(settingsTab) settingsTab.click(); }, 300); }" class="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                            <i class="fas fa-cog ml-2"></i>
                            الذهاب إلى الإعدادات
                        </a>
                    </div>
                `;
            }

            // عرض قائمة مسارات الاعتماد
            const circuitsList = owners
                .filter(ownerId => circuits[ownerId])
                .map(ownerId => {
                    const circuit = circuits[ownerId];
                    const owner = ownerId === '__default__' ? null : this.getUserById(ownerId);
                    const ownerName = ownerId === '__default__' 
                        ? 'المسار الافتراضي (يطبق على جميع المستخدمين)'
                        : (owner?.name || owner?.email || `مستخدم ${ownerId}`);
                    const stepsCount = Array.isArray(circuit.steps) ? circuit.steps.length : 0;

                    return `
                        <div class="border border-gray-200 rounded-lg p-4 mb-4 bg-white hover:shadow-md transition-shadow">
                            <div class="flex items-center justify-between">
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-800 mb-1">${Utils.escapeHTML(circuit.name || ownerName)}</h4>
                                    <p class="text-sm text-gray-600">
                                        ${ownerId === '__default__' ? '' : `المستخدم: ${Utils.escapeHTML(ownerName)} • `}
                                        عدد المستويات: <span class="font-medium">${stepsCount}</span>
                                    </p>
                                </div>
                                <div class="ml-4">
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                        stepsCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                    }">
                                        ${stepsCount > 0 ? 'مفعل' : 'غير مفعل'}
                                    </span>
                                </div>
                            </div>
                            ${stepsCount > 0 ? `
                                <div class="mt-3 pt-3 border-t border-gray-100">
                                    <div class="flex flex-wrap gap-2">
                                        ${circuit.steps.map((step, idx) => `
                                            <span class="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                                                ${idx + 1}. ${Utils.escapeHTML(step.name || step.role || 'مستوى غير محدد')}
                                                ${step.isSafetyOfficer ? ' <i class="fas fa-shield-alt mr-1 text-orange-500"></i>' : ''}
                                            </span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');

            return `
                <div class="space-y-4">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">مسارات الاعتماد المكونة</h3>
                            <p class="text-sm text-gray-600 mt-1">عرض جميع مسارات الاعتماد المعرفة في النظام</p>
                        </div>
                        <a href="javascript:void(0)" onclick="if(typeof AppUI !== 'undefined' && typeof Settings !== 'undefined') { AppUI.switchModule('settings'); setTimeout(() => { const settingsTab = document.querySelector('[data-tab=\"approval-circuits\"]'); if(settingsTab) settingsTab.click(); }, 300); }" class="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                            <i class="fas fa-cog ml-2"></i>
                            إدارة المسارات
                        </a>
                    </div>
                    <div class="space-y-3">
                        ${circuitsList || '<p class="text-gray-500 text-center py-4">لا توجد مسارات اعتماد مكونة</p>'}
                    </div>
                </div>
            `;
        } catch (error) {
            Utils.safeError('خطأ في عرض مدير مسارات الاعتماد:', error);
            return `
                <div class="text-center py-8">
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <i class="fas fa-exclamation-triangle text-yellow-600 text-2xl mb-2"></i>
                        <p class="text-yellow-800 text-sm">حدث خطأ أثناء تحميل مدير مسارات الاعتماد.</p>
                    </div>
                </div>
            `;
        }
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.ApprovalCircuits = ApprovalCircuits;
}

