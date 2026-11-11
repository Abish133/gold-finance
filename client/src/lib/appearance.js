/*
 * Appearance (per computer): accent colour, font and text size.
 * The accent replaces the "navy" colour scale (menu bar, headers, dark buttons) through CSS variables,
 * so every screen follows it without code changes. Text size zooms the whole app.
 */
const KEY = 'gf.appearance';
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export const PALETTES = [
  { key: 'charcoal', label: 'Charcoal', c: ['#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#18181b', '#111111', '#09090b'] },
  { key: 'slate', label: 'Slate', c: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617'] },
  { key: 'navy', label: 'Navy Blue', c: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'] },
  { key: 'indigo', label: 'Indigo', c: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b'] },
  { key: 'violet', label: 'Royal Purple', c: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#2e1065'] },
  { key: 'teal', label: 'Teal', c: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'] },
  { key: 'emerald', label: 'Emerald', c: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'] },
  { key: 'maroon', label: 'Maroon', c: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337', '#4c0519'] },
  { key: 'sky', label: 'Sky Blue', c: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#082f49'] },
  { key: 'cyan', label: 'Cyan', c: ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#083344'] },
  { key: 'green', label: 'Forest Green', c: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16'] },
  { key: 'olive', label: 'Olive', c: ['#f7fee7', '#ecfccb', '#d9f99d', '#bef264', '#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#3f6212', '#365314', '#1a2e05'] },
  { key: 'purple', label: 'Purple', c: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#3b0764'] },
  { key: 'magenta', label: 'Magenta', c: ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75', '#4a044e'] },
  { key: 'pink', label: 'Pink', c: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843', '#500724'] },
  { key: 'red', label: 'Red', c: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'] },
  { key: 'orange', label: 'Orange', c: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#431407'] },
  { key: 'amber', label: 'Amber', c: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#451a03'] },
  { key: 'stone', label: 'Stone', c: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524', '#1c1917', '#0c0a09'] },
  { key: 'brown', label: 'Gold Brown', c: ['#fdf8f0', '#f8ecd6', '#efd5aa', '#e3b877', '#d4974a', '#b97a32', '#9a6127', '#7b4c22', '#5f3b1d', '#4a2e18', '#2a190c'] },
];

/* sans-serif fonts that ship with Windows (no download needed); Tamil always falls back to Noto Sans Tamil */
export const FONTS = [
  { key: 'segoe', label: 'Segoe UI', css: "'Segoe UI'" },
  { key: 'system', label: 'System default', css: 'system-ui' },
  { key: 'calibri', label: 'Calibri', css: 'Calibri' },
  { key: 'arial', label: 'Arial', css: 'Arial' },
  { key: 'tahoma', label: 'Tahoma', css: 'Tahoma' },
  { key: 'verdana', label: 'Verdana', css: 'Verdana' },
  { key: 'trebuchet', label: 'Trebuchet MS', css: "'Trebuchet MS'" },
];

export const SIZES = [
  { key: 'compact', label: 'Compact', zoom: 0.92 },
  { key: 'normal', label: 'Normal', zoom: 1 },
  { key: 'large', label: 'Large', zoom: 1.1 },
  { key: 'xl', label: 'Extra large', zoom: 1.2 },
  { key: 'xxl', label: 'Huge', zoom: 1.3 },
];

export const DEFAULT_APPEARANCE = { palette: 'charcoal', font: 'segoe', size: 'normal', custom: '#1e3a8a' };

/* custom colour: the picked colour is the header shade (900); lighter shades mix in white, 950 mixes in black */
const hexRgb = (h) => { const x = String(h).replace('#', ''); const v = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.padEnd(6, '0'); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0); };
const mix = (rgb, to, t) => '#' + rgb.map((c, i) => Math.round(c + (to[i] - c) * t).toString(16).padStart(2, '0')).join('');
export function scaleFrom(hex) {
  const c = hexRgb(hex); const W = [255, 255, 255]; const B = [0, 0, 0];
  return [0.96, 0.92, 0.85, 0.75, 0.62, 0.5, 0.38, 0.25, 0.12, 0].map((t) => mix(c, W, t)).concat(mix(c, B, 0.35));
}
/** true when white text on this colour would be hard to read */
export const isLight = (hex) => { const [r, g, b] = hexRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3; };

export function loadAppearance() {
  try { return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_APPEARANCE }; }
}

export function applyAppearance(a = loadAppearance()) {
  const root = document.documentElement.style;
  const pal = a.palette === 'custom' ? { c: scaleFrom(a.custom || DEFAULT_APPEARANCE.custom) } : (PALETTES.find((p) => p.key === a.palette) || PALETTES[0]);
  SHADES.forEach((s, i) => root.setProperty(`--color-navy-${s}`, pal.c[i]));
  // dark "gold" button shades follow the accent too
  [[400, 6], [500, 8], [600, 7], [700, 6], [800, 7], [900, 8]].forEach(([g, i]) => root.setProperty(`--color-gold-${g}`, pal.c[i]));
  const font = FONTS.find((f) => f.key === a.font) || FONTS[0];
  root.setProperty('--font-sans', `${font.css}, 'Noto Sans Tamil', ui-sans-serif, system-ui, sans-serif`);
  const zoom = (SIZES.find((x) => x.key === a.size) || SIZES[1]).zoom;
  root.setProperty('--app-zoom', String(zoom));
  root.zoom = zoom === 1 ? '' : String(zoom);
}

export function saveAppearance(a) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private mode */ }
  applyAppearance(a);
}

/** current zoom factor - for code that measures the window */
export const appZoom = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--app-zoom')) || 1;
