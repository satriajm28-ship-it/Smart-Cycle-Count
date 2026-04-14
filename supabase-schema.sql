-- Supabase Schema for Smart Cycle Count

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    name TEXT NOT NULL
);

-- 2. Master Data Table
CREATE TABLE IF NOT EXISTS public.master_data (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "systemStock" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "expiryDate" TEXT,
    category TEXT,
    unit TEXT
);

-- 3. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    location TEXT NOT NULL,
    "batchNumber" TEXT,
    "expiryDate" TEXT,
    "systemQty" INTEGER NOT NULL,
    "physicalQty" INTEGER NOT NULL,
    variance INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    "teamMember" TEXT NOT NULL,
    notes TEXT,
    "evidencePhotos" JSONB
);

-- 4. Location States Table
CREATE TABLE IF NOT EXISTS public.location_states (
    "locationId" TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    "photoUrl" TEXT,
    description TEXT,
    "reportedBy" TEXT
);

-- 5. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    "user" TEXT NOT NULL,
    details TEXT,
    photos JSONB
);

-- 6. Backup Tables
CREATE TABLE IF NOT EXISTS public.backup_audit_logs_latest (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    location TEXT NOT NULL,
    "batchNumber" TEXT,
    "expiryDate" TEXT,
    "systemQty" INTEGER NOT NULL,
    "physicalQty" INTEGER NOT NULL,
    variance INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    "teamMember" TEXT NOT NULL,
    notes TEXT,
    "evidencePhotos" JSONB
);

CREATE TABLE IF NOT EXISTS public.backup_location_states_latest (
    "locationId" TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    "photoUrl" TEXT,
    description TEXT,
    "reportedBy" TEXT
);

-- Enable Realtime for all tables
alter publication supabase_realtime add table public.audit_logs;
alter publication supabase_realtime add table public.master_data;
alter publication supabase_realtime add table public.location_states;
alter publication supabase_realtime add table public.activity_logs;
