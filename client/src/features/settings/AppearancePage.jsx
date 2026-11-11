import { useState } from 'react';
import { Palette, RotateCcw, Type, ALargeSmall, Check, Search, Save, Pipette, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { ExitButton } from '@/features/loans/desk';
import { PALETTES, FONTS, SIZES, DEFAULT_APPEARANCE, loadAppearance, saveAppearance, scaleFrom, isLight } from '@/lib/appearance';

const Dot = () => <span className="relative flex size-1.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" /></span>;

function Panel({ icon: Icon, title, sub, children, className }) {
  return (
    <div className={clsx('card flex flex-col overflow-hidden', className)}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-200 px-3 dark:border-ink-800">
        <Icon className="size-3.5 text-navy-700 dark:text-white" />
        <p className="text-[11px] font-bold tracking-wider whitespace-nowrap text-navy-900 uppercase dark:text-white">{title}</p>
        {sub && <p className="truncate text-[11px] text-ink-500">{sub}</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{children}</div>
    </div>
  );
}

/** Appearance (this computer): accent colour, font and text size - applied instantly. */
export default function AppearancePage() {
  const [a, setA] = useState(loadAppearance);
  const set = (patch) => { const next = { ...a, ...patch }; setA(next); saveAppearance(next); };
  const reset = () => { setA(DEFAULT_APPEARANCE); saveAppearance(DEFAULT_APPEARANCE); toast.success('Appearance reset to default'); };

  return (
    /* fit-screen: three choice panels and a live preview */
    <div className="desk fit-screen animate-rise flex flex-col gap-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
      <section className="navy-gradient flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md px-4 py-2 text-white">
        <Palette className="size-5 shrink-0 opacity-80" />
        <div className="flex min-w-0 flex-1 items-baseline gap-3"><h1 className="text-lg font-bold whitespace-nowrap">Appearance</h1><p className="hidden truncate text-[12px] text-white/60 lg:block">Accent colour, font and text size - changes apply at once and are kept on this computer</p></div>
        <div className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1"><span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">Now</span><b className="text-[13px]">{a.palette === 'custom' ? `Custom ${a.custom}` : PALETTES.find((p) => p.key === a.palette)?.label} · {FONTS.find((f) => f.key === a.font)?.label} · {SIZES.find((s) => s.key === a.size)?.label}</b></div>
      </section>

      <div className="grid gap-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_1fr_340px]">
        <div className="flex flex-col gap-2 xl:min-h-0">
          <Panel icon={Palette} title="Accent colour" sub="menu bar, headers, buttons" className="xl:min-h-0 xl:flex-1">
            {/* custom colour */}
            <div className={clsx('mb-2 flex flex-wrap items-center gap-2 rounded-md border p-1.5', a.palette === 'custom' ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-dashed border-ink-300 dark:border-ink-700')}>
              <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-ink-300 dark:border-ink-600" style={{ background: a.custom }} title="Pick a colour">
                <Pipette className={clsx('size-3.5', isLight(a.custom) ? 'text-ink-900' : 'text-white')} />
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={/^#[0-9a-f]{6}$/i.test(a.custom) ? a.custom : '#1e3a8a'} onChange={(e) => set({ palette: 'custom', custom: e.target.value })} />
              </label>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold">{a.palette === 'custom' && <Dot />}Custom colour</p>
                <input className="num h-6 w-24 rounded-sm border border-ink-200 bg-white px-1.5 text-[12px] uppercase dark:border-ink-700 dark:bg-ink-900" maxLength={7} value={a.custom}
                  onChange={(e) => { const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value; if (/^#[0-9a-f]{6}$/i.test(v)) set({ palette: 'custom', custom: v }); else setA({ ...a, custom: v }); }} />
              </div>
              <span className="flex h-6 min-w-24 flex-1 overflow-hidden rounded-sm">{scaleFrom(a.custom).slice(2).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
              {a.palette !== 'custom' && <button type="button" onClick={() => /^#[0-9a-f]{6}$/i.test(a.custom) && set({ palette: 'custom' })} className="h-7 rounded-md border border-ink-200 bg-white px-2.5 text-[12px] font-semibold hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900">Use</button>}
              {isLight(a.custom) && <p className="flex w-full items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />Light colour - white text on headers may be hard to read. Pick a darker shade.</p>}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {PALETTES.map((p) => {
                const on = a.palette === p.key;
                return (
                  <button key={p.key} type="button" onClick={() => set({ palette: p.key })}
                    className={clsx('flex min-w-0 flex-col gap-1 rounded-md border p-1 text-left transition', on ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800')}>
                    <span className="flex h-5 overflow-hidden rounded-sm">
                      <span className="flex-[3]" style={{ background: p.c[9] }} /><span className="flex-[2]" style={{ background: p.c[7] }} /><span className="flex-1" style={{ background: p.c[4] }} /><span className="flex-1" style={{ background: p.c[1] }} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold">{on && <Dot />}<span className="truncate">{p.label}</span>{on && <Check className="ml-auto size-3 shrink-0 text-emerald-600" />}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel icon={ALargeSmall} title="Text size" sub="everything gets bigger - text, boxes and buttons" className="shrink-0">
            <div className="grid grid-cols-5 gap-1.5">
              {SIZES.map((s) => {
                const on = a.size === s.key;
                return (
                  <button key={s.key} type="button" onClick={() => set({ size: s.key })}
                    className={clsx('flex flex-col items-center justify-end gap-1 rounded-md border px-1 py-2 transition', on ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-ink-200 text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>
                    <span className="leading-none font-bold" style={{ fontSize: `${Math.round(15 * s.zoom)}px` }}>Aa</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap">{on && <Dot />}{s.label}</span>
                    <span className="num text-[9px] text-ink-400">{Math.round(s.zoom * 100)}%</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <Panel icon={Type} title="Font" sub="one font for every screen" className="xl:min-h-0">
          <div className="flex flex-col gap-1.5">
            {FONTS.map((f) => {
              const on = a.font === f.key;
              return (
                <button key={f.key} type="button" onClick={() => set({ font: f.key })}
                  className={clsx('flex items-center gap-3 rounded-md border px-3 py-2 text-left transition', on ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800')}
                  style={{ fontFamily: `${f.css}, sans-serif` }}>
                  <span className="w-9 text-[20px] leading-none font-bold">Aa</span>
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{f.label}</span><span className="num block truncate text-[11px] text-ink-500">Loan GL-1024 · ₹ 1,25,000.00 · 22.500 g</span></span>
                  {on && <Dot />}
                </button>
              );
            })}
          </div>
        </Panel>

        {/* live preview of the real pieces */}
        <Panel icon={Search} title="Preview" className="xl:min-h-0">
          <div className="flex flex-col gap-2">
            <div className="navy-gradient flex items-center gap-2 rounded-md px-3 py-1.5 text-white"><b className="text-[14px]">New Loan</b><span className="truncate text-[11px] text-white/60">Pledge gold and print the bill</span></div>
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-ink-200 dark:border-ink-800">
              {[['Loan amount', '₹ 85,000', 'bg-navy-900 dark:bg-white'], ['Net weight', '24.350 g', 'bg-amber-500']].map(([l, v, bar]) => (
                <div key={l} className="relative border-ink-200 px-3 py-1.5 pl-4 not-last:border-r dark:border-ink-800"><span className={clsx('absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm', bar)} /><p className="text-[10px] font-bold tracking-wider text-ink-500 uppercase">{l}</p><p className="num text-[15px] font-bold text-navy-900 dark:text-white">{v}</p></div>
              ))}
            </div>
            <table className="w-full overflow-hidden rounded-md text-[12px]">
              <thead className="navy-gradient text-[10px] tracking-wider text-white uppercase"><tr><th className="px-2 py-1.5 text-left">Item</th><th className="px-2 text-right">Weight</th></tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                <tr><td className="px-2 py-1">Chain</td><td className="num px-2 text-right">12.500</td></tr>
                <tr className="bg-emerald-50 dark:bg-emerald-950/30"><td className="px-2 py-1"><span className="flex items-center gap-1.5"><Dot />Ring</span></td><td className="num px-2 text-right">4.250</td></tr>
                <tr><td className="px-2 py-1">Bangle</td><td className="num px-2 text-right">7.600</td></tr>
              </tbody>
              <tfoot className="border-t-2 border-amber-400 bg-amber-50 font-bold text-amber-950"><tr><td className="px-2 py-1">Total</td><td className="num px-2 text-right">24.350</td></tr></tfoot>
            </table>
            <div className="flex flex-wrap gap-1.5 [&_button]:h-8 [&_button]:text-[12px]">
              <Button variant="gold" icon={Save}>Save Loan</Button>
              <Button variant="outline">Print</Button>
              <Button variant="soft-danger">Clear</Button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 dark:border-ink-800 dark:bg-ink-900 [&_button]:h-8 [&_button]:text-[12px]">
        <p className="min-w-0 flex-1 truncate text-[11px] text-ink-400">Saved on this computer for this browser. Each counter can choose its own look.</p>
        <Button variant="soft-danger" icon={RotateCcw} onClick={reset}>Reset to default</Button>
        <ExitButton />
      </div>
    </div>
  );
}
