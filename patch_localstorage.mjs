import fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf8');
const newContent = content.replace(
  /localStorage\.setItem\((.*?)\);/g,
  `try { localStorage.setItem($1); } catch (e) { console.warn('localStorage error', e); }`
);
fs.writeFileSync('src/App.tsx', newContent, 'utf8');
console.log('patched localStorage in App.tsx');
