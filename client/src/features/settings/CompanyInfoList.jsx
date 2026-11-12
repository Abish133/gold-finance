import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Pencil, FileText, Printer, LogOut, Building } from 'lucide-react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Button, Drawer } from '@/components/ui';
import { useCompanyRaw, useFetch } from '@/hooks/useApi';
import { printTable } from '@/lib/printTable';
import { date, n } from '@/lib/format';
import { useKeys } from '@/features/loans/desk';
import { CompanyForm } from './CompanyPage';
import { PageActions } from '@/components/common/PageActions';

export function CompanyInfoList() {
  const navigate = useNavigate();
  const { data: c } = useCompanyRaw();
  const { data: years = [] } = useFetch('/admin/financial-years');
  const { data: branches = [] } = useFetch('/admin/branches');
  const status = useFetch('/dashboard/status');
  const [edit, setEdit] = useState(false);
  const fy = years.find((y) => y.is_current);
  const addr = c && [c.address1, c.address2, c.address3].filter(Boolean).join(', ');
  const rows = c ? [{ code: 'C-001', name: c.name, address: addr, phone: c.mobile || c.phone, licence_no: c.licence_no, licence_valid_till: c.licence_valid_till, gstin: c.gstin, proprietor: c.proprietor, fy: fy?.name }] : [];
  const print = () => printTable({ title: 'Company Information', company: c, rows: [...rows, ...branches.map((b) => ({ code: b.code, name: `Branch · ${b.name}`, address: b.address, phone: b.phone }))],
    columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Company Name' }, { key: 'address', label: 'Address' }, { key: 'phone', label: 'Phone / Mobile' }, { key: 'licence_no', label: 'Licence No' }, { key: 'gstin', label: 'GSTIN' }, { key: 'proprietor', label: 'Proprietor' }, { key: 'fy', label: 'FY' }] });
  useKeys({ f2: () => setEdit(true), f4: () => navigate('/settings/printer'), f9: print, escape: () => navigate('/') }, [c, branches]);
  const tile = (l, v, h, cls) => (
    <div className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800">
      <span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', cls)} />
      <p className="truncate text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p>
      <p className="num truncate text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p>
    </div>
  );
  return (
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 rounded-md px-4 py-2 text-white"><div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Company Information</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Name, address and licence printed on receipts and reports</p></div></section>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {tile('Companies', 1, `${branches.length} branch${branches.length === 1 ? '' : 'es'}`, 'bg-navy-800')}
        {tile('Current', 'C-001', c?.name, 'bg-amber-500')}
        {tile('Financial year', fy?.name || '-', fy ? `${date(fy.start_date)} - ${date(fy.end_date)}` : '', 'bg-blue-600')}
        {tile('Open loans', n(status.data?.open_loans), 'open loans in current company', 'bg-emerald-700')}
      </div>
      <div className="min-h-48 flex-1 overflow-auto rounded-md border border-ink-200 bg-white xl:min-h-0 dark:border-ink-800 dark:bg-ink-900">
        <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Companies</p>
        <table className="w-full text-[12px]">
          <thead className="navy-gradient sticky top-0 z-10 text-[10px] tracking-wider text-white uppercase"><tr>{['Code', 'Company Name', 'Address', 'Phone / Mobile', 'Licence No', 'Licence Valid Till', 'GSTIN', 'Proprietor', 'FY', ''].map((h) => <th key={h} className="px-2 py-2 text-left">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {rows.map((r) => (
              <tr key={r.code} onDoubleClick={() => setEdit(true)} className="cursor-pointer bg-navy-50/60 dark:bg-ink-800">
                <td className="px-2 py-1.5">{r.code}</td><td className="px-2 font-bold">{r.name}</td><td className="px-2">{r.address}</td><td className="px-2">{r.phone}</td><td className="px-2">{r.licence_no}</td>
                <td className="px-2">{r.licence_valid_till ? dayjs(r.licence_valid_till).format('DD/MM/YYYY') : ''}</td><td className="px-2">{r.gstin}</td><td className="px-2">{r.proprietor}</td><td className="px-2">{r.fy}</td>
                <td className="px-2"><span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">CURRENT</span></td>
              </tr>
            ))}
            {branches.map((b) => (
              <tr key={b.id} className="text-ink-600"><td className="px-2 py-1.5 pl-6">{b.code}</td><td className="px-2">Branch · {b.name}</td><td className="px-2">{b.address}</td><td className="px-2">{b.phone}</td><td colSpan={6} /></tr>
            ))}
          </tbody>
        </table>
      </div>
      <PageActions keys="F2 / Enter = edit company · F4 = receipt header · F9 = print · Esc = exit">
        <Button variant="outline" icon={Pencil} onClick={() => setEdit(true)}>Edit Company (F2)</Button>
        <Button variant="outline" icon={FileText} onClick={() => navigate('/settings/printer')}>Receipt Header (F4)</Button>
        <Button variant="outline" icon={Building} onClick={() => navigate('/settings/branches')}>Branches</Button>
        <span className="flex-1" />
        <Button variant="outline" icon={Printer} onClick={print}>Print (F9)</Button>
        <Button variant="outline" icon={LogOut} onClick={() => navigate('/')}>Exit (Esc)</Button>
      </PageActions>
      <Drawer open={edit} onClose={() => setEdit(false)} size="xl" icon={Building} title="Edit Company" subtitle="Printed on every bill, receipt and notice" bodyClassName="flex !px-4 !py-3 lg:!overflow-hidden"><CompanyForm embedded /></Drawer>
    </div>
  );
}
