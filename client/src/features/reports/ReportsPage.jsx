import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BarChart3, Download, Printer, Play, FileBarChart, Search, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Button, DataTable, Empty, Field, Input, Select, Spinner } from '@/components/ui';
import { useFetch, useLookups, useCompany } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { exportCsv } from '@/lib/exporters';
import { printElement } from '@/lib/print';
import { formatCell, monthStart, today, date } from '@/lib/format';

function PrintableReport({ report, company, branch }) {
  return (
    <div className="p-2 text-[11px] text-black">
      <div className="mb-2 border-b border-black pb-1 text-center">
        <p className="text-base font-bold">{company?.name}</p>
        <p className="font-semibold">{report.title}</p>
        <p>{branch} · {report.params.from ? `${date(report.params.from)} to ${date(report.params.to)}` : `As on ${date(report.params.asOn)}`}</p>
      </div>
      <table className="w-full border-collapse">
        <thead><tr>{report.columns.map((c) => <th key={c.key} className="border border-black px-1 py-0.5 text-left">{c.label}</th>)}</tr></thead>
        <tbody>{report.rows.map((r, i) => <tr key={i}>{report.columns.map((c) => <td key={c.key} className={clsx('border border-black px-1 py-0.5', ['money', 'weight', 'number'].includes(c.type) && 'text-right')}>{formatCell(r[c.key], c.type)}</td>)}</tr>)}</tbody>
        <tfoot><tr className="font-bold">{report.columns.map((c, i) => <td key={c.key} className="border border-black px-1 py-0.5 text-right">{i === 0 ? 'Total' : report.totals[c.key] !== undefined ? formatCell(report.totals[c.key], c.type) : ''}</td>)}</tr></tfoot>
      </table>
    </div>
  );
}

const hi = (text, t) => {
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-700/60">{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length)}</>;
};

/** Catalogue of server-defined reports; any report renders through one generic viewer. */
export default function ReportsPage() {
  const { data: catalog = [], isLoading } = useFetch('/reports');
  const { data: lk } = useLookups();
  const { data: company } = useCompany();
  const { can, isAllBranches, currentBranch } = useAuth();
  const [sp] = useSearchParams();
  const [key, setKey] = useState(sp.get('key'));
  useEffect(() => { if (sp.get('key')) { setKey(sp.get('key')); setRun(null); } }, [sp]);
  const [params, setParams] = useState({ from: monthStart(), to: today(), asOn: today(), days: 0 });
  const [run, setRun] = useState(null);
  const def = catalog.find((r) => r.key === key);
  const report = useFetch(run ? `/reports/${run.key}` : null, run?.params);
  const [find, setFind] = useState('');
  // search matches the report name, its description or its group
  const groups = useMemo(() => {
    const t = find.trim().toLowerCase();
    const list = t ? catalog.filter((r) => `${r.title} ${r.description || ''} ${r.group}`.toLowerCase().includes(t)) : catalog;
    return list.reduce((a, r) => ({ ...a, [r.group]: [...(a[r.group] || []), r] }), {});
  }, [catalog, find]);
  const found = Object.values(groups).flat();
  // accordion: groups you opened; the group of the chosen report is always open, and searching opens them all
  const [fold, setFold] = useState({}); // group -> true (opened by hand) / false (closed by hand)
  const isOpen = (g, list) => {
    if (find.trim()) return true;
    if (fold[g] !== undefined) return fold[g];
    return list.some((r) => r.key === key) || (!key && g === Object.keys(groups)[0]);
  };
  const toggle = (g, list) => setFold((x) => ({ ...x, [g]: !isOpen(g, list) }));

  if (isLoading) return <Spinner />;
  const data = report.data;
  const exportAllowed = def && can(def.screen, 'export');

  return (
    /* fit-screen: the page fits the window; the report list and the result scroll on their own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <BarChart3 className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Reports</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">{catalog.length} reports available for your role</p></div>
      </section>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[260px_1fr]">
        {/* report list */}
        <nav className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
          <div className="shrink-0 border-b border-ink-100 p-1.5 dark:border-ink-800">
            <Input autoFocus prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder={`Search ${catalog.length} reports…`} value={find}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && found[0]) { setKey(found[0].key); setRun(null); } if (e.key === 'Escape' && find) { e.stopPropagation(); setFind(''); } }} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {!found.length && <p className="px-2 py-6 text-center text-[12px] text-ink-400">No report matches “{find}”</p>}
          {Object.entries(groups).map(([g, list]) => {
            const open = isOpen(g, list);
            const has = list.some((r) => r.key === key);
            return (
            <div key={g} className="mb-1 overflow-hidden rounded-md border border-ink-200 last:mb-0 dark:border-ink-800">
              <button type="button" onClick={() => toggle(g, list)} aria-expanded={open}
                className={clsx('flex w-full items-center gap-2 px-2.5 py-2 text-left transition', open ? 'bg-ink-50 dark:bg-ink-800/60' : 'hover:bg-ink-50 dark:hover:bg-ink-800/40')}>
                <span className="flex-1 truncate text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{g}</span>
                {has && !open && <span className="size-1.5 rounded-full bg-emerald-600" />}
                <span className="num rounded-sm bg-white px-1.5 text-[10px] font-bold text-ink-500 ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-700">{list.length}</span>
                <ChevronDown className={clsx('size-4 text-ink-400 transition-transform duration-200', open && 'rotate-180')} />
              </button>
              {/* smooth open / close */}
              <div className={clsx('grid transition-[grid-template-rows] duration-200', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="min-h-0 overflow-hidden">
              <div className="space-y-0.5 border-t border-ink-100 p-1 dark:border-ink-800">
              {list.map((r) => (
                <button key={r.key} type="button" onClick={() => { setKey(r.key); setRun(null); }}
                  className={clsx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition',
                    key === r.key ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                  {key === r.key ? <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span> : <FileBarChart className="size-3.5 shrink-0 opacity-50" />}<span className="truncate">{find.trim() ? hi(r.title, find.trim()) : r.title}</span>
                </button>
              ))}
              </div>
              </div>
              </div>
            </div>
            );
          })}
          </div>
        </nav>
        <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
          {!def ? (
            <div className="grid flex-1 place-items-center rounded-md border border-dashed border-ink-300 bg-white py-16 dark:border-ink-700 dark:bg-ink-900">
              <Empty icon={BarChart3} title="Pick a report" message="Choose a report on the left, set the filters and press Run." />
            </div>
          ) : (
            <>
              <div className="shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
                <div className="mb-1.5 flex items-baseline gap-2"><p className="text-[13px] font-bold text-navy-900 dark:text-white">{def.title}</p><p className="truncate text-[11px] text-ink-500">{def.description}</p></div>
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                  {def.params.includes('from') && <Field label="From"><Input type="date" className="!h-8 w-36 text-[13px]" value={params.from} onChange={(e) => setParams({ ...params, from: e.target.value })} /></Field>}
                  {def.params.includes('to') && <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={params.to} onChange={(e) => setParams({ ...params, to: e.target.value })} /></Field>}
                  {def.params.includes('asOn') && <Field label="As on"><Input type="date" className="!h-8 w-36 text-[13px]" value={params.asOn} onChange={(e) => setParams({ ...params, asOn: e.target.value })} /></Field>}
                  {def.params.includes('days') && <Field label="Maturing within (days)"><Input type="number" className="!h-8 w-28 text-[13px]" value={params.days} onChange={(e) => setParams({ ...params, days: e.target.value })} /></Field>}
                  {def.params.includes('metal') && <Field label="Metal"><Select className="!h-8 w-36 text-[13px]" value={params.metal || ''} onChange={(e) => setParams({ ...params, metal: e.target.value })} placeholder="All" options={(lk?.metals || []).map((m) => ({ value: m.id, label: m.name }))} /></Field>}
                  {def.params.includes('scheme') && <Field label="Scheme"><Select className="!h-8 w-36 text-[13px]" value={params.scheme || ''} onChange={(e) => setParams({ ...params, scheme: e.target.value })} placeholder="All" options={(lk?.schemes || []).map((m) => ({ value: m.id, label: m.code }))} /></Field>}
                  {def.params.includes('status') && <Field label="Status"><Select className="!h-8 w-36 text-[13px]" value={params.status || ''} onChange={(e) => setParams({ ...params, status: e.target.value })} placeholder="All" options={['ACTIVE', 'BLOCKED']} /></Field>}
                  <Button variant="gold" size="sm" className="h-8 px-3 text-[12px]" icon={Play} loading={report.isFetching} onClick={() => setRun({ key: def.key, params: { ...params, _t: Date.now() } })}>Run</Button>
                  {data && (
                    <div className="ml-auto flex items-center gap-2 [&_button]:h-8 [&_button]:text-[12px]">
                      <span className="text-[11px] text-ink-500">{data.count} rows</span>
                      {exportAllowed && <Button variant="outline" icon={Download} onClick={() => exportCsv(def.key, data.columns, data.rows, data.totals)}>Excel</Button>}
                      <Button variant="outline" icon={Printer} onClick={() => printElement(<PrintableReport report={data} company={company} branch={isAllBranches ? 'All branches' : currentBranch?.name} />, { title: data.title })}>Print</Button>
                    </div>
                  )}
                </div>
              </div>
              {run ? <DataTable fill columns={data?.columns || []} rows={data?.rows || []} loading={report.isLoading} totals={data?.totals} rowKey="__i" />
                : <div className="grid flex-1 place-items-center rounded-md border border-dashed border-ink-300 bg-white py-12 text-[12px] text-ink-400 dark:border-ink-700 dark:bg-ink-900">Set the filters and press Run.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
