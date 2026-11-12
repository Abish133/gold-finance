import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Sunrise, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { amount, n } from '@/lib/format';

const KEY = (uid) => `gf.briefing.${uid}`;

/** First login of the day: what needs attention today, in one small box. Shown once per day per user on this computer. */
export function MorningBriefing() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !can('dashboard')) return;
    const today = dayjs().format('YYYY-MM-DD');
    try { if (localStorage.getItem(KEY(user.id)) === today) return; } catch { return; }
    api.get('/dashboard/briefing').then((r) => { setData(r.data); setOpen(true); }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { try { localStorage.setItem(KEY(user.id), dayjs().format('YYYY-MM-DD')); } catch { /* private mode */ } setOpen(false); };
  const go = (path) => { close(); navigate(path); };
  if (!data) return null;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const y = data.yesterday;
  // things to act on - each with where to go
  const todo = [
    !data.rateEntered && { bad: true, text: "Today's gold / silver rate is not entered yet", go: '/masters?tab=rates', btn: 'Enter rate' },
    n(data.overdue.c) > 0 && { bad: true, text: `${data.overdue.c} loans are past their settle date (₹${amount(data.overdue.amt)})`, go: '/loans/calculator', btn: 'View' },
    n(data.risk.underwater) > 0 && { bad: true, text: `${data.risk.underwater} loans are now worth less than loan + interest`, go: '/analytics', btn: 'View' },
    n(data.risk.at_risk) > n(data.risk.underwater) && { text: `${n(data.risk.at_risk) - n(data.risk.underwater)} loans are close to the value of their gold`, go: '/analytics', btn: 'View' },
    n(data.dueWeek.c) > 0 && { text: `${data.dueWeek.c} loans reach their settle date this week (₹${amount(data.dueWeek.amt)})`, go: '/loans/calculator', btn: 'View' },
    n(data.failedMessages) > 0 && { text: `${data.failedMessages} SMS / WhatsApp could not be sent this week`, go: '/settings/messages', btn: 'Check' },
    data.backupAgeDays == null ? { bad: true, text: 'No backup has been taken yet', go: '/settings/backup', btn: 'Backup' }
      : data.backupAgeDays >= 2 && { text: `Last backup was ${data.backupAgeDays} days ago`, go: '/settings/backup', btn: 'Backup' },
    data.lastCashCount && Math.abs(n(data.lastCashCount.difference)) >= 1 && { text: `Last cash count (${dayjs(data.lastCashCount.count_date).format('DD/MM')}) did not tally by ₹${amount(Math.abs(data.lastCashCount.difference))}`, go: '/accounts/denomination', btn: 'Open' },
  ].filter(Boolean);

  return (
    <Modal open={open} onClose={close} icon={Sunrise} tone="amber" size="lg" title={`${greet}, ${user.full_name.split(' ')[0]}`} subtitle={`Your briefing for ${dayjs(data.date).format('dddd, DD MMM YYYY')}`}
      footer={<><Button variant="outline" onClick={() => go('/analytics')}>Open analytics</Button><Button variant="gold" onClick={close} data-autofocus>Start the day</Button></>}>
      <div className="space-y-3">
        {/* yesterday at a glance */}
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Yesterday</p>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-ink-200 sm:grid-cols-4 dark:border-ink-800">
            {[['New loans', `${n(y.loans)} · ₹${amount(y.lent)}`], ['Releases', n(y.releases)], ['Interest', `₹${amount(y.interest)}`], ['Cash closing', `₹${amount(y.cash)}`]].map(([l, v]) => (
              <div key={l} className="min-w-0 border-ink-200 px-2.5 py-1.5 not-last:border-r dark:border-ink-800">
                <p className="truncate text-[10px] font-semibold text-ink-500 uppercase">{l}</p><p className="num truncate text-[13px] font-bold text-navy-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2 rounded-md bg-ink-50 px-3 py-2 text-[12px] dark:bg-ink-800/60">
          <span className="text-ink-600 dark:text-ink-300">Interest built up on open loans, not yet paid (estimate)</span>
          <b className="num text-[14px] text-navy-900 dark:text-white">₹{amount(data.risk.accrued)}</b>
        </div>
        {/* to-do */}
        <div>
          <p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Needs attention today · {todo.length}</p>
          {!todo.length ? (
            <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 className="size-4" />All clear - nothing pending.</p>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-md border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
              {todo.map((t) => (
                <li key={t.text}>
                  <button type="button" onClick={() => go(t.go)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-ink-50 dark:hover:bg-ink-800/50">
                    <AlertTriangle className={clsx('size-4 shrink-0', t.bad ? 'text-rose-600' : 'text-amber-600')} />
                    <span className="min-w-0 flex-1">{t.text}</span>
                    <span className="flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-navy-700 dark:text-ink-300">{t.btn}<ChevronRight className="size-3.5" /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
