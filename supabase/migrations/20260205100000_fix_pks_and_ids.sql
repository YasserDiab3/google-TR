-- Fix Primary Keys and Schema consistencies

-- 1. Employees: add PRIMARY KEY to id
ALTER TABLE IF EXISTS public."Employees" ADD PRIMARY KEY ("id");

-- 2. PPE_Stock: rename itemId to id and add PRIMARY KEY
ALTER TABLE IF EXISTS public."PPE_Stock" RENAME COLUMN "itemId" TO "id";
ALTER TABLE IF EXISTS public."PPE_Stock" ADD PRIMARY KEY ("id");

-- 3. PTW_DEFAULT_COORDINATES: add id and PRIMARY KEY
-- This table seems to be a single row of settings. We'll give it a constant id.
ALTER TABLE IF EXISTS public."PTW_DEFAULT_COORDINATES" ADD COLUMN IF NOT EXISTS "id" text DEFAULT 'default';
UPDATE public."PTW_DEFAULT_COORDINATES" SET "id" = 'default' WHERE "id" IS NULL;
ALTER TABLE IF EXISTS public."PTW_DEFAULT_COORDINATES" ADD PRIMARY KEY ("id");

-- 4. IncidentNotifications: add PRIMARY KEY to id (if missing)
-- Check if id exists, if not use notificationNumber or add id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='IncidentNotifications' AND column_name='id') THEN
        ALTER TABLE public."IncidentNotifications" ADD COLUMN "id" text;
        UPDATE public."IncidentNotifications" SET "id" = "notificationNumber";
    END IF;
END $$;
ALTER TABLE IF EXISTS public."IncidentNotifications" ADD PRIMARY KEY ("id");

-- 5. Ensure all other tables from previous migrations have PKs
-- Incidents was missing PK in the grep check
ALTER TABLE IF EXISTS public."Incidents" ADD PRIMARY KEY ("id");
