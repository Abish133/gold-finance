import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { date, weight, money0 } from '@/lib/format';

export const barcodeData = (text) => {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, { format: 'CODE128', height: 34, width: 1.4, displayValue: false, margin: 0 });
  return canvas.toDataURL();
};

/** Fields the label designer can switch on / off (Settings > Printer Setup > Label designer). */
export const STICKER_FIELDS = [
  ['company', 'Company name'], ['bill_no', 'Loan no'], ['barcode', 'Barcode'], ['name', 'Customer name'], ['date', 'Loan date'],
  ['weight', 'Net weight'], ['pcs', 'Pieces'], ['items', 'Item names'], ['amount', 'Loan amount'], ['due', 'Due date'], ['phone', 'Mobile'],
];
export const DEFAULT_STICKER_FIELDS = 'company,bill_no,barcode,name,date,weight,pcs,amount';

/** QR code as an SVG (sync, so stickers stay a pure component). */
function Qr({ text, size }) {
  const q = QRCode.create(String(text), { errorCorrectionLevel: 'M' });
  const n = q.modules.size;
  const cells = [];
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (q.modules.get(x, y)) cells.push(`M${x} ${y}h1v1h-1z`);
  return <svg viewBox={`0 0 ${n} ${n}`} style={{ width: size, height: size }} shapeRendering="crispEdges"><path d={cells.join('')} fill="#000" /></svg>;
}

/** Desktop sticker (MyBook): QR, Loan No. + date, Rs, name with relation, gross / net, items. */
function DeskSticker({ l, w, h }) {
  const items = l.items_text || l.item_summary || '';
  return (
    <div style={{ width: `${w}mm`, height: `${h}mm` }} className="flex gap-[1.5mm] overflow-hidden border-2 border-black p-[1.5mm] text-[8px] leading-tight font-semibold">
      <div className="flex flex-col justify-between">
        <Qr text={`LOAN:${l.barcode || l.bill_no}`} size={`${Math.max(10, h - 9)}mm`} />
        <p className="truncate text-[9px] font-bold uppercase">{items},</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex justify-between"><span>Loan No. : {l.bill_no}</span><span>Date {date(l.loan_date)}</span></div>
        <p className="text-[11px] font-bold">Rs : {Number(l.loan_amount ?? l.principal).toFixed(2)}</p>
        <p className="truncate font-serif text-[9px]">{l.customer_name}{l.relation_name ? ` ${l.relation_type || ''} ${l.relation_name}` : ''}</p>
        <div className="flex justify-between"><span>Gross {weight(l.gross_wt)}</span><span>Net : {weight(l.net_wt)}</span></div>
      </div>
    </div>
  );
}

/** Jewel packet stickers - one per loan, size / columns / gap / fields from Print settings. */
export function Stickers({ loans, settings, company }) {
  const w = Number(settings.STICKER_WIDTH_MM || 50);
  const h = Number(settings.STICKER_HEIGHT_MM || 25);
  const cols = Math.max(1, Number(settings.STICKER_COLUMNS || 3));
  const gap = Number(settings.STICKER_GAP_MM ?? 2);
  const on = new Set(String(settings.STICKER_FIELDS || DEFAULT_STICKER_FIELDS).split(',').filter(Boolean));
  const pair = (a, b) => (a || b) && <div className="flex justify-between gap-1"><span className="truncate">{a}</span><span className="shrink-0">{b}</span></div>;
  return (
    <div className="grid text-black" style={{ gridTemplateColumns: `repeat(${cols}, ${w}mm)`, gap: `${gap}mm` }}>
      {loans.map((l) => (settings.STICKER_LAYOUT !== 'CUSTOM' ? <DeskSticker key={l.id} l={l} w={w} h={h} /> : (
        <div key={l.id} style={{ width: `${w}mm`, height: `${h}mm` }} className="flex flex-col justify-between overflow-hidden border border-black p-[1.5mm] text-[8px] leading-tight">
          <div className="flex justify-between font-bold">{on.has('company') && <span className="truncate">{company?.name}</span>}{on.has('bill_no') && <span>#{l.bill_no}</span>}</div>
          {on.has('barcode') && <img src={barcodeData(l.barcode || String(l.bill_no))} alt="" className="h-[8mm] w-full object-fill" />}
          {on.has('items') && <p className="truncate">{l.item_summary}</p>}
          {pair(on.has('name') && l.customer_name, on.has('date') && date(l.loan_date))}
          {pair(on.has('phone') && l.customer_phone, on.has('due') && l.due_date && `Due ${date(l.due_date)}`)}
          <div className="flex justify-between font-bold">
            <span>{[on.has('weight') && `${weight(l.net_wt)} g`, on.has('pcs') && `${l.total_pcs} pcs`].filter(Boolean).join(' · ')}</span>
            {on.has('amount') && <span>{money0(l.principal)}</span>}
          </div>
        </div>
      )))}
    </div>
  );
}
