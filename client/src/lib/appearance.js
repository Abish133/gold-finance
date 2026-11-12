/*
 * Appearance: accent colour, font, text size, light / dark, table style, highlight colours, number style.
 * The colour choices replace Tailwind colour scales through CSS variables, so every screen follows them.
 * Kept in localStorage for a fast start, and synced to the user's login (and an optional shop default) on the server.
 */
import { api } from '@/lib/api';
import { setNumberStyle } from '@/lib/format';

const KEY = 'gf.appearance';
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/* ---------- colour maths ---------- */
const hexRgb = (h) => { const x = String(h).replace('#', ''); const v = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.padEnd(6, '0'); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0); };
const mix = (rgb, to, t) => '#' + rgb.map((c, i) => Math.round(c + (to[i] - c) * t).toString(16).padStart(2, '0')).join('');
export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));
/** 11 shades (50..950) from one colour - the colour itself is the header shade (900) */
export function scaleFrom(hex) {
  const c = hexRgb(hex); const W = [255, 255, 255]; const B = [0, 0, 0];
  return [0.96, 0.92, 0.85, 0.75, 0.62, 0.5, 0.38, 0.25, 0.12, 0].map((t) => mix(c, W, t)).concat(mix(c, B, 0.35));
}
/** true when white text on this colour would be hard to read */
export const isLight = (hex) => { const [r, g, b] = hexRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3; };

const T = (key, label, str, group) => ({ key, label, group, c: str.split(' ') });
const B = (key, label, hex, group) => ({ key, label, group, c: scaleFrom(hex) });

/* main-button accent: the login page's gold, or the theme's own colour */
export const GOLD_ACCENT = { bg: 'linear-gradient(90deg, #f4d58c, #bd9144)', fg: '#10252c', solid: '#d5ad60' };
export const MAIN_BUTTONS = [['auto', 'Theme'], ['gold', 'Gold'], ['accent', 'Accent colour']];

export const PALETTE_GROUPS = ['Classic', 'Blues', 'Greens', 'Warm', 'Purples & Pinks', 'Deep'];
export const PALETTES = [
  { ...T('brand', 'Gold Finance', '#f2f7f8 #e1ecef #c6d9de #9fbcc4 #6f97a2 #4b7782 #355d67 #26474f #17333b #10252c #071d26', 'Classic'), gold: true },
  T('charcoal', 'Charcoal', '#f4f4f5 #e4e4e7 #d4d4d8 #a1a1aa #71717a #52525b #3f3f46 #27272a #18181b #111111 #09090b', 'Classic'),
  T('slate', 'Slate', '#f8fafc #f1f5f9 #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a #020617', 'Classic'),
  T('stone', 'Stone', '#fafaf9 #f5f5f4 #e7e5e4 #d6d3d1 #a8a29e #78716c #57534e #44403c #292524 #1c1917 #0c0a09', 'Classic'),
  B('gunmetal', 'Gunmetal', '#2a3439', 'Classic'),
  B('graphite', 'Graphite', '#33363d', 'Classic'),
  T('navy', 'Navy Blue', '#eff6ff #dbeafe #bfdbfe #93c5fd #60a5fa #3b82f6 #2563eb #1d4ed8 #1e40af #1e3a8a #172554', 'Blues'),
  T('indigo', 'Indigo', '#eef2ff #e0e7ff #c7d2fe #a5b4fc #818cf8 #6366f1 #4f46e5 #4338ca #3730a3 #312e81 #1e1b4b', 'Blues'),
  T('sky', 'Sky Blue', '#f0f9ff #e0f2fe #bae6fd #7dd3fc #38bdf8 #0ea5e9 #0284c7 #0369a1 #075985 #0c4a6e #082f49', 'Blues'),
  T('cyan', 'Cyan', '#ecfeff #cffafe #a5f3fc #67e8f9 #22d3ee #06b6d4 #0891b2 #0e7490 #155e75 #164e63 #083344', 'Blues'),
  B('ocean', 'Ocean', '#0b4f6c', 'Blues'),
  B('steel', 'Steel Blue', '#27445e', 'Blues'),
  B('royal', 'Royal Blue', '#1f3a93', 'Blues'),
  T('teal', 'Teal', '#f0fdfa #ccfbf1 #99f6e4 #5eead4 #2dd4bf #14b8a6 #0d9488 #0f766e #115e59 #134e4a #042f2e', 'Greens'),
  T('emerald', 'Emerald', '#ecfdf5 #d1fae5 #a7f3d0 #6ee7b7 #34d399 #10b981 #059669 #047857 #065f46 #064e3b #022c22', 'Greens'),
  T('green', 'Forest Green', '#f0fdf4 #dcfce7 #bbf7d0 #86efac #4ade80 #22c55e #16a34a #15803d #166534 #14532d #052e16', 'Greens'),
  T('olive', 'Olive', '#f7fee7 #ecfccb #d9f99d #bef264 #a3e635 #84cc16 #65a30d #4d7c0f #3f6212 #365314 #1a2e05', 'Greens'),
  B('pine', 'Pine', '#1f3d2b', 'Greens'),
  B('mint', 'Deep Mint', '#0f5e4f', 'Greens'),
  B('jade', 'Jade', '#00674f', 'Greens'),
  T('maroon', 'Maroon', '#fff1f2 #ffe4e6 #fecdd3 #fda4af #fb7185 #f43f5e #e11d48 #be123c #9f1239 #881337 #4c0519', 'Warm'),
  T('red', 'Red', '#fef2f2 #fee2e2 #fecaca #fca5a5 #f87171 #ef4444 #dc2626 #b91c1c #991b1b #7f1d1d #450a0a', 'Warm'),
  T('orange', 'Orange', '#fff7ed #ffedd5 #fed7aa #fdba74 #fb923c #f97316 #ea580c #c2410c #9a3412 #7c2d12 #431407', 'Warm'),
  T('amber', 'Amber', '#fffbeb #fef3c7 #fde68a #fcd34d #fbbf24 #f59e0b #d97706 #b45309 #92400e #78350f #451a03', 'Warm'),
  T('brown', 'Gold Brown', '#fdf8f0 #f8ecd6 #efd5aa #e3b877 #d4974a #b97a32 #9a6127 #7b4c22 #5f3b1d #4a2e18 #2a190c', 'Warm'),
  B('copper', 'Copper', '#7a3416', 'Warm'),
  B('saffron', 'Saffron', '#9a4a00', 'Warm'),
  B('coffee', 'Coffee', '#3e2a1f', 'Warm'),
  B('terracotta', 'Terracotta', '#8a3b24', 'Warm'),
  T('violet', 'Royal Purple', '#f5f3ff #ede9fe #ddd6fe #c4b5fd #a78bfa #8b5cf6 #7c3aed #6d28d9 #5b21b6 #4c1d95 #2e1065', 'Purples & Pinks'),
  T('purple', 'Purple', '#faf5ff #f3e8ff #e9d5ff #d8b4fe #c084fc #a855f7 #9333ea #7e22ce #6b21a8 #581c87 #3b0764', 'Purples & Pinks'),
  T('magenta', 'Magenta', '#fdf4ff #fae8ff #f5d0fe #f0abfc #e879f9 #d946ef #c026d3 #a21caf #86198f #701a75 #4a044e', 'Purples & Pinks'),
  T('pink', 'Pink', '#fdf2f8 #fce7f3 #fbcfe8 #f9a8d4 #f472b6 #ec4899 #db2777 #be185d #9d174d #831843 #500724', 'Purples & Pinks'),
  B('lavender', 'Lavender', '#4b3b8f', 'Purples & Pinks'),
  B('plum', 'Plum', '#4a1942', 'Purples & Pinks'),
  B('midnight', 'Midnight', '#0b1736', 'Deep'),
  B('wine', 'Wine', '#5a1428', 'Deep'),
  B('rosewood', 'Rosewood', '#65000b', 'Deep'),
  B('aubergine', 'Aubergine', '#3b0d3f', 'Deep'),
  B('forest', 'Deep Forest', '#0e2a1a', 'Deep'),
  B('espresso', 'Espresso', '#2b1a12', 'Deep'),
];

/* highlight (selected rows, active items, success) and totals (total rows, warnings) */
export const HIGHLIGHTS = ['emerald', 'green', 'teal', 'cyan', 'sky', 'navy', 'indigo', 'violet', 'pink'];
export const TOTALS = ['amber', 'orange', 'brown', 'stone', 'sky', 'teal', 'violet', 'pink'];

/* sans-serif fonts that ship with Windows (no download needed); Tamil always falls back to Noto Sans Tamil */
export const FONTS = [
  { key: 'segoe', label: 'Segoe UI', css: "'Segoe UI'" },
  { key: 'system', label: 'System default', css: 'system-ui' },
  { key: 'nirmala', label: 'Nirmala UI', css: "'Nirmala UI'", note: 'best with Tamil' },
  { key: 'calibri', label: 'Calibri', css: 'Calibri' },
  { key: 'arial', label: 'Arial', css: 'Arial' },
  { key: 'tahoma', label: 'Tahoma', css: 'Tahoma' },
  { key: 'verdana', label: 'Verdana', css: 'Verdana', note: 'wide, very clear' },
  { key: 'trebuchet', label: 'Trebuchet MS', css: "'Trebuchet MS'" },
  { key: 'bahnschrift', label: 'Bahnschrift', css: 'Bahnschrift', note: 'narrow, fits more' },
  { key: 'candara', label: 'Candara', css: 'Candara' },
  { key: 'corbel', label: 'Corbel', css: 'Corbel' },
  { key: 'century', label: 'Century Gothic', css: "'Century Gothic'" },
  { key: 'franklin', label: 'Franklin Gothic', css: "'Franklin Gothic Medium'" },
  { key: 'lucida', label: 'Lucida Sans', css: "'Lucida Sans Unicode'" },
  { key: 'mssans', label: 'Microsoft Sans Serif', css: "'Microsoft Sans Serif'" },
  { key: 'leelawadee', label: 'Leelawadee UI', css: "'Leelawadee UI'" },
];

export const SIZES = [
  { key: 'compact', label: 'Compact', zoom: 0.92 },
  { key: 'normal', label: 'Normal', zoom: 1 },
  { key: 'large', label: 'Large', zoom: 1.1 },
  { key: 'xl', label: 'Extra large', zoom: 1.2 },
  { key: 'xxl', label: 'Huge', zoom: 1.3 },
];
export const MODES = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Follow Windows']];
export const DENSITIES = [['compact', 'Compact'], ['normal', 'Normal'], ['comfortable', 'Comfortable']];
export const CORNERS = [['sharp', 'Sharp', '0.125rem'], ['soft', 'Soft', '0.375rem'], ['round', 'Round', '0.625rem']];
export const WEIGHTS = [['normal', 'Regular'], ['medium', 'Medium (bolder)']];
export const GROUPINGS = [['indian', '1,25,000.00'], ['intl', '125,000.00']];
export const CURRENCIES = [['₹', '₹ symbol'], ['Rs.', 'Rs.'], ['', 'No symbol']];

const legacyMode = () => { try { return localStorage.getItem('gf.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
export const DEFAULT_APPEARANCE = {
  palette: 'brand', custom: '#10252c', font: 'segoe', size: 'normal', mode: 'light', density: 'normal', zebra: false,
  corners: 'soft', weight: 'normal', mainBtn: 'auto', highlight: 'emerald', totals: 'amber', grouping: 'indian', currency: '₹', syncLogin: true,
};

export function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    return { ...DEFAULT_APPEARANCE, mode: legacyMode(), ...(saved || {}) };
  } catch { return { ...DEFAULT_APPEARANCE }; }
}

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export const isDarkMode = (a = loadAppearance()) => (a.mode === 'system' ? !!media?.matches : a.mode === 'dark');

const setScale = (root, name, pal) => SHADES.forEach((s, i) => root.setProperty(`--color-${name}-${s}`, pal.c[i]));
const clearScale = (root, name) => SHADES.forEach((s) => root.removeProperty(`--color-${name}-${s}`));
const byKey = (k) => PALETTES.find((p) => p.key === k);

export function applyAppearance(a = loadAppearance()) {
  const el = document.documentElement; const root = el.style;
  // accent: the "navy" scale (menu bar, headers, dark buttons) + the dark "gold" button shades
  const pal = a.palette === 'custom' && isHex(a.custom) ? { c: scaleFrom(a.custom) } : (byKey(a.palette) || PALETTES[0]);
  setScale(root, 'navy', pal);
  [[400, 6], [500, 8], [600, 7], [700, 6], [800, 7], [900, 8]].forEach(([g, i]) => root.setProperty(`--color-gold-${g}`, pal.c[i]));
  // main buttons (Save, Release, Sign in ...): gold like the login page, or the accent colour
  const useGold = a.mainBtn === 'gold' || (a.mainBtn !== 'accent' && !!pal.gold);
  if (useGold) { root.setProperty('--accent-bg', GOLD_ACCENT.bg); root.setProperty('--accent-fg', GOLD_ACCENT.fg); root.setProperty('--accent-solid', GOLD_ACCENT.solid); }
  else ['--accent-bg', '--accent-fg', '--accent-solid'].forEach((k) => root.removeProperty(k));
  // highlight + totals colours (defaults keep the built-in emerald / amber)
  if (a.highlight && a.highlight !== 'emerald' && byKey(a.highlight)) setScale(root, 'emerald', byKey(a.highlight)); else clearScale(root, 'emerald');
  if (a.totals && a.totals !== 'amber' && byKey(a.totals)) setScale(root, 'amber', byKey(a.totals)); else clearScale(root, 'amber');
  // font, weight, corners
  const font = FONTS.find((f) => f.key === a.font) || FONTS[0];
  root.setProperty('--font-sans', `${font.css}, 'Noto Sans Tamil', ui-sans-serif, system-ui, sans-serif`);
  root.setProperty('--app-weight', a.weight === 'medium' ? '500' : '400');
  root.setProperty('--radius-md', (CORNERS.find((c) => c[0] === a.corners) || CORNERS[1])[2]);
  root.setProperty('--radius-sm', a.corners === 'sharp' ? '0.0625rem' : a.corners === 'round' ? '0.375rem' : '0.25rem');
  // text size: zoom the whole app
  const zoom = (SIZES.find((x) => x.key === a.size) || SIZES[1]).zoom;
  root.setProperty('--app-zoom', String(zoom));
  root.zoom = zoom === 1 ? '' : String(zoom);
  // light / dark, table style
  el.classList.toggle('dark', isDarkMode(a));
  el.dataset.density = a.density || 'normal';
  if (a.zebra) el.dataset.zebra = '1'; else delete el.dataset.zebra;
  // numbers
  setNumberStyle({ grouping: a.grouping, currency: a.currency });
  window.dispatchEvent(new CustomEvent('gf-appearance', { detail: a }));
}
media?.addEventListener?.('change', () => { if (loadAppearance().mode === 'system') applyAppearance(); });

let pushTimer = null;
/** save on this computer, apply, and (unless switched off) keep it on the user's login */
export function saveAppearance(a, { remote = true } = {}) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); localStorage.setItem('gf.theme', isDarkMode(a) ? 'dark' : 'light'); } catch { /* private mode */ }
  applyAppearance(a);
  if (!remote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { api.put('/auth/appearance', { appearance: a.syncLogin === false ? null : a }).catch(() => {}); }, 600);
}

/** after login: the user's own look, else the shop default, else what this computer has */
export async function syncAppearance() {
  try {
    const r = await api.get('/auth/appearance');
    const { user, company } = r.data || {};
    const chosen = user || company;
    if (chosen) saveAppearance({ ...DEFAULT_APPEARANCE, ...chosen, syncLogin: !!user || chosen.syncLogin !== false }, { remote: false });
    return r.data;
  } catch { return null; }
}

/** login screen: a computer that never chose a look shows the shop default (applied only, not saved) */
export async function applyShopLookIfNew() {
  try { if (localStorage.getItem(KEY)) return; } catch { return; }
  try {
    const r = await api.get('/auth/appearance/public');
    if (r?.data) applyAppearance({ ...DEFAULT_APPEARANCE, mode: legacyMode(), ...r.data });
  } catch { /* offline / not set - keep the built-in look */ }
}

export const saveShopDefault = (a) => api.put('/auth/appearance/default', { appearance: a });
export const clearShopDefault = () => api.put('/auth/appearance/default', { appearance: null });

/** current zoom factor - for code that measures the window */
export const appZoom = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--app-zoom')) || 1;
