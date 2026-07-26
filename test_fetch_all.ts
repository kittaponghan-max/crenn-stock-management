import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const branch = 'Rayong';
  try {
    const [
      { data: ingredientsData, error: ingError },
      { data: stockData },
      { data: receivingData },
      { data: logsData },
      { data: checklistData },
      { data: rndData },
      { data: wasteData, error: wasteError },
      { data: bakeryPlanDataList },
      { data: settingsData }
    ] = await Promise.all([
      supabase.from('ingredients').select('*').eq('branch', branch),
      supabase.from('stock_records').select('*').eq('branch', branch),
      supabase.from('receiving_records').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(200),
      supabase.from('audit_logs').select('*').eq('branch', branch).order('timestamp', { ascending: false }).limit(120),
      supabase.from('checklist_records').select('*').eq('branch', branch).order('timestamp', { ascending: false }).limit(120),
      supabase.from('rnd_reports').select('id, timestamp, date, menu_name_th, menu_name_en, product_looks, component, taste, flavor, taste_result, improvements, commenter_name, image_url, image_urls, recorder_name').eq('branch', branch).order('timestamp', { ascending: false }).limit(50),
      supabase.from('waste_logs').select('id, timestamp, date, department, ingredient_id, ingredient_name, quantity, unit, cause, solution, image_url, recorder_name').eq('branch', branch).order('timestamp', { ascending: false }).limit(100),
      supabase.from('bakery_plan_records').select('*').eq('branch', branch).order('week_key', { ascending: false }),
      supabase.from('app_settings').select('*').eq('branch', branch)
    ]);
    console.log("Success fetch all. Waste rows:", wasteData?.length);
    console.log("Waste error:", wasteError);
  } catch (err) {
    console.error("Promise.all failed:", err.message);
  }
}
run();
