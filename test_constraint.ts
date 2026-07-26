import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('get_policies'); // or just try a raw query? No rpc available probably
  // Let's test the upsert directly
  const { error: upsertErr } = await supabase.from('stock_records').upsert(
    [{ branch: 'Rayong', record_date: '2026-07-22', ingredient_id: '3', remaining: 3 }],
    { onConflict: 'record_date,ingredient_id,branch' }
  );
  console.log("Upsert Error:", upsertErr);
}
run();
