import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, Eye, FileDown, FileSpreadsheet, Calculator, Search } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { useFetch, useCompany, useSettings } from '@/hooks/useApi';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, date, n, today } from '@/lib/format';
import { ExitButton, Line, useKeys, useAutoMode, AutoManualSwitch } from './desk';
import QuoteCalculator from './InterestCalculatorPage';
import { PageActions } from '@/components/common/PageActions';

const cols = [
  { key: 'bill_no', label: 'Loan', render: (r) => <b>{r.bill_no}</b> }, { key: 'loan_date', label: 'Pledged', type: 'date' }, { key: 'customer_name', label: 'Customer' },
  { key: 'loan_on', label: 'Metal' }, { key: 'principal', label: 'Loan Amt', type: 'money' }, { key: 'interest_rate', label: 'ROI %', type: 'number' },
  { key: 'interest_type', label: 'Type', render: (r) => (r.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'), print: (r) => (r.interest_type === 'COMPOUND' ? 'Compound' : 'Flat') }, { key: 'months', label: 'Months', type: 'number' },
  { key: 'part_paid', label: 'Part Paid', render: (r) => (n(r.part_paid) ? amount(r.part_paid) : ''), print: (r) => (n(r.part_paid) ? r.part_paid : '') }, { key: 'interest_due', label: 'Interest Due', type: 'money' }, { key: 'total_due', label: 'Total Due', type: 'money' },
];

const Dot = () => (
  <span className="relative flex size-1.5" aria-hidden>
    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
  </span>
);

/** Interest Calculation (desktop: frmInterestCalculation) - interest due on open loans up to a date. */
export default function InterestDuePage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const [tab, setTab] = useState('due');
  const { data: settings } = useSettings();
  const overdueMonths = n(settings?.AUCTION_OVERDUE_MONTHS) || 12;
  const [f, setF] = useState({ from: dayjs(today()).subtract(1, 'year').format('YYYY-MM-DD'), to: today(), upto: today(), loan_on: '', where: '', older: 0, search: '' });
  const [q, setQ] = useState(f);
  const [autoSearch, setAutoSearch] = useAutoMode('interestSearch');
  // auto: the search box filters once typing pauses (other filters still wait for Calculate)
  useEffect(() => {
    if (!autoSearch || f.search === q.search) return undefined;
    const t = setTimeout(() => setQ((x) => ({ ...x, search: f.search })), 450);
    return () => clearTimeout(t);
  }, [f.search, autoSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isFetching, refetch } = useFetch(tab === 'due' ? '/desk/interest-due' : null, q);
  const [sel, setSel] = useState(null);
  const rows = data?.rows || [];
  const s = data?.summary;
  const preview = () => printTable({ title: `Interest due up to ${date(q.upto)}`, company, columns: cols, rows, totals: { loan_due: s?.loanDue, interest_due: s?.interestDue, total_due: s?.totalDue, part_paid: s?.partPaid } });
  useKeys({ f3: () => document.getElementById('interest-search')?.focus(), f5: () => setQ(f), 'ctrl+r': () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('interest-due', cols, rows), escape: () => navigate('/') }, [f, rows]);
  const seg = (k, opts) => (
    <div className="flex">
      {opts.map(([v, l]) => (
        <button key={String(v)} type="button" onClick={() => setF({ ...f, [k]: v })}
          className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold first:ml-0 first:rounded-l-md last:rounded-r-md',
            f[k] === v ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>
          {f[k] === v && <Dot />}{l}
        </button>
      ))}
    </div>
  );
  const sum = (k) => rows.reduce((acc, r) => acc + n(r[k]), 0);
  const NUM = ['principal', 'interest_rate', 'months', 'part_paid', 'interest_due', 'total_due'];

  return (
    /* fit-screen: on desktop the page fits the window; the table and the loan panel scroll on their own */
    <div className={clsx('animate-rise flex flex-col gap-2', tab === 'due' && 'desk fit-screen xl:min-h-0 xl:flex-1')}>
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-lg font-bold whitespace-nowrap">Interest Calculation</h1>
          <p className="hidden truncate text-[12px] text-white/60 lg:block">Interest due on open loans up to a date</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/20">
          {[['due', 'Open loans interest due'], ['quote', 'Quote a customer']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              className={clsx('flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold transition', tab === v ? 'bg-white text-navy-900' : 'text-white/75 hover:bg-white/10')}>
              {v === 'quote' && <Calculator className="size-3.5" />}{l}
            </button>
          ))}
        </div>
      </section>
      {tab === 'quote' ? <QuoteCalculator embedded /> : (
        <>
          {/* filters */}
          <div className="flex shrink-0 flex-wrap items-end gap-x-3 gap-y-2 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
            <Field label="Pledged from"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            <Field label="Interest up to"><Input type="date" className="!h-8 w-36 text-[13px]" value={f.upto} onChange={(e) => setF({ ...f, upto: e.target.value })} /></Field>
            <div><p className="label">Metal</p>{seg('loan_on', [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver'], ['MIX', 'Mix']])}</div>
            <div><p className="label">Where</p>{seg('where', [['', 'All'], ['hand', 'In hand'], ['bank', 'At bank']])}</div>
            <div><p className="label">Older than</p>{seg('older', [[0, 'Any'], [6, '6 m'], [9, '9 m'], [12, '12 m']])}</div>
            <div className="min-w-48 flex-1"><div className="mb-0.5 flex items-center justify-between gap-2"><p className="label mb-0">Search (F3)</p><AutoManualSwitch value={autoSearch} onChange={setAutoSearch} /></div>
              <Input id="interest-search" prefix={<Search className="size-3.5" />} className="!h-8 text-[13px]" placeholder={autoSearch ? 'Loan no / customer - filters as you type' : 'Loan no / customer - press Enter'} value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setQ(f)} />
            </div>
            <Button className="h-8" icon={Calculator} loading={isFetching} onClick={() => setQ(f)}>Calculate (F5)</Button>
          </div>

          {/* figures */}
          <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-5 dark:border-ink-800 dark:bg-ink-900">
            {[['Open loans', s?.open || 0, `${s?.over12 || 0} over 12 months`, 'bg-navy-900 dark:bg-white'], ['Loan amount due', amount(s?.loanDue || 0), `part paid ${amount(s?.partPaid || 0)}`, 'bg-blue-600'],
              ['Interest due', amount(s?.interestDue || 0), `up to ${date(q.upto)}`, 'bg-amber-500'], ['Total due', amount(s?.totalDue || 0), 'loan amount + interest', 'bg-emerald-600'],
              ['Average age', `${n(s?.avgAge || 0).toFixed(1)} m`, 'by loan amount', 'bg-ink-400']].map(([l, v, h, bar]) => (
              <div key={l} className="relative border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
                <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} />
                <p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
                <p className="num text-lg leading-tight font-bold text-navy-900 dark:text-white">{v}</p>
                <p className="truncate text-[10px] text-ink-500">{h}</p>
              </div>
            ))}
          </div>

          <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_300px]">
            {/* loans - header and total stay while rows scroll */}
            <div className="min-h-64 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
              <table className="w-full min-w-[900px] text-[12px]">
                <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase">
                  <tr>{cols.map((c) => <th key={c.key} className={clsx('px-2.5 py-1.5 font-semibold', NUM.includes(c.key) ? 'text-right' : 'text-left')}>{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {isFetching && !data && <tr><td colSpan={cols.length} className="py-10 text-center text-ink-400">Calculating…</td></tr>}
                  {data && !rows.length && <tr><td colSpan={cols.length} className="py-10 text-center text-ink-400">No open loans for these filters</td></tr>}
                  {rows.map((r) => {
                    const old = r.months > overdueMonths;
                    return (
                      <tr key={r.id} onClick={() => setSel(r)} onDoubleClick={() => navigate(`/loans/counter?loan=${r.id}`)} title="Click to see the breakdown · double-click to open the loan"
                        className={clsx('cursor-pointer', sel?.id === r.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : old ? 'bg-rose-50/60 hover:bg-rose-50 dark:bg-rose-950/20' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                        <td className={clsx('num border-l-2 px-2.5 py-1 font-bold', sel?.id === r.id ? 'border-emerald-600' : 'border-transparent')}>{r.bill_no}</td>
                        <td className="num px-2.5">{date(r.loan_date)}</td>
                        <td className="max-w-40 truncate px-2.5 font-medium">{r.customer_name}</td>
                        <td className="px-2.5"><span className={clsx('rounded-sm px-1.5 text-[10px] font-bold', r.loan_on === 'SILVER' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800')}>{r.loan_on}</span></td>
                        <td className="num px-2.5 text-right">{amount(r.principal)}</td>
                        <td className="num px-2.5 text-right">{n(r.interest_rate)}</td>
                        <td className="px-2.5 text-ink-500">{r.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'}</td>
                        <td className={clsx('num px-2.5 text-right', old && 'font-bold text-rose-600')}>{r.months}</td>
                        <td className="num px-2.5 text-right text-ink-500">{n(r.part_paid) ? amount(r.part_paid) : ''}</td>
                        <td className="num px-2.5 text-right font-semibold text-rose-600">{amount(r.interest_due)}</td>
                        <td className="num px-2.5 text-right font-bold">{amount(r.total_due)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-100">
                    <tr>
                      <td colSpan={4} className="px-2.5 py-1.5">Total · {rows.length} loan{rows.length === 1 ? '' : 's'}</td>
                      <td className="num px-2.5 text-right">{amount(sum('principal'))}</td><td colSpan={3} />
                      <td className="num px-2.5 text-right">{amount(sum('part_paid'))}</td>
                      <td className="num px-2.5 text-right">{amount(sum('interest_due'))}</td>
                      <td className="num px-2.5 text-right">{amount(sum('total_due'))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* selected loan breakdown */}
            <section className="flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
              <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white">
                <span aria-hidden className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />
                <span className="truncate">{sel ? `Loan ${sel.bill_no} · ${sel.customer_name}` : 'Select a loan'}</span>
              </header>
              {!sel ? (
                <div className="grid flex-1 place-items-center p-4 text-center text-[12px] text-ink-400">Click a loan in the table to see how its interest is worked out.</div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 [&_.box>div]:py-0.5 [&_.box>div]:text-[12px]">
                  <div className="box rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800">
                    <Line label="Pledged" value={date(sel.loan_date)} />
                    <Line label="Items" value={(sel.items_text || '').toUpperCase() || `${sel.total_items} · ${n(sel.net_wt).toFixed(3)} g`} />
                    <Line label="ROI / type" value={`${n(sel.interest_rate).toFixed(2)} %${sel.rate_type === 'MONTHLY' ? '' : ' p.a.'} · ${sel.interest_type === 'COMPOUND' ? 'Compound' : 'Flat'}`} />
                    <Line label="Months (T / P / D)" value={`${sel.months} / ${sel.months_paid} / ${Math.max(0, sel.months_due - sel.months_paid)}`} />
                  </div>
                  <p className="-mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Loan amount</p>
                  <div className="box rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800">
                    <Line label="Loan amount" value={amount(sel.principal)} />
                    <Line minus label="Part paid" value={amount(sel.part_paid)} />
                    <Line label="Loan amount due" value={amount(sel.loan_due)} bold />
                  </div>
                  <p className="-mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Interest</p>
                  <div className="box rounded-md border border-ink-200 px-2.5 py-1 dark:border-ink-800">
                    <Line label="Total interest" value={amount(sel.total_interest)} />
                    <Line minus label="Advance interest" value={amount(sel.advance)} />
                    <Line minus label="Paid earlier" value={amount(sel.paid_earlier)} />
                    <Line label="Interest due" value={amount(sel.interest_due)} bold />
                  </div>
                  <div className="mt-auto space-y-2 pt-1">
                    <div className="navy-gradient flex items-baseline justify-between rounded-md px-3 py-2 text-white">
                      <span className="text-[10px] font-bold tracking-wider uppercase opacity-70">Total due</span>
                      <span className="num text-xl font-extrabold">{amount(sel.total_due)}</span>
                    </div>
                    <Button variant="gold" className="h-9 w-full" onClick={() => navigate(`/loans/part-payment?loan=${sel.id}`)}>Receive interest</Button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <PageActions>
            <p className="hidden min-w-0 flex-1 truncate px-1 text-[11px] text-ink-400 2xl:block">Rows in red are over {overdueMonths} months · click = breakdown · double-click = open loan</p>
            <span className="flex-1 2xl:hidden" />
            <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (Ctrl+R)</Button>
            <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
            <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('interest-due', cols, rows)}>Excel (Ctrl+E)</Button>
            <ExitButton />
          </PageActions>
        </>
      )}
    </div>
  );
}
