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
    .in('action', ['ส่งรายงานตรวจนับสต็อก (Bar)', 'ส่งรายงานตรวจนับสต็อก (Bakery)'])
    .order('timestamp', { ascending: false })
    .limit(5);
  
  logs?.forEach(log => {
     const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
     console.log(details.summary);
     if (details.changes) {
        const ids = details.changes.map(c => c.ingredientId);
        console.log(`Contains ID 63: ${ids.includes('63')}`);
     }
  });
}
run();
