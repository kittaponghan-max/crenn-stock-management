import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: ings } = await supabase.from('ingredients').select('id, name').ilike('name', '%Brazil%');
  console.log("Ingredients:", ings);
  
  if (ings && ings.length > 0) {
     const id = ings[0].id;
     const { data: stock } = await supabase.from('stock_records').select('*').eq('ingredient_id', id).eq('record_date', '2026-07-22');
     console.log("Stock for 22-Jul:", stock);
     
     const { data: stock20 } = await supabase.from('stock_records').select('*').eq('ingredient_id', id).eq('record_date', '2026-07-20');
     console.log("Stock for 20-Jul:", stock20);
  }
}
run();
