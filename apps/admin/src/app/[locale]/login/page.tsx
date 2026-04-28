'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { loginAction } from '@/app/actions/auth-actions';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const searchParams = useSearchParams();
  const unauthorizedError = searchParams.get('error');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-gray-900">
            TrivioQ Admin
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the administrator dashboard
          </p>
        </div>

        {/* Unauthorized Access toast — shown when redirected from middleware */}
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

        <form action={formAction} className="mt-2 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Admin email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {/* Server-side login error */}
          {state?.error && (
            <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
              {state.error}
            </div>
          )}

          <div>
            <Button
              type="submit"
              className="group relative flex w-full justify-center"
              disabled={isPending}
            >
              {isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>
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
