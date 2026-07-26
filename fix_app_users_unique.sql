-- นำคำสั่ง SQL เหล่านี้ไปรันใน Supabase SQL Editor
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_name_key;
ALTER TABLE app_users ADD CONSTRAINT app_users_name_branch_key UNIQUE (name, branch);
