import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, branchStore, setUnauthorizedHandler } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [branch, setBranchState] = useState(branchStore.get());

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const user = me.data?.user || null;

  // keep selected branch valid for the logged-in user
  useEffect(() => {
    if (!user) return;
    const ids = user.branches.map((b) => String(b.id));
    const valid = branch === 'all' ? user.all_branches : ids.includes(String(branch));
    if (!valid) {
      const next = String(user.default_branch_id && ids.includes(String(user.default_branch_id)) ? user.default_branch_id : ids[0] || '');
      branchStore.set(next);
      setBranchState(next);
    }
  }, [user, branch]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    qc.setQueryData(['auth', 'me'], null);
    qc.clear();
  }, [qc]);

  useEffect(() => setUnauthorizedHandler(() => qc.setQueryData(['auth', 'me'], null)), [qc]);

  const setBranch = useCallback((id) => {
    branchStore.set(id);
    setBranchState(String(id));
    // every cached query is branch specific -> drop them (fast, avoids cross-branch flashes)
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }, [qc]);

  const can = useCallback((screen, action = 'view') => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    return !!user.permissions?.[screen]?.[action];
  }, [user]);

  const value = useMemo(() => ({
    user,
    screens: me.data?.screens || [],
    loading: me.isLoading,
    branch,
    isAllBranches: branch === 'all',
    currentBranch: user?.branches.find((b) => String(b.id) === String(branch)) || null,
    setBranch,
    can,
    logout,
    setSession: (data) => qc.setQueryData(['auth', 'me'], data),
  }), [user, me.data, me.isLoading, branch, setBranch, can, logout, qc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
