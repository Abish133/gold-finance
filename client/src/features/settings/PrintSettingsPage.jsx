import { Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { SettingsForm } from './SettingsForm';

export default function PrintSettingsPage() {
  return (
    <div className="animate-rise">
      <PageHeader icon={Printer} title="Print & Receipt Setup" subtitle="Controls the A4 loan bill, terms page, acknowledge card and stickers" />
      <SettingsForm sections={[
        { title: 'Loan bill', fields: [
          { key: 'RECEIPT_LANG', label: 'Bill language', type: 'select', options: [{ value: 'ta', label: 'Tamil' }, { value: 'en', label: 'English' }] },
          { key: 'LOAN_RECEIPT_LAYOUT', label: 'Loan bill layout', type: 'select', options: [{ value: 'PDF', label: 'Branch bill (A4, slab table + promissory note)' }, { value: 'MYBOOK', label: 'MyBook pawn ticket (customer + office copy)' }] },
          { key: 'PRINT_PROMISSORY_NOTE', label: 'Print demand promissory note', type: 'bool' },
          { key: 'PRINT_TERMS_PAGE', label: 'Print terms & conditions page', type: 'bool' },
          { key: 'PRINT_ACK_CARD', label: 'Print acknowledge card (customer copy)', type: 'bool' },
          { key: 'RECEIPT_NOTES', label: 'Notes under the interest table (one per line)', type: 'textarea', tamil: true },
          { key: 'RECEIPT_TERMS', label: 'Terms & conditions (one clause per line)', type: 'textarea', rows: 12, tamil: true, hint: 'Paste your விதிமுறைகளும் நிபந்தனைகளும் here, one numbered clause per line' },
          { key: 'RECEIPT_FOOTER', label: 'Acknowledge card footer (working hours, holidays, contact)', type: 'textarea', tamil: true },
        ] },
        { title: 'Packet sticker', fields: [
          { key: 'STICKER_WIDTH_MM', label: 'Sticker width (mm)', type: 'number' },
          { key: 'STICKER_HEIGHT_MM', label: 'Sticker height (mm)', type: 'number' },
        ] },
      ]} />
    </div>
  );
}
