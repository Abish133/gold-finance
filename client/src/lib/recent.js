/* Recently used screens and records (loans / customers) - kept on this computer for quick jumps. */
const SCREENS = 'gf.recent.screens';
const RECORDS = 'gf.recent.records';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

/** screen: { path, label, menu } */
export function addRecentScreen(screen) {
  if (!screen?.path || !screen?.label) return;
  write(SCREENS, [screen, ...read(SCREENS).filter((s) => s.path !== screen.path)].slice(0, 6));
}
export const recentScreens = () => read(SCREENS);

/** record: { type: 'loan' | 'customer', id, label, sub, path } */
export function addRecentRecord(rec) {
  if (!rec?.path || !rec?.label) return;
  write(RECORDS, [{ ...rec, at: Date.now() }, ...read(RECORDS).filter((r) => r.path !== rec.path)].slice(0, 6));
}
export const recentRecords = () => read(RECORDS);
