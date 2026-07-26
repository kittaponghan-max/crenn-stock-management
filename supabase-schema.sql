-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ingredients Table
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

-- 2. Stock Records Table
CREATE TABLE stock_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_date DATE NOT NULL,
    ingredient_id TEXT REFERENCES ingredients(id) ON DELETE CASCADE,
    stock_in NUMERIC DEFAULT 0,
    stock_out NUMERIC DEFAULT 0,
    remaining NUMERIC DEFAULT 0,
    UNIQUE(record_date, ingredient_id)
);

-- 3. Receiving Records Table
CREATE TABLE receiving_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receive_date DATE NOT NULL,
    ingredient_id TEXT REFERENCES ingredients(id) ON DELETE CASCADE,
    supplier TEXT,
    quantity NUMERIC NOT NULL,
    expiry_date DATE
);

-- 4. Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT,
    user_role TEXT,
    action TEXT,
    details TEXT
);

-- 5. Checklist Records Table
CREATE TABLE checklist_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL,
    report_date DATE,
    reporter_name TEXT,
    data JSONB -- Stores coffeeWeights, coffeeDialIn, salesSummary, categories
);

-- RLS (Row Level Security) Policies (Optional but recommended)
-- Enable RLS on all tables
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_records ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for authenticated/anon users for now
-- (You can restrict these later based on your auth setup)
CREATE POLICY "Allow all operations for anon" ON ingredients FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON stock_records FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON receiving_records FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow all operations for anon" ON checklist_records FOR ALL USING (true);
