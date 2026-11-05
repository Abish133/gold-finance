import { useMemo, useState } from 'react';
import { BarChart3, Download, Printer, Play, FileBarChart } from 'lucide-react';
import clsx from 'clsx';
import { Button, Card, DataTable, Empty, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
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

/** Catalogue of server-defined reports; any report renders through one generic viewer. */
export default function ReportsPage() {
  const { data: catalog = [], isLoading } = useFetch('/reports');
  const { data: lk } = useLookups();
  const { data: company } = useCompany();
  const { can, isAllBranches, currentBranch } = useAuth();
  const [key, setKey] = useState(null);
  const [params, setParams] = useState({ from: monthStart(), to: today(), asOn: today(), days: 0 });
  const [run, setRun] = useState(null);
  const def = catalog.find((r) => r.key === key);
  const report = useFetch(run ? `/reports/${run.key}` : null, run?.params);
  const groups = useMemo(() => catalog.reduce((a, r) => ({ ...a, [r.group]: [...(a[r.group] || []), r] }), {}), [catalog]);

  if (isLoading) return <Spinner />;
  const data = report.data;
  const exportAllowed = def && can(def.screen, 'export');

  return (
    <div className="animate-rise">
      <PageHeader icon={BarChart3} title="Reports" subtitle={`${catalog.length} reports available for your role`} />
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card bodyClassName="p-2">
          {Object.entries(groups).map(([g, list]) => (
            <div key={g} className="mb-3">
              <p className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink-400 uppercase">{g}</p>
              {list.map((r) => (
                <button key={r.key} type="button" onClick={() => { setKey(r.key); setRun(null); }}
                  className={clsx('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                    key === r.key ? 'bg-gold-100 text-gold-900 dark:bg-gold-500/15 dark:text-gold-200' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
                  <FileBarChart className="size-4 shrink-0 opacity-60" /> {r.title}
                </button>
              ))}
            </div>
          ))}
        </Card>
        <div className="min-w-0 space-y-4">
          {!def ? <Card><Empty icon={BarChart3} title="Pick a report" message="Choose a report on the left, set the filters and press Run." /></Card> : (
            <>
              <Card title={def.title} subtitle={def.description}>
                <div className="flex flex-wrap items-end gap-3">
                  {def.params.includes('from') && <Field label="From"><Input type="date" value={params.from} onChange={(e) => setParams({ ...params, from: e.target.value })} /></Field>}
                  {def.params.includes('to') && <Field label="To"><Input type="date" value={params.to} onChange={(e) => setParams({ ...params, to: e.target.value })} /></Field>}
                  {def.params.includes('asOn') && <Field label="As on"><Input type="date" value={params.asOn} onChange={(e) => setParams({ ...params, asOn: e.target.value })} /></Field>}
                  {def.params.includes('days') && <Field label="Maturing within (days)"><Input type="number" className="w-32" value={params.days} onChange={(e) => setParams({ ...params, days: e.target.value })} /></Field>}
                  {def.params.includes('metal') && <Field label="Metal"><Select className="w-36" value={params.metal || ''} onChange={(e) => setParams({ ...params, metal: e.target.value })} placeholder="All" options={(lk?.metals || []).map((m) => ({ value: m.id, label: m.name }))} /></Field>}
                  {def.params.includes('scheme') && <Field label="Scheme"><Select className="w-36" value={params.scheme || ''} onChange={(e) => setParams({ ...params, scheme: e.target.value })} placeholder="All" options={(lk?.schemes || []).map((m) => ({ value: m.id, label: m.code }))} /></Field>}
                  {def.params.includes('status') && <Field label="Status"><Select className="w-36" value={params.status || ''} onChange={(e) => setParams({ ...params, status: e.target.value })} placeholder="All" options={['ACTIVE', 'BLOCKED']} /></Field>}
                  <Button variant="gold" icon={Play} loading={report.isFetching} onClick={() => setRun({ key: def.key, params: { ...params, _t: Date.now() } })}>Run</Button>
                  {data && (
                    <div className="ml-auto flex gap-2">
                      {exportAllowed && <Button variant="outline" icon={Download} onClick={() => exportCsv(def.key, data.columns, data.rows, data.totals)}>Excel</Button>}
                      <Button variant="outline" icon={Printer} onClick={() => printElement(<PrintableReport report={data} company={company} branch={isAllBranches ? 'All branches' : currentBranch?.name} />, { title: data.title })}>Print</Button>
                    </div>
                  )}
                </div>
              </Card>
              {run && <DataTable dense columns={data?.columns || []} rows={data?.rows || []} loading={report.isLoading} totals={data?.totals} rowKey="__i" />}
              {data && <p className="text-xs text-ink-400">{data.count} rows</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
