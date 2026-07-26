import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/remaining: currentObj\.remaining \?\? null \}, \{ onConflict: 'record_date,ingredient_id,branch' \}\n\s*\}, \{ onConflict: 'record_date,ingredient_id,branch' \}\)\.then\(\);/g, "remaining: currentObj.remaining ?? null\n        }, { onConflict: 'record_date,ingredient_id,branch' }).then();");
fs.writeFileSync('src/App.tsx', code);
