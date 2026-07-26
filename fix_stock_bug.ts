import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: stockData } = await supabase.from('stock_records').select('*').eq('branch', 'Rayong').eq('record_date', '2026-07-20');
  console.log(`Stock records for 2026-07-20: ${stockData?.length}`);
  
  const id2 = stockData?.find(d => d.ingredient_id === '2');
  console.log("ID 2 in DB for 2026-07-20:", id2?.remaining);
}
check();
