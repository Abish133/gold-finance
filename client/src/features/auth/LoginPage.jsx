import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Lock, User, ShieldCheck, Gem, BarChart3, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Field, Input } from '@/components/ui';

const FEATURES = [
  { icon: Gem, title: 'Loan in under a minute', text: 'Smart jewel entry, live gold rate & eligibility' },
  { icon: Building2, title: 'Multi-branch', text: 'Strict branch isolation with consolidated owner view' },
  { icon: ShieldCheck, title: 'Role based access', text: 'Screen and action level permissions per role' },
  { icon: BarChart3, title: 'Live insights', text: 'Dashboards, 25+ reports and full accounting' },
];

export default function LoginPage() {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm();
  const login = useMutation({
    mutationFn: (v) => api.post('/auth/login', v),
    onSuccess: (r) => { setSession(r.data); navigate('/', { replace: true }); },
    onError: (e) => toast.error(e.message),
  });
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden navy-gradient p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-gold-500/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 size-[420px] rounded-full bg-navy-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl gold-gradient text-lg font-black text-ink-950">G</div>
          <div><p className="font-bold">Gold Finance</p><p className="text-xs text-ink-400">Pawn Broking Suite</p></div>
        </div>
        <div className="relative mt-auto">
          <h1 className="max-w-md text-4xl leading-tight font-extrabold">Run every branch of your gold loan business from one place.</h1>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <f.icon className="size-5 text-gold-400" />
                <p className="mt-3 text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-xs text-ink-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={handleSubmit((v) => login.mutate(v))} className="w-full max-w-sm animate-rise">
          <h2 className="text-2xl font-bold text-ink-900 dark:text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-500">Sign in to continue</p>
          <div className="mt-8 space-y-4">
            <Field label="Username"><Input prefix={<User className="size-4" />} autoFocus autoComplete="username" {...register('username', { required: true })} /></Field>
            <Field label="Password"><Input prefix={<Lock className="size-4" />} type="password" autoComplete="current-password" {...register('password', { required: true })} /></Field>
            <Button type="submit" variant="gold" size="lg" className="w-full" loading={login.isPending}>Sign in</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
