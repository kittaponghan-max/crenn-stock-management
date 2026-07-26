import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: logs, error: logError } = await supabase
    .from('audit_logs')
    .select('*')
    .in('action', ['ส่งรายงานตรวจนับสต็อก (Bar)', 'ส่งรายงานตรวจนับสต็อก (Bakery)'])
    .order('timestamp', { ascending: false })
    .limit(10);

  if (!logs) return;

  for (const log of logs) {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    const summary = details.summary || '';
    const match = summary.match(/ประจำวันที่ (\d{4}-\d{2}-\d{2})/);
    if (!match) continue;
    const dateKey = match[1];

    if (dateKey === '2026-07-20' || dateKey === '2026-07-21') {
      console.log(`Applying log from ${log.timestamp} for date ${dateKey}`);
      const changes = details.changes || [];
      const branch = log.branch || 'Rayong';
      
      const upserts = [];
      for (const change of changes) {
        // We need the current stock_in and stock_out
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

      if (upserts.length > 0) {
        const { error } = await supabase.from('stock_records').upsert(
          upserts,
          { onConflict: 'record_date,ingredient_id,branch' }
        );
        if (error) {
          console.error(`Error upserting for ${dateKey}:`, error);
        } else {
          console.log(`Successfully applied ${upserts.length} updates from log ${log.timestamp}`);
        }
      }
    }
  }
}
run();
