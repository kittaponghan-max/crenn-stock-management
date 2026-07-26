import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stockData } = await supabase.from('stock_records').select('*').eq('branch', 'Rayong');
  
  const stockRecord: any = {};
  stockData?.forEach(record => {
    if (!stockRecord[record.record_date]) stockRecord[record.record_date] = {};
    stockRecord[record.record_date][record.ingredient_id] = {
      in: record.stock_in,
      out: record.stock_out,
      remaining: record.remaining
    };
  });

  const allDates = Array.from(new Set(Object.keys(stockRecord))).sort();
  console.log("All dates:", allDates.slice(-10));
}
run();
