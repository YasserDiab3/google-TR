-- Add missing tables for various modules to ensure full frontend compatibility

-- Incidents Module
CREATE TABLE IF NOT EXISTS public."IncidentsRegistry" (
  "id" text PRIMARY KEY,
  "sequentialNumber" text,
  "incidentId" text,
  "factory" text,
  "incidentLocation" text,
  "incidentDate" text,
  "incidentDay" text,
  "incidentTime" text,
  "shift" text,
  "employeeCode" text,
  "employeeName" text,
  "employeeJob" text,
  "employeeDepartment" text,
  "incidentDetails" text,
  "injuredPart" text,
  "equipmentCause" text,
  "leaveStartDate" text,
  "returnToWorkDate" text,
  "totalLeaveDays" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."SafetyAlerts" (
  "id" text PRIMARY KEY,
  "alertNumber" text,
  "sequentialNumber" text,
  "incidentId" text,
  "incidentType" text,
  "incidentDate" text,
  "incidentLocation" text,
  "who" text,
  "description" text,
  "facts" text,
  "causes" text,
  "lessonsLearned" text,
  "preventiveMeasures" text,
  "locationImage" text,
  "causesImage" text,
  "notificationNumber" text,
  "preparedBy" text,
  "approvedBy" text,
  "issueDate" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" jsonb
);

-- Legal Documents Module
CREATE TABLE IF NOT EXISTS public."LegalInventory" (
  "id" text PRIMARY KEY,
  "lawNumber" text,
  "issueDate" text,
  "issuingAuthority" text,
  "complianceStatement" text,
  "responsible" text,
  "applicationStatus" text,
  "createdAt" text,
  "updatedAt" text
);

-- PTW Module
CREATE TABLE IF NOT EXISTS public."PTWRegistry" (
  "id" text PRIMARY KEY,
  "serialNumber" text,
  "ptwId" text,
  "description" text,
  "location" text,
  "department" text,
  "startDate" text,
  "endDate" text,
  "status" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."PTW_MAP_SITES" (
  "id" text PRIMARY KEY,
  "name" text,
  "latitude" text,
  "longitude" text,
  "zoom" text,
  "createdAt" text,
  "updatedAt" text
);

-- Training Module
CREATE TABLE IF NOT EXISTS public."TrainingAttendance" (
  "id" text PRIMARY KEY,
  "trainingId" text,
  "employeeCode" text,
  "employeeName" text,
  "department" text,
  "job" text,
  "attendanceStatus" text,
  "startTime" text,
  "endTime" text,
  "date" text,
  "createdAt" text,
  "updatedAt" text
);

CREATE TABLE IF NOT EXISTS public."TrainingAnalysisData" (
  "id" text PRIMARY KEY,
  "notes" text,
  "goals" text,
  "recommendations" text,
  "targets" jsonb,
  "customMetrics" jsonb,
  "updatedAt" text
);

-- Create storage bucket for attachments if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('hse-attachments', 'hse-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'hse-attachments');

-- Allow authenticated users to upload files
CREATE POLICY "Allow Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hse-attachments');
