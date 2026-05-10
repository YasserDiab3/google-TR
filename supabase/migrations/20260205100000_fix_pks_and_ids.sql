-- Fix Primary Keys and Schema consistencies (idempotent for projects already partially migrated)

-- Helper pattern: add PK only when none exists on table

-- 1. Employees: add PRIMARY KEY to id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Employees'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'Employees' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public."Employees" ADD PRIMARY KEY ("id");
  END IF;
END $$;

-- 2. PPE_Stock: rename itemId to id and add PRIMARY KEY
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PPE_Stock' AND column_name = 'itemId'
  ) THEN
    ALTER TABLE public."PPE_Stock" RENAME COLUMN "itemId" TO "id";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PPE_Stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'PPE_Stock' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public."PPE_Stock" ADD PRIMARY KEY ("id");
  END IF;
END $$;

-- 3. PTW_DEFAULT_COORDINATES: add id and PRIMARY KEY
ALTER TABLE IF EXISTS public."PTW_DEFAULT_COORDINATES" ADD COLUMN IF NOT EXISTS "id" text DEFAULT 'default';
UPDATE public."PTW_DEFAULT_COORDINATES" SET "id" = 'default' WHERE "id" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PTW_DEFAULT_COORDINATES'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'PTW_DEFAULT_COORDINATES' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public."PTW_DEFAULT_COORDINATES" ADD PRIMARY KEY ("id");
  END IF;
END $$;

-- 4. IncidentNotifications: ensure id column then PK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'IncidentNotifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'IncidentNotifications' AND column_name = 'id'
  ) THEN
    ALTER TABLE public."IncidentNotifications" ADD COLUMN "id" text;
    UPDATE public."IncidentNotifications" SET "id" = "notificationNumber";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'IncidentNotifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'IncidentNotifications' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public."IncidentNotifications" ADD PRIMARY KEY ("id");
  END IF;
END $$;

-- 5. Incidents: PRIMARY KEY if missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Incidents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'Incidents' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public."Incidents" ADD PRIMARY KEY ("id");
  END IF;
END $$;
