import { useState } from 'react';
import { Gem, Boxes, Briefcase, TrendingUp } from 'lucide-react';
import { ResourcePage } from '@/components/common/ResourcePage';
import { Badge, Segmented } from '@/components/ui';
import { money } from '@/lib/format';
import { today } from '@/lib/format';

const activeCol = { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) };

export function ItemsPage() {
  const [tab, setTab] = useState('items');
  const toggle = <Segmented value={tab} onChange={setTab} options={[{ value: 'items', label: 'Items' }, { value: 'cats', label: 'Categories' }]} />;
  return tab === 'items' ? (
    <ResourcePage key="items" title="Items" singular="Item" endpoint="/masters/items" screen="m_items" icon={Gem} headerActions={toggle} defaults={{ is_active: 1 }}
      columns={[{ key: 'name', label: 'Item', sortable: true }, { key: 'local_name', label: 'Local name' }, { key: 'category_name', label: 'Category' }, activeCol]}
      fields={[{ name: 'name', label: 'Item name', required: true }, { name: 'local_name', label: 'Tamil / local name' },
        { name: 'category_id', label: 'Category', type: 'async-select', endpoint: '/masters/item-categories' }, { name: 'description', label: 'Description' }, { name: 'is_active', label: 'Active', type: 'switch' }]} />
  ) : (
    <ResourcePage key="cats" title="Item Categories" singular="Category" endpoint="/masters/item-categories" screen="m_items" icon={Gem} headerActions={toggle} defaults={{ is_active: 1 }}
      columns={[{ key: 'name', label: 'Category', sortable: true }, { key: 'metal_name', label: 'Metal' }, activeCol]}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'metal_id', label: 'Metal', type: 'async-select', endpoint: '/masters/metals' }, { name: 'description', label: 'Description' }, { name: 'is_active', label: 'Active', type: 'switch' }]} />
  );
}

export function MetalsPage() {
  const [tab, setTab] = useState('metals');
  const toggle = <Segmented value={tab} onChange={setTab} options={[{ value: 'metals', label: 'Metals' }, { value: 'purity', label: 'Purity' }]} />;
  return tab === 'metals' ? (
    <ResourcePage key="m" title="Metals" singular="Metal" endpoint="/masters/metals" screen="m_metals" icon={Boxes} headerActions={toggle} defaults={{ is_active: 1 }}
      columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Metal', sortable: true }, { key: 'local_name', label: 'Local name' }, activeCol]}
      fields={[{ name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'local_name', label: 'Local name' }, { name: 'is_active', label: 'Active', type: 'switch' }]} />
  ) : (
    <ResourcePage key="p" title="Purity" singular="Purity" endpoint="/masters/purities" screen="m_metals" icon={Boxes} headerActions={toggle} defaults={{ is_active: 1 }}
      columns={[{ key: 'name', label: 'Name' }, { key: 'metal_name', label: 'Metal' }, { key: 'purity', label: 'Purity %', type: 'number' }, activeCol]}
      fields={[{ name: 'metal_id', label: 'Metal', type: 'async-select', endpoint: '/masters/metals', required: true }, { name: 'name', label: 'Name (e.g. 22K)', required: true },
        { name: 'purity', label: 'Purity %', type: 'number', step: '0.01', required: true }, { name: 'is_active', label: 'Active', type: 'switch' }]} />
  );
}

export function DesignationsPage() {
  return (
    <ResourcePage title="Designations" singular="Designation" endpoint="/masters/designations" screen="m_designations" icon={Briefcase} defaults={{ is_active: 1 }}
      columns={[{ key: 'name', label: 'Designation', sortable: true }, { key: 'description', label: 'Description' }, activeCol]}
      fields={[{ name: 'name', label: 'Name', required: true }, { name: 'description', label: 'Description' }, { name: 'is_active', label: 'Active', type: 'switch' }]} />
  );
}

export function RatesPage() {
  return (
    <ResourcePage title="Gold & Silver Rate" singular="Rate" endpoint="/masters/rates" screen="m_rates" icon={TrendingUp} canDelete
      subtitle="Update daily. Loan rate per gram drives eligibility on the New Loan screen."
      defaults={{ rate_date: today(), purity: 91.6 }}
      columns={[{ key: 'rate_date', label: 'Date', type: 'date', sortable: true }, { key: 'metal_name', label: 'Metal' }, { key: 'purity', label: 'Purity', type: 'number' },
        { key: 'market_rate', label: 'Market rate / g', render: (r) => money(r.market_rate), align: 'right' }, { key: 'loan_rate', label: 'Loan rate / g', render: (r) => <b>{money(r.loan_rate)}</b>, align: 'right' }]}
      fields={[{ name: 'metal_id', label: 'Metal', type: 'async-select', endpoint: '/masters/metals', required: true }, { name: 'rate_date', label: 'Date', type: 'date', required: true },
        { name: 'purity', label: 'Purity (rate basis)', type: 'number', step: '0.01' }, { name: 'market_rate', label: 'Market rate per gram', type: 'money', required: true },
        { name: 'loan_rate', label: 'Loan rate per gram', type: 'money', required: true, hint: 'Amount you lend per gram before LTV' }]} />
  );
}
