-- ==========================================
-- SQL Script: Fix constraints for multi-branch database isolation (Bangkok & Rayong)
-- Run this script in your Supabase SQL Editor to ensure independent branch data sync
-- ==========================================

-- 1. DROP EXISTING CONSTRAINTS TO PREVENT CONFLICTS
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_ingredient_id_fkey;
ALTER TABLE IF EXISTS public.receiving_records DROP CONSTRAINT IF EXISTS receiving_records_ingredient_id_fkey;
ALTER TABLE IF EXISTS public.ingredients DROP CONSTRAINT IF EXISTS ingredients_pkey;
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_record_date_ingredient_id_key;
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_date_ing_branch_key;
ALTER TABLE IF EXISTS public.bakery_plan_records DROP CONSTRAINT IF EXISTS bakery_plan_records_week_key_key;
ALTER TABLE IF EXISTS public.bakery_plan_records DROP CONSTRAINT IF EXISTS bakery_plan_records_week_key_branch_key;
ALTER TABLE IF EXISTS public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE IF EXISTS public.app_users DROP CONSTRAINT IF EXISTS app_users_name_key;
ALTER TABLE IF EXISTS public.app_users DROP CONSTRAINT IF EXISTS app_users_name_branch_key;

-- 2. ADD BRANCH COLUMN IF NOT EXISTED (SAFELY)
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('app_users', 'ingredients', 'stock_records', 'receiving_records', 'audit_logs', 'checklist_records', 'rnd_reports', 'waste_logs', 'bakery_plan_records', 'app_settings')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch text DEFAULT ''Rayong'';', t);
    END LOOP;
END $$;

-- 3. ENSURE ALL NULL OR OLD DATA DEFAULT TO 'Rayong' OR CORRESPONDING BRANCH
-- (Run this if you want to initialize default branches for existing rows)
UPDATE public.app_users SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.ingredients SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.stock_records SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.receiving_records SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.audit_logs SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.checklist_records SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.rnd_reports SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.waste_logs SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.bakery_plan_records SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';
UPDATE public.app_settings SET branch = 'Rayong' WHERE branch IS NULL OR branch = '';

-- 4. CREATE NEW UNIQUE COMPOSITE CONSTRAINTS (INCLUDING BRANCH)

-- A. App Users: unique username per branch
ALTER TABLE public.app_users ADD CONSTRAINT app_users_name_branch_key UNIQUE (name, branch);

-- B. Ingredients: primary key is now (id, branch)
ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id, branch);

-- C. Stock Records: unique record per date, ingredient, and branch
ALTER TABLE public.stock_records ADD CONSTRAINT stock_records_date_ing_branch_key UNIQUE (record_date, ingredient_id, branch);

-- D. Bakery Plan Records: unique plan per week and branch
ALTER TABLE public.bakery_plan_records ADD CONSTRAINT bakery_plan_records_week_key_branch_key UNIQUE (week_key, branch);

-- E. App Settings: primary key is now (setting_key, branch)
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (setting_key, branch);

-- 5. RE-ESTABLISH COMPOSITE FOREIGN KEY REFERENCES (OPTIONAL BUT RECOMMENDED)
-- To maintain clean data integrity, stock and receiving records can reference ingredients by (id, branch)
ALTER TABLE public.stock_records 
  ADD CONSTRAINT stock_records_ing_branch_fkey 
  FOREIGN KEY (ingredient_id, branch) 
  REFERENCES public.ingredients(id, branch) 
  ON DELETE CASCADE;

ALTER TABLE public.receiving_records 
  ADD CONSTRAINT receiving_records_ing_branch_fkey 
  FOREIGN KEY (ingredient_id, branch) 
  REFERENCES public.ingredients(id, branch) 
  ON DELETE CASCADE;

-- 6. DOUBLE-CHECK RLS (ROW LEVEL SECURITY) IS ENABLED WITH PROPER POLICIES
-- Ensure all tables allow read/write operations
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bakery_plan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- If you want strict branch security at the DB level, you can implement it here.
-- For now, we allow general access and let the application layer handle the branch-specific filtering via .eq('branch', branch).
