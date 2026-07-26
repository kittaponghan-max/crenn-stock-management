import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('waste_logs').select('id').eq('branch', 'Rayong');
  if (data) {
    for (const row of data) {
      // Just check the length
      const { data: rowData } = await supabase.from('waste_logs').select('id, image_url').eq('id', row.id).single();
      if (rowData?.image_url && rowData.image_url.length > 500000) {
        console.log(`ID ${row.id} has image size ${rowData.image_url.length}. Removing to fix timeout.`);
        await supabase.from('waste_logs').update({ image_url: null }).eq('id', row.id);
      }
    }
  }
  
  const { data: rndData } = await supabase.from('rnd_reports').select('id').eq('branch', 'Rayong');
  if (rndData) {
    for (const row of rndData) {
      const { data: rowData } = await supabase.from('rnd_reports').select('id, image_url, image_urls').eq('id', row.id).single();
      if (rowData?.image_url && rowData.image_url.length > 500000) {
        console.log(`RnD ID ${row.id} has image size ${rowData.image_url.length}. Removing.`);
        await supabase.from('rnd_reports').update({ image_url: null }).eq('id', row.id);
      }
      if (rowData?.image_urls && rowData.image_urls.length > 500000) {
        console.log(`RnD ID ${row.id} has image_urls size ${rowData.image_urls.length}. Removing.`);
        await supabase.from('rnd_reports').update({ image_urls: '[]' }).eq('id', row.id);
      }
    }
  }
}
run();
