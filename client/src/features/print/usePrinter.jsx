import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Printer, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { useCompany, useSettings, useLookups } from '@/hooks/useApi';
import { Button, Drawer } from '@/components/ui';
import { n } from '@/lib/format';
import { LoanReceipt, buildLoanPrintData } from './LoanReceipt';
import { TransactionReceipt } from './TransactionReceipt';

/**
 * One hook for every print action. Documents open in a preview drawer first
 * (exactly what will print), then print in an isolated frame.
 * Render `printerUi` once in the screen that uses the hook.
 */
export function usePrinter() {
  const { data: company } = useCompany();
  const { data: settings } = useSettings();
  const { data: lookups } = useLookups();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const printLoan = useCallback(async (full) => {
    setBusy(true);
    try {
      const prev = await api.get(`/loans/${full.loan.id}/print-logs`);
      const copy = prev.data.some((p) => p.doc_type === 'LOAN_RECEIPT') ? 'DUPLICATE' : 'ORIGINAL';
      const data = await buildLoanPrintData({ full, company, settings, schemes: lookups?.schemes, copy });
      setPreview({ title: `Loan bill #${full.loan.bill_no}`, element: <LoanReceipt data={data} />, log: { id: full.loan.id, doc_type: 'LOAN_RECEIPT' } });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }, [company, settings, lookups]);

  /** Several loan bills in one preview (Duplicate Bill screen). Always marked DUPLICATE. */
  const printLoans = useCallback(async (fulls) => {
    setBusy(true);
    try {
      const datas = await Promise.all(fulls.map((full) => buildLoanPrintData({ full, company, settings, schemes: lookups?.schemes, copy: 'DUPLICATE' })));
      setPreview({ title: `Duplicate bill${fulls.length > 1 ? `s (${fulls.length})` : ` #${fulls[0].loan.bill_no}`}`,
        element: <div>{datas.map((d, i) => <div key={i} className={i < datas.length - 1 ? 'page-break' : ''}><LoanReceipt data={d} /></div>)}</div>,
        logs: fulls.map((f) => ({ id: f.loan.id, doc_type: 'LOAN_RECEIPT' })) });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }, [company, settings, lookups]);

  const printTxn = useCallback((full, txn) => {
    const after = full.transactions.filter((t) => !t.is_void && t.id <= txn.id).reduce((s, t) => s + n(t.principal_amount), 0);
    const paidBefore = full.transactions.filter((t) => !t.is_void && t.id < txn.id && t.txn_type !== 'DISBURSE').reduce((s, t) => s + n(t.interest_amount), 0);
    const data = { company: company || {}, loan: full.loan, txn, balance: after, items: full.items, monthly: full.calc?.monthlyInterest, months: full.calc?.months, paidBefore };
    setPreview({ title: `Receipt ${txn.receipt_no}`, element: <TransactionReceipt data={data} />, log: { id: full.loan.id, doc_type: `RCPT_${txn.id}` } });
  }, [company]);

  const doPrint = async () => {
    setBusy(true);
    try {
      if (preview.log) await api.post(`/loans/${preview.log.id}/print-log`, { doc_type: preview.log.doc_type });
      for (const lg of preview.logs || []) await api.post(`/loans/${lg.id}/print-log`, { doc_type: lg.doc_type });
      await printElement(preview.element, { title: preview.title });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const printerUi = (
    <Drawer open={!!preview} onClose={() => setPreview(null)} size="xl" icon={Eye} title={preview?.title} subtitle="Print preview (A4)" bodyClassName="bg-ink-200/60 dark:bg-ink-950"
      footer={<><Button variant="outline" onClick={() => setPreview(null)}>Close</Button><Button variant="gold" icon={Printer} loading={busy} onClick={doPrint}>Print</Button></>}>
      <div className="mx-auto w-fit bg-white p-[8mm] shadow-xl">{preview?.element}</div>
    </Drawer>
  );

  return { printLoan, printLoans, printTxn, busy, company, settings, printerUi };
}
