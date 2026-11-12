/** Branch contact numbers: 1 to 5, first one is the primary (also kept in branches.phone). */
export const MAX_PHONES = 5;

/** JSON column / string / array -> clean array of numbers (falls back to the old single phone). */
export const parsePhones = (raw, fallback) => {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = list.split(','); }
  }
  if (!Array.isArray(list)) list = [];
  list = list.map((p) => String(p ?? '').trim()).filter(Boolean);
  if (!list.length && fallback) list = [String(fallback).trim()];
  return [...new Set(list)].slice(0, MAX_PHONES);
};
