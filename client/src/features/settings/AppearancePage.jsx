import { useEffect, useState } from 'react';
import { Palette, RotateCcw, Type, ALargeSmall, Check, Eye, Save, Pipette, AlertTriangle, SlidersHorizontal, Store, CloudUpload, Search } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { amount, money } from '@/lib/format';
import { ExitButton } from '@/features/loans/desk';
import {
  PALETTES, PALETTE_GROUPS, HIGHLIGHTS, TOTALS, FONTS, SIZES, MODES, DENSITIES, CORNERS, WEIGHTS, GROUPINGS, CURRENCIES,
  DEFAULT_APPEARANCE, loadAppearance, saveAppearance, saveShopDefault, clearShopDefault, scaleFrom, isLight, isHex,
} from '@/lib/appearance';

const Dot = () => <span className="relative flex size-1.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>;
const pick = (on) => (on ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800');
const tgl = (on) => clsx('-ml-px flex h-7 items-center gap-1.5 border px-2.5 text-[12px] font-semibold whitespace-nowrap first:ml-0 first:rounded-l-md last:rounded-r-md',
  on ? 'relative z-10 border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300');

function Panel({ icon: Icon, title, sub, children, className, bodyClass }) {
  return (
    <div className={clsx('card flex flex-col overflow-hidden', className)}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
        <Icon className="size-3.5 text-navy-700 dark:text-white" />
        <p className="text-[11px] font-bold tracking-wider whitespace-nowrap text-navy-900 uppercase dark:text-white">{title}</p>
        {sub && <p className="truncate text-[11px] text-ink-500">{sub}</p>}
      </div>
      <div className={clsx('min-h-0 flex-1 overflow-y-auto p-2.5', bodyClass)}>{children}</div>
    </div>
  );
}

/** one option row: label on the left, joined choice buttons on the right */
function Row({ label, hint, value, options, onChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-dashed border-ink-200 py-1.5 last:border-0 dark:border-ink-700">
      <div className="min-w-0"><p className="text-[12px] font-semibold">{label}</p>{hint && <p className="text-[10px] text-ink-500">{hint}</p>}</div>
      <div className="flex">{options.map(([k, l]) => <button key={String(k)} type="button" onClick={() => onChange(k)} className={tgl(value === k)}>{value === k && <Dot />}{l}</button>)}</div>
    </div>
  );
}

/** small swatch row for the highlight / totals colour */
function Swatches({ label, hint, value, keys, onChange }) {
  return (
    <div className="border-b border-dashed border-ink-200 py-1.5 last:border-0 dark:border-ink-700">
      <p className="text-[12px] font-semibold">{label}</p>{hint && <p className="text-[10px] text-ink-500">{hint}</p>}
      <div className="mt-1 flex flex-wrap gap-1">
        {keys.map((k) => { const p = PALETTES.find((x) => x.key === k); const on = value === k; return (
          <button key={k} type="button" title={p.label} onClick={() => onChange(k)} className={clsx('grid size-7 place-items-center rounded-md border-2', on ? 'border-navy-900 dark:border-white' : 'border-transparent')}>
            <span className="grid size-5 place-items-center rounded-sm" style={{ background: p.c[2] }}><span className="size-2.5 rounded-full" style={{ background: p.c[6] }} /></span>
          </button>
        ); })}
      </div>
    </div>
  );
}

/** Appearance: accent colour, font, text size, light / dark, tables, highlight colours, numbers - applied at once. */
export default function AppearancePage() {
  const { can } = useAuth();
  const admin = can('s_system', 'edit');
  const [a, setA] = useState(loadAppearance);
  const [shop, setShop] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/auth/appearance').then((r) => setShop(r.data?.company || null)).catch(() => {}); }, []);
  const set = (patch) => { const next = { ...a, ...patch }; setA(next); saveAppearance(next); };
  const reset = () => { const next = { ...DEFAULT_APPEARANCE, syncLogin: a.syncLogin }; setA(next); saveAppearance(next); toast.success('Appearance reset to default'); };
  const useShop = () => { if (!shop) return; const next = { ...DEFAULT_APPEARANCE, ...shop, syncLogin: a.syncLogin }; setA(next); saveAppearance(next); toast.success('Shop default applied'); };
  const makeShop = async () => { try { const { syncLogin, ...look } = a; await saveShopDefault(look); setShop(look); toast.success('Saved as the shop default - new users and computers start with this look'); } catch (e) { toast.error(e.message); } };
  const dropShop = async () => { try { await clearShopDefault(); setShop(null); toast.success('Shop default removed'); } catch (e) { toast.error(e.message); } };
  const palLabel = a.palette === 'custom' ? `Custom ${a.custom}` : PALETTES.find((p) => p.key === a.palette)?.label;
  const shown = PALETTES.filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()) || p.group.toLowerCase().includes(q.toLowerCase()));

  return (
    /* fit-screen: each panel scrolls on its own */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <Palette className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Appearance</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Colours, font, text size, tables and numbers - changes apply at once</p></div>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">Now</span><b className="truncate text-[13px]">{palLabel} · {FONTS.find((f) => f.key === a.font)?.label} · {SIZES.find((s) => s.key === a.size)?.label} · {MODES.find((m) => m[0] === a.mode)?.[1]}</b></div>
      </section>

      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.25fr_1fr_1fr]">
        {/* accent colours */}
        <Panel icon={Palette} title="Accent colour" sub={`${PALETTES.length} colours + your own`} className="min-h-96 xl:min-h-0" bodyClass="!p-0 flex flex-col">
          <div className="shrink-0 space-y-2 border-b border-ink-100 p-2.5 dark:border-ink-800">
            <div className={clsx('flex flex-wrap items-center gap-2 rounded-md border p-1.5', a.palette === 'custom' ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-dashed border-ink-300 dark:border-ink-700')}>
              <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-ink-300 dark:border-ink-600" style={{ background: isHex(a.custom) ? a.custom : '#1e3a8a' }} title="Pick a colour">
                <Pipette className={clsx('size-3.5', isLight(a.custom) ? 'text-ink-900' : 'text-white')} />
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={isHex(a.custom) ? a.custom : '#1e3a8a'} onChange={(e) => set({ palette: 'custom', custom: e.target.value })} />
              </label>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold">{a.palette === 'custom' && <Dot />}Your own colour</p>
                <input className="num h-6 w-24 rounded-sm border border-ink-200 bg-white px-1.5 text-[12px] uppercase dark:border-ink-700 dark:bg-ink-900" maxLength={7} value={a.custom}
                  onChange={(e) => { const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value; if (isHex(v)) set({ palette: 'custom', custom: v }); else setA({ ...a, custom: v }); }} />
              </div>
              <span className="flex h-6 min-w-20 flex-1 overflow-hidden rounded-sm">{scaleFrom(isHex(a.custom) ? a.custom : '#1e3a8a').slice(2).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
              {a.palette !== 'custom' && <button type="button" onClick={() => isHex(a.custom) && set({ palette: 'custom' })} className="h-7 rounded-md border border-ink-200 bg-white px-2.5 text-[12px] font-semibold hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900">Use</button>}
              {isHex(a.custom) && isLight(a.custom) && <p className="flex w-full items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />Light colour - white text on headers may be hard to read. Pick a darker shade.</p>}
            </div>
            <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-400" /><input className="h-7 w-full rounded-md border border-ink-200 bg-white pr-2 pl-7 text-[12px] outline-none focus:border-navy-400 dark:border-ink-700 dark:bg-ink-900" placeholder="Find a colour - blue, green, warm…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
            {PALETTE_GROUPS.map((g) => {
              const list = shown.filter((p) => p.group === g);
              if (!list.length) return null;
              return (
                <div key={g}>
                  <p className="mb-1 text-[10px] font-bold tracking-wider text-ink-500 uppercase">{g}</p>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {list.map((p) => {
                      const on = a.palette === p.key;
                      return (
                        <button key={p.key} type="button" onClick={() => set({ palette: p.key })} className={clsx('flex min-w-0 flex-col gap-1 rounded-md border p-1 text-left transition', pick(on))}>
                          <span className="flex h-5 overflow-hidden rounded-sm"><span className="flex-[3]" style={{ background: p.c[9] }} /><span className="flex-[2]" style={{ background: p.c[7] }} /><span className="flex-1" style={{ background: p.c[4] }} /><span className="flex-1" style={{ background: p.c[1] }} /></span>
                          <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold">{on && <Dot />}<span className="truncate">{p.label}</span>{on && <Check className="ml-auto size-3 shrink-0 text-emerald-600" />}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!shown.length && <p className="p-3 text-center text-[12px] text-ink-400">No colour named "{q}"</p>}
          </div>
        </Panel>

        {/* font + text size */}
        <div className="flex flex-col gap-2 xl:min-h-0">
          <Panel icon={Type} title="Font" sub={`${FONTS.length} fonts - one for every screen`} className="min-h-72 xl:min-h-0 xl:flex-1">
            <div className="flex flex-col gap-1">
              {FONTS.map((f) => {
                const on = a.font === f.key;
                return (
                  <button key={f.key} type="button" onClick={() => set({ font: f.key })} className={clsx('flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition', pick(on))} style={{ fontFamily: `${f.css}, sans-serif` }}>
                    <span className="w-8 text-[18px] leading-none font-bold">Aa</span>
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[13px] font-semibold">{f.label}{f.note && <span className="rounded-sm bg-ink-100 px-1 font-sans text-[9px] font-bold text-ink-600 uppercase dark:bg-ink-800 dark:text-ink-300">{f.note}</span>}</span><span className="num block truncate text-[11px] text-ink-500">GL-1024 · ₹ 1,25,000.00 · 22.500 g · தங்கம்</span></span>
                    {on && <Dot />}
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel icon={ALargeSmall} title="Text size" sub="text, boxes and buttons" className="shrink-0">
            <div className="grid grid-cols-5 gap-1.5">
              {SIZES.map((s) => {
                const on = a.size === s.key;
                return (
                  <button key={s.key} type="button" onClick={() => set({ size: s.key })} className={clsx('flex flex-col items-center justify-end gap-0.5 rounded-md border px-1 py-1.5 transition', pick(on))}>
                    <span className="leading-none font-bold" style={{ fontSize: `${Math.round(15 * s.zoom)}px` }}>Aa</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap">{on && <Dot />}{s.label}</span>
                    <span className="num text-[9px] text-ink-400">{Math.round(s.zoom * 100)}%</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* options + preview */}
        <div className="flex flex-col gap-2 xl:min-h-0">
          <Panel icon={SlidersHorizontal} title="Look & feel" className="min-h-72 xl:min-h-0 xl:flex-1">
            <Row label="Theme" value={a.mode} options={MODES} onChange={(v) => set({ mode: v })} />
            <Row label="Table rows" hint="row height in every table" value={a.density} options={DENSITIES} onChange={(v) => set({ density: v })} />
            <Row label="Zebra rows" hint="shade every other row" value={!!a.zebra} options={[[false, 'Off'], [true, 'On']]} onChange={(v) => set({ zebra: v })} />
            <Row label="Corners" value={a.corners} options={CORNERS.map(([k, l]) => [k, l])} onChange={(v) => set({ corners: v })} />
            <Row label="Text weight" value={a.weight} options={WEIGHTS} onChange={(v) => set({ weight: v })} />
            <Swatches label="Selection colour" hint="selected rows, active items, success" value={a.highlight} keys={HIGHLIGHTS} onChange={(v) => set({ highlight: v })} />
            <Swatches label="Totals colour" hint="total rows and warnings" value={a.totals} keys={TOTALS} onChange={(v) => set({ totals: v })} />
            <Row label="Number grouping" value={a.grouping} options={GROUPINGS} onChange={(v) => set({ grouping: v })} />
            <Row label="Money sign" value={a.currency} options={CURRENCIES} onChange={(v) => set({ currency: v })} />
          </Panel>
          <Panel icon={Eye} title="Preview" className="shrink-0">
            <div className="flex flex-col gap-1.5">
              <div className="navy-gradient flex items-center gap-2 rounded-md px-3 py-1.5 text-white"><b className="text-[13px]">New Loan</b><span className="truncate text-[11px] text-white/60">Pledge gold and print the bill</span></div>
              <table className="w-full overflow-hidden rounded-md text-[12px]">
                <thead className="navy-gradient text-[10px] tracking-wider text-white uppercase"><tr><th className="px-2 py-1 text-left">Item</th><th className="px-2 text-right">Weight</th><th className="px-2 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  <tr><td className="px-2 py-1">Chain</td><td className="num px-2 text-right">12.500</td><td className="num px-2 text-right">{amount(62500)}</td></tr>
                  <tr className="bg-emerald-50 dark:bg-emerald-950/30"><td className="px-2 py-1"><span className="flex items-center gap-1.5"><Dot />Ring</span></td><td className="num px-2 text-right">4.250</td><td className="num px-2 text-right">{amount(21250)}</td></tr>
                  <tr><td className="px-2 py-1">Bangle</td><td className="num px-2 text-right">7.600</td><td className="num px-2 text-right">{amount(38000)}</td></tr>
                </tbody>
                <tfoot className="border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"><tr><td className="px-2 py-1">Total</td><td className="num px-2 text-right">24.350</td><td className="num px-2 text-right">{money(121750)}</td></tr></tfoot>
              </table>
              <div className="flex flex-wrap gap-1.5 [&_button]:h-7 [&_button]:text-[12px]"><Button variant="gold" icon={Save}>Save Loan</Button><Button variant="outline">Print</Button><Button variant="soft-danger">Clear</Button></div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <button type="button" role="switch" aria-checked={a.syncLogin !== false} onClick={() => set({ syncLogin: a.syncLogin === false })}
          className={clsx('flex items-center gap-2 rounded-md border px-2.5 font-semibold', a.syncLogin !== false ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 text-ink-600 dark:border-ink-700 dark:text-ink-300')}>
          <span className={clsx('relative h-4 w-7 shrink-0 rounded-full', a.syncLogin !== false ? 'bg-emerald-600' : 'bg-ink-300 dark:bg-ink-600')}><span className={clsx('absolute top-0.5 size-3 rounded-full bg-white transition-all', a.syncLogin !== false ? 'left-3.5' : 'left-0.5')} /></span>
          <CloudUpload className="size-3.5" />Keep my look on my login
        </button>
        <p className="hidden min-w-0 flex-1 truncate text-[11px] text-ink-400 lg:block">{a.syncLogin !== false ? 'Your look follows you to any counter you sign in on.' : 'Your look stays on this computer only.'}{shop ? ' · A shop default is set.' : ''}</p>
        <span className="flex-1 lg:hidden" />
        {shop && <Button variant="outline" icon={Store} onClick={useShop}>Use shop default</Button>}
        {admin && <Button variant="outline" icon={Store} onClick={makeShop}>Save as shop default</Button>}
        {admin && shop && <Button variant="soft-danger" onClick={dropShop}>Remove shop default</Button>}
        <Button variant="soft-danger" icon={RotateCcw} onClick={reset}>Reset</Button>
        <ExitButton />
      </div>
    </div>
  );
}
