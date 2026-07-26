-- นำคำสั่ง SQL เหล่านี้ไปรันใน Supabase SQL Editor 
-- สคริปต์นี้จะตรวจสอบว่ามีตารางอยู่หรือไม่ก่อนที่จะทำการเพิ่มคอลัมน์ branch และอัปเดตข้อมูล

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['app_users', 'ingredients', 'stock_records', 'receiving_records', 'audit_logs', 'checklist_records', 'rnd_reports', 'waste_logs', 'bakery_plan_records', 'app_settings', 'app_backups'])
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
