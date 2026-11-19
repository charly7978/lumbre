import fs from 'node:fs';
const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
const map = {
  'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú', 'Ã±': 'ñ', 'Ã‘': 'Ñ',
  'Ã': 'Á', 'Ã¼': 'ü', 'Ãœ': 'Ü', 'â€“': '–', 'â€”': '—', 'â€¦': '…',
  'Â¿': '¿', 'Â¡': '¡', 'Â': '', 'â€œ': '“', 'â€': '”',
};
for (const [from, to] of Object.entries(map)) s = s.split(from).join(to);
fs.writeFileSync(file, s, 'utf8');
console.log('restantes:', (s.match(/Ã|â€|Â/g) || []).length);
