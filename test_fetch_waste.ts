import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching waste logs...");
  const t0 = Date.now();
  const { data, error } = await supabase.from('waste_logs').select('id, timestamp, date, department, ingredient_id, ingredient_name, quantity, unit, cause, solution, image_url, recorder_name').eq('branch', 'Rayong').order('timestamp', { ascending: false }).limit(100);
  console.log("Time taken:", Date.now() - t0, "ms");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success. Rows:", data?.length);
  }
}
run();
