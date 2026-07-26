const fs = require('fs');

let appContent = fs.readFileSync('src/App.tsx', 'utf-8');

appContent = appContent.replace(
  /localStorage\.setItem\(`cafe-waste-logs-\$\{user\.branch\}`,\s*JSON\.stringify\(updated\)\);/g,
  "try { localStorage.setItem(`cafe-waste-logs-${user.branch}`, JSON.stringify(updated)); } catch(e) { console.warn('localStorage full'); }"
);

appContent = appContent.replace(
  /localStorage\.setItem\('cafe-waste-logs',\s*JSON\.stringify\(updated\)\);/g,
  "try { localStorage.setItem('cafe-waste-logs', JSON.stringify(updated)); } catch(e) { console.warn('localStorage full'); }"
);

appContent = appContent.replace(
  /localStorage\.setItem\(`cafe-rnd-reports-\$\{user\.branch\}`,\s*JSON\.stringify\(updated\)\);/g,
  "try { localStorage.setItem(`cafe-rnd-reports-${user.branch}`, JSON.stringify(updated)); } catch(e) { console.warn('localStorage full'); }"
);

appContent = appContent.replace(
  /localStorage\.setItem\('cafe-rnd-reports',\s*JSON\.stringify\(updated\)\);/g,
  "try { localStorage.setItem('cafe-rnd-reports', JSON.stringify(updated)); } catch(e) { console.warn('localStorage full'); }"
);

fs.writeFileSync('src/App.tsx', appContent);
console.log('App.tsx localStorage wrapped in try-catch');
