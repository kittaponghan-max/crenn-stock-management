import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stockData, error } = await supabase.from('stock_records').select('*').eq('branch', 'Rayong').limit(5000);
  console.log("Count with limit(5000):", stockData?.length);
}
run();
