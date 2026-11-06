import clsx from 'clsx';
import { printElement } from './print';
import { formatCell, date } from './format';

/** A4 landscape-friendly table print used by registers and reports (Print Preview / PDF). */
export function PrintableTable({ title, subtitle, company, columns, rows, totals }) {
  return (
    <div className="p-1 text-[10.5px] text-black">
      <div className="mb-2 border-b-2 border-black pb-1 text-center">
        <p className="text-base font-bold">{company?.name}</p>
        <p className="text-[12px] font-semibold">{title}</p>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <table className="w-full border-collapse">
        <thead><tr>{columns.map((c) => <th key={c.key} className="border border-black bg-gray-100 px-1 py-0.5 text-left">{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className={clsx('border border-black px-1 py-0.5', ['money', 'weight', 'number'].includes(c.type) && 'text-right')}>{c.print ? c.print(r, i) : formatCell(r[c.key], c.type)}</td>)}</tr>)}</tbody>
        {totals && (
          <tfoot><tr className="font-bold">{columns.map((c, i) => <td key={c.key} className="border border-black px-1 py-0.5 text-right">{i === 0 ? 'Total' : totals[c.key] !== undefined ? formatCell(totals[c.key], c.type) : ''}</td>)}</tr></tfoot>
        )}
      </table>
      <p className="mt-2 text-right text-[9px]">Printed on {date(new Date())}</p>
    </div>
  );
}

export const printTable = (props) => printElement(<PrintableTable {...props} />, { title: props.title });
