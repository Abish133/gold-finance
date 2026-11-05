import { formatCell } from './format';

/** Export rows to an Excel-friendly CSV (UTF-8 BOM keeps Tamil text intact). */
export const exportCsv = (filename, columns, rows, totals) => {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(c.type === 'date' ? formatCell(r[c.key], 'date') : r[c.key])).join(','));
  if (totals) lines.push(columns.map((c, i) => esc(i === 0 ? 'TOTAL' : totals[c.key] ?? '')).join(','));
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${filename}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
};
