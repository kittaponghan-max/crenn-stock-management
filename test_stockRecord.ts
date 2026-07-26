import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stockData } = await supabase.from('stock_records').select('*').eq('branch', 'Rayong').eq('ingredient_id', '3').order('record_date', { ascending: false }).limit(5);
  console.log("Stock records for Brazil:", stockData);
}
run();
