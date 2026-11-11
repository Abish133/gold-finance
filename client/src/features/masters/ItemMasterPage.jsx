import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Save, Trash2, FileDown, Printer, FileSpreadsheet, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Badge, Button, ConfirmDrawer, Field, Input } from '@/components/ui';
import { useList, useCompany } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exporters';
import { printTable } from '@/lib/printTable';
import { ExitButton, useKeys } from '@/features/loans/desk';

/** Item Master (desktop: frmItemCategoryList) - loan item categories and item names. */
export default function ItemMasterPage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const cats = useList('/masters/item-categories', { all: 1 });
  const items = useList('/masters/items', { all: 1 });
  const [cat, setCat] = useState(null);
  const [show, setShow] = useState('all');
  const [q, setQ] = useState('');
  const [ci, setCi] = useState({ name: '', description: '' });
  const [it, setIt] = useState({ name: '', local_name: '', description: '' });
  const [del, setDel] = useState(null);
  const catList = cats.data?.data || [];
  const itemList = items.data?.data || [];
  useEffect(() => { if (!cat && catList.length) setCat(catList[0]); }, [catList, cat]);
  useEffect(() => { if (cat) setCi({ id: cat.id, name: cat.name, description: cat.description || '', metal_id: cat.metal_id }); }, [cat]);
  const rows = useMemo(() => itemList.filter((i) => (!cat || i.category_id === cat.id) && (show === 'all' || (show === 'used' ? i.used_in_loans > 0 : !i.used_in_loans))
    && (!q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.local_name || '').includes(q))), [itemList, cat, show, q]);
  const refresh = () => { cats.refetch(); items.refetch(); };
  const saveItem = async () => {
    if (!it.name) return toast.error('Enter item name');
    try { if (it.id) await api.put(`/masters/items/${it.id}`, { ...it, category_id: cat?.id }); else await api.post('/masters/items', { ...it, category_id: cat?.id, is_active: 1 }); toast.success('Item saved'); setIt({ name: '', local_name: '', description: '' }); refresh(); } catch (e) { toast.error(e.message); }
  };
  const saveCat = async () => {
    if (!ci.name) return toast.error('Enter category name');
    try { const r = ci.id ? await api.put(`/masters/item-categories/${ci.id}`, ci) : await api.post('/masters/item-categories', { ...ci, is_active: 1 }); toast.success('Category saved'); setCat(r.data); refresh(); } catch (e) { toast.error(e.message); }
  };
  const used = itemList.filter((i) => i.used_in_loans > 0).length;
  const cols = [{ key: 'id', label: 'Code' }, { key: 'name', label: 'Item Name' }, { key: 'local_name', label: 'Local name' }, { key: 'description', label: 'Description' }, { key: 'used_in_loans', label: 'Used in Loans', type: 'number' }];
  const print = () => printTable({ title: `Item list · ${cat?.name || ''}`, company, columns: cols, rows });
  useKeys({ 'ctrl+n': () => setIt({ name: '', local_name: '', description: '' }), f2: saveItem, delete: () => it.id && setDel(it), 'ctrl+p': print, f9: print, f10: () => exportCsv('items', cols, rows), escape: () => navigate('/') }, [it, cat, rows]);

  return (
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 rounded-md px-4 py-2 text-white"><div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Item Master</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Loan item categories and item names</p></div></section>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 shrink-0 rounded-md border border-ink-200 bg-white px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
        <Field label="Search item / category"><Input className="!h-8 w-72 text-[13px]" prefix={<Search className="size-3.5" />} value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <div><p className="label">Show</p><div className="flex">{[['all', 'All items'], ['used', 'In use'], ['unused', 'Unused']].map(([k, l]) => <button key={k} type="button" onClick={() => setShow(k)} className={clsx('-ml-px flex h-8 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md', show === k ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300')}>{show === k && <span className="relative flex size-1.5" aria-hidden><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>}{l}</button>)}</div></div>
        <span className="ml-auto pb-2 text-[11px] text-ink-500">{rows.length} items in {cat?.name}</span>
      </div>
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {[['Categories', catList.length, catList.map((c) => c.name).join(' - '), 'bg-navy-900 dark:bg-white'], ['Items', itemList.length, 'all categories', 'bg-amber-500'], ['In use', used, 'used in loans', 'bg-blue-600'], ['Unused', itemList.length - used, 'can be deleted', 'bg-emerald-600']].map(([l, v, h, c]) => (
          <div key={l} className="relative min-w-0 border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800"><span aria-hidden className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', c)} /><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p><p className="num text-[15px] leading-tight font-bold text-navy-900 dark:text-white">{v}</p><p className="truncate text-[10px] text-ink-500">{h}</p></div>
        ))}
      </div>
      <div className="grid items-stretch gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[340px_1fr]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Categories · {catList.length}</p>
          <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10 bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr><th className="px-3 py-1.5 text-left">Category</th><th className="px-3 text-left">Description</th><th className="px-3 text-right">Items</th><th className="px-3 text-right">Used</th></tr></thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{catList.map((c) => (
              <tr key={c.id} onClick={() => setCat(c)} className={clsx('cursor-pointer', cat?.id === c.id ? 'bg-emerald-50 font-semibold dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}><td className="px-3 py-1 uppercase">{c.name}</td><td className="px-3">{c.description}</td><td className="num px-3 text-right">{c.item_count}</td><td className="num px-3 text-right">{c.used || '-'}</td></tr>
            ))}</tbody>
          </table>
          </div>
          <div className="shrink-0 space-y-2 border-t border-ink-200 bg-ink-50/50 p-2.5 dark:border-ink-800 dark:bg-ink-800/30">
            <p className="text-[10px] font-bold tracking-wider text-navy-900 uppercase dark:text-white">{ci.id ? `Edit category · ${ci.name}` : 'New category'}</p>
            <div className="grid grid-cols-2 gap-1.5"><Field label="Category name"><Input value={ci.name} onChange={(e) => setCi({ ...ci, name: e.target.value })} /></Field><Field label="Description"><Input value={ci.description} onChange={(e) => setCi({ ...ci, description: e.target.value })} /></Field></div>
            <div className="grid grid-cols-2 gap-1.5 [&_button]:h-8 [&_button]:w-full [&_button]:text-[12px]"><Button size="sm" variant="outline" icon={Plus} onClick={() => setCi({ name: '', description: '' })}>New Category</Button><Button size="sm" icon={Save} onClick={saveCat}>Save Category</Button></div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
          <p className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 text-[11px] font-bold tracking-wider text-navy-900 uppercase dark:border-ink-800 dark:text-white"><span className="h-3.5 w-0.5 rounded-sm bg-navy-900 dark:bg-white" />Items in {cat?.name} · {rows.length} items</p>
          <div className="grid shrink-0 items-end gap-2 border-b border-ink-200 bg-ink-50/50 p-2.5 sm:grid-cols-[1fr_1fr_1fr_auto_auto] dark:border-ink-800 dark:bg-ink-800/30 [&_button]:h-9 [&_button]:text-[12px]">
            <Field label={it.id ? `Edit item · code ${it.id}` : 'Item name'}><Input value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value.toUpperCase() })} onKeyDown={(e) => e.key === 'Enter' && saveItem()} /></Field>
            <Field label="Local (Tamil) name"><Input value={it.local_name || ''} onChange={(e) => setIt({ ...it, local_name: e.target.value })} /></Field>
            <Field label="Description"><Input value={it.description || ''} onChange={(e) => setIt({ ...it, description: e.target.value })} /></Field>
            <Button variant="outline" icon={Plus} onClick={() => setIt({ name: '', local_name: '', description: '' })}>New Item (Ctrl+N)</Button>
            <Button icon={Save} onClick={saveItem}>Save Item (F2)</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-ink-50 text-[10px] tracking-wider text-ink-500 uppercase dark:bg-ink-800"><tr><th className="w-16 px-3 py-1.5 text-left">Code</th><th className="px-3 text-left">Item Name</th><th className="px-3 text-left">Description</th><th className="px-3 text-right">Used in Loans</th><th className="px-3 text-center">Status</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{rows.map((i) => (
                <tr key={i.id} onClick={() => setIt(i)} className={clsx('cursor-pointer', it.id === i.id ? 'bg-emerald-50 font-semibold dark:bg-emerald-950/30' : 'hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
                  <td className="px-3 py-1">{i.id}</td><td className="px-3 font-bold"><span className="uppercase">{i.name}</span> {i.local_name && <span className="font-normal text-ink-500">· {i.local_name}</span>}</td><td className="px-3">{i.description}</td>
                  <td className="num px-3 text-right">{i.used_in_loans || '-'}</td><td className="px-3 text-center"><Badge tone={i.used_in_loans ? 'blue' : 'green'} className="!py-0 text-[9px]">{i.used_in_loans ? 'IN USE' : 'UNUSED'}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <Button variant="soft-danger" icon={Trash2} disabled={!it.id || it.used_in_loans > 0} onClick={() => setDel(it)}>Delete (Del)</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" icon={FileDown} onClick={print}>PDF (Ctrl+P)</Button>
          <Button variant="outline" icon={Printer} onClick={print}>Print Item List (F9)</Button>
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCsv('items', cols, rows)}>Excel (F10)</Button>
          <ExitButton />
        </div>
      </div>
      <ConfirmDrawer open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} onConfirm={async () => { try { await api.del(`/masters/items/${del.id}`); toast.success('Deleted'); setDel(null); setIt({ name: '', local_name: '', description: '' }); refresh(); } catch (e) { toast.error(e.message); } }} />
    </div>
  );
}
