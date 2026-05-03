/**
 * Workflow Engine Service
 * Handles multi-step workflow processes
 */

const Workflow = {
    STATUSES: {
        DRAFT: 'draft',
        IN_REVIEW: 'in_review',
        AWAITING_APPROVAL: 'awaiting_approval',
        APPROVED: 'approved',
        REJECTED: 'rejected'
    },

    create(module, recordId) {
        return {
            id: Utils.generateId('WF'),
            module,
            recordId,
            status: this.STATUSES.DRAFT,
            steps: [],
            history: [],
            currentStep: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    addStep(workflow, stepConfig) {
        if (!workflow.steps) {
            workflow.steps = [];
        }

        const step = {
            key: stepConfig.key,
            label: stepConfig.label,
            role: stepConfig.role || null,
            roles: stepConfig.roles || null,
            description: stepConfig.description || '',
            status: 'pending',
            createdAt: new Date().toISOString(),
            completedAt: null,
            completedBy: null
        };

        workflow.steps.push(step);
        this._touch(workflow);
        return step;
    },

    start(workflow, startIndex = 0) {
        if (!workflow.steps || workflow.steps.length === 0) return;
        workflow.steps.forEach((step, index) => {
            step.status = index === startIndex ? 'in_progress' : (index < startIndex ? 'completed' : 'pending');
        });
        workflow.currentStep = startIndex;
        workflow.status = startIndex === 0 ? this.STATUSES.DRAFT : this.STATUSES.IN_REVIEW;
        this._touch(workflow);
    },

    getCurrentStep(workflow) {
        if (!workflow || !workflow.steps || workflow.steps.length === 0) return null;
        return workflow.steps[Math.min(workflow.currentStep, workflow.steps.length - 1)] || null;
    },

    canUserAction(workflow, user) {
        if (!workflow || !user) return false;
        if (workflow.status === this.STATUSES.APPROVED) return false;
        const step = this.getCurrentStep(workflow);
        if (!step) return false;
        if (workflow.status === this.STATUSES.REJECTED && step.status !== 'in_progress') {
            return false;
        }

        if (!step.role && !step.roles) {
            return true;
        }

        if (step.role && user.role === step.role) {
            return true;
        }

        if (Array.isArray(step.roles) && step.roles.includes(user.role)) {
            return true;
        }

        if (step.userId && user.id && step.userId === user.id) {
            return true;
        }

        if (step.email && user.email && step.email === user.email) {
            return true;
        }

        return false;
    },

    completeCurrentStep(workflow, user, metadata = {}) {
        const step = this.getCurrentStep(workflow);
        if (!step) return workflow;

        const timestamp = new Date().toISOString();
        step.status = 'completed';
        step.completedAt = timestamp;
        step.completedBy = this._extractUser(user);

        workflow.history.push({
            type: 'step_completed',
            stepKey: step.key,
            stepLabel: step.label,
            timestamp,
            user: this._extractUser(user),
            metadata
        });

        if (workflow.currentStep < workflow.steps.length - 1) {
            workflow.currentStep += 1;
            workflow.steps[workflow.currentStep].status = 'in_progress';
            workflow.status = workflow.currentStep === workflow.steps.length - 1
                ? this.STATUSES.AWAITING_APPROVAL
                : this.STATUSES.IN_REVIEW;
        } else {
            workflow.status = this.STATUSES.APPROVED;
        }

        this._touch(workflow);
        return workflow;
    },

    reject(workflow, user, metadata = {}) {
        const timestamp = new Date().toISOString();
        workflow.status = this.STATUSES.REJECTED;
        workflow.rejectedAt = timestamp;
        workflow.history.push({
            type: 'rejected',
            stepKey: this.getCurrentStep(workflow)?.key || null,
            stepLabel: this.getCurrentStep(workflow)?.label || '',
            timestamp,
            user: this._extractUser(user),
            metadata
        });
        this._touch(workflow);
        return workflow;
    },

    resetToStep(workflow, stepIndex) {
        if (!workflow.steps || stepIndex < 0 || stepIndex >= workflow.steps.length) return workflow;

        workflow.steps.forEach((step, index) => {
            if (index < stepIndex) {
                step.status = 'completed';
            } else if (index === stepIndex) {
                step.status = 'in_progress';
                step.completedAt = null;
                step.completedBy = null;
            } else {
                step.status = 'pending';
                step.completedAt = null;
                step.completedBy = null;
            }
        });

        workflow.currentStep = stepIndex;
        workflow.status = stepIndex === 0 ? this.STATUSES.DRAFT : this.STATUSES.IN_REVIEW;
        this._touch(workflow);
        return workflow;
    },

    getStatusLabel(workflow) {
        if (!workflow) return '';
        switch (workflow.status) {
            case this.STATUSES.DRAFT:
                return 'مسودة';
            case this.STATUSES.IN_REVIEW:
                return 'قيد المراجعة';
            case this.STATUSES.AWAITING_APPROVAL:
                return 'في انتظار الموافقة';
            case this.STATUSES.APPROVED:
                return 'موافق عليه';
            case this.STATUSES.REJECTED:
                return 'مرفوض';
            default:
                return 'غير معروف';
        }
    },

    _touch(workflow) {
        workflow.updatedAt = new Date().toISOString();
    },

    _extractUser(user) {
        if (!user) return null;
        return {
            id: user.id || null,
            name: user.name || user.fullName || user.displayName || '',
            email: user.email || '',
            role: user.role || ''
        };
    }
};

// Export to global window (for script tag loading)
if (typeof window !== 'undefined') {
    window.Workflow = Workflow;
}

