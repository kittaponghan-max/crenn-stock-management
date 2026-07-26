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
    .like('action', '%ส่งรายงานตรวจนับสต็อก (Bar)%')
    .order('timestamp', { ascending: false })
    .limit(20);
    
  if (!logs) return;

  const branch = 'Rayong';
  const dateKey = '2026-07-22';

  let foundLog = logs.find(log => {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    return details.summary && details.summary.includes(dateKey) && details.changes && details.changes.length === 80;
  });

  if (!foundLog) {
      console.log("No exact log found for 80 items on 22-Jul-2026.");
      foundLog = logs.find(log => {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        return details.summary && details.summary.includes(dateKey);
      });
  }

  if (!foundLog) {
      console.log("No log found for 22-Jul-2026");
      return;
  }

  const details = typeof foundLog.details === 'string' ? JSON.parse(foundLog.details) : foundLog.details;
  const changes = details.changes || [];
  console.log(`Found log from ${foundLog.timestamp} with ${changes.length} changes.`);

  const upserts = [];
  for (const change of changes) {
      const { data: currentStock } = await supabase
          .from('stock_records')
          .select('stock_in, stock_out')
          .eq('record_date', dateKey)
          .eq('ingredient_id', change.ingredientId)
          .eq('branch', branch)
          .single();

      upserts.push({
          branch: branch,
          record_date: dateKey,
          ingredient_id: change.ingredientId,
          stock_in: currentStock?.stock_in || 0,
          stock_out: currentStock?.stock_out || 0,
          remaining: change.newVal
      });
  }

  console.log(`Will upsert ${upserts.length} items for ${dateKey}`);
  
  if (upserts.length > 0) {
     const { error } = await supabase.from('stock_records').upsert(upserts, { onConflict: 'record_date,ingredient_id,branch' });
     if (error) {
       console.error("Error upserting:", error);
     } else {
       console.log("Success");
     }
  }
}
run();
