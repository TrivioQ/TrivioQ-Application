'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthSync } from '@/hooks/use-auth-sync';
import { useAuth } from '@/context/auth-provider';
import { useNotification } from '@/context/notification-context';

const inputClass = 'relative block w-full rounded-xl shadow-sm border-0 bg-bg-secondary dark:bg-bg-secondary-dark py-3 px-4 text-text ring-1 ring-inset ring-border placeholder:text-text-muted focus:z-10 focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:text-sm sm:leading-6';

export default function SignupPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState(searchParams.get('referral') ?? '');

  const { isPending, registerWithEmailSync, signInWithGoogleSync } = useAuthSync();
  const { error: notifyError } = useNotification();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (dateOfBirth) {
      const dobParts = dateOfBirth.split('-');
      const dobYear = parseInt(dobParts[0], 10);
      const dobMonth = parseInt(dobParts[1], 10);
      const dobDay = parseInt(dobParts[2], 10);

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentDay = today.getDate();

      let age = currentYear - dobYear;
      if (currentMonth < dobMonth || (currentMonth === dobMonth && currentDay < dobDay)) {
        age--;
      }

      if (age < 13) {
        notifyError(t('ageTooYoung'), t('invalidDateOfBirth'));
        return;
      }
    }

    await registerWithEmailSync(email, password, username, displayName, dateOfBirth, referralCode || undefined);
  };

  const handleGoogleSignup = () => {
    signInWithGoogleSync();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:px-8 selection:bg-brand-500 selection:text-text">
      <div className="w-full max-w-md space-y-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl p-10 rounded-3xl border border-brand-100 dark:border-white/10 shadow-2xl shadow-brand-500/15">
        <div className="text-center">
          <Link href="/" className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-400">
            {t('brandName')}
          </Link>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-text">{t('createTitle')}</h2>
          <p className="mt-2 text-sm text-text-muted">
            {t('createSubtitle')}{' '}
            <Link href="/login" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
              {t('createSubtitleLink')}
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="sr-only" htmlFor="displayName">
                {t('displayNameLabel')}
              </label>
              <input id="displayName" type="text" required className={inputClass} placeholder={t('displayNamePlaceholder')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={isPending} />
            </div>

            {/* Username */}
            <div>
              <label className="sr-only" htmlFor="username">
                {t('usernameLabel')}
              </label>
              <input id="username" type="text" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.]+" title={t('usernameTitle')} className={inputClass} placeholder={t('usernamePlaceholder')} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} disabled={isPending} />
            </div>

            {/* Email */}
            <div>
              <label className="sr-only" htmlFor="email">
                {t('emailLabel')}
              </label>
              <input id="email" type="email" required className={inputClass} placeholder={t('emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
            </div>

            {/* Password */}
            <div>
              <label className="sr-only" htmlFor="password">
                {t('passwordLabel')}
              </label>
              <input id="password" type="password" required minLength={8} className={inputClass} placeholder={t('passwordMinLength')} value={password} onChange={(e) => setPassword(e.target.value)} disabled={isPending} />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="sr-only" htmlFor="dateOfBirth">
                {t('dateOfBirthLabel')}
              </label>
              <input id="dateOfBirth" type="date" required className={inputClass} placeholder={t('dateOfBirthLabel')} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={isPending} />
            </div>

            {/* Referral Code (optional) */}
            <div>
              <label className="sr-only" htmlFor="referralCode">
                {t('referralCodeLabel')}
              </label>
              <input id="referralCode" type="text" className={inputClass} placeholder={t('referralCodePlaceholder')} value={referralCode} onChange={(e) => setReferralCode(e.target.value)} disabled={isPending} />
            </div>
          </div>

          {/* Terms & Privacy agreement */}
          <div className="flex items-start gap-3">
            <input id="terms" type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} disabled={isPending} className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-bg-secondary text-brand-600 dark:text-brand-500 focus:ring-brand-600 dark:focus:ring-brand-500 focus:ring-offset-bg-secondary dark:focus:ring-offset-bg-primary cursor-pointer" />
            <label htmlFor="terms" className="text-sm text-text-muted leading-snug cursor-pointer select-none">
              {t('termsAgreement')}{' '}
              <Link href="/terms" target="_blank" className="text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 underline underline-offset-2">
                {t('termsLink')}
              </Link>{' '}
              {t('and')}{' '}
              <Link href="/privacy" target="_blank" className="text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 underline underline-offset-2">
                {t('privacyLink')}
              </Link>
              {t('ageConfirmation')}
            </label>
          </div>

          <div>
            <button type="submit" disabled={isPending || !agreedToTerms} className="group relative flex w-full justify-center rounded-md bg-brand-500 px-3 py-3 text-sm font-semibold text-text hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {isPending ? t('creatingAccount') : t('createButton')}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-border" />
            <span className="flex-shrink-0 px-6 text-sm font-medium text-text-muted">{t('orContinueWith')}</span>
            <div className="flex-grow border-t border-border" />
          </div>

          <div className="mt-6">
            <button onClick={handleGoogleSignup} disabled={isPending || !agreedToTerms} className="flex w-full items-center justify-center gap-3 rounded-md bg-bg-secondary px-3 py-3 text-sm font-semibold text-text shadow-sm ring-1 ring-inset ring-border hover:bg-bg focus-visible:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
              </svg>
              <span className="text-sm font-semibold leading-6">{t('googleButton')}</span>
            </button>
          </div>
          {!agreedToTerms && <p className="mt-3 text-center text-xs text-text-muted">{t('termsRequired')}</p>}
        </div>
      </div>
    </div>
  );
}
