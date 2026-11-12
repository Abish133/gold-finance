import { useState } from 'react';
import { MessageSquare, RotateCcw, BellRing } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Button, DataTable } from '@/components/ui';
import { useList, useFetch } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { amount, date, dateTime } from '@/lib/format';
import { SettingsForm } from './SettingsForm';

/* every message the app sends: [what it is for, the {variables} it can use] - same list as the server */
const MSG = {
  NEW_LOAN: ['New loan (SMS)', '{name} {loan_no} {amount} {date} {weight} {due_date}'],
  INTEREST: ['Interest / part payment (SMS)', '{name} {loan_no} {amount} {date}'],
  RELEASE: ['Loan closed (SMS)', '{name} {loan_no} {amount} {date}'],
  DUE_REMINDER: ['Due reminder / auction notice (SMS)', '{name} {loan_no} {amount} {date} {due_date}'],
  BIRTHDAY: ['Birthday wishes (SMS)', '{name} {company}'],
  OWNER_SUMMARY: ['Daily summary to owner (SMS)', '{branch} {date} {loans} {lent} {releases} {released} {interest} {cash} {open} {open_amount} {overdue}'],
  WA_NEW_LOAN: ['New loan (WhatsApp)', '{shop} {name} {loan_no} {amount} {date} {items} {due_date}'],
  WA_RELEASE: ['Loan released (WhatsApp)', '{shop} {name} {loan_no} {amount} {date}'],
  WA_PART_PAYMENT: ['Part payment (WhatsApp)', '{shop} {name} {loan_no} {amount} {date} {balance}'],
  WA_INTEREST: ['Interest received (WhatsApp)', '{shop} {name} {loan_no} {amount} {date} {months}'],
};

export default function MessagesPage() {
  const [tab, setTab] = useState('queue');
  const queue = useList(tab === 'queue' ? '/admin/message-queue' : null, {});
  const { data: tiles } = useFetch('/desk/sms-tiles');
  const { data: st } = useFetch('/admin/settings', { scope: 'global' });
  const { isAllBranches } = useAuth();
  const due = useFetch(tab === 'settings' && !isAllBranches ? '/admin/reminders/preview' : null);
  const [sending, setSending] = useState(false);
  const sendNow = async () => {
    setSending(true);
    try { const r = await api.post('/admin/reminders/run'); toast.success(`${r.data.queued} of ${r.data.due} reminders queued`); due.refetch(); queue.refetch?.(); } catch (e) { toast.error(e.message); }
    setSending(false);
  };
  return (
    /* fit-screen: the page fits the window; each tab's content scrolls on its own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <MessageSquare className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">SMS / WhatsApp</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Automatic customer alerts on loan, interest and release</p></div>
        <div className="flex overflow-hidden rounded-md border border-white/20">
          {[['queue', 'Queue & Log'], ['templates', 'Templates'], ['settings', 'Auto SMS Rules']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1 text-[12px] font-semibold transition ${tab === k ? 'bg-white text-navy-900' : 'text-white/75 hover:bg-white/10'}`}>{l}</button>
          ))}
        </div>
      </section>
      <div className={`flex shrink-0 items-center gap-2.5 rounded-md border px-3 py-1.5 ${st?.SMS_ENABLED === '1' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}>
        <span className={`size-2 shrink-0 rounded-full ${st?.SMS_ENABLED === '1' ? 'animate-pulse bg-emerald-600' : 'bg-amber-500'}`} /><div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-[12px] [&>p:first-child]:text-[13px]"><p className="font-bold">{st?.SMS_ENABLED === '1' ? 'SMS service is active' : 'SMS service is not active'}</p><p className="truncate">{st?.SMS_ENABLED === '1' ? 'Messages are sent through your provider every 30 seconds.' : 'Enter your SMS provider URL in Settings and switch on Enable SMS.'}</p></div>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {[['Pending', tiles?.pending, 'in queue', 'bg-amber-500'], ['Sent today', tiles?.sent_today, 'all types', 'bg-emerald-600'], ['Failed', tiles?.failed, 'retry available', 'bg-rose-600'], ['This month', tiles?.this_month, 'SMS sent this month', 'bg-navy-500']].map(([l, v, h, c]) => (
          <div key={l} className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800"><span aria-hidden className={`absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm ${c}`} /><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p><p className="flex items-baseline gap-2"><span className="num text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v || 0}</span><span className="truncate text-[10px] text-ink-500">{h}</span></p></div>
        ))}
      </div>
      {tab === 'settings' && <div className="flex flex-col gap-2 xl:min-h-0 xl:flex-1"><SettingsForm compact allowBranchScope={false} sections={[{ title: 'SMS gateway', subtitle: 'Any HTTP SMS provider (DLT approved) - use {phone} and {message} in the URL', fields: [
        { key: 'SMS_ENABLED', label: 'Enable SMS', type: 'bool' },
        { key: 'SMS_PROVIDER_URL', label: 'Provider URL', wide: true, hint: 'https://api.provider.com/send?apikey=XXX&to={phone}&text={message}' },
        { key: 'SMS_ON_NEW_LOAN', label: 'On new loan', type: 'bool' }, { key: 'SMS_ON_INTEREST', label: 'On interest / part payment', type: 'bool' },
        { key: 'SMS_ON_RELEASE', label: 'On release', type: 'bool' }, { key: 'SMS_ON_DUE_REMINDER', label: 'Due reminders (with notices and daily)', type: 'bool' },
      ] }, { title: 'Daily due reminders', subtitle: 'Every day after the set time, the server sends a due-reminder SMS to customers who need one', fields: [
        { key: 'SMS_AUTO_REMINDER', label: 'Send due reminders every day', type: 'bool' },
        { key: 'SMS_REMINDER_TIME', label: 'Send after (24 hours)', type: 'time' },
        { key: 'SMS_REMINDER_MONTHS', label: 'Interest not paid for (months)', type: 'number' },
        { key: 'SMS_REMINDER_OVERDUE', label: 'Also remind loans past the settle-before date', type: 'bool' },
        { key: 'SMS_REMINDER_GAP_DAYS', label: 'Do not remind the same loan again within (days)', type: 'number' },
      ] }, { title: 'Automations', subtitle: 'Optional - each one is off until you switch it on', fields: [
        { key: 'OWNER_PHONE', label: 'Owner mobile(s) for the daily summary', hint: '9443xxxxxx, 9894xxxxxx', wide: true },
        { key: 'OWNER_SUMMARY_TIME', label: 'Send the daily summary after', type: 'time' },
        { key: 'BIRTHDAY_TIME', label: 'Send birthday wishes after', type: 'time' },
        { key: 'OWNER_SUMMARY', label: "Daily summary to owner (loans, releases, interest, cash)", type: 'bool' },
        { key: 'SMS_ON_BIRTHDAY', label: 'Birthday wishes to customers with an open loan', type: 'bool' },
        { key: 'RATE_WATCH', label: 'Remind when loans come close to their gold value', type: 'bool' },
        { key: 'CUSTOMER_LINK_DAYS', label: 'Customer link works for (days)', type: 'number' },
        { key: 'CUSTOMER_LINK_ENABLED', label: 'Customer loan-status link (view only)', type: 'bool' },
      ] }]} />
      {!isAllBranches && (
        <div className="card flex min-h-64 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-ink-200 px-3 py-2 dark:border-ink-800">
            <BellRing className="size-4 text-navy-700 dark:text-white" /><div className="min-w-0 flex-1"><p className="text-[13px] font-bold">Due reminders today · {due.data?.loans.length ?? 0} loans</p>
              <p className="truncate text-[11px] text-ink-500">{due.data && (!due.data.smsEnabled ? 'SMS is switched off - nothing will be sent.' : !due.data.templateOn ? 'Due reminders are switched off above.' : 'Loans that match the rules above and were not reminded recently.')}</p></div>
            <Button variant="gold" className="h-8 text-[12px]" icon={BellRing} loading={sending} disabled={!due.data?.loans.length} onClick={sendNow}>Send Reminders Now</Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2"><DataTable fill rows={due.data?.loans || []} empty="No loan needs a reminder today" columns={[
            { key: 'bill_no', label: 'Loan No' }, { key: 'customer_name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'loan_date', label: 'Loan date', render: (r) => date(r.loan_date) },
            { key: 'due_date', label: 'Settle before', render: (r) => date(r.due_date) }, { key: 'last_paid', label: 'Last paid', render: (r) => date(r.last_paid) },
            { key: 'current_principal', label: 'Balance', render: (r) => amount(r.current_principal) }, { key: 'last_reminder', label: 'Last reminder', render: (r) => (r.last_reminder ? dateTime(r.last_reminder) : '-') },
          ]} /></div>
        </div>
      )}
      </div>}
      {tab === 'templates' && (
        <div className="flex flex-col xl:min-h-0 xl:flex-1"><ResourcePage title="Templates" singular="Template" endpoint="/admin/message-templates" screen="s_messages" defaults={{ is_active: 1 }}
          columns={[{ key: 'event_key', label: 'Message', render: (r) => <span className="flex items-center gap-1.5"><span className={`rounded-sm px-1.5 py-px text-[10px] font-bold ${r.event_key.startsWith('WA_') ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{r.event_key.startsWith('WA_') ? 'WhatsApp' : 'SMS'}</span>{MSG[r.event_key]?.[0] || r.event_key}</span> },
            { key: 'name', label: 'Name' }, { key: 'body', label: 'Text', className: 'max-w-lg truncate text-xs' }, { key: 'is_active', label: 'On', render: (r) => (r.is_active ? 'Yes' : 'Off') }]}
          fields={[{ name: 'event_key', label: 'Message for', type: 'select', options: Object.entries(MSG).map(([value, [label]]) => ({ value, label })), required: true },
            { name: 'name', label: 'Name', required: true }, { name: 'dlt_template_id', label: 'DLT template id' },
            { name: 'body', label: 'Message', type: 'textarea', span: 'full', required: true, hint: (v) => (MSG[v.event_key] ? `You can use: ${MSG[v.event_key][1]}` : 'Choose what the message is for to see its variables') },
            { name: 'is_active', label: 'Active', type: 'switch' }]} /></div>
      )}
      {tab === 'queue' && (
        <>
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900">
            <Button variant="outline" className="h-8 text-[12px]" icon={RotateCcw} onClick={async () => { await api.post('/admin/message-queue/retry'); toast.success('Queued for retry'); queue.refetch(); }}>Retry failed</Button>
            <span className="ml-auto text-[11px] text-ink-500">{queue.data?.data?.length || 0} messages</span>
          </div>
          <DataTable fill rows={queue.data?.data} loading={queue.isLoading} columns={[
            { key: 'created_at', label: 'Time', render: (r) => dateTime(r.created_at) }, { key: 'event_key', label: 'Event' }, { key: 'phone', label: 'Mobile' },
            { key: 'message', label: 'Message', className: 'max-w-md truncate text-[11px]' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'last_error', label: 'Error', className: 'text-xs' },
          ]} />
        </>
      )}
    </div>
  );
}
