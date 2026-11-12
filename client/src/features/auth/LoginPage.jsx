import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import {
  Lock,
  User,
  ShieldCheck,
  Gem,
  BarChart3,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Field, Input } from '@/components/ui';

const FEATURES = [
  {
    icon: Gem,
    title: 'Instant Gold Loans',
    text: 'Fast loan processing and smart jewel valuation.',
  },
  {
    icon: Building2,
    title: 'Multi-Branch Control',
    text: 'Manage all your branches from one platform.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Reliable',
    text: 'Advanced role-based access and permissions.',
  },
  {
    icon: BarChart3,
    title: 'Business Intelligence',
    text: 'Real-time insights, reports and accounting.',
  },
];

export default function LoginPage() {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit } = useForm({
    defaultValues: { username: '', password: '' },
  });

  const [showPassword, setShowPassword] = useState(false);

  const login = useMutation({
    mutationFn: (values) => api.post('/auth/login', values),

    onSuccess: (response) => {
      setSession(response.data);
      navigate('/', { replace: true });
    },

    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (user) return <Navigate to="/" replace />;

  return (
    <main className="fixed inset-0 grid w-full grid-cols-1 overflow-hidden bg-white lg:grid-cols-2">
      {/* =========================================
          LEFT SECTION - BRANDING
      ========================================= */}

      <section className="relative hidden h-full min-h-0 flex-col overflow-hidden bg-[#071d26] px-10 py-8 text-white lg:flex xl:px-14 xl:py-10 2xl:px-20">
        {/* Background decorations */}

        <div className="pointer-events-none absolute -right-40 -top-40 size-[550px] rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-[400px] rounded-full border border-white/[0.08]" />
        <div className="pointer-events-none absolute -bottom-48 -left-40 size-[550px] rounded-full bg-[#355d67]/25 blur-[100px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 size-80 rounded-full bg-[#17424b]/40 blur-[100px]" />

        {/* Brand Logo */}

        <div className="relative z-10 flex shrink-0 items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-white">
            <Gem className="size-6 text-[#10252c]" />
          </div>

          <div>
            <h2 className="text-lg font-bold tracking-wide">GOLD FINANCE</h2>

            <p className="text-[10px] font-semibold uppercase tracking-[3px] text-white/55">
              Pawn Broking Suite
            </p>
          </div>
        </div>

        {/* Main Content */}

        <div className="relative z-10 my-auto min-h-0 w-full max-w-3xl py-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80">
            <Sparkles className="size-3.5" />
            Smart Financial Management
          </div>

          <h1 className="max-w-3xl text-4xl leading-[1.15] font-extrabold tracking-tight xl:text-5xl">
            Your entire gold loan business,
            <span className="mt-2 block text-[#9fbcc4]">
              under one roof.
            </span>
          </h1>

          {/* Hidden on short screens so the footer is never clipped */}
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400 xl:text-base [@media(max-height:760px)]:hidden">
            A smarter way to manage customers, gold loans, branches,
            accounting and business performance — all in one place.
          </p>

          {/* Feature Cards */}

          <div className="mt-8 grid grid-cols-2 gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] xl:p-5"
                >
                  <div className="mb-3 grid size-10 place-items-center rounded-xl bg-white/[0.08] text-white/80 transition-colors group-hover:bg-white/[0.14]">
                    <Icon className="size-5" />
                  </div>

                  <h3 className="text-sm font-semibold xl:text-base">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-400 xl:text-sm">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Left Footer */}

        <div className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Gold Finance</span>

          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-white/60" />
            Secure Business Platform
          </span>
        </div>
      </section>

      {/* =========================================
          RIGHT SECTION - LOGIN
      ========================================= */}

      <section className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-white">
        {/* Mobile Branding */}

        <div className="absolute left-6 top-6 flex items-center gap-3 lg:hidden">
          <div className="grid size-11 place-items-center rounded-xl bg-[#10252c]">
            <Gem className="size-5 text-white" />
          </div>

          <div>
            <p className="font-bold text-[#10252c]">GOLD FINANCE</p>

            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Pawn Broking Suite
            </p>
          </div>
        </div>

        {/* Login Content */}

        <div className="flex min-h-full w-full items-center justify-center px-6 py-24 sm:px-12 lg:px-12 lg:py-10 xl:px-20">
          <div className="w-full max-w-[430px] animate-rise">
            {/* Welcome Header */}

            <div className="mb-10">
              <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-[#e1ecef] text-[#26474f]">
                <Lock className="size-6" />
              </div>

              <p className="mb-3 text-xs font-bold uppercase tracking-[2px] text-[#355d67]">
                Welcome Back
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-[#10252c] sm:text-4xl">
                Sign in to your account
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Enter your credentials to access your business dashboard.
              </p>
            </div>

            {/* Login Form */}

            <form
              onSubmit={handleSubmit(
                (values) => login.mutate(values),
                () => toast.error('Please enter your username and password'),
              )}
              className="space-y-6"
            >
              {/* Username */}

              <Field label="Username">
                <Input
                  prefix={<User className="size-4" />}
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter your username"
                  {...register('username', { required: true })}
                />
              </Field>

              {/* Password */}

              <Field label="Password">
                <div className="relative">
                  <Input
                    prefix={<Lock className="size-4" />}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="pr-12"
                    {...register('password', { required: true })}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#355d67]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>

              {/* Submit - solid dark teal, the same colour as the left panel */}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="group h-12 w-full justify-center gap-3 rounded-xl border-0 !bg-none !bg-[#10252c] font-semibold !text-white transition-all hover:-translate-y-0.5 hover:!bg-[#17333b]"
                loading={login.isPending}
              >
                Sign In

                {!login.isPending && (
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                )}
              </Button>
            </form>

            {/* Security Information */}

            <div className="mt-8 flex items-start gap-3 rounded-xl bg-[#f8f8f5] p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#355d67]" />

              <div>
                <p className="text-xs font-semibold text-[#10252c]">
                  Your account is protected
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Secure access with role-based permissions and protected
                  authentication.
                </p>
              </div>
            </div>

            {/* Right Footer */}

            <p className="mt-10 text-center text-xs text-slate-400">
              © {new Date().getFullYear()} Gold Finance. All rights reserved.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}