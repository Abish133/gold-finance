import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Generic data hooks shared by every screen. Query keys always include the
 * active branch, so switching branch never shows another branch's cache.
 */

export const useBranchKey = () => useAuth()?.branch || '';

/** GET list with pagination/filter params. */
export function useList(endpoint, params = {}, options = {}) {
  const branch = useBranchKey();
  return useQuery({
    queryKey: [endpoint, branch, 'list', params],
    queryFn: ({ signal }) => api.get(endpoint, params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
    enabled: !!endpoint && (options.enabled ?? true),
  });
}

/** GET returning `data` field (lookups, single records, reports). */
export function useFetch(endpoint, params, options = {}) {
  const branch = useBranchKey();
  return useQuery({
    queryKey: [endpoint, branch, params ?? null],
    queryFn: ({ signal }) => api.get(endpoint, params, { signal }).then((r) => r.data),
    enabled: !!endpoint && (options.enabled ?? true),
    ...options,
  });
}

/**
 * Mutation that toasts and invalidates related lists.
 * useSave({ method: 'post', url: '/customers', invalidate: ['/customers'] })
 */
export function useAction({ method = 'post', url, invalidate = [], success, silent = false } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url: u, body } = {}) => api[method](u || url, body),
    onSuccess: (res) => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      if (!silent) toast.success(typeof success === 'function' ? success(res) : success || 'Saved successfully');
    },
    onError: (err) => toast.error(err.message),
  });
}

/** Save (create or update) a record of a REST resource. */
export function useSaveResource(endpoint, { invalidate = [], onDone } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => (id ? api.put(`${endpoint}/${id}`, body) : api.post(endpoint, body)),
    onSuccess: (res, vars) => {
      [endpoint, ...invalidate].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(vars.id ? 'Updated successfully' : 'Created successfully');
      onDone?.(res);
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteResource(endpoint, { onDone } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.del(`${endpoint}/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [endpoint] }); toast.success('Deleted'); onDone?.(); },
    onError: (err) => toast.error(err.message),
  });
}

/** Cached lookups used by forms (metals, items, schemes, banks, latest rates). */
export const useLookups = () => useFetch('/masters/lookups', undefined, { staleTime: 5 * 60_000 });
export const useCompany = () => useFetch('/admin/company', undefined, { staleTime: 10 * 60_000 });
export const useSettings = () => useFetch('/admin/settings', undefined, { staleTime: 5 * 60_000 });
