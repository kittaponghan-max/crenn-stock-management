-- นำคำสั่ง SQL เหล่านี้ไปรันใน Supabase SQL Editor
-- 1. แก้ไข Policy ของตาราง app_users ให้สามารถลบ/แก้ไข/เพิ่มข้อมูลได้อย่างสมบูรณ์
DROP POLICY IF EXISTS "Allow all operations for anon" ON app_users;
CREATE POLICY "Allow all operations for anon" ON app_users FOR ALL USING (true) WITH CHECK (true);

-- 2. เพิ่มคอลัมน์ branch และย้ายข้อมูลไปสาขาระยอง (ข้ามตารางที่ไม่มีอยู่จริงเพื่อไม่ให้เกิด Error)
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
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch text DEFAULT ''Rayong'';', t);
      EXECUTE format('UPDATE %I SET branch = ''Rayong'' WHERE branch IS NULL OR branch = ''Bangkok'';', t);
    END IF;
  END LOOP;
END $$;
