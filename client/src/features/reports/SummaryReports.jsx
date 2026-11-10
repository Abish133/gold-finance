import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, RefreshCw, Eye, FileDown, FileSpreadsheet, LogOut, Printer } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Field, Input, Select } from '@/components/ui';
import { useFetch, useCompany } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { exportCsv } from '@/lib/exporters';
import { amount, compact, date, n, weight } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { Seg, Tile, SideLine, SideHead } from './ReportScreen';

const Buttons = ({ onShow, preview, excel }) => {
  const navigate = useNavigate();
  return (
    <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
      <Button variant="outline" icon={RefreshCw} onClick={onShow}>Refresh (F6)</Button>
      <Button variant="outline" icon={Eye} onClick={preview}>Print Preview (F9)</Button>
      <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
      <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Excel (Ctrl+E)</Button>
      <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
    </div>
  );
};

/** Loan & Release Summary (desktop): loans given, released and auctioned, with the running balance - month-wise or day-wise. */
export function LoanReleaseSummaryPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const { data: years = [] } = useFetch('/admin/financial-years');
  const [fy, setFy] = useState('');
  const [view, setView] = useState('month');
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const year = years.find((y) => String(y.id) === fy) || years.find((y) => y.is_current) || years[0];
  const params = year && (view === 'month'
    ? { from: String(year.start_date).slice(0, 10), to: String(year.end_date).slice(0, 10), view }
    : { from: `${month}-01`, to: dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD'), view });
  const { data, refetch } = useFetch(params ? '/desk/rep/summary' : null, params);
  const rows = (data?.rows || []).map((r) => ({ ...r, label: view === 'month' ? dayjs(`${r.key}-01`).format('MMM YYYY') : dayjs(r.key).format('DD/MM/YYYY ddd') }));
  const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
  const metal = (m, k) => rows.reduce((s, r) => s + n(r.by_metal?.[m]?.[k]), 0);
  const cols = [{ key: 'label', label: view === 'month' ? 'Month' : 'Day' }, { key: 'given', label: 'Loans Given', type: 'money' }, { key: 'given_count', label: 'No.', type: 'number' }, { key: 'released', label: 'Released', type: 'money' }, { key: 'released_count', label: 'No.', type: 'number' },
    { key: 'auctioned', label: 'Auctioned', type: 'money' }, { key: 'auctioned_count', label: 'No.', type: 'number' }, { key: 'part_paid', label: 'Part Paid', type: 'money' }, { key: 'balance', label: 'Balance', type: 'money' }, { key: 'outstanding', label: 'Outstanding', type: 'money' }];
  const preview = () => printTable({ title: `Loan & Release Summary · ${view === 'month' ? year?.name : dayjs(`${month}-01`).format('MMMM YYYY')}`, company, columns: cols, rows, totals: { given: sum('given'), released: sum('released'), auctioned: sum('auctioned'), part_paid: sum('part_paid') } });
  useKeys({ f5: () => refetch(), f6: () => refetch(), f9: preview, 'ctrl+p': preview, 'ctrl+e': () => exportCsv('loan-release-summary', cols, rows), backspace: () => setView('month'), escape: () => navigate('/') }, [rows, view]);
  const months = year ? Array.from({ length: 12 }, (_, i) => dayjs(year.start_date).add(i, 'month')).map((d) => ({ value: d.format('YYYY-MM'), label: d.format('MMMM YYYY') })) : [];
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Loan &amp; Release Summary</h1><p className="text-sm text-navy-100">Loans given, released and auctioned, with the running balance</p></section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="A/c year" className="w-44"><Select value={fy || String(year?.id || '')} onChange={(e) => setFy(e.target.value)} options={years.map((y) => ({ value: y.id, label: y.name }))} /></Field>
        <div><p className="label">View</p><Seg value={view} onChange={setView} options={[['month', 'Month-wise'], ['day', 'Day-wise']]} /></div>
        <Field label="Month (day-wise)" className="w-48"><Select disabled={view !== 'day'} value={month} onChange={(e) => setMonth(e.target.value)} options={months} /></Field>
        <Button className="ml-auto" size="lg" variant="outline" icon={Search} onClick={() => refetch()}>Show (F5)</Button>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <Tile label="Opening balance" value={amount(data?.opening || 0)} hint={params && `on ${date(params.from)}`} cls="border-t-navy-800" />
        <Tile label="Loans given" value={amount(sum('given'))} hint={`${sum('given_count')} loans`} cls="border-t-amber-600" />
        <Tile label="Released" value={amount(sum('released'))} hint={`${sum('released_count')} loans`} cls="border-t-emerald-700" />
        <Tile label="Auctioned" value={amount(sum('auctioned'))} hint={`${sum('auctioned_count')} loans`} cls="border-t-rose-600" />
        <Tile label="Closing balance" value={amount(data?.closing || 0)} hint={params && `on ${date(params.to)} · outstanding ${amount(data?.outstanding || 0)}`} dark />
      </div>
      <div className="grid items-stretch gap-3 xl:grid-cols-[1fr_320px]">
        <div className="card min-h-[calc(100vh-27rem)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="navy-gradient sticky top-0 text-white"><tr><th className="px-2 py-2 text-left">{view === 'month' ? 'Month' : 'Day'}</th><th className="px-2 text-right">Loans Given · No.</th><th className="px-2 text-right">Released · No.</th><th className="px-2 text-right">Auctioned · No.</th><th className="px-2 text-right">Part Paid</th><th className="px-2 text-right">Balance</th><th className="px-2 text-right">Outstanding</th></tr></thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              <tr className="bg-cream-100 text-xs font-bold dark:bg-ink-800"><td className="px-2 py-1">Opening · {params && date(params.from)}</td><td colSpan={4} /><td className="num px-2 text-right">{amount(data?.opening || 0)}</td><td className="num px-2 text-right">{amount(data?.openingOutstanding || 0)}</td></tr>
              {rows.map((r) => (
                <tr key={r.key} onDoubleClick={() => { if (view === 'month') { setMonth(r.key); setView('day'); } }} className={clsx('cursor-pointer hover:bg-navy-50/60', r.given_count + r.released_count ? 'font-semibold' : 'text-ink-500')}>
                  <td className="px-2 py-1.5">{r.label}</td><td className="num px-2 text-right">{amount(r.given)} · {r.given_count}</td><td className="num px-2 text-right">{amount(r.released)} · {r.released_count}</td>
                  <td className="num px-2 text-right">{amount(r.auctioned)} · {r.auctioned_count}</td><td className="num px-2 text-right">{amount(r.part_paid)}</td><td className="num px-2 text-right font-semibold">{amount(r.balance)}</td><td className="num px-2 text-right">{amount(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="navy-gradient text-white"><tr className="font-bold"><td className="px-2 py-2">Total · {date(params?.to)}</td><td className="num px-2 text-right">{amount(sum('given'))} · {sum('given_count')}</td><td className="num px-2 text-right">{amount(sum('released'))} · {sum('released_count')}</td>
              <td className="num px-2 text-right">{amount(sum('auctioned'))} · {sum('auctioned_count')}</td><td className="num px-2 text-right">{amount(sum('part_paid'))}</td><td className="num px-2 text-right">{amount(data?.closing || 0)}</td><td className="num px-2 text-right">{amount(data?.outstanding || 0)}</td></tr></tfoot>
          </table>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-xs font-bold text-amber-700 uppercase">A/c year {year?.name}</p>
          <SideLine k="Opening balance" v={amount(data?.opening || 0)} />
          <SideHead>Loans given</SideHead>{['GOLD', 'SILVER', 'MIX'].map((m) => <SideLine key={m} k={`${m.charAt(0) + m.slice(1).toLowerCase()} · ${metal(m, 'c')}`} v={amount(metal(m, 'a'))} />)}
          <SideHead>Closed</SideHead><SideLine k={`Released · ${sum('released_count')}`} v={amount(sum('released'))} /><SideLine k={`Auctioned · ${sum('auctioned_count')}`} v={amount(sum('auctioned'))} />
          <SideHead>Other</SideHead><SideLine k="Part paid (loan amt)" v={amount(sum('part_paid'))} /><SideLine k="Top-up given" v={amount(sum('topup'))} />
          <SideLine k="Closing balance" v={amount(data?.closing || 0)} bold /><SideLine k="Outstanding" v={amount(data?.outstanding || 0)} bold />
        </div>
      </div>
      <Buttons onShow={() => refetch()} preview={preview} excel={() => exportCsv('loan-release-summary', cols, rows)} />
      <p className="px-1 text-xs text-ink-500">F5 = show · F6 = refresh · double-click a month = day-wise · Backspace = back to months · F9 = print preview · Ctrl+P = PDF · Ctrl+E = Excel · Esc = exit</p>
    </div>
  );
}

const fy = () => (dayjs().month() >= 3 ? dayjs().month(3).date(1) : dayjs().subtract(1, 'year').month(3).date(1));
const PRESETS = {
  'This month vs last month': () => [dayjs().startOf('month'), dayjs(), dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  'Month vs same month last year': () => [dayjs().startOf('month'), dayjs(), dayjs().subtract(1, 'year').startOf('month'), dayjs().subtract(1, 'year')],
  'This year vs last year': () => [fy(), dayjs(), fy().subtract(1, 'year'), dayjs().subtract(1, 'year')],
};
const change = (a, b) => (n(b) ? `${(((n(a) - n(b)) / n(b)) * 100).toFixed(1)}%` : n(a) ? 'new' : '-');

/** Loan & Release Comparison (desktop): loan vs loan, release vs release, loan vs release - any two periods side by side. */
export function ComparisonReportPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const d = (x) => x.format('YYYY-MM-DD');
  const init = PRESETS['This year vs last year']();
  const [f, setF] = useState({ mode: 'loan', metal: '', a_from: d(init[0]), a_to: d(init[1]), b_from: d(init[2]), b_to: d(init[3]), preset: 'This year vs last year' });
  const [q, setQ] = useState(f);
  const [measure, setMeasure] = useState('a');
  const { data, refetch } = useFetch('/desk/rep/compare', { mode: q.mode, metal: q.metal, a_from: q.a_from, a_to: q.a_to, b_from: q.b_from, b_to: q.b_to });
  const A = data?.A; const B = data?.B;
  const monthKeys = useMemo(() => { const out = []; for (let m = dayjs(q.a_from).startOf('month'); !m.isAfter(dayjs(q.a_to)); m = m.add(1, 'month')) out.push(m); return out; }, [q]);
  const table = monthKeys.map((m) => { const k = m.format('MM'); const a = A?.months?.[k] || {}; const b = B?.months?.[k] || {}; return { month: m.format('MMM YYYY'), bc: n(b.c), ac: n(a.c), ba: n(b.a), aa: n(a.a), bw: n(b.w), aw: n(a.w) }; });
  const chart = table.map((r) => ({ m: r.month.slice(0, 3), A: measure === 'a' ? r.aa : measure === 'c' ? r.ac : r.aw, B: measure === 'a' ? r.ba : measure === 'c' ? r.bc : r.bw }));
  const word = (side) => (side?.kind === 'release' ? 'Release' : 'Loan');
  const pick = (name) => { const [a, b, c, e] = PRESETS[name](); const nf = { ...f, preset: name, a_from: d(a), a_to: d(b), b_from: d(c), b_to: d(e) }; setF(nf); setQ(nf); };
  const cols = [{ key: 'month', label: 'Month' }, { key: 'bc', label: `${word(B)}s B`, type: 'number' }, { key: 'ac', label: `${word(A)}s A`, type: 'number' }, { key: 'ba', label: 'Amount B', type: 'money' }, { key: 'aa', label: 'Amount A', type: 'money' }, { key: 'bw', label: 'Gold wt B', type: 'weight' }, { key: 'aw', label: 'Gold wt A', type: 'weight' }];
  const preview = () => printTable({ title: `Comparison · A ${date(q.a_from)}-${date(q.a_to)} vs B ${date(q.b_from)}-${date(q.b_to)}`, company, columns: cols, rows: table });
  useKeys({ f5: () => setQ(f), f6: () => refetch(), f9: preview, 'ctrl+p': preview, f10: () => exportCsv('comparison', cols, table), 'ctrl+1': () => pick('This month vs last month'), 'ctrl+2': () => pick('Month vs same month last year'), 'ctrl+3': () => pick('This year vs last year'), escape: () => navigate('/') }, [f, table]);
  const tile = (label, a, b, fmtv) => <Tile key={label} label={label} value={fmtv(a)} hint={`${change(a, b)} · B: ${fmtv(b)}`} cls="border-t-navy-500" />;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Loan &amp; Release Comparison</h1><p className="text-sm text-navy-100">Loan vs loan, release vs release - any two periods side by side</p></section>
      <div className="card space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div><p className="label">Compare</p><Seg value={f.preset} onChange={(v) => (v === 'custom' ? setF({ ...f, preset: 'custom' }) : pick(v))} options={[...Object.keys(PRESETS).map((k) => [k, k]), ['custom', 'Custom periods']]} /></div>
          <Field label="Metal" className="w-36"><Select value={f.metal} onChange={(e) => { setF({ ...f, metal: e.target.value }); setQ({ ...f, metal: e.target.value }); }} options={[{ value: '', label: 'All' }, { value: 'GOLD', label: 'Gold' }, { value: 'SILVER', label: 'Silver' }, { value: 'MIX', label: 'Mix' }]} /></Field>
          <Button className="ml-auto" size="lg" variant="outline" icon={Search} onClick={() => setQ(f)}>Show (F5)</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Seg value={f.mode} onChange={(v) => { setF({ ...f, mode: v }); setQ({ ...f, mode: v }); }} options={[['loan', 'Loan vs Loan'], ['release', 'Release vs Release'], ['mixed', 'Loan vs Release']]} />
          <span className="ml-4 font-bold">A</span><Input type="date" className="w-40" value={f.a_from} onChange={(e) => setF({ ...f, a_from: e.target.value, preset: 'custom' })} /><span>to</span><Input type="date" className="w-40" value={f.a_to} onChange={(e) => setF({ ...f, a_to: e.target.value, preset: 'custom' })} />
          <span className="ml-4 font-bold text-amber-700">B</span><Input type="date" className="w-40" value={f.b_from} onChange={(e) => setF({ ...f, b_from: e.target.value, preset: 'custom' })} /><span>to</span><Input type="date" className="w-40" value={f.b_to} onChange={(e) => setF({ ...f, b_to: e.target.value, preset: 'custom' })} />
          <span className="ml-auto text-xs text-ink-500">{dayjs(q.a_to).diff(dayjs(q.a_from), 'day') + 1} / {dayjs(q.b_to).diff(dayjs(q.b_from), 'day') + 1} days</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        {tile(`${word(A)} amount`, A?.amount, B?.amount, (v) => `₹ ${amount(v || 0)}`)}{tile(`No. of ${word(A).toLowerCase()}s`, A?.count, B?.count, (v) => n(v))}
        {tile(`Average ${word(A).toLowerCase()}`, A?.average, B?.average, (v) => `₹ ${amount(v || 0)}`)}{tile('Gold weight (net)', A?.weight, B?.weight, (v) => `${weight(v)} g`)}
        {tile('New customers', A?.new_customers, B?.new_customers, (v) => n(v))}{tile(`${word(A)}s per day`, A?.per_day, B?.per_day, (v) => n(v).toFixed(1))}
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="card p-3">
            <div className="mb-1 flex items-center gap-2"><p className="flex-1 text-xs font-bold text-navy-900 uppercase dark:text-white">{word(A)}s - month by month · A {date(q.a_from)} - {date(q.a_to)} vs B {date(q.b_from)} - {date(q.b_to)}</p>
              <Seg value={measure} onChange={setMeasure} options={[['a', 'Amount'], ['c', 'No. of loans'], ['w', 'Weight']]} /></div>
            <div className="h-56"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#dfe4ea" /><XAxis dataKey="m" fontSize={11} /><YAxis fontSize={10} width={60} tickFormatter={(v) => compact(v)} /><Tooltip /><Legend /><Bar dataKey="B" name="B" fill="#a1a1aa" /><Bar dataKey="A" name="A" fill="#18181b" /></BarChart></ResponsiveContainer></div>
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-sm">
              <thead className="navy-gradient text-white"><tr>{['Month', `${word(B)}s B`, `${word(A)}s A`, 'Change', 'Amount B', 'Amount A', 'Change', 'Gold wt B', 'Gold wt A', 'Change'].map((h, i) => <th key={i} className={clsx('px-2 py-1.5', i ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">{table.map((r) => (
                <tr key={r.month}><td className="px-2 py-1">{r.month}</td><td className="num px-2 text-right">{r.bc}</td><td className="num px-2 text-right">{r.ac}</td><td className="px-2 text-right text-xs">{change(r.ac, r.bc)}</td>
                  <td className="num px-2 text-right">{amount(r.ba)}</td><td className="num px-2 text-right">{amount(r.aa)}</td><td className="px-2 text-right text-xs">{change(r.aa, r.ba)}</td>
                  <td className="num px-2 text-right">{weight(r.bw)} g</td><td className="num px-2 text-right">{weight(r.aw)} g</td><td className="px-2 text-right text-xs">{change(r.aw, r.bw)}</td></tr>
              ))}</tbody>
              <tfoot className="navy-gradient text-white"><tr className="font-bold"><td className="px-2 py-1.5">Total</td><td className="num px-2 text-right">{B?.count || 0}</td><td className="num px-2 text-right">{A?.count || 0}</td><td className="px-2 text-right text-xs">{change(A?.count, B?.count)}</td>
                <td className="num px-2 text-right">{amount(B?.amount || 0)}</td><td className="num px-2 text-right">{amount(A?.amount || 0)}</td><td className="px-2 text-right text-xs">{change(A?.amount, B?.amount)}</td>
                <td className="num px-2 text-right">{weight(B?.weight)} g</td><td className="num px-2 text-right">{weight(A?.weight)} g</td><td className="px-2 text-right text-xs">{change(A?.weight, B?.weight)}</td></tr></tfoot>
            </table>
          </div>
        </div>
        <div className="space-y-3">
          {[['By metal', 'metal', ['GOLD', 'SILVER', 'MIX']], ['By loan size', 'size', ['< 10K', '10K - 50K', '50K - 1L', '> 1L']]].map(([t, k, keys]) => (
            <div key={t} className="card overflow-hidden"><p className="navy-gradient px-3 py-2 text-xs font-bold text-white uppercase">{t} · A vs B</p>
              <div className="divide-y divide-ink-200 text-xs dark:divide-ink-700">{keys.map((m) => { const a = A?.[k]?.[m] || {}; const b = B?.[k]?.[m] || {}; const max = Math.max(n(a.a), n(b.a), 1); return (
                <div key={m} className="grid grid-cols-[70px_1fr_60px] items-center gap-2 px-3 py-2">
                  <b>{m}</b>
                  <div><div className="flex justify-between"><span>₹{amount(a.a || 0)}</span><span>{a.c || 0} loans</span></div><div className="h-1.5 rounded bg-ink-100"><div className="h-1.5 rounded bg-ink-900" style={{ width: `${(n(a.a) / max) * 100}%` }} /></div>
                    <div className="mt-0.5 flex justify-between text-ink-500"><span>B ₹{amount(b.a || 0)}</span><span>{b.c || 0}</span></div></div>
                  <span className="text-right">{change(a.a, b.a)}</span>
                </div>); })}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={Printer} onClick={preview}>Print (F9)</Button>
        <Button variant="outline" icon={FileDown} onClick={preview}>PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('comparison', cols, table)}>Excel (F10)</Button>
        <Button variant="outline" icon={RefreshCw} onClick={() => refetch()}>Refresh (F6)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F5 = show · F6 = refresh · Ctrl+1..3 = compare mode · F9 = print · F10 = Excel · Esc = exit</p>
    </div>
  );
}


