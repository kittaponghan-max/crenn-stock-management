-- ==========================================
-- SQL Script: Safe & Repeatable Multi-Branch Isolation Script
-- วิธีใช้: คัดลอกสคริปต์ทั้งหมดนี้ไปวางและกด Run ในหน้า SQL Editor บน Supabase
-- สคริปต์นี้ถูกปรับปรุงให้สามารถกด Run ซ้ำกี่ครั้งก็ได้โดยไม่มี Error 
-- ==========================================

-- 1. ลบ Foreign Key ตัวใหม่ก่อน (ถ้ามี) เพื่อป้องกันการติด Lock Dependency เวลาทำซ้ำ
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_ing_branch_fkey;
ALTER TABLE IF EXISTS public.receiving_records DROP CONSTRAINT IF EXISTS receiving_records_ing_branch_fkey;

-- 2. ลบข้อกำหนดเก่าทั้งหมด (Constraints)
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_ingredient_id_fkey;
ALTER TABLE IF EXISTS public.receiving_records DROP CONSTRAINT IF EXISTS receiving_records_ingredient_id_fkey;
ALTER TABLE IF EXISTS public.ingredients DROP CONSTRAINT IF EXISTS ingredients_pkey CASCADE;
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_record_date_ingredient_id_key;
ALTER TABLE IF EXISTS public.stock_records DROP CONSTRAINT IF EXISTS stock_records_date_ing_branch_key;
ALTER TABLE IF EXISTS public.bakery_plan_records DROP CONSTRAINT IF EXISTS bakery_plan_records_week_key_key;
ALTER TABLE IF EXISTS public.bakery_plan_records DROP CONSTRAINT IF EXISTS bakery_plan_records_week_key_branch_key;
ALTER TABLE IF EXISTS public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE IF EXISTS public.app_users DROP CONSTRAINT IF EXISTS app_users_name_key;
ALTER TABLE IF EXISTS public.app_users DROP CONSTRAINT IF EXISTS app_users_name_branch_key;

-- 3. ตรวจสอบและเพิ่มคอลัมน์ branch (ถ้ายังไม่มี)
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

-- 4. ตั้งค่าเริ่มต้นข้อมูลเก่าที่ยังว่างอยู่ให้เป็นสาขา Rayong
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

-- 5. สร้างข้อกำหนดใหม่สำหรับแบ่งแยกสาขาอย่างอิสระ (Composite Unique/Primary Keys)
ALTER TABLE public.app_users ADD CONSTRAINT app_users_name_branch_key UNIQUE (name, branch);
ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id, branch);
ALTER TABLE public.stock_records ADD CONSTRAINT stock_records_date_ing_branch_key UNIQUE (record_date, ingredient_id, branch);
ALTER TABLE public.bakery_plan_records ADD CONSTRAINT bakery_plan_records_week_key_branch_key UNIQUE (week_key, branch);
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (setting_key, branch);

-- 6. เชื่อมโยงความสัมพันธ์ระหว่างตาราง (Foreign Keys) ใหม่โดยอิงตามรหัสวัตถุดิบและสาขาคู่กัน
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

-- 7. เปิดใช้งานและตั้งค่านโยบายความปลอดภัย (RLS)
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rnd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bakery_plan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for anon" ON app_users;
CREATE POLICY "Allow all operations for anon" ON app_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON app_users;
CREATE POLICY "Enable delete for authenticated users" ON app_users FOR DELETE USING (true);
