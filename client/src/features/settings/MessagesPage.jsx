import { useState } from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Button, DataTable, PageHeader, Tabs } from '@/components/ui';
import { useList, useFetch } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { SettingsForm } from './SettingsForm';

export default function MessagesPage() {
  const [tab, setTab] = useState('queue');
  const queue = useList(tab === 'queue' ? '/admin/message-queue' : null, {});
  const { data: tiles } = useFetch('/desk/sms-tiles');
  const { data: st } = useFetch('/admin/settings', { scope: 'global' });
  return (
    <div className="animate-rise">
      <PageHeader icon={MessageSquare} title="SMS / WhatsApp" subtitle="Automatic customer alerts on loan, interest and release" />
      <div className={`mb-3 flex items-center gap-3 rounded-md border p-4 ${st?.SMS_ENABLED === '1' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <MessageSquare className="size-5" /><div className="flex-1"><p className="font-bold">{st?.SMS_ENABLED === '1' ? 'SMS service is active' : 'SMS service is not active'}</p><p className="text-sm">{st?.SMS_ENABLED === '1' ? 'Messages are sent through your provider every 30 seconds.' : 'Enter your SMS provider URL in Settings and switch on Enable SMS.'}</p></div>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[['Pending', tiles?.pending, 'in queue', 'border-t-gold-500'], ['Sent today', tiles?.sent_today, 'all types', 'border-t-emerald-600'], ['Failed', tiles?.failed, 'retry available', 'border-t-rose-600'], ['This month', tiles?.this_month, 'SMS sent this month', 'border-t-navy-500']].map(([l, v, h, c]) => (
          <div key={l} className={`card border-t-4 px-4 py-3 ${c}`}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900">{v || 0}</p><p className="text-[11px] text-ink-500">{h}</p></div>
        ))}
      </div>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'queue', label: 'Queue & Log' }, { value: 'templates', label: 'Templates' }, { value: 'settings', label: 'Auto SMS Rules' }]} />
      {tab === 'settings' && <SettingsForm allowBranchScope={false} sections={[{ title: 'SMS gateway', subtitle: 'Any HTTP SMS provider (DLT approved) - use {phone} and {message} in the URL', fields: [
        { key: 'SMS_ENABLED', label: 'Enable SMS', type: 'bool' },
        { key: 'SMS_PROVIDER_URL', label: 'Provider URL', hint: 'https://api.provider.com/send?apikey=XXX&to={phone}&text={message}' },
        { key: 'SMS_ON_NEW_LOAN', label: 'On new loan', type: 'bool' }, { key: 'SMS_ON_INTEREST', label: 'On interest / part payment', type: 'bool' },
        { key: 'SMS_ON_RELEASE', label: 'On release', type: 'bool' }, { key: 'SMS_ON_DUE_REMINDER', label: 'Due reminders with notices', type: 'bool' },
      ] }]} />}
      {tab === 'templates' && (
        <ResourcePage title="Templates" singular="Template" endpoint="/admin/message-templates" screen="s_messages" defaults={{ is_active: 1 }}
          columns={[{ key: 'event_key', label: 'Event' }, { key: 'name', label: 'Name' }, { key: 'body', label: 'Message', className: 'max-w-lg text-xs' }]}
          fields={[{ name: 'event_key', label: 'Event key', type: 'select', options: ['NEW_LOAN', 'INTEREST', 'RELEASE', 'DUE_REMINDER'], required: true },
            { name: 'name', label: 'Name', required: true }, { name: 'dlt_template_id', label: 'DLT template id' },
            { name: 'body', label: 'Message', type: 'textarea', span: 'full', required: true, hint: 'Variables: {name} {loan_no} {amount} {date} {weight}' },
            { name: 'is_active', label: 'Active', type: 'switch' }]} />
      )}
      {tab === 'queue' && (
        <>
          <Button className="mb-3" variant="outline" icon={RotateCcw} onClick={async () => { await api.post('/admin/message-queue/retry'); toast.success('Queued for retry'); queue.refetch(); }}>Retry failed</Button>
          <DataTable dense rows={queue.data?.data} loading={queue.isLoading} columns={[
            { key: 'created_at', label: 'Time', render: (r) => dateTime(r.created_at) }, { key: 'event_key', label: 'Event' }, { key: 'phone', label: 'Mobile' },
            { key: 'message', label: 'Message', className: 'max-w-md text-xs' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'last_error', label: 'Error', className: 'text-xs' },
          ]} />
        </>
      )}
    </div>
  );
}
