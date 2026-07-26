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
    .limit(50);
    
  if (!logs) return;

  const branch = 'Rayong';
  const dateKey = '2026-07-20';

  let foundLogs = [];
  logs.forEach(log => {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    if (details.summary && details.summary.includes('2026-07-20')) {
      foundLogs.push(log);
    }
  });

  const sortedLogs = foundLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const upsertsMap = {};
  
  for (const log of sortedLogs) {
     const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
     if (!details.changes) continue;
     for (const change of details.changes) {
       upsertsMap[change.ingredientId] = change.newVal;
     }
  }

  const upserts = [];
  for (const [ingredientId, newVal] of Object.entries(upsertsMap)) {
      const { data: currentStock } = await supabase
          .from('stock_records')
          .select('stock_in, stock_out')
          .eq('record_date', dateKey)
          .eq('ingredient_id', ingredientId)
          .eq('branch', branch)
          .single();

      upserts.push({
          branch: branch,
          record_date: dateKey,
          ingredient_id: ingredientId,
          stock_in: currentStock?.stock_in || 0,
          stock_out: currentStock?.stock_out || 0,
          remaining: newVal
      });
  }

  console.log(`Will upsert ${upserts.length} items`);
  
  if (upserts.length > 0) {
     // Batch upsert might be safer in chunks if too big, but 81 items should be fine
     const { error } = await supabase.from('stock_records').upsert(upserts, { onConflict: 'record_date,ingredient_id,branch' });
     if (error) {
       console.error("Error upserting:", error);
     } else {
       console.log("Success");
     }
  }
}
run();
