'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { makeAPICallV1 } from '@/lib/api';
import { useNotification } from '@/context/notification-context';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'PREMIUM' | 'PLUS' | 'FREE';

interface SubscriptionData {
  currentStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  onDemandTokensAvailable: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconCrown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20M5 20 3 8l4.5 4.5L12 4l4.5 8.5L21 8l-2 12" />
    </svg>
  );
}

function IconVault() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M15 12h4M5 12h2" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionSettings() {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const t = useTranslations('subscription');
  const locale = useLocale();

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [daysToSpend, setDaysToSpend] = useState(1);
  const [activating, setActivating] = useState(false);

  const fetchStatus = useCallback(async () => {
    setFetchError(false);
    try {
      const result = await makeAPICallV1<SubscriptionData>('subscriptions/status');
      setData(result);
      setDaysToSpend(1);
    } catch {
      setFetchError(true);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleActivate = async () => {
    if (!data || daysToSpend < 1) return;
    setActivating(true);
    try {
      await makeAPICallV1('subscriptions/activate-vault', {
        method: 'POST',
        body: { daysToActivate: daysToSpend },
      });
      notifySuccess(t('daysActivated', { count: daysToSpend }), t('vaultActivated'));
      setLoadingData(true);
      await fetchStatus();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : t('activationFailed'));
    } finally {
      setActivating(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <section className="bg-bg/50 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-900/10 dark:shadow-none rounded-2xl border border-white dark:border-white/5 p-6 flex items-center justify-center min-h-[200px]">
        <IconSpinner />
      </section>
    );
  }

  if (fetchError || !data) {
    return (
      <section className="bg-bg/50 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-900/10 dark:shadow-none rounded-2xl border border-white dark:border-white/5 p-6 flex items-center gap-3">
        <span className="text-error">
          <IconAlertCircle />
        </span>
        <p className="text-sm text-error">{t('loadFailed')}</p>
      </section>
    );
  }

  const { currentStatus, subscriptionExpiresAt, onDemandTokensAvailable } = data;
  const isAutoRenew = currentStatus === 'PREMIUM';
  const isVault = currentStatus === 'PLUS';
  const isFree = currentStatus === 'FREE';
  const canActivate = (isFree || isVault) && onDemandTokensAvailable > 0;

  return (
    <div className="space-y-6">
      {/* ── Current Plan ──────────────────────────────────────────────────── */}
      <section
        className={`rounded-2xl border p-6 space-y-5 shadow-2xl dark:shadow-none backdrop-blur-2xl ${isAutoRenew ? 'bg-warning/10 dark:bg-warning/5 border-warning/30 dark:border-warning/20 shadow-warning/10' : isVault ? 'bg-brand-50/50 dark:bg-brand-500/5 border-brand-200/50 dark:border-brand-500/20 shadow-brand-900/10' : 'bg-bg/50 dark:bg-overlay/50 border-white dark:border-white/5 shadow-brand-900/10'}`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-text">{t('currentPlan')}</h3>
            <p className="text-sm text-text-muted mt-0.5">{t('currentPlanDesc')}</p>
          </div>

          {isAutoRenew && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 dark:bg-warning/15 text-warning border border-warning/30 dark:border-warning/25">
              <IconCrown />
              {t('premium')}
            </span>
          )}
          {isVault && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/25">
              <IconVault />
              {t('plus')}
            </span>
          )}
          {isFree && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-bg-secondary dark:bg-white/5 text-text-muted border border-border dark:border-white/10">
              <IconSparkles />
              {t('free')}
            </span>
          )}
        </div>

        {isAutoRenew && subscriptionExpiresAt && (
          <div className="flex items-center gap-2 text-sm text-warning">
            <IconCalendar />
            <span>
              {t('nextBillingDate')}
              <span className="font-semibold">{formatDate(subscriptionExpiresAt, locale)}</span>
            </span>
          </div>
        )}
        {isVault && subscriptionExpiresAt && (
          <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-300/80">
            <IconCalendar />
            <span>
              {t('plusExpires')}
              <span className="font-semibold text-brand-900 dark:text-brand-200">{formatDate(subscriptionExpiresAt, locale)}</span>
            </span>
          </div>
        )}

        {isFree && (
          <button className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-text px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
            <IconZap />
            {t('upgradeToPremium')}
          </button>
        )}
      </section>

      {/* ── Premium Vault ─────────────────────────────────────────────────── */}
      <section className="bg-bg/50 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-900/10 dark:shadow-none rounded-2xl border border-white dark:border-white/5 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-text">{t('bankedDaysTitle')}</h3>
            <p className="text-sm text-text-muted mt-0.5">{t('bankedDaysDesc')}</p>
          </div>
          <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 rounded-xl px-4 py-2">
            <span className="text-brand-600 dark:text-brand-400">
              <IconVault />
            </span>
            <span className="text-2xl font-extrabold text-text tabular-nums">{onDemandTokensAvailable}</span>
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 leading-tight">
              {t('banked')}
              <br />
              {t('days')}
            </span>
          </div>
        </div>

        {isAutoRenew && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 dark:border-warning/20 bg-warning/5 dark:bg-warning/5 px-4 py-3.5">
            <span className="text-warning">
              <IconLock />
            </span>
            <p className="text-sm text-warning leading-relaxed">{t('daysLockedMessage')}</p>
          </div>
        )}

        {canActivate && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted">{t('daysToActivate')}</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setDaysToSpend((v) => Math.max(1, v - 1))} disabled={daysToSpend <= 1} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border dark:border-white/10 bg-bg-secondary hover:bg-bg-secondary/70 dark:bg-bg-secondary-dark dark:hover:bg-text-muted/20 text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <IconMinus />
                </button>
                <input
                  type="number"
                  min={1}
                  max={onDemandTokensAvailable}
                  value={daysToSpend}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setDaysToSpend(Math.min(onDemandTokensAvailable, Math.max(1, v)));
                  }}
                  className="w-20 text-center bg-bg-secondary dark:bg-bg-secondary-dark border border-border dark:border-white/10 rounded-xl px-3 py-2 text-text font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand-500 tabular-nums"
                />
                <button
                  onClick={() => setDaysToSpend((v) => Math.min(onDemandTokensAvailable, v + 1))}
                  disabled={daysToSpend >= onDemandTokensAvailable}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border dark:border-white/10 bg-bg-secondary hover:bg-bg-secondary/70 dark:bg-bg-secondary-dark dark:hover:bg-text-muted/20 text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <IconPlus />
                </button>
                <span className="text-sm text-text-muted">{t('ofAvailable', { n: onDemandTokensAvailable })}</span>
              </div>
            </div>

            <button onClick={handleActivate} disabled={activating} className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-text px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {activating ? (
                <>
                  <IconSpinner />
                  {t('activating')}
                </>
              ) : (
                <>
                  <IconZap />
                  {t('activateDays', { count: daysToSpend })}
                </>
              )}
            </button>
          </div>
        )}

        {(isFree || isVault) && onDemandTokensAvailable === 0 && <p className="text-sm text-text-muted italic">{t('noBankedDays')}</p>}
      </section>
    </div>
  );
}
