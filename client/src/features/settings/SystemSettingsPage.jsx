import { useEffect, useState } from 'react';
import { Settings2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { useFetch } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { SettingsForm } from './SettingsForm';

function BillBook() {
  const { isAllBranches, can } = useAuth();
  const { data, refetch } = useFetch(isAllBranches ? null : '/admin/sequences');
  const [v, setV] = useState({});
  useEffect(() => { if (data) setV(data); }, [data]);
  if (isAllBranches) return null;
  return (
    <Card title="Bill book / next numbers" subtitle="Change only when starting a new bill book" icon={Hash}>
      <div className="grid items-end gap-4 sm:grid-cols-4">
        <Field label="Next loan no"><Input type="number" value={v.LOAN || ''} onChange={(e) => setV({ ...v, LOAN: e.target.value })} /></Field>
        <Field label="Next receipt no"><Input type="number" value={v.RECEIPT || ''} onChange={(e) => setV({ ...v, RECEIPT: e.target.value })} /></Field>
        <Field label="Next customer no"><Input type="number" value={v.CUSTOMER || ''} onChange={(e) => setV({ ...v, CUSTOMER: e.target.value })} /></Field>
        {can('s_system', 'edit') && <Button onClick={async () => { try { await api.put('/admin/sequences', v); toast.success('Numbers updated'); refetch(); } catch (e) { toast.error(e.message); } }}>Update numbers</Button>}
      </div>
    </Card>
  );
}

export default function SystemSettingsPage() {
  return (
    <div className="animate-rise space-y-6">
      <PageHeader icon={Settings2} title="System Settings" subtitle="Business rules. Branch-level values override the defaults." />
      <BillBook />
      <SettingsForm sections={[
        { title: 'Loan rules', fields: [
          { key: 'ROUND_LOAN_TO', label: 'Round eligible amount down to (₹)', type: 'number' },
          { key: 'ROUND_INTEREST_TO', label: 'Round interest to (₹)', type: 'number' },
          { key: 'MONTH_ROUND_HALF_DAYS', label: 'Months mode: extra days counted as half month up to', type: 'number', hint: 'e.g. 15 → 1-15 days = ½ month, 16+ = full month. 0 = always full' },
          { key: 'DEFAULT_TENURE_MONTHS', label: 'Default tenure (months)', type: 'number' },
          { key: 'ALLOW_LOAN_ABOVE_ELIGIBLE', label: 'Allow loan above eligible amount', type: 'bool' },
          { key: 'BLOCK_LOAN_FOR_BLOCKED_CUSTOMER', label: 'Stop loans for blocked customers', type: 'bool' },
          { key: 'CANCEL_SAME_DAY_ONLY', label: 'Allow cancelling only same-day loans', type: 'bool' },
          { key: 'ENFORCE_DAY_CLOSE', label: 'Lock entries on closed days', type: 'bool' },
        ] },
        { title: 'Numbering', fields: [
          { key: 'LOAN_NO_RESET_YEARLY', label: 'Restart loan numbers every financial year', type: 'bool' },
          { key: 'LOAN_NO_FORMAT', label: 'Loan number format', hint: 'Tokens: {PREFIX} {NO} {FY} {BRANCH}' },
          { key: 'RECEIPT_PREFIX', label: 'Receipt number prefix' },
        ] },
        { title: 'Auction', fields: [
          { key: 'AUCTION_AFTER_DAYS_OVERDUE', label: 'Show in auction list after overdue days', type: 'number' },
          { key: 'NOTICE_POSTAGE', label: 'Default notice postage (₹)', type: 'number' },
        ] },
      ]} />
    </div>
  );
}
