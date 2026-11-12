import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Wand2, FileDown, Printer, FileSpreadsheet, Save } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line as RLine, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input } from '@/components/ui';
import { useFetch, useCompany, useSettings } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { amount, n, today, round2 } from '@/lib/format';
import { ExitButton, useKeys } from '@/features/loans/desk';
import { PageActions } from '@/components/common/PageActions';

/** Metal Rate Update (desktop: frmRateMaster) - today's board rate per purity. */
export default function RateBoardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const { data: settings } = useSettings();
  // opened from Day End with ?date=<new billing date> (desktop opens Rate Update after closing a day)
  const [d, setD] = useState(() => new URLSearchParams(window.location.search).get('date') || today());
  const { data, refetch } = useFetch('/desk/rate-board', { date: d });
  const [rows, setRows] = useState([]);
  const [hist, setHist] = useState('GOLD');
  const ltv = n(settings?.LTV_SAFE_PERCENT || 75);
  useEffect(() => { if (data) setRows(data.rows.map((r) => ({ ...r, today: r.today ?? '', today_loan: r.today_loan ?? '' }))); }, [data]);
  const set = (i, patch) => setRows((l) => l.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const copyPrev = () => setRows((l) => l.map((r) => ({ ...r, today: r.previous ?? r.today, today_loan: r.previous_loan ?? r.today_loan })));
  const auto = () => setRows((l) => {
    const base = Object.fromEntries(l.filter((r) => n(r.purity) >= 99.5 && n(r.today)).map((r) => [r.metal_id, n(r.today)]));
    if (!Object.keys(base).length) { toast.error('Enter the 100% (fine) rate first'); return l; }
    return l.map((r) => (base[r.metal_id] && n(r.purity) < 99.5 ? { ...r, today: round2((base[r.metal_id] * n(r.purity)) / 100) } : r));
  });
  const save = async () => {
    try {
      await api.post('/desk/rate-board', { date: d, rows: rows.map((r) => ({ metal_id: r.metal_id, purity: r.purity, today: r.today, today_loan: r.today_loan || round2((n(r.today) * ltv) / 100) })) });
      toast.success("Today's rate saved"); refetch(); qc.invalidateQueries({ queryKey: ['/masters/lookups'] }); qc.invalidateQueries({ queryKey: ['/masters/rates/latest/all'] }); qc.invalidateQueries({ queryKey: ['/dashboard/alerts'] });
    } catch (e) { toast.error(e.message); }
  };
  const cols = [{ key: 'metal_name', label: 'Metal' }, { key: 'name', label: 'Purity' }, { key: 'purity', label: 'Purity %', type: 'number' }, { key: 'today', label: 'Rate / g', type: 'money' }, { key: 'today_loan', label: 'Loan rate / g', type: 'money' }];
  const card = () => printTable({ title: `Rate card · ${dayjs(d).format('DD/MM/YYYY')}`, company, columns: cols, rows });
  useKeys({ f5: copyPrev, f2: save, f9: card, 'ctrl+p': card, escape: () => navigate('/') }, [rows, d]);
  const metalId = rows.find((r) => r.metal_code === hist)?.metal_id;
  const chart = (data?.history || []).filter((h) => h.metal_id === metalId).map((h) => ({ d: dayjs(h.rate_date).format('DD MMM'), rate: n(h.top_rate) })).reverse();
  const table = Object.values((data?.history || []).reduce((a, h) => { const k = h.rate_date; a[k] ||= { date: k }; a[k][h.metal_id] = n(h.top_rate); return a; }, {}));
  const goldId = rows.find((r) => r.metal_code === 'GOLD')?.metal_id;
  const silverId = rows.find((r) => r.metal_code === 'SILVER')?.metal_id;

  return (
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 rounded-md px-4 py-2 text-white"><div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Metal Rate Update</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Today's board rate for gold and silver</p></div></section>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Rate date"><Input type="date" className="!h-8 w-36 text-[13px]" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Button variant="outline" className="h-8 text-[12px]" icon={Copy} onClick={copyPrev}>Copy Previous Rate (F5)</Button>
        <Button variant="outline" className="h-8 border-amber-300 bg-amber-50 text-[12px] text-amber-900 hover:bg-amber-100" icon={Wand2} onClick={auto}>Auto from 100% Rate</Button>
        <span className={clsx('ml-auto rounded-md border px-3 py-1.5 text-[12px] font-bold', data?.isSet ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700')}>{data?.isSet ? `Rate set for ${dayjs(d).format('DD/MM/YYYY')}` : `Rate NOT set for ${dayjs(d).format('DD/MM/YYYY')}`}</span>
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_1fr]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Board rate · {dayjs(d).format('DD/MM/YYYY')}</p>
          {/* one card per metal: fine (100%) rate on top, ornament purities below */}
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
            {[...new Set(rows.map((r) => r.metal_id))].map((mid) => {
              const list = rows.map((r, i) => ({ ...r, i })).filter((r) => r.metal_id === mid);
              const head = list[0];
              const silver = head?.metal_code === 'SILVER';
              const done = list.filter((r) => n(r.today)).length;
              return (
                <div key={mid} className="overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
                  <div className={clsx('flex items-center gap-2 px-3 py-1.5', silver ? 'bg-slate-50 dark:bg-slate-900/40' : 'bg-amber-50 dark:bg-amber-950/30')}>
                    <span className={clsx('grid size-6 place-items-center rounded-full text-[9px] font-black ring-1', silver ? 'bg-[radial-gradient(circle_at_30%_30%,#fff,#cbd5e1_55%,#64748b)] text-slate-700 ring-slate-400/40' : 'bg-[radial-gradient(circle_at_30%_30%,#fde68a,#d4a017_55%,#8a6508)] text-amber-950 ring-amber-700/30')}>{silver ? 'Ag' : 'Au'}</span>
                    <span className="flex-1 text-[12px] font-bold tracking-wide text-navy-900 uppercase dark:text-white">{head?.metal_name || head?.metal_code}</span>
                    <span className={clsx('rounded-sm px-1.5 text-[10px] font-bold', done === list.length ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-ink-500 ring-1 ring-ink-200 dark:bg-ink-900')}>{done}/{list.length} entered</span>
                  </div>
                  <div className="divide-y divide-ink-100 dark:divide-ink-800">
                    {list.map((r) => {
                      const ch = n(r.today) && n(r.previous) ? n(r.today) - n(r.previous) : null;
                      const fine = n(r.purity) >= 99.5;
                      return (
                        <div key={`${r.metal_id}-${r.purity}`} className={clsx('grid grid-cols-[1fr_80px_120px_84px] items-center gap-2 px-3 py-1', fine && 'bg-ink-50/60 dark:bg-ink-800/30')}>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-[12px] font-semibold text-navy-900 dark:text-white">{r.name}{fine && <span className="ml-1.5 rounded-sm bg-navy-900 px-1 text-[9px] font-bold text-white dark:bg-white dark:text-navy-900">100%</span>}</p>
                            <p className="num text-[10px] text-ink-400">{n(r.purity)}% purity</p>
                          </div>
                          <p className="num text-right text-[11px] text-ink-500" title="Previous rate">{r.previous != null ? amount(r.previous) : '-'}</p>
                          <Input data-rate type="number" className={clsx('!h-8 text-right text-[14px] font-bold', fine && 'border-navy-300')} prefix="₹" value={r.today} onFocus={(e) => e.target.select()}
                            onChange={(e) => set(r.i, { today: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const all = [...document.querySelectorAll('input[data-rate]')]; all[all.indexOf(e.target) + 1]?.focus(); } }} />
                          <span className={clsx('num justify-self-end rounded-sm px-1.5 py-0.5 text-[11px] font-bold', ch == null ? 'text-ink-300' : ch > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : ch < 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>
                            {ch == null ? '—' : ch === 0 ? 'same' : `${ch > 0 ? '▲' : '▼'} ${amount(Math.abs(ch))}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!rows.length && <p className="py-10 text-center text-[12px] text-ink-400">No metal purities set up - add them in Masters &gt; Metal &amp; Purity</p>}
          </div>
          <p className="shrink-0 border-t border-ink-100 px-3 py-1.5 text-[11px] text-ink-500 dark:border-ink-800">Type the <b>100%</b> rate, then <b>Auto from 100% Rate</b> fills each ornament purity. Enter = next box. Loans are valued at fine weight × 100% rate.</p>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Rate history · last 30 days · {hist === 'GOLD' ? 'Gold' : 'Silver'}</p>
          <div className="flex shrink-0 p-2">{['GOLD', 'SILVER'].map((m) => <button key={m} type="button" onClick={() => setHist(m)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', hist === m ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{hist === m && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{m === 'GOLD' ? 'Gold' : 'Silver'}</button>)}</div>
          <div className="h-40 shrink-0 px-2">{chart.length > 1 ? (
            <ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#dfe4ea" /><XAxis dataKey="d" fontSize={10} /><YAxis fontSize={10} width={60} domain={['auto', 'auto']} /><Tooltip /><RLine dataKey="rate" stroke="#71717a" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          ) : <p className="pt-16 text-center text-xs text-ink-400">Not enough rate history to draw a chart</p>}</div>
          <div className="min-h-0 flex-1 overflow-auto border-t border-ink-100 dark:border-ink-800">
          <table className="w-full text-[12px]">
            <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr><th className="px-3 py-1.5 text-left">Date</th><th className="px-3 text-right">Gold (top purity)</th><th className="px-3 text-right">Silver (top purity)</th></tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{table.map((r) => <tr key={r.date}><td className="px-3 py-1">{dayjs(r.date).format('DD/MM/YYYY')}</td><td className="num px-3 text-right">{r[goldId] ? amount(r[goldId]) : '-'}</td><td className="num px-3 text-right">{r[silverId] ? amount(r[silverId]) : '-'}</td></tr>)}</tbody>
          </table>
          </div>
        </div>
      </div>
      <PageActions keys="Enter = next rate · F5 = copy previous · F2 = save · F9 = print rate card · Esc = exit">
        <Button variant="outline" icon={FileDown} onClick={card}>Rate Card PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={Printer} onClick={card}>Print Rate Card (F9)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('rate-history', [{ key: 'rate_date', label: 'Date', type: 'date' }, { key: 'top_rate', label: 'Rate' }], data?.history || [])}>History Excel</Button>
        <Button variant="gold" icon={Save} className="!px-5" onClick={save}>Save Today's Rate (F2)</Button>
        <ExitButton />
      </PageActions>
    </div>
  );
}
