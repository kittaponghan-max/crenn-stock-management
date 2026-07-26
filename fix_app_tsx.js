const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `        const [
          { data: ingredientsData, error: ingError },
          { data: stockData },
          { data: receivingData },
          { data: logsData },
          { data: checklistData },
          { data: rndData },
          { data: wasteData },
          { data: bakeryPlanDataList },
          { data: settingsData }
        ] = await Promise.all([
          supabase.from('ingredients').select('*').eq('branch', branch),
          supabase.from('stock_records').select('*').eq('branch', branch),
          supabase.from('receiving_records').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(200),`;

const replacement = `        const fetchAllStockRecords = async (branch) => {
          const allData = [];
          let page = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase.from('stock_records')
              .select('*')
              .eq('branch', branch)
              .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) return { data: null, error };
            if (data) allData.push(...data);
            if (!data || data.length < pageSize) break;
            page++;
          }
          return { data: allData, error: null };
        };

        const [
          { data: ingredientsData, error: ingError },
          { data: stockData },
          { data: receivingData },
          { data: logsData },
          { data: checklistData },
          { data: rndData },
          { data: wasteData },
          { data: bakeryPlanDataList },
          { data: settingsData }
        ] = await Promise.all([
          supabase.from('ingredients').select('*').eq('branch', branch),
          fetchAllStockRecords(branch),
          supabase.from('receiving_records').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(200),`;

if (content.includes(target)) {
  fs.writeFileSync('src/App.tsx', content.replace(target, replacement), 'utf8');
  console.log("Success");
} else {
  console.log("Target not found");
}
