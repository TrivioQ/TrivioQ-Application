'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthSync } from '@/hooks/use-auth-sync';
import { useAuth } from '@/context/auth-provider';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepMeLoggedIn, setKeepMeLoggedIn] = useState(false);

  // Errors are shown as toast notifications via useAuthSync → useNotification
  const { isPending, loginWithEmailSync, signInWithGoogleSync } = useAuthSync();

  useEffect(() => {
    if (!isLoading && user) {
      const callbackUrl = searchParams.get('callbackUrl');
      if (callbackUrl && callbackUrl.startsWith('/')) {
        router.replace(callbackUrl);
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, router, searchParams]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithEmailSync(email, password, keepMeLoggedIn);
  };

  const handleGoogleLogin = async () => {
    await signInWithGoogleSync();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:px-8 selection:bg-brand-500 selection:text-white">
      <div className="w-full max-w-md space-y-8 bg-white/30 dark:bg-white/5 backdrop-blur-2xl p-10 rounded-3xl border border-white/50 dark:border-white/10 shadow-2xl shadow-brand-900/10">
        <div className="text-center">
          <Link href="/" className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-400">
            {t('brandName')}
          </Link>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{t('signInTitle')}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('signInSubtitle')}{' '}
            <Link href="/signup" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
              {t('signInSubtitleLink')}
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleEmailLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="sr-only" htmlFor="email">
                {t('emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                required
                className="relative block w-full rounded-t-md border-0 bg-white dark:bg-gray-800 py-3 px-4 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="password">
                {t('passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                required
                className="relative block w-full rounded-b-md border-0 bg-white dark:bg-gray-800 py-3 px-4 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input id="keep-me-logged-in" type="checkbox" checked={keepMeLoggedIn} onChange={(e) => setKeepMeLoggedIn(e.target.checked)} disabled={isPending} className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-500 focus:ring-brand-600 dark:focus:ring-brand-500 focus:ring-offset-white dark:focus:ring-offset-gray-900" />
            <label htmlFor="keep-me-logged-in" className="text-sm text-gray-600 dark:text-gray-400 select-none cursor-pointer">
              {t('keepMeLoggedIn')}
            </label>
          </div>

          <div>
            <button type="submit" disabled={isPending} className="group relative flex w-full justify-center rounded-md bg-brand-500 px-3 py-3 text-sm font-semibold text-white hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 transition-colors">
              {isPending ? t('authenticating') : t('signInButton')}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700" />
            <span className="flex-shrink-0 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">{t('orContinueWith')}</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700" />
          </div>

          <div className="mt-6">
            <button onClick={handleGoogleLogin} disabled={isPending} className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent disabled:opacity-50 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
              </svg>
              <span className="text-sm font-semibold leading-6">{t('googleButton')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
