import JsBarcode from 'jsbarcode';
import { date, weight, money0 } from '@/lib/format';

export const barcodeData = (text) => {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, { format: 'CODE128', height: 34, width: 1.4, displayValue: false, margin: 0 });
  return canvas.toDataURL();
};

/** Jewel packet stickers - one per loan, sized from Print settings. */
export function Stickers({ loans, settings, company }) {
  const w = Number(settings.STICKER_WIDTH_MM || 50);
  const h = Number(settings.STICKER_HEIGHT_MM || 25);
  return (
    <div className="flex flex-wrap gap-[2mm] text-black">
      {loans.map((l) => (
        <div key={l.id} style={{ width: `${w}mm`, height: `${h}mm` }} className="flex flex-col justify-between overflow-hidden border border-black p-[1.5mm] text-[8px] leading-tight">
          <div className="flex justify-between font-bold"><span className="truncate">{company?.name}</span><span>#{l.bill_no}</span></div>
          <img src={barcodeData(l.barcode || String(l.bill_no))} alt="" className="h-[8mm] w-full object-fill" />
          <div className="flex justify-between"><span className="truncate">{l.customer_name}</span><span>{date(l.loan_date)}</span></div>
          <div className="flex justify-between font-bold"><span>{weight(l.net_wt)} g · {l.total_pcs} pcs</span><span>{money0(l.principal)}</span></div>
        </div>
      ))}
    </div>
  );
}
