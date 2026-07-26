-- ==========================================
-- 1. แก้ไขระบบความปลอดภัย (RLS) และเงื่อนไขชื่อซ้ำของ app_users
-- ==========================================

-- ลบข้อจำกัดที่ห้ามชื่อซ้ำทั่วทั้งระบบ เพื่อให้แต่ละสาขามีชื่อเดียวกันได้ (เช่น มี Admin ประจำทั้งกรุงเทพและระยอง)
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_name_key;

-- เพิ่มข้อจำกัดใหม่: ชื่อห้ามซ้ำเฉพาะในสาขาเดียวกันเท่านั้น
ALTER TABLE app_users ADD CONSTRAINT app_users_name_branch_key UNIQUE (name, branch);

-- เปิดสิทธิ์ RLS ให้สามารถ เพิ่ม ลบ และแก้ไขผู้ใช้ (app_users) ได้อย่างสมบูรณ์ผ่านแอปพลิเคชัน
DROP POLICY IF EXISTS "Allow all operations for anon" ON app_users;
CREATE POLICY "Allow all operations for anon" ON app_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON app_users;
CREATE POLICY "Enable delete for authenticated users" ON app_users FOR DELETE USING (true);


-- ==========================================
-- 2. ตรวจสอบ เพิ่มคอลัมน์ branch และย้ายข้อมูลเดิมทั้งหมดไปสาขาระยอง (Rayong)
-- ==========================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'app_users', 'ingredients', 'stock_records', 'receiving_records', 
      'audit_logs', 'checklist_records', 'rnd_reports', 'waste_logs', 
      'bakery_plan_records', 'app_settings'
    ])
  LOOP
    -- ตรวจสอบว่าตารางนี้มีอยู่ในฐานข้อมูลจริงหรือไม่ก่อนทำงานเพื่อป้องกันข้อผิดพลาด
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t
    ) THEN
      -- เพิ่มคอลัมน์ branch (ถ้ายังไม่มี) และตั้งค่า Default เป็น 'Rayong'
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch text DEFAULT ''Rayong'';', t);
      -- อัปเดตข้อมูลเก่าที่เป็น NULL หรือ 'Bangkok' ให้ย้ายมาที่สาขา 'Rayong' ทั้งหมด
      EXECUTE format('UPDATE %I SET branch = ''Rayong'' WHERE branch IS NULL OR branch = ''Bangkok'';', t);
    END IF;
  END LOOP;
END $$;
