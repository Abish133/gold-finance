import { useEffect, useState } from 'react';
import { Link2, Copy, Check, MessageCircle, Ban, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import { openWhatsApp } from '@/lib/whatsapp';

/** Make / send / cancel a read-only "loan status" link for one customer. */
export function ShareLinkModal({ open, onClose, customer }) {
  const [info, setInfo] = useState(null);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = () => api.get(`/customers/${customer.id}/share-links`).then((r) => setInfo(r.data)).catch((e) => toast.error(e.message));
  useEffect(() => { if (open && customer?.id) { setLink(null); load(); } }, [open, customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const url = link ? `${window.location.origin}/c/${link}` : '';
  const make = async () => { setBusy(true); try { const r = await api.post(`/customers/${customer.id}/share-links`); setLink(r.data.token); load(); } catch (e) { toast.error(e.message); } setBusy(false); };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error('Copy is blocked here - select the link and copy it'); } };
  const send = () => { if (!openWhatsApp(customer.phone, `Dear ${customer.name}, see your gold loan status any time here (view only): ${url}`)) toast.error('This customer has no valid 10-digit mobile number'); };
  const revoke = async (id) => { try { await api.del(`/customers/share-links/${id}`); toast.success('Link cancelled - it no longer opens'); if (link) setLink(null); load(); } catch (e) { toast.error(e.message); } };
  const active = (info?.links || []).filter((k) => !k.revoked && dayjs(k.expires_at).isAfter(dayjs()));

  return (
    <Modal open={open} onClose={onClose} icon={Link2} size="md" title="Loan status link" subtitle={customer?.name}
      footer={info?.enabled && <Button variant="gold" icon={link ? RefreshCw : Link2} loading={busy} onClick={make}>{link ? 'Make another link' : 'Make a link'}</Button>}>
      {!info ? <div className="h-24 animate-pulse rounded-md bg-ink-100 dark:bg-ink-800" /> : !info.enabled ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          The customer link is switched off. An admin can switch it on in <b>SMS / WhatsApp → Auto SMS Rules → Automations</b>.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-ink-500">The customer can see only their open loans, interest due and amount to close - no address, photos or ID. The link works for {info.days} days and you can cancel it any time.</p>
          {link && (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <code className="block truncate rounded-sm bg-white px-2 py-1 font-sans text-[12px] select-all dark:bg-ink-900" title={url}>{url}</code>
              <div className="flex gap-2 [&_button]:h-8 [&_button]:text-[12px]">
                <Button variant="outline" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                <Button variant="outline" icon={MessageCircle} className="text-emerald-700" onClick={send}>Send on WhatsApp</Button>
              </div>
            </div>
          )}
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">Links working now · {active.length}</p>
            {!active.length ? <p className="text-[12px] text-ink-400">No link is working for this customer.</p> : (
              <ul className="divide-y divide-ink-100 rounded-md border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
                {active.map((k) => (
                  <li key={k.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                    <span className="min-w-0 flex-1">Made {dayjs(k.created_at).format('DD/MM/YY')}{k.created_by_name ? ` by ${k.created_by_name}` : ''} · works till {dayjs(k.expires_at).format('DD/MM/YY')} · opened {k.views} time{k.views === 1 ? '' : 's'}</span>
                    <Button variant="soft-danger" icon={Ban} className="h-7 px-2 text-[11px]" onClick={() => revoke(k.id)}>Cancel</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
