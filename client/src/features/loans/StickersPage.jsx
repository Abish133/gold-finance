import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tag, Printer } from 'lucide-react';
import { Button, DataTable, Input, PageHeader, Segmented } from '@/components/ui';
import { useList, useCompany, useSettings } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useUtils';
import { printElement } from '@/lib/print';
import { Stickers } from '@/features/print/Sticker';
import { api } from '@/lib/api';
import { today } from '@/lib/format';

export default function StickersPage() {
  const [state, set] = useTableState({ status: 'OPEN', from: today(), to: today(), pageSize: 100 });
  const [onlyPending, setOnlyPending] = useState('1');
  const list = useList('/loans', state);
  const [sel, setSel] = useState([]);
  const { data: company } = useCompany();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const rows = (list.data?.data || []).filter((r) => onlyPending !== '1' || !r.sticker_printed_at);

  const print = async () => {
    const loans = rows.filter((r) => sel.includes(r.id));
    await printElement(<Stickers loans={loans} settings={settings || {}} company={company} />, { title: 'Stickers' });
    await api.post('/loans/stickers/printed', { ids: sel });
    qc.invalidateQueries({ queryKey: ['/loans'] });
    setSel([]);
  };

  return (
    <div className="animate-rise">
      <PageHeader icon={Tag} title="Jewel Packet Stickers" subtitle="Barcode stickers for jewel packets - scan them at the counter or during stock check"
        actions={<Button variant="gold" icon={Printer} disabled={!sel.length} onClick={print}>Print {sel.length || ''} stickers</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input type="date" className="w-40" value={state.from} onChange={(e) => set({ from: e.target.value })} />
        <Input type="date" className="w-40" value={state.to} onChange={(e) => set({ to: e.target.value })} />
        <Segmented value={onlyPending} onChange={setOnlyPending} options={[{ value: '1', label: 'Not printed' }, { value: '0', label: 'All' }]} />
      </div>
      <DataTable selectable selected={sel} onSelect={setSel} rows={rows} loading={list.isLoading} columns={[
        { key: 'bill_no', label: 'Loan no' }, { key: 'loan_date', label: 'Date', type: 'date' }, { key: 'customer_name', label: 'Customer' },
        { key: 'item_summary', label: 'Items' }, { key: 'net_wt', label: 'Net wt', type: 'weight' }, { key: 'principal', label: 'Amount', type: 'money' },
      ]} />
    </div>
  );
}
