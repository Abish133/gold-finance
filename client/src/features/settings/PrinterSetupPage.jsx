import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Printer, Save, FileText } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Field, Input, Select } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { ExitButton, useKeys } from '@/features/loans/desk';
import PrintSettingsPage from './PrintSettingsPage';
import LabelDesigner from './LabelDesigner';

const DOCS = [
  ['LOAN_RECEIPT', 'Loan receipt', 'New loan, re-loan, old loan, duplicate bill'],
  ['RELEASE_RECEIPT', 'Release receipt', 'Loan closure'],
  ['PART_RECEIPT', 'Part payment / top-up receipt', 'Interest, part payment, top-up'],
  ['NOTICE', 'Auction notices / letters', ''],
  ['REPORT', 'Reports and lists', ''],
  ['DAYEND', 'Day End / cash report', ''],
];
const PAPERS = ['A4', 'A5', 'Letter', '80mm roll', '58mm roll'];

/** Printer Setup (desktop: frmPrinterSetup). Browsers pick the printer in their print dialog, so here we keep paper and copies per document. */
export default function PrinterSetupPage() {
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const { data } = useFetch('/admin/settings', { scope: 'global' });
  const [v, setV] = useState({});
  const [sel, setSel] = useState('LOAN_RECEIPT');
  const [tab, setTab] = useState('docs');
  useEffect(() => { if (data) setV(data); }, [data]);
  const key = (d, f) => `PRINT_${d}_${f}`;
  const save = async () => {
    try { await api.put('/admin/settings?scope=global', Object.fromEntries(DOCS.flatMap(([d]) => [[key(d, 'PAPER'), v[key(d, 'PAPER')] || 'A4'], [key(d, 'COPIES'), v[key(d, 'COPIES')] || '1']]).filter(([k]) => k in (data || {})))); toast.success('Printer setup saved'); qc.invalidateQueries({ queryKey: ['/admin/settings'] }); } catch (e) { toast.error(e.message); }
  };
  const test = () => printElement(<div className="p-6 text-black"><p className="text-xl font-bold">{company?.name}</p><p>Test print · {DOCS.find((d) => d[0] === sel)[1]} · paper {v[key(sel, 'PAPER')] || 'A4'}</p></div>, { title: 'Test print' });
  useKeys({ f2: save, f7: test }, [v, sel]);
  const cur = DOCS.find((d) => d[0] === sel);
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient flex items-center gap-3 rounded-md px-5 py-3 text-white">
        <div className="flex-1"><h1 className="text-2xl font-bold">Printer Setup</h1><p className="text-sm text-navy-100">Which paper and how many copies each print uses</p></div>
        <div className="flex gap-1 rounded-md bg-white/10 p-1">{[['docs', 'Printers & paper'], ['bill', 'Bill content'], ['label', 'Label designer']].map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={clsx('rounded px-3 py-1.5 text-sm font-semibold', tab === k ? 'bg-white text-navy-900' : 'text-white')}>{l}</button>)}</div>
      </section>
      {tab === 'label' ? <LabelDesigner /> : tab === 'bill' ? <PrintSettingsPage /> : (
        <>
          <div className="grid items-start gap-3 xl:grid-cols-[1fr_380px]">
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="navy-gradient text-white"><tr><th className="px-3 py-2 text-left">Print</th><th className="px-3 text-left">Printer</th><th className="px-3 text-left">Paper</th><th className="px-3 text-right">Copies</th></tr></thead>
                <tbody className="divide-y divide-ink-200">{DOCS.map(([k, l]) => (
                  <tr key={k} onClick={() => setSel(k)} className={clsx('cursor-pointer hover:bg-navy-50/50', sel === k && 'bg-cream-200')}><td className="px-3 py-2 font-semibold">{l}</td><td className="px-3 text-ink-500">Chosen in the print dialog</td><td className="px-3">{v[key(k, 'PAPER')] || 'A4'}</td><td className="num px-3 text-right">{v[key(k, 'COPIES')] || 1}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">{cur[1]}</p>
              <div className="space-y-3 p-4">
                {cur[2] && <p className="text-xs text-ink-500">{cur[2]}</p>}
                <Field label="Paper"><Select value={v[key(sel, 'PAPER')] || 'A4'} onChange={(e) => setV({ ...v, [key(sel, 'PAPER')]: e.target.value })} options={PAPERS} /></Field>
                <Field label="Copies"><Input type="number" min="1" value={v[key(sel, 'COPIES')] || 1} onChange={(e) => setV({ ...v, [key(sel, 'COPIES')]: e.target.value })} /></Field>
                <p className="rounded-md bg-cream-100 p-3 text-xs text-ink-600">The printer is selected in the browser print window. Tick "Save as PDF" there for PDF files. Your choice is remembered by the browser.</p>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" icon={FileText} onClick={test}>Test Print (F7)</Button><Button icon={Save} onClick={save}>Save (F2)</Button></div>
              </div>
            </div>
          </div>
          <div className="card flex justify-end gap-2 px-3 py-2"><Button variant="outline" icon={Printer} onClick={test}>Test print</Button><ExitButton /></div>
        </>
      )}
    </div>
  );
}
