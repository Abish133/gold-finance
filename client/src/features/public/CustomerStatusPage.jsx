import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Gem, AlertTriangle, CalendarClock, Phone, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { amount, weight } from '@/lib/format';

const TYPE = { DISBURSE: 'Loan given', INTEREST: 'Interest paid', PART_PAYMENT: 'Part payment', TOPUP: 'Top-up', RELEASE: 'Released', RENEW: 'Renewed' };

/** What a customer sees from the shop's link: their open loans and what is due - read only, nothing else. */
export default function CustomerStatusPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    api.get(`/public/loan-status/${encodeURIComponent(token)}`)
      .then((r) => setState({ data: r.data }))
      .catch((e) => setState({ error: e.message || 'This link is not valid or has expired.' }));
  }, [token]);

  const d = state.data;
  const total = d ? d.loans.reduce((x, l) => x + Number(l.total_payable || 0), 0) : 0;

  return (
    <main className="min-h-screen bg-ink-50 text-ink-800 dark:bg-ink-950 dark:text-ink-100">
      <header className="navy-gradient px-4 py-4 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white text-navy-900"><Gem className="size-5" /></span>
          <div className="min-w-0"><p className="truncate text-[16px] font-bold">{d?.shop.name || 'Gold Loan'}</p><p className="text-[12px] text-white/70">Your gold loan status</p></div>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {state.loading && <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-md bg-ink-200 dark:bg-ink-800" />)}</div>}

        {state.error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" />Link not available</p>
            <p className="mt-1">{state.error}</p>
          </div>
        )}

        {d && (
          <>
            <section className="rounded-md border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
              <p className="text-[13px] text-ink-500">Dear</p>
              <p className="text-[18px] font-bold text-navy-900 dark:text-white">{d.customer.name}</p>
              <p className="mt-2 text-[12px] text-ink-500">As on {dayjs(d.asOn).format('DD MMM YYYY')} · {d.loans.length} open loan{d.loans.length === 1 ? '' : 's'}</p>
              {d.loans.length > 0 && (
                <div className="mt-3 flex items-baseline justify-between rounded-md bg-ink-50 px-3 py-2 dark:bg-ink-800">
                  <span className="text-[12px] font-semibold text-ink-600 dark:text-ink-300">Total to close all loans today</span>
                  <span className="num text-[20px] font-extrabold text-navy-900 dark:text-white">₹{amount(total)}</span>
                </div>
              )}
            </section>

            {!d.loans.length && <p className="rounded-md border border-ink-200 bg-white p-4 text-center text-[14px] dark:border-ink-800 dark:bg-ink-900">You have no open loans with us. Thank you!</p>}

            {d.loans.map((l) => (
              <section key={l.loan_no} className="overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
                <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 dark:border-ink-800">
                  <div><p className="text-[15px] font-bold text-navy-900 dark:text-white">Loan {l.loan_no}</p><p className="text-[12px] text-ink-500">{dayjs(l.loan_date).format('DD MMM YYYY')}{l.branch ? ` · ${l.branch}` : ''}</p></div>
                  {l.overdue
                    ? <span className="flex items-center gap-1 rounded-sm bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700"><AlertTriangle className="size-3" />Overdue</span>
                    : <span className="rounded-sm bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">Open</span>}
                </header>
                <div className="space-y-1 px-4 py-3 text-[14px]">
                  <p className="text-[12px] text-ink-500">{l.items} · {weight(l.net_wt)} g</p>
                  {[['Loan amount (balance)', l.outstanding], ['Interest due till today', l.interest_due]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><span className="text-ink-600 dark:text-ink-300">{k}</span><b className="num">₹{amount(v)}</b></div>
                  ))}
                  <div className="mt-1 flex justify-between gap-3 border-t border-dashed border-ink-200 pt-2 dark:border-ink-700"><span className="font-semibold">To close this loan today</span><b className="num text-[16px] text-navy-900 dark:text-white">₹{amount(l.total_payable)}</b></div>
                  <div className={clsx('mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-[12px]', l.overdue ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200' : 'bg-ink-50 text-ink-700 dark:bg-ink-800 dark:text-ink-200')}>
                    <CalendarClock className="size-4 shrink-0" />
                    <span>{l.overdue ? `Past the settle date by ${l.overdue_days} days. Please pay the interest or renew soon.` : `Please settle before ${dayjs(l.due_date).format('DD MMM YYYY')}.`} Interest is about ₹{amount(l.monthly_interest)} a month.</span>
                  </div>
                </div>
                {l.recent.length > 0 && (
                  <div className="border-t border-ink-100 px-4 py-2.5 dark:border-ink-800">
                    <p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Recent</p>
                    {l.recent.map((t, i) => <div key={i} className="flex justify-between text-[12px]"><span className="text-ink-600 dark:text-ink-300">{dayjs(t.date).format('DD MMM YY')} · {TYPE[t.type] || t.type}</span><span className="num">₹{amount(t.amount)}</span></div>)}
                  </div>
                )}
              </section>
            ))}

            <footer className="space-y-2 pb-6 text-center text-[12px] text-ink-500">
              {d.shop.phone && <a href={`tel:${d.shop.phone}`} className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 bg-white px-3 py-1.5 font-semibold text-navy-900 dark:border-ink-700 dark:bg-ink-900 dark:text-white"><Phone className="size-3.5" />Call the shop</a>}
              <p className="flex items-center justify-center gap-1"><ShieldCheck className="size-3.5" />View only · this link works till {dayjs(d.expiresAt).format('DD MMM YYYY')}</p>
              <p>Amounts are as on today. The shop's receipt is final.</p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
