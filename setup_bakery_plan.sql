-- สร้างตาราง bakery_plan_records เพื่อเก็บข้อมูลแผนงาน Bakery ประจำสัปดาห์และประวัติย้อนหลัง
CREATE TABLE IF NOT EXISTS public.bakery_plan_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key DATE NOT NULL UNIQUE,
  week_label TEXT NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  user_name TEXT,
  plan_data JSONB NOT NULL
);

-- สร้างตาราง app_settings เพื่อเก็บข้อมูลการตั้งค่าต่างๆ (เช่น การตั้งค่า Bakery)
CREATE TABLE IF NOT EXISTS public.app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดใช้งาน Row Level Security (RLS) สำหรับ bakery_plan_records
ALTER TABLE public.bakery_plan_records ENABLE ROW LEVEL SECURITY;

-- สร้าง Policy สำหรับ bakery_plan_records
CREATE POLICY "Allow all read access on bakery_plan_records"
  ON public.bakery_plan_records FOR SELECT USING (true);
CREATE POLICY "Allow all insert access on bakery_plan_records"
  ON public.bakery_plan_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update access on bakery_plan_records"
  ON public.bakery_plan_records FOR UPDATE USING (true);
CREATE POLICY "Allow all delete access on bakery_plan_records"
  ON public.bakery_plan_records FOR DELETE USING (true);

-- เปิดใช้งาน Row Level Security (RLS) สำหรับ app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- สร้าง Policy สำหรับ app_settings
CREATE POLICY "Allow all read access on app_settings"
  ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow all insert access on app_settings"
  ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update access on app_settings"
  ON public.app_settings FOR UPDATE USING (true);
CREATE POLICY "Allow all delete access on app_settings"
  ON public.app_settings FOR DELETE USING (true);

