import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Printer, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { printElement } from '@/lib/print';
import { useCompany, useSettings, useLookups } from '@/hooks/useApi';
import { Button, Drawer } from '@/components/ui';
import { n } from '@/lib/format';
import { letterhead, loanBranch } from '@/lib/branchInfo';
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

  // System Control: LRBP = preview before print (No = straight to the printer); DB.. = duplicate preview / mark / copies
  // direct = skip the preview even when System Control asks for one (reprint from history)
  const show = useCallback(async (p, dup = false, direct = false) => {
    const wantPreview = !direct && (dup ? settings?.DUP_PREVIEW !== '0' : settings?.PRINT_PREVIEW !== '0');
    if (wantPreview) { setPreview(p); return; }
    try {
      if (p.log) await api.post(`/loans/${p.log.id}/print-log`, { doc_type: p.log.doc_type });
      for (const lg of p.logs || []) await api.post(`/loans/${lg.id}/print-log`, { doc_type: lg.doc_type });
      await printElement(p.element, { title: p.title });
    } catch (e) { toast.error(e.message); }
  }, [settings]);
  const dupMark = settings?.DUP_MARK !== '0';

  const printLoan = useCallback(async (full) => {
    setBusy(true);
    try {
      const prev = await api.get(`/loans/${full.loan.id}/print-logs`);
      const again = prev.data.some((p) => p.doc_type === 'LOAN_RECEIPT');
      const data = await buildLoanPrintData({ full, company, settings, schemes: lookups?.schemes, copy: again && dupMark ? 'DUPLICATE' : 'ORIGINAL' });
      await show({ title: `Loan bill #${full.loan.bill_no}`, element: <LoanReceipt data={data} />, log: { id: full.loan.id, doc_type: 'LOAN_RECEIPT' } }, again);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }, [company, settings, lookups, show, dupMark]);

  /** Several loan bills in one preview (Duplicate Bill screen). Always marked DUPLICATE. */
  const printLoans = useCallback(async (fulls) => {
    setBusy(true);
    try {
      const copies = Math.min(5, Math.max(1, Number(settings?.DUP_COPIES) || 1));
      const one = await Promise.all(fulls.map((full) => buildLoanPrintData({ full, company, settings, schemes: lookups?.schemes, copy: dupMark ? 'DUPLICATE' : 'ORIGINAL' })));
      const datas = one.flatMap((d) => Array.from({ length: copies }, () => d));
      await show({ title: `Duplicate bill${fulls.length > 1 ? `s (${fulls.length})` : ` #${fulls[0].loan.bill_no}`}`,
        element: <div>{datas.map((d, i) => <div key={i} className={i < datas.length - 1 ? 'page-break' : ''}><LoanReceipt data={d} /></div>)}</div>,
        logs: fulls.map((f) => ({ id: f.loan.id, doc_type: 'LOAN_RECEIPT' })) }, true);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }, [company, settings, lookups, show, dupMark]);

  const printTxn = useCallback((full, txn, { direct = false } = {}) => {
    const after = full.transactions.filter((t) => !t.is_void && t.id <= txn.id).reduce((s, t) => s + n(t.principal_amount), 0);
    const paidBefore = full.transactions.filter((t) => !t.is_void && t.id < txn.id && t.txn_type !== 'DISBURSE').reduce((s, t) => s + n(t.interest_amount), 0);
    const data = { company: letterhead(company || {}, loanBranch(full.loan)), loan: full.loan, txn, balance: after, items: full.items, monthly: full.calc?.monthlyInterest, months: full.calc?.months, paidBefore };
    show({ title: { RELEASE: 'Release Receipt', PART_PAYMENT: 'Part Payment Receipt', INTEREST: 'Interest Receipt', TOPUP: 'Top-up Receipt' }[txn.txn_type] || `Receipt ${txn.receipt_no}`, element: <TransactionReceipt data={data} />, log: { id: full.loan.id, doc_type: `RCPT_${txn.id}` } }, false, direct);
  }, [company, show]);

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
      footer={<><Button variant="soft-danger" onClick={() => setPreview(null)}>Close</Button><Button variant="gold" icon={Printer} loading={busy} onClick={doPrint}>Print</Button></>}>
      <div className="mx-auto w-fit">
        <p className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-ink-500 uppercase"><span>Paper</span><span>dashed line = paper edge</span></p>
        <div className="bg-white p-[8mm] text-black outline-1 outline-offset-0 outline-ink-400 outline-dashed">{preview?.element}</div>
      </div>
    </Drawer>
  );

  return { printLoan, printLoans, printTxn, busy, company, settings, printerUi };
}
