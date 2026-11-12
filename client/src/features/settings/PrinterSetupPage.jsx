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
import { PageActions } from '@/components/common/PageActions';

const DOCS = [
  ['LOAN_RECEIPT', 'Loan receipt', 'New loan, re-loan, old loan, duplicate bill'],
  ['RELEASE_RECEIPT', 'Release receipt', 'Loan closure'],
  ['PART_RECEIPT', 'Part payment / top-up receipt', 'Interest, part payment, top-up'],
  ['STICKER', 'Jewel packet sticker', 'A4 sticker sheet'],
  ['NOTICE', 'Auction notices / letters', ''],
  ['REPORT', 'Reports and lists', ''],
  ['DAYEND', 'Day End / cash report', ''],
  ['STICKER_THERMAL', 'Jewel Packet Sticker (Thermal)', 'Label printer roll'],
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
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Printer Setup</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Which paper and how many copies each print uses</p></div>
        <div className="flex gap-1 rounded-md bg-white/10 p-1">{[['docs', 'Printers & paper'], ['bill', 'Bill content'], ['label', 'Label designer']].map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={clsx('rounded px-3 py-1.5 text-sm font-semibold', tab === k ? 'bg-white text-navy-900' : 'text-white')}>{l}</button>)}</div>
      </section>
      {tab === 'label' ? <LabelDesigner /> : tab === 'bill' ? <PrintSettingsPage /> : (
        <>
          <div className="grid items-start gap-3 xl:grid-cols-[1fr_380px]">
            <div className="card overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="px-3 py-2 text-left">Print</th><th className="px-3 text-left">Printer</th><th className="px-3 text-left">Paper</th><th className="px-3 text-right">Copies</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{DOCS.map(([k, l]) => (
                  <tr key={k} onClick={() => setSel(k)} className={clsx('cursor-pointer', sel === k ? 'bg-emerald-50 font-semibold dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}><td className="px-3 py-2 font-semibold">{l}</td><td className="px-3 text-ink-500">Chosen in the print dialog</td><td className="px-3">{v[key(k, 'PAPER')] || 'A4'}</td><td className="num px-3 text-right">{v[key(k, 'COPIES')] || 1}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />{cur[1]}</p>
              <div className="space-y-3 p-4">
                {cur[2] && <p className="text-xs text-ink-500">{cur[2]}</p>}
                <Field label="Paper"><Select value={v[key(sel, 'PAPER')] || 'A4'} onChange={(e) => setV({ ...v, [key(sel, 'PAPER')]: e.target.value })} options={PAPERS} /></Field>
                <Field label="Copies"><Input type="number" min="1" value={v[key(sel, 'COPIES')] || 1} onChange={(e) => setV({ ...v, [key(sel, 'COPIES')]: e.target.value })} /></Field>
                <p className="rounded-md bg-ink-50 dark:bg-ink-800/50 p-3 text-xs text-ink-600">The printer is selected in the browser print window. Tick "Save as PDF" there for PDF files. Your choice is remembered by the browser.</p>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" icon={FileText} onClick={test}>Test Print (F7)</Button><Button icon={Save} onClick={save}>Save (F2)</Button></div>
              </div>
            </div>
          </div>
          <PageActions><Button variant="outline" icon={Printer} onClick={test}>Test print</Button><ExitButton /></PageActions>
        </>
      )}
    </div>
  );
}
