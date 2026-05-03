/**
 * Google Apps Script for HSE System - Default Headers
 * 
 * الرؤوس الافتراضية لجميع الأوراق
 */

/**
 * الحصول على الرؤوس الافتراضية لكل ورقة
 */
function getDefaultHeaders(sheetName) {
    const headersMap = {
        'Users': ['id', 'name', 'email', 'password', 'passwordHash', 'role', 'department', 'active', 'photo', 'permissions', 'lastLogin', 'lastLogout', 'isOnline', 'loginHistory', 'postLoginPolicySeenAt', 'profilePublicToken', 'profilePublicTokenExpiry', 'createdAt', 'updatedAt'],
        'Incidents': ['id', 'isoCode', 'title', 'description', 'location', 'siteId', 'siteName', 'sublocation', 'sublocationId', 'sublocationName', 'date', 'severity', 'incidentType', 'affiliation', 'department', 'reportedBy', 'employeeCode', 'employeeNumber', 'employeeName', 'employeeJob', 'employeeDepartment', 'status', 'rootCause', 'correctiveAction', 'preventiveAction', 'actionPlan', 'affectedType', 'affectedCode', 'affectedName', 'affectedJobTitle', 'affectedDepartment', 'affectedContact', 'injuryDescription', 'losses', 'actionsTaken', 'contractorName', 'image', 'attachments', 'investigation', 'closureDate', 'actionOwner', 'requiresApproval', 'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectionReason', 'createdBy', 'createdAt', 'updatedAt'],
        'IncidentNotifications': ['id', 'notificationNumber', 'date', 'location', 'siteId', 'siteName', 'sublocation', 'sublocationId', 'sublocationName', 'department', 'incidentType', 'affiliation', 'contractorName', 'employeeCode', 'employeeName', 'employeeJob', 'employeeDepartment', 'description', 'injuryDescription', 'losses', 'actions', 'reporterName', 'reporterCode', 'createdBy', 'createdAt', 'updatedAt'],
        'SafetyAlerts': ['id', 'alertNumber', 'sequentialNumber', 'incidentId', 'incidentType', 'incidentDate', 'incidentLocation', 'who', 'description', 'facts', 'causes', 'lessonsLearned', 'preventiveMeasures', 'locationImage', 'causesImage', 'notificationNumber', 'preparedBy', 'approvedBy', 'approvedAt', 'issueDate', 'status', 'createdBy', 'createdAt', 'updatedAt'],
        'Incident_Analysis_Settings': ['id', 'enabledSections', 'updatedAt', 'updatedBy', 'createdAt'],
        // ✅ سجل الحوادث (الإدخال اليدوي) - Registry
        'IncidentsRegistry': ['id', 'sequentialNumber', 'incidentId', 'incidentType', 'factory', 'incidentLocation', 'incidentDate', 'incidentDay', 'incidentTime', 'shift', 'employeeAffiliation', 'employeeCode', 'employeeName', 'employeeJob', 'employeeDepartment', 'incidentDetails', 'incidentDetailsBrief', 'injuryDescription', 'injuredPart', 'losses', 'equipmentCause', 'actionsTaken', 'leaveStartDate', 'returnToWorkDate', 'totalLeaveDays', 'treatingDoctor', 'status', 'createdAt', 'updatedAt'],
        'NearMiss': ['id', 'type', 'date', 'observerName', 'phone', 'location', 'department', 'description', 'correctiveProposed', 'correctiveDescription', 'attachments', 'status', 'reportedBy', 'createdAt', 'updatedAt'],
        'PTW': ['id', 'workType', 'workDescription', 'location', 'department', 'startDate', 'endDate', 'responsible', 'status', 'approvals', 'requiredPPE', 'riskAssessment', 'riskNotes', 'approvalCircuitOwnerId', 'approvalCircuitName', 'skipApprovalFlow', 'createdAt', 'updatedAt'],
        // ✅ سجل حصر التصاريح (الإدخال اليدوي) - PTW Registry (جميع القيم تخزن كنص أو رقم فقط، لا JSON)
        'PTWRegistry': [
            'id', 'sequentialNumber', 'permitId', 'openDate', 'permitType', 'permitTypeDisplay', 'requestingParty', 'locationId', 'location', 'sublocationId', 'sublocation',
            'timeFrom', 'timeTo', 'totalTime', 'authorizedParty', 'workDescription', 'supervisor1', 'supervisor2', 'status',
            'paperPermitNumber', 'equipment', 'tools', 'toolsList', 'teamMembersText',
            'hotWorkDetails', 'hotWorkOther', 'confinedSpaceDetails', 'confinedSpaceOther', 'heightWorkDetails', 'heightWorkOther',
            'electricalWorkType', 'coldWorkType', 'otherWorkType', 'excavationLength', 'excavationWidth', 'excavationDepth', 'soilType',
            'preStartChecklist', 'lotoApplied', 'governmentPermits', 'riskAssessmentAttached', 'gasTesting', 'mocRequest',
            'ppeNotes', 'requiredPPE', 'riskLikelihood', 'riskConsequence', 'riskScore', 'riskLevel', 'riskNotes',
            'manualApprovalsText', 'manualClosureApprovalsText', 'closureDate', 'closureReason', 'isManualEntry',
            'approvalCircuitOwnerId', 'approvalCircuitName', 'skipApprovalFlow',
            'createdAt', 'updatedAt'
        ],
        // Hybrid ID migration map for PTWRegistry IDs
        'PTWIdMapping': ['id', 'entityType', 'oldId', 'newId', 'createdAt', 'updatedAt'],
        'PTW_MAP_COORDINATES': ['id', 'name', 'latitude', 'longitude', 'zoom', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'PTW_DEFAULT_COORDINATES': ['latitude', 'longitude', 'zoom', 'updatedAt', 'updatedBy'],
        'Training': ['id', 'name', 'trainer', 'trainingType', 'date', 'factory', 'factoryName', 'location', 'locationName', 'startTime', 'endTime', 'hours', 'startDate', 'participants', 'participantsCount', 'status', 'createdAt', 'updatedAt'],
        'TrainingAttendance': ['id', 'trainingId', 'date', 'trainingType', 'factory', 'factoryName', 'employeeCode', 'employeeName', 'position', 'department', 'topic', 'trainer', 'startTime', 'endTime', 'totalHours', 'createdAt', 'updatedAt'],
        // ✅ Clinic Visits (Employees) - avoid JSON fields; flatten medications into plain text + total qty
        'ClinicVisits': [
            'id',
            'personType',
            'employeeCode',
            'employeeNumber',
            'employeeName',
            'employeePosition',
            'employeeDepartment',
            'factory',
            'factoryName',
            'employeeLocation',
            'visitDate',
            'exitDate',
            'visitType',
            'reason',
            'diagnosis',
            'treatment',
            'medicationsDispensed',
            'medicationsDispensedQty',
            'createdAt',
            'updatedAt',
            'createdBy',
            'updatedBy'
        ],
        // ✅ New sheet: Clinic Contractor/External Visits (separate table, linked to same module)
        // Stores contractors + external labor visits only (no JSON fields)
        'ClinicContractorVisits': [
            'id',
            'personType',
            'contractorName',
            'contractorWorkerName',
            'contractorPosition',
            'externalName',
            'factory',
            'factoryName',
            'workArea',
            'visitDate',
            'exitDate',
            'visitType',
            'reason',
            'diagnosis',
            'treatment',
            'medicationsDispensed',
            'medicationsDispensedQty',
            'createdAt',
            'updatedAt',
            'createdBy',
            'updatedBy'
        ],
        // ✅ Medications - canonical order aligned with frontend table (quantityAdded=الكمية, remainingQuantity=الرصيد)
        'Medications': [
            'id',
            'name',
            'type',
            'usage',
            'purchaseDate',
            'expiryDate',
            'status',
            'daysRemaining',
            'quantityAdded',
            'remainingQuantity',
            'location',
            'notes',
            'createdBy',
            'createdById',
            'createdAt',
            'updatedAt',
            'updatedBy'
        ],
        'SickLeave': ['id', 'personType', 'employeeCode', 'employeeNumber', 'employeeName', 'department', 'contractorName', 'externalName', 'startDate', 'endDate', 'daysCount', 'reason', 'medicalNotes', 'treatingDoctor', 'status', 'linkedRegistryId', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy'],
        // ✅ جدول الإصابات للموظفين فقط (الحالي - تم الإبقاء عليه)
        'Injuries': ['id', 'personType', 'employeeCode', 'employeeNumber', 'employeeName', 'employeePosition', 'employeeDepartment', 'department', 'factory', 'factoryName', 'subLocation', 'subLocationName', 'injuryDate', 'injuryType', 'injuryBodyPart', 'injuryLocation', 'injuryDescription', 'actionsTaken', 'treatment', 'status', 'attachments', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        // ✅ جدول جديد لإصابات المقاولين/الخارجي
        'ClinicContractorInjuries': ['id', 'personType', 'contractorName', 'personName', 'contractorPosition', 'department', 'factory', 'factoryName', 'subLocation', 'subLocationName', 'injuryDate', 'injuryType', 'injuryBodyPart', 'injuryLocation', 'injuryDescription', 'actionsTaken', 'treatment', 'status', 'attachments', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'ClinicInventory': ['id', 'medicationName', 'quantity', 'expiryDate', 'location', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'FireEquipment': ['id', 'equipmentNumber', 'equipmentType', 'location', 'checkDate', 'status', 'inspector', 'notes', 'createdAt', 'updatedAt'],
        'PPE': ['id', 'receiptNumber', 'employeeName', 'employeeCode', 'employeeNumber', 'employeeDepartment', 'employeePosition', 'employeeBranch', 'employeeLocation', 'equipmentType', 'quantity', 'receiptDate', 'status', 'createdAt', 'updatedAt'],
        'Violations': ['id', 'isoCode', 'personType', 'employeeId', 'employeeName', 'employeeCode', 'employeeNumber', 'employeePosition', 'employeeDepartment', 'contractorId', 'contractorName', 'contractorWorker', 'contractorPosition', 'contractorDepartment', 'violationTypeId', 'violationType', 'fineAmount', 'violationDate', 'violationTime', 'violationLocation', 'violationLocationId', 'violationPlace', 'violationPlaceId', 'violationDetails', 'severity', 'actionTaken', 'status', 'photo', 'createdAt', 'updatedAt'],
        'Blacklist_Register': ['id', 'serialNumber', 'factory', 'factoryId', 'location', 'locationId', 'fullName', 'idNumber', 'photo', 'job', 'department', 'banReason', 'banDate', 'bannedBy', 'editor', 'notes', 'createdAt', 'updatedAt'],
        'Contractors': ['id', 'name', 'serviceType', 'contractNumber', 'startDate', 'endDate', 'status', 'contactPerson', 'phone', 'email', 'createdAt', 'updatedAt'],
        // ✅ ترتيب مطابق لواجهة جدول الموظفين في الواجهة الأمامية + إضافة age (محسوب)
        // ملاحظة: id موجود للحفاظ على التوافق لكنه يساوي employeeNumber (حسب منطق النظام)
        // ✅ إضافة: status (active/inactive) و resignationDate لإدارة استقالات الموظفين
        'Employees': ['employeeNumber', 'name', 'department', 'job', 'nationalId', 'birthDate', 'age', 'hireDate', 'gender', 'phone', 'insuranceNumber', 'sapId', 'branch', 'location', 'position', 'email', 'photo', 'status', 'resignationDate', 'createdAt', 'updatedAt', 'id'],
        'BehaviorMonitoring': ['id', 'isoCode', 'employeeId', 'employeeCode', 'employeeNumber', 'employeeName', 'department', 'job', 'factory', 'factoryId', 'factoryName', 'subLocation', 'subLocationId', 'subLocationName', 'behaviorType', 'date', 'rating', 'correctiveAction', 'correctiveActionDetails', 'description', 'photo', 'createdAt', 'updatedAt'],
        'ChemicalSafety': ['id', 'isoCode', 'chemicalName', 'trainer', 'date', 'status', 'description', 'createdAt', 'updatedAt'],
        'Chemical_Register': ['id', 'serialNumber', 'rmName', 'physicalShape', 'purposeOfUse', 'methodOfApplication', 'department', 'msdsArabic', 'msdsEnglish', 'localImport', 'manufacturer', 'agentEgypt', 'containerType', 'containerDisposalMethod', 'hazardClass', 'hazardDescription', 'locationStore', 'qtyYear', 'nfpaDiamond', 'createdAt', 'updatedAt'],
        'DailyObservations': ['id', 'isoCode', 'siteId', 'siteName', 'placeId', 'locationName', 'observationType', 'date', 'shift', 'details', 'correctiveAction', 'responsibleDepartment', 'riskLevel', 'observerName', 'expectedCompletionDate', 'status', 'overdays', 'timestamp', 'reviewedBy', 'remarks', 'attachments', 'createdAt', 'updatedAt', 'workflowStage', 'submittedBy', 'submittedByEmail', 'submittedAt', 'specialistReviewedBy', 'specialistReviewedAt', 'specialistComments', 'managerApprovedBy', 'managerApprovedAt', 'managerComments', 'departmentActionBy', 'departmentActionAt', 'rejectionReason', 'dueReminderSentAt', 'assignedToName', 'assignedToEmail', 'comments', 'updates', 'timeLog'],
        'DailySafetyCheckList': ['id', 'reportNumber', 'siteId', 'siteName', 'date', 'inspectorName', 'shift', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q15Reading', 'q16', 'q17', 'notes', 'createdAt', 'updatedAt'],
        'ISODocuments': ['id', 'isoCode', 'name', 'type', 'version', 'department', 'createdAt', 'updatedAt'],
        'ISOProcedures': ['id', 'isoCode', 'name', 'department', 'version', 'createdAt', 'updatedAt'],
        'ISOForms': ['id', 'isoCode', 'name', 'type', 'createdAt', 'updatedAt'],
        'DocumentCodes': ['id', 'code', 'documentName', 'documentType', 'department', 'status', 'description', 'createdAt', 'updatedAt', 'createdBy'],
        'DocumentVersions': ['id', 'documentCodeId', 'documentCode', 'versionNumber', 'issueDate', 'revisionDate', 'status', 'notes', 'isActive', 'createdAt', 'updatedAt', 'createdBy'],
        'SOPJHA': ['id', 'isoCode', 'type', 'title', 'department', 'issueDate', 'status', 'version', 'procedures', 'hazards', 'requiredPPE', 'createdAt', 'updatedAt'],
        'RiskAssessments': ['id', 'isoCode', 'activity', 'location', 'date', 'status', 'riskLevel', 'correctiveActions', 'createdAt', 'updatedAt'],
        'LegalDocuments': ['id', 'isoCode', 'documentName', 'documentType', 'documentNumber', 'issuedBy', 'issueDate', 'expiryDate', 'alertDays', 'status', 'description', 'documentLink', 'documentImage', 'createdAt', 'updatedAt'],
        'HSEAudits': ['id', 'type', 'date', 'auditor', 'status', 'description', 'createdAt', 'updatedAt'],
        'HSENonConformities': ['id', 'date', 'description', 'status', 'createdAt', 'updatedAt'],
        'HSECorrectiveActions': ['id', 'description', 'responsible', 'dueDate', 'status', 'createdAt', 'updatedAt'],
        'HSEObjectives': ['id', 'name', 'description', 'dueDate', 'responsible', 'status', 'createdAt', 'updatedAt'],
        'HSERiskAssessments': ['id', 'activity', 'location', 'date', 'riskLevel', 'status', 'createdAt', 'updatedAt'],
        'EnvironmentalAspects': ['id', 'name', 'description', 'impact', 'createdAt', 'updatedAt'],
        'EnvironmentalMonitoring': ['id', 'aspect', 'date', 'value', 'unit', 'status', 'createdAt', 'updatedAt'],
        'Sustainability': ['id', 'name', 'description', 'startDate', 'status', 'createdAt', 'updatedAt'],
        'CarbonFootprint': ['id', 'date', 'source', 'co2Equivalent', 'description', 'createdAt', 'updatedAt'],
        'WasteManagement': ['id', 'date', 'wasteType', 'quantity', 'disposalMethod', 'createdAt', 'updatedAt'],
        'WasteManagement_RegularWasteTypes': ['id', 'name', 'createdAt', 'updatedAt'],
        'WasteManagement_RegularWasteRecords': ['id', 'serialNumber', 'date', 'location', 'wasteType', 'quantity', 'unit', 'department', 'storageMethod', 'notes', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'WasteManagement_RegularWasteSales': ['id', 'transactionNumber', 'date', 'location', 'wasteType', 'quantity', 'unit', 'unitPrice', 'totalValue', 'buyerName', 'paymentMethod', 'notes', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'WasteManagement_HazardousWasteRecords': ['id', 'serialNumber', 'date', 'location', 'wasteType', 'quantity', 'unit', 'hazardClassification', 'storageMethod', 'transportCompany', 'treatmentFacility', 'transportDate', 'documents', 'notes', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'WaterManagement_Records': ['id', 'serialNumber', 'date', 'monthYear', 'location', 'source', 'startReading', 'endReading', 'totalConsumption', 'unit', 'department', 'notes', 'hasAlert', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'GasManagement_Records': ['id', 'serialNumber', 'date', 'monthYear', 'location', 'source', 'startReading', 'endReading', 'totalConsumption', 'unit', 'department', 'notes', 'hasAlert', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'ElectricityManagement_Records': ['id', 'serialNumber', 'date', 'monthYear', 'location', 'source', 'startReading', 'endReading', 'totalConsumption', 'unit', 'department', 'notes', 'hasAlert', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'EnergyEfficiency': ['id', 'date', 'department', 'energyConsumption', 'efficiencyPercentage', 'notes', 'createdAt', 'updatedAt'],
        'WaterManagement': ['id', 'date', 'usageType', 'quantity', 'waterSource', 'createdAt', 'updatedAt'],
        'RecyclingPrograms': ['id', 'programName', 'materialType', 'recyclingRate', 'status', 'description', 'createdAt', 'updatedAt'],
        'PeriodicInspections': ['id', 'inspectionType', 'location', 'date', 'inspector', 'status', 'findings', 'recommendations', 'createdAt', 'updatedAt'],
        'SafetyBudget': ['id', 'category', 'description', 'amount', 'date', 'status', 'approvedBy', 'createdAt', 'updatedAt'],
        'SafetyPerformanceKPIs': ['id', 'recordType', 'year', 'month', 'kpiName', 'target', 'actual', 'date', 'status', 'notes', 'hoursWorked', 'neboshStatus', 'createdAt', 'updatedAt', 'updatedBy'],
        'KPIAnnualPlans': ['id', 'year', 'indicatorType', 'objective', 'kpi', 'target', 'goal', 'improvementPlan', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'total', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'HSEMonitoringPlans': ['id', 'year', 'frequency', 'activity', 'activityDescription', 'area', 'responsibility', 'recordDocument', 'target_jan', 'target_feb', 'target_mar', 'target_apr', 'target_may', 'target_jun', 'target_jul', 'target_aug', 'target_sep', 'target_oct', 'target_nov', 'target_dec', 'executed_jan', 'executed_feb', 'executed_mar', 'executed_apr', 'executed_may', 'executed_jun', 'executed_jul', 'executed_aug', 'executed_sep', 'executed_oct', 'executed_nov', 'executed_dec', 'total_target', 'total_executed', 'score', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'ActionTrackingRegister': ['id', 'serialNumber', 'issueDate', 'typeOfIssue', 'observationClassification', 'observationIssueHazard', 'correctivePreventiveAction', 'rootCause', 'department', 'location', 'riskRating', 'responsible', 'originalTargetDate', 'status', 'observerName', 'shift', 'sourceModule', 'sourceId', 'sourceData', 'timeLog', 'updates', 'comments', 'closedAt', 'closedBy', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'ActionTrackingSettings': ['id', 'typeOfIssueList', 'classificationList', 'rootCauseList', 'typeClassificationMapping', 'classificationRootCauseMapping', 'statusList', 'riskRatingList', 'departmentList', 'locationList', 'responsibleList', 'shiftList', 'permissions', 'updatedAt'],
        'Budget': ['id', 'category', 'description', 'amount', 'date', 'status', 'createdAt', 'updatedAt'],
        'KPIs': ['id', 'name', 'target', 'actual', 'date', 'status', 'createdAt', 'updatedAt'],
        'EmergencyAlerts': ['id', 'title', 'message', 'type', 'priority', 'status', 'targetAudience', 'channels', 'scheduledDate', 'sentDate', 'createdBy', 'createdAt', 'updatedAt'],
        'EmergencyPlans': ['id', 'name', 'type', 'description', 'procedures', 'responsibleTeam', 'equipment', 'contacts', 'status', 'lastReview', 'nextReview', 'createdAt', 'updatedAt'],
        // ✅ تحديثات خطط الطوارئ (Emergency Plans Updates) - صور وإرشادات الطوارئ القابلة للتعديل
        'EmergencyPlansUpdates': ['id', 'sectionKey', 'sectionNameAr', 'sectionNameEn', 'titleAr', 'titleEn', 'subtitleAr', 'subtitleEn', 'imageUrl', 'contentHtmlAr', 'contentHtmlEn', 'order', 'isActive', 'siteId', 'lastUpdatedBy', 'lastUpdatedAt', 'createdAt', 'updatedAt'],
        'EmployeeTrainingMatrix': ['id', 'employeeId', 'employeeCode', 'employeeName', 'position', 'department', 'topics', 'trainingRecords', 'lastUpdated', 'createdAt', 'updatedAt'],
        'ContractorTrainings': ['id', 'contractorId', 'contractorName', 'trainingName', 'trainer', 'date', 'participants', 'topics', 'topic', 'traineesCount', 'startTime', 'endTime', 'durationMinutes', 'totalHours', 'location', 'locationId', 'subLocation', 'subLocationId', 'notes', 'status', 'createdAt', 'updatedAt'],
        'ExternalWorkforceMonthly': ['id', 'year', 'contractorId', 'contractorCode', 'contractorName', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'total', 'createdAt', 'updatedAt', 'updatedBy'],
        'PeriodicInspectionCategories': ['id', 'name', 'description', 'frequency', 'isDefault', 'createdAt', 'updatedAt'],
        'PeriodicInspectionChecklists': ['id', 'categoryId', 'categoryName', 'items', 'createdAt', 'updatedAt'],
        'PeriodicInspectionSchedules': ['id', 'categoryId', 'categoryName', 'location', 'scheduledDate', 'status', 'assignedTo', 'frequency', 'createdAt', 'updatedAt'],
        'PeriodicInspectionRecords': ['id', 'scheduleId', 'categoryId', 'categoryName', 'location', 'inspectionDate', 'inspector', 'result', 'findings', 'recommendations', 'status', 'createdAt', 'updatedAt'],
        'FireEquipmentAssets': ['id', 'factory', 'factoryId', 'location', 'subLocation', 'subLocationId', 'type', 'capacity', 'capacityKg', 'siteNumber', 'number', 'manufacturer', 'manufacturingYear', 'productionDate', 'serialNumber', 'status', 'installationMethod', 'model', 'installationDate', 'lastServiceDate', 'responsible', 'notes', 'qrCodeData', 'assetNumber', 'equipmentType', 'lastInspection', 'nextInspection', 'createdAt', 'updatedAt'],
        'FireEquipmentInspections': ['id', 'assetId', 'assetNumber', 'inspectionDate', 'inspector', 'result', 'findings', 'actions', 'status', 'createdAt', 'updatedAt'],
        'ViolationTypes': ['id', 'name', 'description', 'fineAmount', 'severity', 'category', 'defaultAction', 'isActive', 'createdAt', 'updatedAt'],
        'SafetyBudgets': ['id', 'year', 'budgetAmount', 'allocatedAmount', 'spentAmount', 'remainingAmount', 'status', 'createdAt', 'updatedAt'],
        'SafetyBudgetTransactions': ['id', 'budgetId', 'category', 'description', 'amount', 'type', 'date', 'approvedBy', 'status', 'createdAt', 'updatedAt'],
        'SafetyBudgetPurchaseOrders': ['id', 'prNo', 'prDate', 'itemCodeNo', 'itemsDescription', 'detailsRemarks', 'quantity', 'prStatus', 'poNo', 'poStatus', 'note', 'createdAt', 'updatedAt', 'updatedBy'],
        'PPEMatrix': ['id', 'employeeId', 'employeeCode', 'employeeName', 'position', 'department', 'ppeItems', 'lastUpdated', 'createdAt', 'updatedAt'],
        'PPE_Stock': ['itemId', 'itemCode', 'itemName', 'category', 'stock_IN', 'stock_OUT', 'balance', 'minThreshold', 'supplier', 'lastUpdate', 'createdAt', 'updatedAt'],
        'PPE_Transactions': ['id', 'itemId', 'date', 'action', 'quantity', 'issuedTo', 'remarks', 'createdAt', 'updatedAt'],
        // ✅ Updated schema (matches current ApprovedContractors records used by Contractors module)
        // Note: keep contractorId for backward compatibility (often holds contractor code like CON-xxx)
        // isActive: حقل التفعيل التشغيلي — false = معطّل، true أو غير موجود = نشط
        'ApprovedContractors': ['id', 'code', 'isoCode', 'companyName', 'entityType', 'serviceType', 'licenseNumber', 'contractorId', 'approvalDate', 'expiryDate', 'status', 'notes', 'safetyReviewer', 'approvedBy', 'isActive', 'createdAt', 'updatedAt'],
        'ContractorEvaluations': ['id', 'contractorId', 'contractorName', 'evaluationDate', 'evaluatorName', 'projectName', 'location', 'generalNotes', 'items', 'compliantCount', 'totalItems', 'finalScore', 'finalRating', 'isoCode', 'status', 'approvedAt', 'approvedBy', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        // ✅ Canonical order used by frontend (My Requests/Admin review) + backend approve/reject flows
        'ContractorApprovalRequests': [
            'id', 'requestType', 'companyName', 'serviceType', 'licenseNumber',
            'createdByName', 'approvedByName',
            'contactPerson', 'phone', 'email',
            'notes', 'attachments', 'customFields',
            'status', 'approvedAt', 'approvedBy',
            'createdAt', 'createdBy', 'updatedAt',
            'contractorId', 'contractorName', 'evaluationData',
            // extra backend fields (kept for compatibility/history)
            'rejectedAt', 'rejectedBy', 'rejectedByName', 'rejectionReason',
            'contractorData'
        ],
        'ContractorDeletionRequests': ['id', 'requestType', 'entityId', 'reason', 'status', 'createdBy', 'createdAt', 'updatedAt', 'approvedAt', 'approvedBy', 'approvedByName', 'rejectedAt', 'rejectedBy', 'rejectedByName', 'rejectionReason'],
        // إدارة التغيرات (Change Management - مطابق للنماذج الورقية فني/إداري + نقل الفنيين)
        'ChangeRequests': ['id', 'requestNumber', 'title', 'description', 'changeType', 'priority', 'impact', 'status', 'requestedBy', 'requestedByEmail', 'requestedAt', 'factoryId', 'factoryName', 'subLocationId', 'subLocationName', 'dueDate', 'relatedModule', 'relatedProcess', 'riskAssessment', 'mitigationActions', 'fromDepartment', 'toDepartment', 'locationOther', 'technicalChangeSubType', 'changeContinuity', 'temporaryUntilDate', 'priorityUrgentReason', 'attachedDocumentsText', 'requestingDepartment', 'otherDepartments', 'affectedDepartments', 'documentsToAmendJson', 'committeeMembersJson', 'committeeRecommendations', 'employeeName', 'employeeCode', 'currentTasksDescription', 'newTasksDescription', 'administrativeChangeSubType', 'responsibleRequestingDepartment', 'responsibleImplementingDepartment', 'previousInjury', 'chronicDiseases', 'healthNotes', 'trainingRequirementsJson', 'reviewerName', 'reviewerNotes', 'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectionReason', 'implementedAt', 'implementedBy', 'closedAt', 'closedBy', 'approvalFlowJson', 'currentApprovalStep', 'approvalStatus', 'timeLog', 'attachments', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy'],
        'AuditLog': ['id', 'userId', 'userName', 'action', 'module', 'details', 'ipAddress', 'timestamp', 'createdAt', 'updatedAt'],
        'UserActivityLog': ['id', 'userId', 'username', 'userEmail', 'actionType', 'module', 'recordId', 'details', 'sessionId', 'sessionLoginTime', 'ipAddress', 'timestamp', 'createdAt', 'updatedAt'],
        'AIAssistantSettings': ['id', 'userId', 'settings', 'preferences', 'createdAt', 'updatedAt'],
        'UserAILog': ['id', 'userId', 'userName', 'query', 'response', 'timestamp', 'createdAt', 'updatedAt'],
        'ObservationSites': ['id', 'name', 'location', 'description', 'status', 'createdAt', 'updatedAt'],
        'AnnualTrainingPlans': ['id', 'year', 'plans', 'status', 'createdAt', 'updatedAt'],
        // Safety & Health Management Module
        'SafetyTeamMembers': ['id', 'name', 'jobTitle', 'department', 'contactInfo', 'email', 'phone', 'appointmentDate', 'positionLevel', 'photo', 'employeeCode', 'employeeNumber', 'status', 'createdAt', 'updatedAt'],
        'SafetyOrganizationalStructure': ['id', 'position', 'positionLevel', 'memberId', 'memberName', 'parentPositionId', 'order', 'description', 'createdAt', 'updatedAt'],
        'SafetyJobDescriptions': ['id', 'memberId', 'employeeId', 'jobTitle', 'roleDescription', 'responsibilities', 'tasks', 'workScope', 'requiredQualifications', 'createdAt', 'updatedAt'],
        'SafetyTeamKPIs': ['id', 'memberId', 'period', 'inspectionsCount', 'closedActionsCount', 'observationsCount', 'trainingsCount', 'incidentsHandledCount', 'nearMissCount', 'ptwCount', 'commitmentRate', 'targetInspections', 'targetActionsClosure', 'targetObservations', 'targetTrainings', 'targetCommitment', 'customKPIs', 'isManual', 'calculatedAt', 'createdAt', 'updatedAt'],
        'SafetyTeamTasks': ['id', 'memberId', 'taskTitle', 'taskDescription', 'taskType', 'priority', 'dueDate', 'status', 'assignedBy', 'completedDate', 'notes', 'createdAt', 'updatedAt'],
        'SafetyTeamPerformanceReports': ['id', 'memberId', 'period', 'startDate', 'endDate', 'reportData', 'summary', 'generatedAt', 'createdAt'],
        'SafetyTeamAttendance': ['id', 'memberId', 'date', 'checkIn', 'checkOut', 'workDuration', 'status', 'notes', 'createdAt', 'updatedAt'],
        'SafetyTeamLeaves': ['id', 'memberId', 'leaveType', 'startDate', 'endDate', 'daysCount', 'reason', 'approvalStatus', 'approvedBy', 'notes', 'createdAt', 'updatedAt'],
        'SafetyHealthManagementSettings': ['id', 'leaveTypes', 'attendanceStatuses', 'kpiTargets', 'organizationalStructureSettings', 'createdAt', 'updatedAt'],
        // إعدادات النماذج وأنواع المخالفات
        'Form_Settings_DB': ['id', 'sites', 'departments', 'safetyTeam', 'updatedAt', 'updatedBy'],
        'Violation_Types_DB': ['id', 'violationTypes', 'updatedAt', 'updatedBy'],
        // جداول إعدادات النماذج الجديدة (بصيغة عادية - كل صف = سجل واحد)
        'Form_Sites': ['id', 'name', 'description', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'Form_Places': ['id', 'siteId', 'siteName', 'name', 'description', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'Form_Departments': ['id', 'name', 'description', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        'Form_SafetyTeam': ['id', 'name', 'position', 'phone', 'email', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
        // مهام المستخدمين والتعليمات
        'UserTasks': ['id', 'title', 'taskTitle', 'description', 'taskDescription', 'assignedTo', 'assignedDepartments', 'status', 'priority', 'dueDate', 'completionRate', 'userProgress', 'completedDate', 'createdBy', 'createdAt', 'updatedAt'],
        'UserInstructions': ['id', 'type', 'title', 'description', 'content', 'assignedTo', 'assignedDepartments', 'isRead', 'readAt', 'createdBy', 'createdAt', 'updatedAt'],
        // إدارة الموديولات
        'ModuleManagement': ['id', 'moduleId', 'enabled', 'version', 'lastUpdated', 'updatedBy', 'updatedByName', 'notes', 'createdAt'],
        // الإشعارات
        'Notifications': ['id', 'userId', 'type', 'priority', 'title', 'message', 'read', 'readAt', 'relatedId', 'relatedType', 'taskId', 'actionId', 'ptwId', 'scheduleId', 'trainingId', 'dueDate', 'scheduledDate', 'startDate', 'endDate', 'createdAt', 'updatedAt'],
        // نظام النسخ الاحتياطي
        'BackupLog': ['id', 'backupType', 'backupName', 'fileId', 'fileUrl', 'fileName', 'fileSize', 'fileSizeFormatted', 'sheetsCount', 'totalRecords', 'sheetsDetails', 'sourceSpreadsheetId', 'sourceSpreadsheetName', 'status', 'duration', 'errorMessage', 'restoredFromBackupId', 'restoredSheets', 'errors', 'createdBy', 'createdById', 'createdAt', 'updatedAt'],
        'BackupSettings': ['id', 'autoBackupEnabled', 'backupTimes', 'maxBackupFiles', 'backupFolderName', 'retentionDays', 'notifyOnBackup', 'notifyOnFailure', 'updatedAt', 'updatedBy', 'updatedById'],
        // أرقام طوارئ المؤسسة (يُديرها المدير) — تظهر في الملف الشخصي والبطاقة العامة
        'AppEmergencyNumbers': ['id', 'label', 'phone', 'sortOrder', 'isActive', 'createdAt', 'updatedAt'],
        // ✅ قائمة الأشخاص المصرح لهم بالتوقيع على تصاريح العمل (Issuing Authorities)
        // G = مصرح بالتوقيع في كل الحالات
        // Y = مصرح بالتوقيع بعد التنسيق مع مدير السلامة (يُضاف شرط HSE)
        // X = غير مصرح له بالتوقيع
        'PTWIssuingAuthorities': [
            'id', 'personType', 'employeeCode', 'contractorCompanyName', 'name', 'departmentId', 'departmentName', 'jobTitle', 'factory', 'location', 'sublocation', 'email', 'phone', 'isActive',
            'contractorFlag',
            'coldWork', 'loto', 'hotWork', 'workAtHeight', 'confinedSpace',
            'excavation', 'contractorPTW', 'liftingPlan',
            'sortOrder', 'notes',
            'createdAt', 'updatedAt', 'createdBy', 'updatedBy'
        ],
        // ✅ قائمة المصرح لهم بالتوقيع - مقاولين (قاعدة بيانات منفصلة)
        'PTWContractorIssuingAuthorities': [
            'id', 'personType', 'employeeCode', 'contractorCompanyName', 'name', 'departmentId', 'departmentName', 'jobTitle', 'factory', 'location', 'sublocation', 'email', 'phone', 'isActive',
            'contractorFlag',
            'coldWork', 'loto', 'hotWork', 'workAtHeight', 'confinedSpace',
            'excavation', 'contractorPTW', 'liftingPlan',
            'sortOrder', 'notes',
            'createdAt', 'updatedAt', 'createdBy', 'updatedBy'
        ]
    };
    
    return headersMap[sheetName] || [];
}
