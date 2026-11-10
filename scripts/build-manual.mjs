// Joins the in-app manual chapters (client/src/features/help/manual/*.md) into docs/USER-MANUAL.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'client/src/features/help/manual');
const chapters = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r/g, '');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = Object.fromEntries((m ? m[1] : '').split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
  return { ...meta, body: m ? raw.slice(m[0].length) : raw };
});
const anchor = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let out = '# Gold Finance - User Manual\n\nStep by step guide to every menu, with examples. The same manual is inside the app: **Help → User Manual** (it shows each person the chapters of their role). First time? Start with **Help → Getting Started**.\n\n## Contents\n\n';
let group = '';
for (const c of chapters) {
  if (c.group !== group) { group = c.group; out += `\n**${group}**\n\n`; }
  const first = (c.body.match(/^# (.*)$/m) || [])[1] || c.title;
  out += `- [${c.title}](#${anchor(first)})\n`;
}
out += '\n---\n\n' + chapters.map((c) => c.body.trim()).join('\n\n---\n\n') + '\n';
fs.writeFileSync(path.join(root, 'docs/USER-MANUAL.md'), out);
console.log(`docs/USER-MANUAL.md - ${chapters.length} chapters, ${out.split('\n').length} lines`);
