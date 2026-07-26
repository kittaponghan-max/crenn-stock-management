import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stockData } = await supabase.from('stock_records').select('*').eq('branch', 'Rayong').eq('record_date', '2026-07-22');
  console.log("Stock for 22-Jul:", stockData?.length);
  // Let's print a few
  if (stockData) {
      console.log(stockData.slice(0, 5));
  }
}
run();
