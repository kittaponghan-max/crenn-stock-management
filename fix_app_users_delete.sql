-- นำคำสั่ง SQL เหล่านี้ไปรันใน Supabase SQL Editor
-- เพื่ออนุญาตให้ลบผู้ใช้งานได้
CREATE POLICY "Enable delete for authenticated users" ON app_users FOR DELETE USING (true);
