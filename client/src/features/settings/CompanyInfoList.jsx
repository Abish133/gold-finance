import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Pencil, FileText, Printer, LogOut, Building } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Drawer } from '@/components/ui';
import { useCompany, useFetch } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { date, n } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { CompanyForm } from './CompanyPage';

export function CompanyInfoList() {
  const navigate = useNavigate();
  const { data: c } = useCompany();
  const { data: years = [] } = useFetch('/admin/financial-years');
  const { data: branches = [] } = useFetch('/admin/branches');
  const status = useFetch('/dashboard/status');
  const [edit, setEdit] = useState(false);
  const fy = years.find((y) => y.is_current);
  const addr = c && [c.address1, c.address2, c.address3].filter(Boolean).join(', ');
  const rows = c ? [{ code: 'C-001', name: c.name, address: addr, phone: c.mobile || c.phone, licence_no: c.licence_no, licence_valid_till: c.licence_valid_till, gstin: c.gstin, fy: fy?.name }] : [];
  const print = () => printTable({ title: 'Company Information', company: c, rows: [...rows, ...branches.map((b) => ({ code: b.code, name: `Branch · ${b.name}`, address: b.address, phone: b.phone }))],
    columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Company Name' }, { key: 'address', label: 'Address' }, { key: 'phone', label: 'Phone / Mobile' }, { key: 'licence_no', label: 'Licence No' }, { key: 'gstin', label: 'GSTIN' }, { key: 'fy', label: 'FY' }] });
  useKeys({ f2: () => setEdit(true), f4: () => navigate('/settings/printer'), f9: print, escape: () => navigate('/') }, [c, branches]);
  const tile = (l, v, h, cls) => <div className={clsx('card border-t-4 px-4 py-3', cls)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold">{v}</p><p className="text-[11px] text-ink-500">{h}</p></div>;
  return (
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Company Information</h1><p className="text-sm text-navy-100">Name, address and licence printed on receipts and reports</p></section>
      <div className="grid gap-3 sm:grid-cols-4">
        {tile('Companies', 1, `${branches.length} branch${branches.length === 1 ? '' : 'es'}`, 'border-t-navy-800')}
        {tile('Current', 'C-001', c?.name, 'border-t-amber-500 bg-cream-100')}
        {tile('Financial year', fy?.name || '-', fy ? `${date(fy.start_date)} - ${date(fy.end_date)}` : '', 'border-t-blue-600')}
        {tile('Open loans', n(status.data?.open_loans), 'open loans in current company', 'border-t-emerald-700')}
      </div>
      <div className="card min-h-[calc(100vh-24rem)] overflow-auto">
        <p className="navy-gradient px-3 py-2 text-xs font-bold text-white uppercase">Companies</p>
        <table className="w-full text-sm">
          <thead className="bg-navy-800 text-white"><tr>{['Code', 'Company Name', 'Address', 'Phone / Mobile', 'Licence No', 'Licence Valid Till', 'GSTIN', 'FY', ''].map((h) => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
            {rows.map((r) => (
              <tr key={r.code} onDoubleClick={() => setEdit(true)} className="cursor-pointer bg-navy-50/60 dark:bg-ink-800">
                <td className="px-2 py-2">{r.code}</td><td className="px-2 font-bold">{r.name}</td><td className="px-2">{r.address}</td><td className="px-2">{r.phone}</td><td className="px-2">{r.licence_no}</td>
                <td className="px-2">{r.licence_valid_till ? dayjs(r.licence_valid_till).format('DD/MM/YYYY') : ''}</td><td className="px-2">{r.gstin}</td><td className="px-2">{r.fy}</td>
                <td className="px-2"><span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">CURRENT</span></td>
              </tr>
            ))}
            {branches.map((b) => (
              <tr key={b.id} className="text-ink-600"><td className="px-2 py-1.5 pl-6">{b.code}</td><td className="px-2">Branch · {b.name}</td><td className="px-2">{b.address}</td><td className="px-2">{b.phone}</td><td colSpan={5} /></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Pencil} onClick={() => setEdit(true)}>Edit Company (F2)</Button>
        <Button variant="outline" icon={FileText} onClick={() => navigate('/settings/printer')}>Receipt Header (F4)</Button>
        <Button variant="outline" icon={Building} onClick={() => navigate('/settings/branches')}>Branches</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </div>
      <p className="px-1 text-xs text-ink-500">F2 / Enter = edit company · F4 = receipt header · F9 = print · Esc = exit</p>
      <Drawer open={edit} onClose={() => setEdit(false)} size="xl" icon={Building} title="Edit Company" subtitle="Printed on every bill, receipt and notice"><CompanyForm embedded /></Drawer>
    </div>
  );
}
