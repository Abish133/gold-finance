import { toast } from 'sonner';

const toDate = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))) : null;
};
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const FMT = { money: '#,##0.00', weight: '0.000', date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm' };
const NAVY = 'FF0F1E3C';

const cellValue = (c, r) => {
  const v = r[c.exportKey || c.key];
  if (c.type === 'money' || c.type === 'weight' || c.type === 'number') return num(v) ?? (v ?? '');
  if (c.type === 'date' || c.type === 'datetime') return toDate(v) ?? (v ?? '');
  return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
};

/**
 * Export rows to a real Excel workbook (.xlsx): title, header row, number / date formats, totals row.
 * Money and weight stay numbers so the shop can add them up in Excel.
 */
export const exportExcel = async (filename, columns, rows = [], totals) => {
  try {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const title = String(filename || 'export').replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.addRow([title]).font = { bold: true, size: 14 };
    ws.addRow([`Generated ${new Date().toLocaleString('en-IN')} · ${rows.length} rows`]).font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
    const head = ws.addRow(columns.map((c) => c.label));
    head.eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; cell.alignment = { vertical: 'middle' }; });
    for (const r of rows) ws.addRow(columns.map((c) => cellValue(c, r)));
    const sums = totals || Object.fromEntries(columns.filter((c) => c.type === 'money' || c.type === 'weight').map((c) => [c.key, rows.reduce((t, r) => t + (num(r[c.exportKey || c.key]) || 0), 0)]));
    if (rows.length && Object.keys(sums).length) {
      const t = ws.addRow(columns.map((c, i) => (i === 0 ? 'TOTAL' : sums[c.key] ?? '')));
      t.font = { bold: true };
      t.eachCell((cell) => { cell.border = { top: { style: 'thin' } }; });
    }
    columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (FMT[c.type]) col.numFmt = FMT[c.type];
      if (['money', 'weight', 'number'].includes(c.type)) col.alignment = { horizontal: 'right' };
      const longest = Math.max(String(c.label).length, ...rows.slice(0, 300).map((r) => String(r[c.exportKey || c.key] ?? '').length));
      col.width = Math.min(50, Math.max(10, longest + 2));
    });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${filename}.xlsx` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) {
    toast.error(`Excel export failed: ${e.message}`);
  }
};

/** Older name kept for the export buttons: now writes .xlsx too. */
export const exportCsv = exportExcel;
