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
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Metal Rate Update</h1><p className="text-sm text-navy-100">Today's board rate for gold and silver</p></section>
      <div className="card flex flex-wrap items-end gap-3 px-4 py-3">
        <Field label="Rate date"><Input type="date" max={today()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Button variant="outline" icon={Copy} onClick={copyPrev}>Copy Previous Rate (F5)</Button>
        <Button variant="outline" icon={Wand2} onClick={auto}>Auto from 100% Rate</Button>
        <span className={clsx('ml-auto rounded-md px-4 py-2 text-sm font-bold', data?.isSet ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{data?.isSet ? `Rate set for ${dayjs(d).format('DD/MM/YYYY')}` : `Rate NOT set for ${dayjs(d).format('DD/MM/YYYY')}`}</span>
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Board rate · {dayjs(d).format('DD/MM/YYYY')}</p>
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-xs text-navy-800 uppercase"><tr><th className="px-3 py-1.5 text-left">Metal</th><th className="px-3 text-left">Purity</th><th className="px-3 text-right">Purity %</th><th className="px-3 text-right">Previous</th><th className="px-3 text-right">Today</th><th className="px-3 text-right">Change</th></tr></thead>
            <tbody className="divide-y divide-ink-200">
              {rows.map((r, i) => {
                const ch = n(r.today) && n(r.previous) ? n(r.today) - n(r.previous) : null;
                return (
                  <tr key={`${r.metal_id}-${r.purity}`}>
                    <td className="px-3 py-1 font-bold">{rows[i - 1]?.metal_id === r.metal_id ? '' : r.metal_code}</td><td className="px-3">{r.name}</td><td className="num px-3 text-right">{n(r.purity)}</td>
                    <td className="num px-3 text-right text-ink-500">{r.previous != null ? amount(r.previous) : '-'}</td>
                    <td className="px-2"><Input type="number" className="h-8 bg-gold-50 text-right" value={r.today} onChange={(e) => set(i, { today: e.target.value })} /></td>
                    <td className={clsx('num px-3 text-right', ch > 0 ? 'text-emerald-700' : ch < 0 ? 'text-rose-600' : '')}>{ch == null ? '' : `${ch > 0 ? '+' : ''}${amount(ch)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-ink-500">Enter the 100% rate and press Auto from 100% Rate - the ornament rate is filled from its purity. Loans are valued at fine weight x 100% rate.</p>
        </div>
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Rate history · last 30 days · {hist === 'GOLD' ? 'Gold' : 'Silver'}</p>
          <div className="flex gap-1 p-2">{['GOLD', 'SILVER'].map((m) => <button key={m} type="button" onClick={() => setHist(m)} className={clsx('h-8 rounded-md border px-3 text-xs font-semibold', hist === m ? 'border-navy-200 bg-navy-50' : 'border-ink-300')}>{m === 'GOLD' ? 'Gold' : 'Silver'}</button>)}</div>
          <div className="h-48 px-2">{chart.length > 1 ? (
            <ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#dfe4ea" /><XAxis dataKey="d" fontSize={10} /><YAxis fontSize={10} width={60} domain={['auto', 'auto']} /><Tooltip /><RLine dataKey="rate" stroke="#71717a" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          ) : <p className="pt-16 text-center text-xs text-ink-400">Not enough rate history to draw a chart</p>}</div>
          <table className="w-full text-sm">
            <thead className="navy-gradient text-white"><tr><th className="px-3 py-1.5 text-left">Date</th><th className="px-3 text-right">Gold (top purity)</th><th className="px-3 text-right">Silver (top purity)</th></tr></thead>
            <tbody className="divide-y divide-ink-200">{table.slice(0, 10).map((r) => <tr key={r.date}><td className="px-3 py-1">{dayjs(r.date).format('DD/MM/YYYY')}</td><td className="num px-3 text-right">{r[goldId] ? amount(r[goldId]) : '-'}</td><td className="num px-3 text-right">{r[silverId] ? amount(r[silverId]) : '-'}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="card flex flex-wrap justify-end gap-2 px-3 py-2">
        <Button variant="outline" icon={FileDown} onClick={card}>Rate Card PDF (Ctrl+P)</Button>
        <Button variant="outline" icon={Printer} onClick={card}>Print Rate Card (F9)</Button>
        <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('rate-history', [{ key: 'rate_date', label: 'Date', type: 'date' }, { key: 'top_rate', label: 'Rate' }], data?.history || [])}>History Excel</Button>
        <Button variant="gold" icon={Save} onClick={save}>Save Today's Rate (F2)</Button>
        <ExitButton />
      </div>
      <p className="px-1 text-xs text-ink-500">Enter = next rate · F5 = copy previous · F2 = save · F9 = print rate card · Esc = exit</p>
    </div>
  );
}
