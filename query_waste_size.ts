import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('waste_logs').select('id, image_url');
  
  if (data) {
     const sizes = data.map(d => (d.image_url ? d.image_url.length : 0));
     console.log("Sizes of image_url:", sizes);
  }
  console.log("Error:", error);
}
run();
