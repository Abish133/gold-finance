import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button, Drawer, Field, Input } from '@/components/ui';
import { NeedBranch } from '@/components/common/NeedBranch';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import dayjs from 'dayjs';
import { money, today, n, date as fmtDate } from '@/lib/format';

const NOTES = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/** Cash count form (same note list as the desktop app). Enter = next note, F2 = save. */
export function CashCount({ date, onSaved }) {
  const qc = useQueryClient();
  const { data } = useFetch('/accounts/denominations', { date });
  const [notes, setNotes] = useState({});
  const [coins, setCoins] = useState('');
  const [remarks, setRemarks] = useState('');
  const boxes = useRef([]);
  useEffect(() => {
    const saved = data?.record?.notes ? (typeof data.record.notes === 'string' ? JSON.parse(data.record.notes) : data.record.notes) : {};
    setNotes(saved); setCoins(saved.coins || ''); setRemarks(data?.record?.remarks || '');
  }, [data]);
  const total = NOTES.reduce((s, x) => s + x * n(notes[x]), 0) + n(coins);
  const diff = Math.round((total - n(data?.bookBalance)) * 100) / 100;
  const save = useMutation({
    mutationFn: () => api.post('/accounts/denominations', { date, notes: Object.fromEntries(NOTES.map((x) => [x, n(notes[x])])), coins: n(coins), remarks }),
    onSuccess: () => {
      toast.success('Cash saved successfully');
      qc.invalidateQueries({ queryKey: ['/accounts/denominations'] });
      qc.invalidateQueries({ queryKey: ['/desk/day-report'] });
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });
  const next = (i) => (e) => {
    if (e.key === 'Enter') { e.preventDefault(); (boxes.current[i + 1] || boxes.current[0])?.select?.(); }
    if (e.key === 'F2') { e.preventDefault(); save.mutate(); }
  };
  const tally = Math.abs(diff) < 0.01;
  // a note count is a whole number - at most 5 digits, so a slip of the finger cannot make a crore-sized total
  const asCount = (v) => String(v).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 5);
  const noteRow = (x, i) => (
    <div key={x} className={clsx('grid min-w-0 grid-cols-[60px_minmax(72px,110px)_minmax(0,1fr)] items-center gap-3 px-3 py-1', n(notes[x]) && 'bg-emerald-50/60 dark:bg-emerald-950/20')}>
      <span className="num text-[15px] font-bold text-navy-900 dark:text-white">₹ {x}</span>
      <Input ref={(el) => { boxes.current[i] = el; }} type="text" inputMode="numeric" maxLength={5} className="!h-9 text-right text-[14px] font-semibold" value={notes[x] ?? ''} placeholder="0"
        onChange={(e) => setNotes({ ...notes, [x]: asCount(e.target.value) })} onKeyDown={next(i)} autoFocus={i === 0} onFocus={(e) => e.target.select()} />
      <span title={money(x * n(notes[x]))} className={clsx('num truncate text-right text-[13px]', n(notes[x]) ? 'font-semibold text-navy-900 dark:text-white' : 'text-ink-400')}>{money(x * n(notes[x]))}</span>
    </div>
  );
  return (
    <div className="grid w-full gap-3 lg:h-full lg:grid-cols-[1fr_240px]">
      <div className="flex min-w-0 flex-col gap-2">
        {/* notes in two columns; rows stretch to use the full height */}
        <div className="@container flex flex-1 flex-col overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
          <div className="grid grid-cols-[60px_minmax(72px,110px)_minmax(0,1fr)] gap-3 bg-ink-50 px-3 py-1 text-[10px] font-semibold tracking-wider text-ink-500 uppercase @min-[680px]:hidden dark:bg-ink-800"><span>Note</span><span className="text-right">Count</span><span className="text-right">Amount</span></div>
          <div className="grid flex-1 grid-rows-10 divide-y divide-ink-100 @min-[680px]:grid-flow-col @min-[680px]:grid-cols-2 @min-[680px]:grid-rows-5 @min-[680px]:divide-x dark:divide-ink-800">
            {NOTES.map((x, i) => noteRow(x, i))}
          </div>
          <div className="flex items-center justify-between border-t-2 border-amber-400 bg-amber-50 px-3 py-1.5 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="text-[11px] font-bold tracking-wider uppercase">Counted cash</span><span className="num min-w-0 truncate text-xl font-extrabold" title={money(total)}>{money(total)}</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <Field label="Loose coins (amount)"><Input ref={(el) => { boxes.current[NOTES.length] = el; }} type="text" inputMode="decimal" prefix={<Coins className="size-3.5" />} className="!h-8 text-right text-[13px]" value={coins} onChange={(e) => setCoins(String(e.target.value).replace(/[^\d.]/g, '').slice(0, 7))} onKeyDown={next(NOTES.length)} /></Field>
          <Field label="Remarks"><Input className="!h-8 text-[13px]" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="optional" /></Field>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-md border border-ink-200 px-2.5 py-1 text-[13px] dark:border-ink-800 [&>div]:flex [&>div]:flex-wrap [&>div]:justify-between [&>div]:gap-x-2 [&>div]:border-b [&>div]:border-dashed [&>div]:border-ink-200 [&>div]:py-1 [&>div:last-child]:border-0 dark:[&>div]:border-ink-700">
          <div><span className="text-ink-500">Expected in drawer</span><b className="num break-all">{money(data?.bookBalance)}</b></div>
          <div><span className="text-ink-500">Counted cash</span><b className="num break-all">{money(total)}</b></div>
        </div>
        <div className={clsx('rounded-md border px-3 py-2 text-center', tally ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200')}>
          <p className="text-[10px] font-bold tracking-wider uppercase opacity-80">Difference</p>
          <p className="num text-lg font-extrabold break-all">{tally ? 'Cash Tally' : `${diff > 0 ? '+ ' : '- '}${money(Math.abs(diff))}`}</p>
          <p className="text-[11px]">{tally ? 'drawer cash matches' : diff > 0 ? 'excess cash' : 'shortage'}</p>
        </div>
        <Button variant="gold" className="mt-auto h-10 w-full" loading={save.isPending} onClick={() => save.mutate()}>Save Count (F2)</Button>
        <p className="text-[11px] text-ink-400">Enter = next note · type how many of each note</p>
      </div>
    </div>
  );
}

/** Cash count as a drawer over the Day Report / Day End (F6). */
export function CashCountDrawer({ open, onClose, date }) {
  return (
    <Drawer open={open} onClose={onClose} size="lg" icon={Coins} bodyClassName="flex !px-4 !py-3" title={`Cash Count - ${fmtDate(date)}`} subtitle="Count the cash in the drawer - it must match the Day Report">
      {open && <CashCount date={date} onSaved={onClose} />}
    </Drawer>
  );
}

export default function DenominationPage() {
  const { isAllBranches } = useAuth();
  const [d, setD] = useState(today());
  if (isAllBranches) return <NeedBranch action="count its cash" />;
  const shift = (k) => setD(dayjs(d).add(k, 'day').format('YYYY-MM-DD'));
  const isToday = d === today();
  const navBtn = 'grid h-8 w-8 place-items-center rounded-md border border-white/20 text-white/80 hover:bg-white/10 disabled:opacity-40';
  return (
    /* fit-screen: the count form fills the window, no page scroll */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <Coins className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Cash Denomination</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Count the cash drawer and tally with the books</p></div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={navBtn} title="Previous day" onClick={() => shift(-1)}>‹</button>
          <div className="flex items-center gap-2 rounded-md border border-white/15 px-2.5 py-0.5">
            <span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">Date</span>
            <input type="date" className="h-7 bg-transparent text-[13px] font-semibold text-white outline-none [color-scheme:dark]" value={d} max={today()} onChange={(e) => e.target.value && setD(e.target.value)} />
          </div>
          <button type="button" className={navBtn} title="Next day" disabled={isToday} onClick={() => shift(1)}>›</button>
          {!isToday && <button type="button" className="h-8 rounded-md bg-white px-3 text-[12px] font-semibold text-navy-900" onClick={() => setD(today())}>Today</button>}
        </div>
      </section>
      <div className="card flex min-h-0 flex-1 p-3"><CashCount key={d} date={d} /></div>
    </div>
  );
}
