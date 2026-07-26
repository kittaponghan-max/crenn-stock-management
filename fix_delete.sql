-- นำคำสั่ง SQL เหล่านี้ไปรันใน Supabase SQL Editor
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON app_users;
CREATE POLICY "Enable delete for authenticated users" ON app_users FOR DELETE USING (true);
