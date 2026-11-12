import { useState } from 'react';
import { Wand2, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

/* easy to read and type at the counter: Word-1234-Word! (no look-alike letters such as l / 1 / O / 0) */
const WORDS = ['Gold', 'Ruby', 'Pearl', 'Coral', 'Amber', 'Jade', 'Opal', 'Topaz', 'River', 'Lotus', 'Mango', 'Tiger', 'Cloud', 'Stone', 'Maple', 'Cedar', 'Sunny', 'Peacock', 'Silver', 'Copper', 'Harbor', 'Monsoon', 'Temple', 'Garden'];
const SYMBOLS = '!@#$%&*?';
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };

export function suggestPassword() {
  const w1 = WORDS[rand(WORDS.length)];
  let w2 = WORDS[rand(WORDS.length)];
  while (w2 === w1) w2 = WORDS[rand(WORDS.length)];
  const digits = String(rand(9000) + 1000).replace(/0/g, '7');
  return `${w1}-${digits}-${w2}${SYMBOLS[rand(SYMBOLS.length)]}`;
}

/** 0 = empty, 1 weak, 2 fair, 3 good, 4 strong */
export function passwordStrength(pw = '') {
  if (!pw) return { score: 0, label: '', tip: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 6) score = Math.min(score, 1);
  if (/^(.)\1+$/.test(pw) || /^(123456|password|admin|qwerty)/i.test(pw)) score = 1;
  score = Math.max(1, Math.min(4, score));
  const tip = pw.length < 6 ? 'At least 6 characters'
    : score < 3 ? 'Mix capital + small letters, a number and a symbol' : score < 4 ? 'Make it a little longer' : 'Strong password';
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score], tip };
}

const BAR = ['', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-600'];
const TXT = ['', 'text-rose-600', 'text-amber-700', 'text-sky-700', 'text-emerald-700'];

/**
 * Under a new-password box: strength bar + "Suggest" a strong password (shown in plain text so it can be noted / copied).
 * onUse(password) puts the suggestion into the box.
 */
export function PasswordHelp({ value, onUse, className }) {
  const [sug, setSug] = useState(null);
  const [copied, setCopied] = useState(false);
  const st = passwordStrength(value);
  const make = () => { const p = suggestPassword(); setSug(p); setCopied(false); onUse?.(p); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(sug); setCopied(true); toast.success('Password copied'); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error('Copy is blocked here - please note it down'); }
  };
  return (
    <div className={clsx('mt-1.5 space-y-1.5', className)}>
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => <span key={i} className={clsx('h-1 rounded-sm', i <= st.score ? BAR[st.score] : 'bg-ink-200 dark:bg-ink-700')} />)}
        </div>
        <span className={clsx('w-14 text-right text-[11px] font-semibold', TXT[st.score] || 'text-ink-400')}>{st.label || '—'}</span>
        <button type="button" onClick={make} className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-ink-200 px-2 text-[11px] font-semibold text-navy-800 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
          {sug ? <RefreshCw className="size-3" /> : <Wand2 className="size-3" />}{sug ? 'Another' : 'Suggest'}
        </button>
      </div>
      {value && st.score < 4 && <p className="text-[11px] text-ink-500">{st.tip}</p>}
      {sug && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 dark:border-emerald-900 dark:bg-emerald-950/30">
          <span className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300">Suggested</span>
          <code className="num min-w-0 flex-1 truncate font-sans text-[13px] font-bold tracking-wide text-emerald-900 select-all dark:text-emerald-100">{sug}</code>
          <button type="button" onClick={copy} title="Copy" className="grid size-6 shrink-0 place-items-center rounded-md text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      )}
      {sug && <p className="text-[11px] text-ink-500">It is already filled in. Note it down or copy it before you save.</p>}
    </div>
  );
}
