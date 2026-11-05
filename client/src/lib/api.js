/**
 * Thin fetch wrapper.
 *  - cookie based auth (httpOnly, set by server)
 *  - sends the currently selected branch in `x-branch-id`
 *  - throws ApiError with server message
 */
const BRANCH_KEY = 'gf.branch';

export const branchStore = {
  get: () => localStorage.getItem(BRANCH_KEY) || '',
  set: (v) => localStorage.setItem(BRANCH_KEY, String(v)),
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const toQuery = (params) => {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, Array.isArray(v) ? v.join(',') : v);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
};

const request = async (method, url, { params, body, signal, raw } = {}) => {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${url}${toQuery(params)}`, {
    method,
    signal,
    credentials: 'include',
    headers: {
      ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
      'x-branch-id': branchStore.get(),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (raw) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(res.status, data?.message || `Request failed (${res.status})`, data?.details);
  }
  return data;
};

export const api = {
  get: (url, params, opts) => request('GET', url, { params, ...opts }),
  post: (url, body, opts) => request('POST', url, { body, ...opts }),
  put: (url, body, opts) => request('PUT', url, { body, ...opts }),
  del: (url, opts) => request('DELETE', url, opts),
  upload: (url, file, extra = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return request('POST', url, { body: fd });
  },
  download: async (url, params, filename) => {
    const res = await request('GET', url, { params, raw: true });
    if (!res.ok) throw new ApiError(res.status, 'Download failed');
    const blob = await res.blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
