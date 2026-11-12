/*
 * Excel workbook with the page's charts as pictures next to their numbers.
 * Charts on screen are SVG (recharts); each one is drawn to a PNG and placed in its sheet.
 * Nothing is sent anywhere - the file is built in the browser and downloaded.
 */

/** PNG (base64, no prefix) of the first chart SVG inside an element, on a white background; null if there is none. */
export async function chartPng(el, scale = 2) {
  const svg = el?.querySelector('svg.recharts-surface');
  if (!svg) return null;
  const { width, height } = svg.getBoundingClientRect();
  if (!width || !height) return null;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', width); clone.setAttribute('height', height);
  clone.setAttribute('style', `font-family:${getComputedStyle(document.body).fontFamily};font-size:11px`);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL('image/png').split(',')[1], width, height };
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

/**
 * sheets: [{ name, blocks: [{ title, columns: [{ key, label, money?, width? }], rows, chart?: element }] }]
 * Blocks are written top to bottom; a block's chart picture sits to the right of its table.
 */
export async function downloadWorkbook(filename, { title, subtitle, sheets }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gold Finance'; wb.created = new Date();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name.slice(0, 31));
    let r = 1;
    ws.getCell(r, 1).value = title; ws.getCell(r, 1).font = { bold: true, size: 14 }; r++;
    if (subtitle) { ws.getCell(r, 1).value = subtitle; ws.getCell(r, 1).font = { color: { argb: 'FF6B6B6B' } }; r++; }
    r++;
    for (const b of sh.blocks) {
      if (!b.rows?.length && !b.chart) continue;
      const start = r;
      ws.getCell(r, 1).value = b.title; ws.getCell(r, 1).font = { bold: true, size: 12 }; r++;
      // header
      b.columns.forEach((c, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = c.label; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10252C' } };
        cell.alignment = { horizontal: c.money || c.num ? 'right' : 'left' };
        ws.getColumn(i + 1).width = Math.max(ws.getColumn(i + 1).width || 10, c.width || Math.min(40, Math.max(12, String(c.label).length + 4)));
      });
      r++;
      for (const row of b.rows || []) {
        b.columns.forEach((c, i) => {
          const v = typeof c.value === 'function' ? c.value(row) : row[c.key];
          const cell = ws.getCell(r, i + 1);
          cell.value = v == null ? '' : v;
          if (c.money) cell.numFmt = '#,##,##0.00';
          else if (c.num) cell.numFmt = '0.###';
        });
        r++;
      }
      // the chart picture beside the table
      const png = b.chart ? await chartPng(b.chart) : null;
      if (png) {
        const id = wb.addImage({ base64: png.base64, extension: 'png' });
        const w = Math.min(620, png.width); const h = Math.round((png.height / png.width) * w);
        ws.addImage(id, { tl: { col: b.columns.length + 1, row: start - 1 }, ext: { width: w, height: h } });
        r = Math.max(r, start + Math.ceil(h / 20) + 1);
      }
      r += 2;
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
