-- HSE sheet tables (generated from Headers.gs / Config.gs)
CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

CREATE TABLE IF NOT EXISTS public."AIAssistantSettings" (
  "id" text PRIMARY KEY,
  "userId" text,
  "settings" jsonb,
  "preferences" jsonb,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ActionTrackingRegister" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "issueDate" text,
  "typeOfIssue" text,
  "observationClassification" text,
  "observationIssueHazard" text,
  "correctivePreventiveAction" text,
  "rootCause" text,
  "department" text,
  "location" text,
  "riskRating" text,
  "responsible" text,
  "originalTargetDate" text,
  "status" text,
  "observerName" text,
  "shift" text,
  "sourceModule" text,
  "sourceId" text,
  "sourceData" text,
  "timeLog" text,
  "updates" text,
  "comments" text,
  "closedAt" text,
  "closedBy" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."ActionTrackingSettings" (
  "id" text PRIMARY KEY,
  "typeOfIssueList" text,
  "classificationList" text,
  "rootCauseList" text,
  "typeClassificationMapping" text,
  "classificationRootCauseMapping" text,
  "statusList" text,
  "riskRatingList" text,
  "departmentList" text,
  "locationList" text,
  "responsibleList" text,
  "shiftList" text,
  "permissions" jsonb,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."AnnualTrainingPlans" (
  "id" text PRIMARY KEY,
  "year" text,
  "plans" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."AppEmergencyNumbers" (
  "id" text PRIMARY KEY,
  "label" text,
  "phone" text,
  "sortOrder" text,
  "isActive" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ApprovedContractors" (
  "id" text PRIMARY KEY,
  "code" text,
  "isoCode" text,
  "companyName" text,
  "entityType" text,
  "serviceType" text,
  "licenseNumber" text,
  "contractorId" text,
  "approvalDate" text,
  "expiryDate" text,
  "status" text,
  "notes" text,
  "safetyReviewer" text,
  "approvedBy" text,
  "isActive" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."AuditLog" (
  "id" text PRIMARY KEY,
  "userId" text,
  "userName" text,
  "action" text,
  "module" text,
  "details" text,
  "ipAddress" text,
  "timestamp" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."BackupLog" (
  "id" text PRIMARY KEY,
  "backupType" text,
  "backupName" text,
  "fileId" text,
  "fileUrl" text,
  "fileName" text,
  "fileSize" text,
  "fileSizeFormatted" text,
  "sheetsCount" text,
  "totalRecords" text,
  "sheetsDetails" text,
  "sourceSpreadsheetId" text,
  "sourceSpreadsheetName" text,
  "status" text,
  "duration" text,
  "errorMessage" text,
  "restoredFromBackupId" text,
  "restoredSheets" text,
  "errors" text,
  "createdBy" text,
  "createdById" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."BackupSettings" (
  "id" text PRIMARY KEY,
  "autoBackupEnabled" text,
  "backupTimes" text,
  "maxBackupFiles" text,
  "backupFolderName" text,
  "retentionDays" text,
  "notifyOnBackup" text,
  "notifyOnFailure" text,
  "updatedAt" text,
  "updatedBy" text,
  "updatedById" text
);

CREATE TABLE IF NOT EXISTS public."BehaviorMonitoring" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "employeeId" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeeName" text,
  "department" text,
  "job" text,
  "factory" text,
  "factoryId" text,
  "factoryName" text,
  "subLocation" text,
  "subLocationId" text,
  "subLocationName" text,
  "behaviorType" text,
  "date" text,
  "rating" text,
  "correctiveAction" text,
  "correctiveActionDetails" text,
  "description" text,
  "photo" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Blacklist_Register" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "factory" text,
  "factoryId" text,
  "location" text,
  "locationId" text,
  "fullName" text,
  "idNumber" text,
  "photo" text,
  "job" text,
  "department" text,
  "banReason" text,
  "banDate" text,
  "bannedBy" text,
  "editor" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Budget" (
  "id" text PRIMARY KEY,
  "category" text,
  "description" text,
  "amount" text,
  "date" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."CarbonFootprint" (
  "id" text PRIMARY KEY,
  "date" text,
  "source" text,
  "co2Equivalent" text,
  "description" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ChemicalSafety" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "chemicalName" text,
  "trainer" text,
  "date" text,
  "status" text,
  "description" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Chemical_Register" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "rmName" text,
  "physicalShape" text,
  "purposeOfUse" text,
  "methodOfApplication" text,
  "department" text,
  "msdsArabic" text,
  "msdsEnglish" text,
  "localImport" text,
  "manufacturer" text,
  "agentEgypt" text,
  "containerType" text,
  "containerDisposalMethod" text,
  "hazardClass" text,
  "hazardDescription" text,
  "locationStore" text,
  "qtyYear" text,
  "nfpaDiamond" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ClinicContractorInjuries" (
  "id" text PRIMARY KEY,
  "personType" text,
  "contractorName" text,
  "personName" text,
  "contractorPosition" text,
  "department" text,
  "factory" text,
  "factoryName" text,
  "subLocation" text,
  "subLocationName" text,
  "injuryDate" text,
  "injuryType" text,
  "injuryBodyPart" text,
  "injuryLocation" text,
  "injuryDescription" text,
  "actionsTaken" text,
  "treatment" text,
  "status" text,
  "attachments" jsonb,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."ClinicInventory" (
  "id" text PRIMARY KEY,
  "medicationName" text,
  "quantity" text,
  "expiryDate" text,
  "location" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."ClinicVisits" (
  "id" text PRIMARY KEY,
  "personType" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeeName" text,
  "employeePosition" text,
  "employeeDepartment" text,
  "factory" text,
  "factoryName" text,
  "employeeLocation" text,
  "visitDate" text,
  "exitDate" text,
  "visitType" text,
  "reason" text,
  "diagnosis" text,
  "treatment" text,
  "medicationsDispensed" text,
  "medicationsDispensedQty" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."ContractorApprovalRequests" (
  "id" text PRIMARY KEY,
  "requestType" text,
  "companyName" text,
  "serviceType" text,
  "licenseNumber" text,
  "createdByName" text,
  "approvedByName" text,
  "contactPerson" text,
  "phone" text,
  "email" text,
  "notes" text,
  "attachments" jsonb,
  "customFields" text,
  "status" text,
  "approvedAt" text,
  "approvedBy" text,
  "createdAt" text,
  "createdBy" text,
  "updatedAt" text,
  "contractorId" text,
  "contractorName" text,
  "evaluationData" text,
  "rejectedAt" text,
  "rejectedBy" text,
  "rejectedByName" text,
  "rejectionReason" text,
  "contractorData" text
);

CREATE TABLE IF NOT EXISTS public."ContractorDeletionRequests" (
  "id" text PRIMARY KEY,
  "requestType" text,
  "entityId" text,
  "reason" text,
  "status" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text,
  "approvedAt" text,
  "approvedBy" text,
  "approvedByName" text,
  "rejectedAt" text,
  "rejectedBy" text,
  "rejectedByName" text,
  "rejectionReason" text
);

CREATE TABLE IF NOT EXISTS public."ContractorEvaluations" (
  "id" text PRIMARY KEY,
  "contractorId" text,
  "contractorName" text,
  "evaluationDate" text,
  "evaluatorName" text,
  "projectName" text,
  "location" text,
  "generalNotes" text,
  "items" jsonb,
  "compliantCount" text,
  "totalItems" text,
  "finalScore" text,
  "finalRating" text,
  "isoCode" text,
  "status" text,
  "approvedAt" text,
  "approvedBy" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."ContractorTrainings" (
  "id" text PRIMARY KEY,
  "contractorId" text,
  "contractorName" text,
  "trainingName" text,
  "trainer" text,
  "date" text,
  "participants" text,
  "topics" text,
  "topic" text,
  "traineesCount" text,
  "startTime" text,
  "endTime" text,
  "durationMinutes" text,
  "totalHours" text,
  "location" text,
  "locationId" text,
  "subLocation" text,
  "subLocationId" text,
  "notes" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Contractors" (
  "id" text PRIMARY KEY,
  "name" text,
  "serviceType" text,
  "contractNumber" text,
  "startDate" text,
  "endDate" text,
  "status" text,
  "contactPerson" text,
  "phone" text,
  "email" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."DailyObservations" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "siteId" text,
  "siteName" text,
  "placeId" text,
  "locationName" text,
  "observationType" text,
  "date" text,
  "shift" text,
  "details" text,
  "correctiveAction" text,
  "responsibleDepartment" text,
  "riskLevel" text,
  "observerName" text,
  "expectedCompletionDate" text,
  "status" text,
  "overdays" text,
  "timestamp" text,
  "reviewedBy" text,
  "remarks" text,
  "attachments" jsonb,
  "createdAt" text,
  "updatedAt" text,
  "workflowStage" text,
  "submittedBy" text,
  "submittedByEmail" text,
  "submittedAt" text,
  "specialistReviewedBy" text,
  "specialistReviewedAt" text,
  "specialistComments" text,
  "managerApprovedBy" text,
  "managerApprovedAt" text,
  "managerComments" text,
  "departmentActionBy" text,
  "departmentActionAt" text,
  "rejectionReason" text,
  "dueReminderSentAt" text,
  "assignedToName" text,
  "assignedToEmail" text,
  "comments" text,
  "updates" text,
  "timeLog" text
);

CREATE TABLE IF NOT EXISTS public."DailySafetyCheckList" (
  "id" text PRIMARY KEY,
  "reportNumber" text,
  "siteId" text,
  "siteName" text,
  "date" text,
  "inspectorName" text,
  "shift" text,
  "q1" text,
  "q2" text,
  "q3" text,
  "q4" text,
  "q5" text,
  "q6" text,
  "q7" text,
  "q8" text,
  "q9" text,
  "q10" text,
  "q11" text,
  "q12" text,
  "q13" text,
  "q14" text,
  "q15" text,
  "q15Reading" text,
  "q16" text,
  "q17" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."DocumentCodes" (
  "id" text PRIMARY KEY,
  "code" text,
  "documentName" text,
  "documentType" text,
  "department" text,
  "status" text,
  "description" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text
);

CREATE TABLE IF NOT EXISTS public."DocumentVersions" (
  "id" text PRIMARY KEY,
  "documentCodeId" text,
  "documentCode" text,
  "versionNumber" text,
  "issueDate" text,
  "revisionDate" text,
  "status" text,
  "notes" text,
  "isActive" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text
);

CREATE TABLE IF NOT EXISTS public."ElectricityManagement_Records" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "date" text,
  "monthYear" text,
  "location" text,
  "source" text,
  "startReading" text,
  "endReading" text,
  "totalConsumption" text,
  "unit" text,
  "department" text,
  "notes" text,
  "hasAlert" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."EmergencyAlerts" (
  "id" text PRIMARY KEY,
  "title" text,
  "message" text,
  "type" text,
  "priority" text,
  "status" text,
  "targetAudience" text,
  "channels" text,
  "scheduledDate" text,
  "sentDate" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."EmergencyPlans" (
  "id" text PRIMARY KEY,
  "name" text,
  "type" text,
  "description" text,
  "procedures" text,
  "responsibleTeam" text,
  "equipment" text,
  "contacts" text,
  "status" text,
  "lastReview" text,
  "nextReview" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."EmergencyPlansUpdates" (
  "id" text PRIMARY KEY,
  "sectionKey" text,
  "sectionNameAr" text,
  "sectionNameEn" text,
  "titleAr" text,
  "titleEn" text,
  "subtitleAr" text,
  "subtitleEn" text,
  "imageUrl" text,
  "contentHtmlAr" text,
  "contentHtmlEn" text,
  "order" text,
  "isActive" text,
  "siteId" text,
  "lastUpdatedBy" text,
  "lastUpdatedAt" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."EmployeeTrainingMatrix" (
  "id" text PRIMARY KEY,
  "employeeId" text,
  "employeeCode" text,
  "employeeName" text,
  "position" text,
  "department" text,
  "topics" text,
  "trainingRecords" text,
  "lastUpdated" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Employees" (
  "employeeNumber" text,
  "name" text,
  "department" text,
  "job" text,
  "nationalId" text,
  "birthDate" text,
  "age" text,
  "hireDate" text,
  "gender" text,
  "phone" text,
  "insuranceNumber" text,
  "sapId" text,
  "branch" text,
  "location" text,
  "position" text,
  "email" text,
  "photo" text,
  "status" text,
  "resignationDate" text,
  "createdAt" text,
  "updatedAt" text,
  "id" text
);

CREATE TABLE IF NOT EXISTS public."EnergyEfficiency" (
  "id" text PRIMARY KEY,
  "date" text,
  "department" text,
  "energyConsumption" text,
  "efficiencyPercentage" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."EnvironmentalAspects" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "impact" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."EnvironmentalMonitoring" (
  "id" text PRIMARY KEY,
  "aspect" text,
  "date" text,
  "value" text,
  "unit" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ExternalWorkforceMonthly" (
  "id" text PRIMARY KEY,
  "year" text,
  "contractorId" text,
  "contractorCode" text,
  "contractorName" text,
  "jan" text,
  "feb" text,
  "mar" text,
  "apr" text,
  "may" text,
  "jun" text,
  "jul" text,
  "aug" text,
  "sep" text,
  "oct" text,
  "nov" text,
  "dec" text,
  "total" text,
  "createdAt" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."FireEquipment" (
  "id" text PRIMARY KEY,
  "equipmentNumber" text,
  "equipmentType" text,
  "location" text,
  "checkDate" text,
  "status" text,
  "inspector" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."FireEquipmentAssets" (
  "id" text PRIMARY KEY,
  "factory" text,
  "factoryId" text,
  "location" text,
  "subLocation" text,
  "subLocationId" text,
  "type" text,
  "capacity" text,
  "capacityKg" text,
  "siteNumber" text,
  "number" text,
  "manufacturer" text,
  "manufacturingYear" text,
  "productionDate" text,
  "serialNumber" text,
  "status" text,
  "installationMethod" text,
  "model" text,
  "installationDate" text,
  "lastServiceDate" text,
  "responsible" text,
  "notes" text,
  "qrCodeData" text,
  "assetNumber" text,
  "equipmentType" text,
  "lastInspection" text,
  "nextInspection" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."FireEquipmentInspections" (
  "id" text PRIMARY KEY,
  "assetId" text,
  "assetNumber" text,
  "inspectionDate" text,
  "inspector" text,
  "result" text,
  "findings" text,
  "actions" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Form_Departments" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "isActive" text,
  "sortOrder" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."Form_Places" (
  "id" text PRIMARY KEY,
  "siteId" text,
  "siteName" text,
  "name" text,
  "description" text,
  "isActive" text,
  "sortOrder" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."Form_SafetyTeam" (
  "id" text PRIMARY KEY,
  "name" text,
  "position" text,
  "phone" text,
  "email" text,
  "isActive" text,
  "sortOrder" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."Form_Settings_DB" (
  "id" text PRIMARY KEY,
  "sites" text,
  "departments" text,
  "safetyTeam" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."Form_Sites" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "isActive" text,
  "sortOrder" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."GasManagement_Records" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "date" text,
  "monthYear" text,
  "location" text,
  "source" text,
  "startReading" text,
  "endReading" text,
  "totalConsumption" text,
  "unit" text,
  "department" text,
  "notes" text,
  "hasAlert" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."HSEAudits" (
  "id" text PRIMARY KEY,
  "type" text,
  "date" text,
  "auditor" text,
  "status" text,
  "description" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."HSECorrectiveActions" (
  "id" text PRIMARY KEY,
  "description" text,
  "responsible" text,
  "dueDate" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."HSENonConformities" (
  "id" text PRIMARY KEY,
  "date" text,
  "description" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."HSEObjectives" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "dueDate" text,
  "responsible" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."HSERiskAssessments" (
  "id" text PRIMARY KEY,
  "activity" text,
  "location" text,
  "date" text,
  "riskLevel" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ISODocuments" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "name" text,
  "type" text,
  "version" text,
  "department" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ISOForms" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "name" text,
  "type" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ISOProcedures" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "name" text,
  "department" text,
  "version" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."IncidentNotifications" (
  "id" text PRIMARY KEY,
  "notificationNumber" text,
  "date" text,
  "location" text,
  "siteId" text,
  "siteName" text,
  "sublocation" text,
  "sublocationId" text,
  "sublocationName" text,
  "department" text,
  "incidentType" text,
  "affiliation" text,
  "contractorName" text,
  "employeeCode" text,
  "employeeName" text,
  "employeeJob" text,
  "employeeDepartment" text,
  "description" text,
  "injuryDescription" text,
  "losses" text,
  "actions" text,
  "reporterName" text,
  "reporterCode" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Incidents" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "title" text,
  "description" text,
  "location" text,
  "siteId" text,
  "siteName" text,
  "sublocation" text,
  "sublocationId" text,
  "sublocationName" text,
  "date" text,
  "severity" text,
  "incidentType" text,
  "affiliation" text,
  "department" text,
  "reportedBy" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeeName" text,
  "employeeJob" text,
  "employeeDepartment" text,
  "status" text,
  "rootCause" text,
  "correctiveAction" text,
  "preventiveAction" text,
  "actionPlan" text,
  "affectedType" text,
  "affectedCode" text,
  "affectedName" text,
  "affectedJobTitle" text,
  "affectedDepartment" text,
  "affectedContact" text,
  "injuryDescription" text,
  "losses" text,
  "actionsTaken" text,
  "contractorName" text,
  "image" text,
  "attachments" jsonb,
  "investigation" text,
  "closureDate" text,
  "actionOwner" text,
  "requiresApproval" text,
  "approvedBy" text,
  "approvedAt" text,
  "rejectedBy" text,
  "rejectedAt" text,
  "rejectionReason" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Injuries" (
  "id" text PRIMARY KEY,
  "personType" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeeName" text,
  "employeePosition" text,
  "employeeDepartment" text,
  "department" text,
  "factory" text,
  "factoryName" text,
  "subLocation" text,
  "subLocationName" text,
  "injuryDate" text,
  "injuryType" text,
  "injuryBodyPart" text,
  "injuryLocation" text,
  "injuryDescription" text,
  "actionsTaken" text,
  "treatment" text,
  "status" text,
  "attachments" jsonb,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."KPIs" (
  "id" text PRIMARY KEY,
  "name" text,
  "target" text,
  "actual" text,
  "date" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."LegalDocuments" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "documentName" text,
  "documentType" text,
  "documentNumber" text,
  "issuedBy" text,
  "issueDate" text,
  "expiryDate" text,
  "alertDays" text,
  "status" text,
  "description" text,
  "documentLink" text,
  "documentImage" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Medications" (
  "id" text PRIMARY KEY,
  "name" text,
  "type" text,
  "usage" text,
  "purchaseDate" text,
  "expiryDate" text,
  "status" text,
  "daysRemaining" text,
  "quantityAdded" text,
  "remainingQuantity" text,
  "location" text,
  "notes" text,
  "createdBy" text,
  "createdById" text,
  "createdAt" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."ModuleManagement" (
  "id" text PRIMARY KEY,
  "moduleId" text,
  "enabled" text,
  "version" text,
  "lastUpdated" text,
  "updatedBy" text,
  "updatedByName" text,
  "notes" text,
  "createdAt" text
);

CREATE TABLE IF NOT EXISTS public."NearMiss" (
  "id" text PRIMARY KEY,
  "type" text,
  "date" text,
  "observerName" text,
  "phone" text,
  "location" text,
  "department" text,
  "description" text,
  "correctiveProposed" text,
  "correctiveDescription" text,
  "attachments" jsonb,
  "status" text,
  "reportedBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Notifications" (
  "id" text PRIMARY KEY,
  "userId" text,
  "type" text,
  "priority" text,
  "title" text,
  "message" text,
  "read" text,
  "readAt" text,
  "relatedId" text,
  "relatedType" text,
  "taskId" text,
  "actionId" text,
  "ptwId" text,
  "scheduleId" text,
  "trainingId" text,
  "dueDate" text,
  "scheduledDate" text,
  "startDate" text,
  "endDate" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ObservationSites" (
  "id" text PRIMARY KEY,
  "name" text,
  "location" text,
  "description" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PPE" (
  "id" text PRIMARY KEY,
  "receiptNumber" text,
  "employeeName" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeeDepartment" text,
  "employeePosition" text,
  "employeeBranch" text,
  "employeeLocation" text,
  "equipmentType" text,
  "quantity" text,
  "receiptDate" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PPEMatrix" (
  "id" text PRIMARY KEY,
  "employeeId" text,
  "employeeCode" text,
  "employeeName" text,
  "position" text,
  "department" text,
  "ppeItems" text,
  "lastUpdated" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PPE_Stock" (
  "itemId" text,
  "itemCode" text,
  "itemName" text,
  "category" text,
  "stock_IN" text,
  "stock_OUT" text,
  "balance" text,
  "minThreshold" text,
  "supplier" text,
  "lastUpdate" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PPE_Transactions" (
  "id" text PRIMARY KEY,
  "itemId" text,
  "date" text,
  "action" text,
  "quantity" text,
  "issuedTo" text,
  "remarks" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PTW" (
  "id" text PRIMARY KEY,
  "workType" text,
  "workDescription" text,
  "location" text,
  "department" text,
  "startDate" text,
  "endDate" text,
  "responsible" text,
  "status" text,
  "approvals" text,
  "requiredPPE" text,
  "riskAssessment" text,
  "riskNotes" text,
  "approvalCircuitOwnerId" text,
  "approvalCircuitName" text,
  "skipApprovalFlow" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PTW_DEFAULT_COORDINATES" (
  "latitude" text,
  "longitude" text,
  "zoom" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."PTW_MAP_COORDINATES" (
  "id" text PRIMARY KEY,
  "name" text,
  "latitude" text,
  "longitude" text,
  "zoom" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."PeriodicInspectionCategories" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "frequency" text,
  "isDefault" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PeriodicInspectionChecklists" (
  "id" text PRIMARY KEY,
  "categoryId" text,
  "categoryName" text,
  "items" jsonb,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PeriodicInspectionRecords" (
  "id" text PRIMARY KEY,
  "scheduleId" text,
  "categoryId" text,
  "categoryName" text,
  "location" text,
  "inspectionDate" text,
  "inspector" text,
  "result" text,
  "findings" text,
  "recommendations" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PeriodicInspectionSchedules" (
  "id" text PRIMARY KEY,
  "categoryId" text,
  "categoryName" text,
  "location" text,
  "scheduledDate" text,
  "status" text,
  "assignedTo" text,
  "frequency" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PeriodicInspections" (
  "id" text PRIMARY KEY,
  "inspectionType" text,
  "location" text,
  "date" text,
  "inspector" text,
  "status" text,
  "findings" text,
  "recommendations" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."RecyclingPrograms" (
  "id" text PRIMARY KEY,
  "programName" text,
  "materialType" text,
  "recyclingRate" text,
  "status" text,
  "description" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."RiskAssessments" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "activity" text,
  "location" text,
  "date" text,
  "status" text,
  "riskLevel" text,
  "correctiveActions" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SOPJHA" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "type" text,
  "title" text,
  "department" text,
  "issueDate" text,
  "status" text,
  "version" text,
  "procedures" text,
  "hazards" text,
  "requiredPPE" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyBudget" (
  "id" text PRIMARY KEY,
  "category" text,
  "description" text,
  "amount" text,
  "date" text,
  "status" text,
  "approvedBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyBudgetPurchaseOrders" (
  "id" text PRIMARY KEY,
  "prNo" text,
  "prDate" text,
  "itemCodeNo" text,
  "itemsDescription" text,
  "detailsRemarks" text,
  "quantity" text,
  "prStatus" text,
  "poNo" text,
  "poStatus" text,
  "note" text,
  "createdAt" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."SafetyBudgetTransactions" (
  "id" text PRIMARY KEY,
  "budgetId" text,
  "category" text,
  "description" text,
  "amount" text,
  "type" text,
  "date" text,
  "approvedBy" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyBudgets" (
  "id" text PRIMARY KEY,
  "year" text,
  "budgetAmount" text,
  "allocatedAmount" text,
  "spentAmount" text,
  "remainingAmount" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyHealthManagementSettings" (
  "id" text PRIMARY KEY,
  "leaveTypes" text,
  "attendanceStatuses" text,
  "kpiTargets" text,
  "organizationalStructureSettings" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyJobDescriptions" (
  "id" text PRIMARY KEY,
  "memberId" text,
  "employeeId" text,
  "jobTitle" text,
  "roleDescription" text,
  "responsibilities" text,
  "tasks" text,
  "workScope" text,
  "requiredQualifications" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyOrganizationalStructure" (
  "id" text PRIMARY KEY,
  "position" text,
  "positionLevel" text,
  "memberId" text,
  "memberName" text,
  "parentPositionId" text,
  "order" text,
  "description" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyPerformanceKPIs" (
  "id" text PRIMARY KEY,
  "recordType" text,
  "year" text,
  "month" text,
  "kpiName" text,
  "target" text,
  "actual" text,
  "date" text,
  "status" text,
  "notes" text,
  "hoursWorked" text,
  "neboshStatus" text,
  "createdAt" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."SafetyTeamAttendance" (
  "id" text PRIMARY KEY,
  "memberId" text,
  "date" text,
  "checkIn" text,
  "checkOut" text,
  "workDuration" text,
  "status" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyTeamKPIs" (
  "id" text PRIMARY KEY,
  "memberId" text,
  "period" text,
  "inspectionsCount" text,
  "closedActionsCount" text,
  "observationsCount" text,
  "trainingsCount" text,
  "incidentsHandledCount" text,
  "nearMissCount" text,
  "ptwCount" text,
  "commitmentRate" text,
  "targetInspections" text,
  "targetActionsClosure" text,
  "targetObservations" text,
  "targetTrainings" text,
  "targetCommitment" text,
  "customKPIs" text,
  "isManual" text,
  "calculatedAt" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyTeamLeaves" (
  "id" text PRIMARY KEY,
  "memberId" text,
  "leaveType" text,
  "startDate" text,
  "endDate" text,
  "daysCount" text,
  "reason" text,
  "approvalStatus" text,
  "approvedBy" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyTeamMembers" (
  "id" text PRIMARY KEY,
  "name" text,
  "jobTitle" text,
  "department" text,
  "contactInfo" text,
  "email" text,
  "phone" text,
  "appointmentDate" text,
  "positionLevel" text,
  "photo" text,
  "employeeCode" text,
  "employeeNumber" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyTeamPerformanceReports" (
  "id" text PRIMARY KEY,
  "memberId" text,
  "period" text,
  "startDate" text,
  "endDate" text,
  "reportData" jsonb,
  "summary" text,
  "generatedAt" text,
  "createdAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyTeamTasks" (
  "id" text PRIMARY KEY,
  "memberId" text,
  "taskTitle" text,
  "taskDescription" text,
  "taskType" text,
  "priority" text,
  "dueDate" text,
  "status" text,
  "assignedBy" text,
  "completedDate" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SickLeave" (
  "id" text PRIMARY KEY,
  "personType" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeeName" text,
  "department" text,
  "contractorName" text,
  "externalName" text,
  "startDate" text,
  "endDate" text,
  "daysCount" text,
  "reason" text,
  "medicalNotes" text,
  "treatingDoctor" text,
  "status" text,
  "linkedRegistryId" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."Sustainability" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "startDate" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Training" (
  "id" text PRIMARY KEY,
  "name" text,
  "trainer" text,
  "trainingType" text,
  "date" text,
  "factory" text,
  "factoryName" text,
  "location" text,
  "locationName" text,
  "startTime" text,
  "endTime" text,
  "hours" text,
  "startDate" text,
  "participants" text,
  "participantsCount" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."UserAILog" (
  "id" text PRIMARY KEY,
  "userId" text,
  "userName" text,
  "query" text,
  "response" text,
  "timestamp" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."UserActivityLog" (
  "id" text PRIMARY KEY,
  "userId" text,
  "username" text,
  "userEmail" text,
  "actionType" text,
  "module" text,
  "recordId" text,
  "details" text,
  "sessionId" text,
  "sessionLoginTime" text,
  "ipAddress" text,
  "timestamp" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."UserInstructions" (
  "id" text PRIMARY KEY,
  "type" text,
  "title" text,
  "description" text,
  "content" text,
  "assignedTo" text,
  "assignedDepartments" text,
  "isRead" text,
  "readAt" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."UserTasks" (
  "id" text PRIMARY KEY,
  "title" text,
  "taskTitle" text,
  "description" text,
  "taskDescription" text,
  "assignedTo" text,
  "assignedDepartments" text,
  "status" text,
  "priority" text,
  "dueDate" text,
  "completionRate" text,
  "userProgress" text,
  "completedDate" text,
  "createdBy" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Users" (
  "id" text PRIMARY KEY,
  "name" text,
  "email" text,
  "password" text,
  "passwordHash" text,
  "role" text,
  "department" text,
  "active" text,
  "photo" text,
  "permissions" jsonb,
  "lastLogin" text,
  "lastLogout" text,
  "isOnline" text,
  "loginHistory" text,
  "postLoginPolicySeenAt" text,
  "profilePublicToken" text,
  "profilePublicTokenExpiry" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."ViolationTypes" (
  "id" text PRIMARY KEY,
  "name" text,
  "description" text,
  "fineAmount" text,
  "severity" text,
  "category" text,
  "defaultAction" text,
  "isActive" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."Violation_Types_DB" (
  "id" text PRIMARY KEY,
  "violationTypes" text,
  "updatedAt" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."Violations" (
  "id" text PRIMARY KEY,
  "isoCode" text,
  "personType" text,
  "employeeId" text,
  "employeeName" text,
  "employeeCode" text,
  "employeeNumber" text,
  "employeePosition" text,
  "employeeDepartment" text,
  "contractorId" text,
  "contractorName" text,
  "contractorWorker" text,
  "contractorPosition" text,
  "contractorDepartment" text,
  "violationTypeId" text,
  "violationType" text,
  "fineAmount" text,
  "violationDate" text,
  "violationTime" text,
  "violationLocation" text,
  "violationLocationId" text,
  "violationPlace" text,
  "violationPlaceId" text,
  "violationDetails" text,
  "severity" text,
  "actionTaken" text,
  "status" text,
  "photo" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."WasteManagement" (
  "id" text PRIMARY KEY,
  "date" text,
  "wasteType" text,
  "quantity" text,
  "disposalMethod" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."WasteManagement_HazardousWasteRecords" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "date" text,
  "location" text,
  "wasteType" text,
  "quantity" text,
  "unit" text,
  "hazardClassification" text,
  "storageMethod" text,
  "transportCompany" text,
  "treatmentFacility" text,
  "transportDate" text,
  "documents" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."WasteManagement_RegularWasteRecords" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "date" text,
  "location" text,
  "wasteType" text,
  "quantity" text,
  "unit" text,
  "department" text,
  "storageMethod" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."WasteManagement_RegularWasteSales" (
  "id" text PRIMARY KEY,
  "transactionNumber" text,
  "date" text,
  "location" text,
  "wasteType" text,
  "quantity" text,
  "unit" text,
  "unitPrice" text,
  "totalValue" text,
  "buyerName" text,
  "paymentMethod" text,
  "notes" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

CREATE TABLE IF NOT EXISTS public."WasteManagement_RegularWasteTypes" (
  "id" text PRIMARY KEY,
  "name" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."WaterManagement" (
  "id" text PRIMARY KEY,
  "date" text,
  "usageType" text,
  "quantity" text,
  "waterSource" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."WaterManagement_Records" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "date" text,
  "monthYear" text,
  "location" text,
  "source" text,
  "startReading" text,
  "endReading" text,
  "totalConsumption" text,
  "unit" text,
  "department" text,
  "notes" text,
  "hasAlert" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);

