-- Company settings + app meta (users sync cursor) for Supabase-only / hse-api MVP
SET search_path TO public;
CREATE TABLE IF NOT EXISTS public."Company_Settings" (
  "id" text,
  "name" text,
  "secondaryName" text,
  "nameFontSize" text,
  "secondaryNameFontSize" text,
  "secondaryNameColor" text,
  "formVersion" text,
  "address" text,
  "phone" text,
  "email" text,
  "logo" text,
  "postLoginItems" text,
  "clinicMonthlyVisitsAlertThreshold" text,
  "clinicVisitTypes" text,
  "profileTeamsUrl" text,
  "profileWhatsAppUrl" text,
  "createdAt" text,
  "updatedAt" text,
  "createdBy" text,
  "updatedBy" text
);
CREATE TABLE IF NOT EXISTS public."HSE_AppMeta" (
  "key" text PRIMARY KEY,
  "value_text" text,
  "value_num" bigint,
  "updated_at" timestamptz DEFAULT now()
);
COMMENT ON TABLE public."HSE_AppMeta" IS 'Internal key-value for Edge hse-api (not exposed as sheet CRUD).';
