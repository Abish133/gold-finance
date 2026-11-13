import { Fragment } from 'react';
import clsx from 'clsx';

/* Small markdown renderer for the user manual: headings, paragraphs, lists (one level of nesting),
   tables, > tips, **bold**, *italic*, `keys`. Builds React elements (no HTML injection). */

const inline = (text, keyBase = 'i') => {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0; let m; let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<b key={`${keyBase}${k++}`} className="font-semibold text-navy-900 dark:text-white">{t.slice(2, -2)}</b>);
    else if (t.startsWith('`')) out.push(<code key={`${keyBase}${k++}`} className="rounded border border-ink-300 bg-ink-50 px-1 py-px font-mono text-[0.85em] dark:border-ink-700 dark:bg-ink-800">{t.slice(1, -1)}</code>);
    else out.push(<i key={`${keyBase}${k++}`}>{t.slice(1, -1)}</i>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

export const parseFront = (input) => {
  const raw = input.split(String.fromCharCode(13)).join('');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  if (m) m[1].split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  return { meta, body: m ? raw.slice(m[0].length) : raw };
};

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function Markdown({ text, highlight }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i += 1; continue; }
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) { blocks.push({ t: `h${h[1].length}`, text: h[2] }); i += 1; continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i += 1; }
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      blocks.push({ t: 'table', head: cells(rows[0]), rows: rows.slice(2).map(cells) });
      continue;
    }
    if (l.startsWith('> ')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('> ')) { q.push(lines[i].slice(2)); i += 1; }
      blocks.push({ t: 'tip', text: q.join(' ') });
      continue;
    }
    if (/^(\d+\.|-)\s/.test(l)) {
      const ordered = /^\d+\./.test(l);
      const items = [];
      while (i < lines.length && (/^(\d+\.|-)\s/.test(lines[i]) || /^\s{2,}(-|\d+\.)\s/.test(lines[i]) || /^\s{3,}\S/.test(lines[i]))) {
        const s = lines[i];
        if (/^\s{2,}(-|\d+\.)\s/.test(s)) (items.at(-1).sub ||= []).push(s.replace(/^\s+(-|\d+\.)\s/, ''));
        else if (/^\s{3,}\S/.test(s)) items.at(-1).text += ` ${s.trim()}`;
        else items.push({ text: s.replace(/^(\d+\.|-)\s/, '') });
        i += 1;
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\||> |(\d+\.|-)\s)/.test(lines[i])) { p.push(lines[i].trim()); i += 1; }
    blocks.push({ t: 'p', text: p.join(' ') });
  }
  const hl = highlight?.trim().toLowerCase();
  const mark = (s) => (hl && s.toLowerCase().includes(hl) ? 'bg-yellow-100 dark:bg-yellow-500/20' : '');
  return (
    <div className="manual mx-auto w-full max-w-7xl space-y-3 text-[14px] leading-relaxed text-ink-800 dark:text-ink-100">
      {blocks.map((b, n) => {
        if (b.t === 'h1') return <h1 key={n} id={slug(b.text)} className="border-b border-ink-200 pb-2 text-[22px] font-bold tracking-tight text-navy-900 dark:border-ink-800 dark:text-white">{inline(b.text)}</h1>;
        if (b.t === 'h2') return <h2 key={n} id={slug(b.text)} className="pt-3 text-[17px] font-bold text-navy-900 dark:text-white">{inline(b.text)}</h2>;
        if (b.t === 'h3') return <h3 key={n} id={slug(b.text)} className="pt-1.5 text-[14px] font-bold text-navy-800 dark:text-ink-100">{inline(b.text)}</h3>;
        if (b.t === 'tip') return <p key={n} className={clsx('flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100', mark(b.text))}><span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-sky-600 text-[10px] font-bold text-white">i</span><span className="min-w-0">{inline(b.text)}</span></p>;
        if (b.t === 'table') return (
          <div key={n} className="overflow-x-auto rounded-md border border-ink-200 dark:border-ink-800"><table className="w-full border-collapse text-[13px]">
            <thead><tr>{b.head.map((c, k) => <th key={k} className="navy-gradient px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-wide text-white uppercase">{inline(c)}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{b.rows.map((r, k) => <tr key={k} className={mark(r.join(' '))}>{r.map((c, j) => <td key={j} className="px-2.5 py-1.5 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table></div>
        );
        if (b.t === 'ol' || b.t === 'ul') {
          const L = b.t;
          return (
            <L key={n} className={clsx('space-y-1 pl-6', L === 'ol' ? 'list-decimal' : 'list-disc')}>
              {b.items.map((it, k) => (
                <li key={k} className={mark(it.text)}>{inline(it.text)}
                  {it.sub && <ul className="mt-1 list-[circle] space-y-0.5 pl-5">{it.sub.map((s, j) => <li key={j} className={mark(s)}>{inline(s)}</li>)}</ul>}
                </li>
              ))}
            </L>
          );
        }
        return <p key={n} className={mark(b.text)}><Fragment>{inline(b.text)}</Fragment></p>;
      })}
    </div>
  );
}
