import { createClient } from '@supabase/supabase-api-js';

// ตรวจสอบว่าชื่อตัวแปรต้องมี VITE_ นำหน้า และใช้ import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
