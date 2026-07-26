-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to recreate them
DROP TABLE IF EXISTS checklist_records CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS receiving_records CASCADE;
DROP TABLE IF EXISTS stock_records CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;

-- 1. ตารางวัตถุดิบ (Ingredients)
CREATE TABLE ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    size_per_unit TEXT,
    min_stock INTEGER DEFAULT 0,
    min_order INTEGER DEFAULT 0,
    supplier TEXT,
    unit TEXT,
    category TEXT,
    image TEXT,
    department TEXT
);

-- 2. ตารางบันทึกสต็อก (Stock Records)
CREATE TABLE stock_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_date DATE NOT NULL,
    ingredient_id TEXT REFERENCES ingredients(id) ON DELETE CASCADE,
    stock_in NUMERIC DEFAULT 0,
    stock_out NUMERIC DEFAULT 0,
    remaining NUMERIC DEFAULT 0,
    UNIQUE(record_date, ingredient_id)
);

-- 3. ตารางประวัติการรับสินค้า (Receiving Records)
CREATE TABLE receiving_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receive_date DATE NOT NULL,
    ingredient_id TEXT REFERENCES ingredients(id) ON DELETE CASCADE,
    supplier TEXT,
    quantity NUMERIC NOT NULL,
    expiry_date DATE
);

-- 4. ตารางประวัติการใช้งาน (Audit Logs)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT,
    user_role TEXT,
    action TEXT,
    details TEXT
);

-- 5. ตารางประวัติ Check-in & Check-out (Checklist Records)
CREATE TABLE checklist_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL,
    report_date DATE,
    reporter_name TEXT,
    data JSONB -- ใช้เก็บข้อมูลแบบ JSON เช่น coffeeWeights, coffeeDialIn, salesSummary, categories
);

-- 6. ตารางผู้ใช้งาน (App Users)
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

-- เปิดใช้งาน RLS และสร้าง Policy
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for anon" ON app_users FOR ALL USING (true);

-- ลองเพิ่ม Admin เริ่มต้นเป็นตัวอย่าง
INSERT INTO app_users (name, password, role) 
VALUES ('Admin', 'Administrator', 'Admin');

-- การตั้งค่าความปลอดภัย (RLS - Row Level Security)
-- เปิดใช้งาน RLS ทุกตาราง
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_records ENABLE ROW LEVEL SECURITY;

-- อนุญาตให้ใช้งานได้ทั้งหมดสำหรับตอนนี้ (สามารถตั้งค่าความปลอดภัยเพิ่มเติมได้ในภายหลัง)
CREATE POLICY "Allow all operations for anon" ON ingredients FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON stock_records FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON receiving_records FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON checklist_records FOR ALL USING (true);
