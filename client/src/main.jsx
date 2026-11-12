import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import { router } from '@/router';
import '@/styles/index.css';
import { applyAppearance } from '@/lib/appearance';

const Devtools = import.meta.env.DEV ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))) : () => null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => err?.status >= 500 && count < 2,
    },
  },
});

if (localStorage.getItem('gf.theme') === 'dark') document.documentElement.classList.add('dark');
applyAppearance(); // accent colour, font, text size chosen on the Appearance screen

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
      <Suspense fallback={null}><Devtools buttonPosition="bottom-left" /></Suspense>
    </QueryClientProvider>
  </StrictMode>,
);
