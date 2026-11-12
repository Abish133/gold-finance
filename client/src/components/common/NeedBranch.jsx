import { useState } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { Building2, Layers, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button, Modal } from '@/components/ui';

/**
 * Shown on screens that only work for one branch while "All Branches" is selected:
 * a modal to pick the branch right here. Cancel goes back to the dashboard.
 */
export function NeedBranch({ action = 'continue' }) {
  const { user, setBranch } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const term = q.trim().toLowerCase();
  const list = term ? user.branches.filter((b) => b.name.toLowerCase().includes(term) || String(b.code || '').toLowerCase().includes(term)) : user.branches;
  const keys = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' && list[hi]) { e.preventDefault(); setBranch(list[hi].id); }
  };
  const cancel = () => navigate('/');

  return (
    <Modal open onClose={cancel} icon={Layers} tone="green" title="Choose a branch"
      subtitle={<>You are viewing <b className="text-ink-700 dark:text-ink-300">All Branches</b>. Pick one branch to {action}.</>}
      bodyClassName="p-0"
      footer={<Button variant="soft-danger" size="sm" onClick={cancel}>Cancel (Esc)</Button>}>
      {user.branches.length > 5 && (
        <div className="relative border-b border-ink-100 p-2 dark:border-ink-800">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-3.5 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={keys} placeholder="Search branch or code…"
            className="h-8 w-full rounded-md border border-ink-200 bg-white pr-2 pl-8 text-[13px] outline-none focus:border-emerald-500 dark:border-ink-700 dark:bg-ink-950" />
        </div>
      )}
      <ul className="p-2" onKeyDown={keys}>
        {!list.length && <li className="px-3 py-4 text-center text-[12px] text-ink-400">No branch matches “{q}”</li>}
        {list.map((b, i) => (
          <li key={b.id}>
            <button type="button" onClick={() => setBranch(b.id)} onMouseEnter={() => setHi(i)} data-autofocus={i === 0 ? '' : undefined}
              className={clsx('group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition', i === hi && 'bg-emerald-50 dark:bg-emerald-950/30')}>
              <span className={clsx('grid size-8 shrink-0 place-items-center rounded-md transition', i === hi ? 'bg-emerald-600 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300')}>
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-navy-900 dark:text-white">{b.name}</span>
                {b.code && <span className="num block text-[11px] text-ink-400">Code {b.code}</span>}
              </span>
              <span className={clsx('text-[11px] font-bold text-emerald-700 transition dark:text-emerald-300', i === hi ? 'opacity-100' : 'opacity-0')}>Select ↵</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
