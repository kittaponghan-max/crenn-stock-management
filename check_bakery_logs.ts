import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'ส่งรายงานตรวจนับสต็อก (Bakery)')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  logs?.forEach(log => {
     try {
       const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
       console.log(log.timestamp, details.summary);
     } catch (e) {
       console.log(log.timestamp, log.details);
     }
  });
}
run();
