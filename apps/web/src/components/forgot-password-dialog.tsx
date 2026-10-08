'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

/** Asks for an email and triggers the Firebase password-reset email. */
export function ForgotPasswordDialog({ open, initialEmail, onClose }: { open: boolean; initialEmail: string; onClose: () => void }) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, initialEmail, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      toast.success(t('resetSent'));
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('resetFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="forgot-title" onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-bg-secondary border border-border dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div>
          <h2 id="forgot-title" className="text-lg font-bold text-text">
            {t('forgotPasswordTitle')}
          </h2>
          <p className="text-sm text-text-muted mt-1">{t('forgotPasswordBody')}</p>
        </div>
        <label htmlFor="forgot-email" className="sr-only">
          {t('emailLabel')}
        </label>
        <input ref={inputRef} id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')} className="block w-full rounded-xl bg-bg py-3 px-4 text-text ring-1 ring-inset ring-border placeholder:text-text-muted focus:ring-2 focus:ring-brand-500" />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-md px-3 py-2.5 text-sm font-semibold text-text ring-1 ring-inset ring-border hover:bg-bg">
            {t('cancel')}
          </button>
          <button type="submit" disabled={sending} className="flex-1 rounded-md bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {sending ? t('sending') : t('sendResetLink')}
          </button>
        </div>
      </form>
    </div>
  );
}
