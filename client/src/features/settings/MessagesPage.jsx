import { useState } from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Button, DataTable, PageHeader, Tabs } from '@/components/ui';
import { useList } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { SettingsForm } from './SettingsForm';

export default function MessagesPage() {
  const [tab, setTab] = useState('settings');
  const queue = useList(tab === 'queue' ? '/admin/message-queue' : null, {});
  return (
    <div className="animate-rise">
      <PageHeader icon={MessageSquare} title="SMS / WhatsApp" subtitle="Automatic customer alerts on loan, interest and release" />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'settings', label: 'Settings' }, { value: 'templates', label: 'Templates' }, { value: 'queue', label: 'Sent log' }]} />
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
