import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Save, Trash2, FileDown, Printer, FileSpreadsheet } from 'lucide-react';
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
    <div className="animate-rise space-y-3">
      <section className="navy-gradient rounded-md px-5 py-3 text-white"><h1 className="text-2xl font-bold">Item Master</h1><p className="text-sm text-navy-100">Loan item categories and item names</p></section>
      <div className="card flex flex-wrap items-end gap-4 px-4 py-3">
        <Field label="Search item / category"><Input className="w-72" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        <div><p className="label">Show</p><div className="flex gap-1">{[['all', 'All items'], ['used', 'In use'], ['unused', 'Unused']].map(([k, l]) => <button key={k} type="button" onClick={() => setShow(k)} className={clsx('h-9 rounded-md border px-3 text-sm font-semibold', show === k ? 'border-navy-200 bg-navy-50 text-navy-900' : 'border-ink-300 bg-white text-navy-800')}>{l}</button>)}</div></div>
        <span className="ml-auto text-xs text-ink-500">{rows.length} items in {cat?.name}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Categories', catList.length, catList.map((c) => c.name).join(' - '), 'border-t-navy-800 bg-cream-100'], ['Items', itemList.length, 'all categories', 'border-t-gold-500'], ['In use', used, 'used in loans', 'border-t-navy-500'], ['Unused', itemList.length - used, 'can be deleted', 'border-t-emerald-600']].map(([l, v, h, c]) => (
          <div key={l} className={clsx('card border-t-4 px-4 py-3', c)}><p className="text-xs font-bold text-ink-600 uppercase">{l}</p><p className="num text-2xl font-bold text-navy-900">{v}</p><p className="truncate text-[11px] text-ink-500">{h}</p></div>
        ))}
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-[360px_1fr]">
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Categories · {catList.length}</p>
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-xs text-navy-800 uppercase"><tr><th className="px-3 py-1.5 text-left">Category</th><th className="px-3 text-left">Description</th><th className="px-3 text-right">Items</th><th className="px-3 text-right">Used</th></tr></thead>
            <tbody className="divide-y divide-ink-200">{catList.map((c) => (
              <tr key={c.id} onClick={() => setCat(c)} className={clsx('cursor-pointer hover:bg-navy-50/50', cat?.id === c.id && 'bg-cream-200 font-semibold')}><td className="px-3 py-1.5">{c.name}</td><td className="px-3">{c.description}</td><td className="num px-3 text-right">{c.item_count}</td><td className="num px-3 text-right">{c.used || '-'}</td></tr>
            ))}</tbody>
          </table>
          <div className="space-y-2 border-t border-ink-200 p-3">
            <p className="text-xs font-bold text-gold-700 uppercase">{ci.id ? `Edit category · ${ci.name}` : 'New category'}</p>
            <div className="grid grid-cols-2 gap-2"><Field label="Category name"><Input value={ci.name} onChange={(e) => setCi({ ...ci, name: e.target.value })} /></Field><Field label="Description"><Input value={ci.description} onChange={(e) => setCi({ ...ci, description: e.target.value })} /></Field></div>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setCi({ name: '', description: '' })}>New Category</Button><Button size="sm" icon={Save} onClick={saveCat}>Save Category</Button></div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <p className="navy-gradient px-4 py-2 text-sm font-bold text-white uppercase">Items in {cat?.name} · {rows.length} items</p>
          <div className="grid items-end gap-2 border-b border-ink-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Field label={it.id ? `Edit item · code ${it.id}` : 'Item name'}><Input value={it.name} onChange={(e) => setIt({ ...it, name: e.target.value.toUpperCase() })} onKeyDown={(e) => e.key === 'Enter' && saveItem()} /></Field>
            <Field label="Local (Tamil) name"><Input value={it.local_name || ''} onChange={(e) => setIt({ ...it, local_name: e.target.value })} /></Field>
            <Field label="Description"><Input value={it.description || ''} onChange={(e) => setIt({ ...it, description: e.target.value })} /></Field>
            <Button variant="outline" icon={Plus} onClick={() => setIt({ name: '', local_name: '', description: '' })}>New Item (Ctrl+N)</Button>
            <Button icon={Save} onClick={saveItem}>Save Item (F2)</Button>
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-navy-50 text-xs text-navy-800 uppercase"><tr><th className="w-16 px-3 py-1.5 text-left">Code</th><th className="px-3 text-left">Item Name</th><th className="px-3 text-left">Description</th><th className="px-3 text-right">Used in Loans</th><th className="px-3 text-center">Status</th></tr></thead>
              <tbody className="divide-y divide-ink-200">{rows.map((i) => (
                <tr key={i.id} onClick={() => setIt(i)} className={clsx('cursor-pointer hover:bg-navy-50/50', it.id === i.id && 'bg-cream-200')}>
                  <td className="px-3 py-1.5">{i.id}</td><td className="px-3 font-bold">{i.name} {i.local_name && <span className="font-normal text-ink-500">· {i.local_name}</span>}</td><td className="px-3">{i.description}</td>
                  <td className="num px-3 text-right">{i.used_in_loans || '-'}</td><td className="px-3 text-center"><Badge tone={i.used_in_loans ? 'blue' : 'green'} className="text-[10px]">{i.used_in_loans ? 'IN USE' : 'UNUSED'}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card flex flex-wrap gap-2 px-3 py-2">
        <Button variant="outline" icon={Trash2} disabled={!it.id || it.used_in_loans > 0} onClick={() => setDel(it)}>Delete (Del)</Button>
        <div className="ml-auto flex gap-2">
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
