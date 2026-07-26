import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('waste_logs').select('department, count()', { count: 'exact', head: false }).eq('branch', 'Rayong');
  // the above is not valid group by, let's just select department
  const { data: d2 } = await supabase.from('waste_logs').select('department').eq('branch', 'Rayong');
  const counts = {};
  d2?.forEach(r => counts[r.department] = (counts[r.department] || 0) + 1);
  console.log(counts);
}
run();
