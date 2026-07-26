import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error, count } = await supabase.from('waste_logs').select('*', { count: 'exact', head: true });
  console.log("Count:", count);
  console.log("Error:", error);
  
  const { data: data2, error: error2 } = await supabase.from('waste_logs').select('*').limit(1);
  console.log("First row:", data2);
  console.log("Error2:", error2);
}
run();
