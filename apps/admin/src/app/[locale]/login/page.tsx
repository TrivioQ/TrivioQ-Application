'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { loginAction } from '@/app/actions/auth-actions';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LayoutDashboard, Users, HelpCircle, Tags, Lock } from 'lucide-react';

function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const searchParams = useSearchParams();
  const unauthorizedError = searchParams.get('error');

  return (
    <div className="flex min-h-screen">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gray-900 p-12 relative overflow-hidden">
        {/* Background grid decoration */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Top: wordmark */}
        <div className="relative">
          <span className="text-2xl font-bold tracking-tight text-white">
            TrivioQ <span className="text-blue-500">Admin</span>
          </span>
        </div>

        {/* Centre: headline + feature list */}
        <div className="relative space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Administration Portal
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white">
              Manage your platform <br />
              <span className="text-blue-500">with confidence.</span>
            </h1>
            <p className="text-sm text-gray-400 max-w-sm">
              A centralised hub for overseeing users, content, and platform settings — all in one place.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: LayoutDashboard, label: 'Real-time dashboard & analytics' },
              { icon: Users, label: 'Full user management & roles' },
              { icon: HelpCircle, label: 'Question bank with difficulty control' },
              { icon: Tags, label: 'Category & content organisation' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-gray-300">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800 text-blue-400">
                  <Icon size={16} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: security notice */}
        <p className="relative text-xs text-gray-600">
          Access is restricted to authorised administrators only.
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 px-6 py-12 sm:px-12">
        {/* Mobile wordmark */}
        <div className="mb-8 lg:hidden">
          <span className="text-2xl font-bold tracking-tight text-gray-900">
            TrivioQ <span className="text-blue-500">Admin</span>
          </span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* Heading */}
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 mb-4">
              <Lock size={22} className="text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Sign in to access the administrator dashboard.
            </p>
          </div>

          {/* Unauthorized access banner */}
          {unauthorizedError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">{unauthorizedError}</p>
                <p className="mt-0.5 text-xs text-red-600">
                  You must be an Admin to access this area.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form action={formAction} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="admin@example.com"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                id="keep-me-logged-in"
                name="keepMeLoggedIn"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="keep-me-logged-in" className="text-sm text-gray-600 select-none cursor-pointer">
                Keep me logged in
              </label>
            </div>

            {/* Server-side error */}
            {state?.error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
                <ShieldAlert className="h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm font-medium text-red-700">{state.error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400">
            Restricted access — administrators only.
          </p>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it in Next.js 15
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
