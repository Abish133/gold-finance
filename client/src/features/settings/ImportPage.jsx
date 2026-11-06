import { useState } from 'react';
import { DatabaseBackup, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, DataTable, Field, PageHeader, Segmented, Select } from '@/components/ui';
import { useLookups } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const TEMPLATES = {
  customers: ['customer_no', 'title', 'name', 'relation_type', 'relation_name', 'door_no', 'street', 'area', 'city', 'pincode', 'phone', 'alt_phone', 'id_proof_type', 'id_proof_no'],
  loans: ['loan_no', 'bill_book_no', 'loan_date', 'customer_no', 'customer_phone', 'amount', 'rate', 'interest_type', 'item_name', 'pcs', 'gross_wt', 'stone_wt', 'purity', 'rate_per_gram'],
};

/** Minimal CSV parser (quotes, commas, new lines). */
const parseCsv = (text) => {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = (head || []).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/^﻿/, ''));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
};

/** Database migration (desktop: frmDbMigration) - bring customers and running loans from the old software. */
export default function ImportPage() {
  const { isAllBranches } = useAuth();
  const { data: lk } = useLookups();
  const [type, setType] = useState('customers');
  const [rows, setRows] = useState([]);
  const [scheme, setScheme] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const template = () => {
    const blob = new Blob(['﻿' + TEMPLATES[type].join(',') + '\n'], { type: 'text/csv' });
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${type}-template.csv` }).click();
  };
  const run = async () => {
    setBusy(true);
    try { const r = await api.post('/tools/import', { type, rows, scheme_id: scheme }); setResult(r.data); toast.success(`${r.data.imported} imported, ${r.data.skipped} skipped`); } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  if (isAllBranches) return <Card><p className="text-sm">Select the branch to import into.</p></Card>;
  return (
    <div className="animate-rise space-y-4">
      <PageHeader icon={DatabaseBackup} title="Database Migration" subtitle="Import customers and running loans from the old software (export them to Excel / CSV first)" />
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div><p className="label">What to import</p><Segmented value={type} onChange={(v) => { setType(v); setRows([]); setResult(null); }} options={[{ value: 'customers', label: '1. Customers' }, { value: 'loans', label: '2. Running loans' }]} /></div>
          <Button variant="outline" icon={Download} onClick={template}>Download template</Button>
          <Field label="CSV file"><input type="file" accept=".csv,text/csv" className="input pt-2" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { setRows(parseCsv(await file.text())); setResult(null); } }} /></Field>
          {type === 'loans' && <Field label="Scheme for these loans"><Select className="w-60" value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="Select" options={(lk?.schemes || []).map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))} /></Field>}
          <Button variant="gold" icon={Upload} disabled={!rows.length || (type === 'loans' && !scheme)} loading={busy} onClick={run}>Import {rows.length || ''} rows</Button>
        </div>
        <p className="mt-3 text-xs text-ink-500">Loans are imported as opening (old) entries, so today's cash is not changed. One CSV row per jewel item; rows with the same loan_no become one loan. Import customers first.</p>
      </Card>
      {result && (
        <Card title={`Result · ${result.imported} imported · ${result.skipped} skipped`}>
          {result.errors.length ? <DataTable dense rows={result.errors.map((e, i) => ({ ...e, id: i }))} columns={[{ key: 'row', label: 'CSV row' }, { key: 'error', label: 'Problem' }]} /> : <p className="text-sm text-emerald-700">All rows imported.</p>}
        </Card>
      )}
      {rows.length > 0 && !result && (
        <DataTable dense rows={rows.slice(0, 50).map((r, i) => ({ ...r, id: i }))} columns={Object.keys(rows[0]).slice(0, 10).map((k) => ({ key: k, label: k }))} />
      )}
    </div>
  );
}
