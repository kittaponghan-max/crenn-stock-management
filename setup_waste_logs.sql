-- สร้างตาราง waste_logs เพื่อเก็บข้อมูลบันทึกของเสีย
CREATE TABLE IF NOT EXISTS public.waste_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE,
  department TEXT,
  ingredient_id TEXT,
  ingredient_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  cause TEXT,
  solution TEXT,
  image_url TEXT,
  recorder_name TEXT
);

-- เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

-- สร้าง Policy ให้สามารถอ่านข้อมูลได้ (ปรับตามความเหมาะสมของ Project)
CREATE POLICY "Allow all read access"
  ON public.waste_logs
  FOR SELECT
  USING (true);

-- สร้าง Policy ให้สามารถเพิ่มข้อมูลได้
CREATE POLICY "Allow all insert access"
  ON public.waste_logs
  FOR INSERT
  WITH CHECK (true);

-- สร้าง Policy ให้สามารถอัปเดตข้อมูลได้
CREATE POLICY "Allow all update access"
  ON public.waste_logs
  FOR UPDATE
  USING (true);

-- สร้าง Policy ให้สามารถลบข้อมูลได้
CREATE POLICY "Allow all delete access"
  ON public.waste_logs
  FOR DELETE
  USING (true);
