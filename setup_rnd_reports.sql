-- สร้างตาราง rnd_reports เพื่อเก็บข้อมูล R&D Report
CREATE TABLE IF NOT EXISTS public.rnd_reports (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE,
  menu_name_th TEXT,
  menu_name_en TEXT,
  product_looks TEXT,
  component TEXT,
  taste TEXT, -- บันทึกเป็น JSON string
  flavor TEXT, -- บันทึกเป็น JSON string
  taste_result TEXT, -- บันทึกเป็น JSON string
  improvements TEXT, -- บันทึกเป็น JSON string
  commenter_name TEXT,
  image_url TEXT,
  image_urls TEXT, -- บันทึกเป็น JSON string ประกอบด้วยหลายรูป 
  recorder_name TEXT
);

-- เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.rnd_reports ENABLE ROW LEVEL SECURITY;

-- สร้าง Policy ให้สามารถอ่านข้อมูลได้ (ปรับตามความเหมาะสมของ Project)
CREATE POLICY "Allow all read access"
  ON public.rnd_reports
  FOR SELECT
  USING (true);

-- สร้าง Policy ให้สามารถเพิ่มข้อมูลได้
CREATE POLICY "Allow all insert access"
  ON public.rnd_reports
  FOR INSERT
  WITH CHECK (true);

-- สร้าง Policy ให้สามารถอัปเดตข้อมูลได้
CREATE POLICY "Allow all update access"
  ON public.rnd_reports
  FOR UPDATE
  USING (true);

-- สร้าง Policy ให้สามารถลบข้อมูลได้
CREATE POLICY "Allow all delete access"
  ON public.rnd_reports
  FOR DELETE
  USING (true);
