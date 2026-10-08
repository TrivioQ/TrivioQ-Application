'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { NotificationPreferences } from '@trivioq/shared-types';
import { api } from '@/lib/queries';
import { WebPushSubscription } from './web-push-subscription';

const TYPES: (keyof NotificationPreferences)[] = ['triviaDrop', 'streakReminder', 'socialActivity', 'subscriptionReminder', 'offerPromotion', 'enableEmailNotification'];

function Toggle({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button id={id} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-text-muted/30'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Browser push opt-in plus per-type notification toggles (saved immediately). */
export function NotificationSettings() {
  const t = useTranslations('settings.notifications');
  const queryClient = useQueryClient();
  const { data: prefs } = useQuery({ queryKey: ['notificationPrefs'], queryFn: api.notificationPrefs });

  const mutation = useMutation({
    mutationFn: api.updateNotificationPrefs,
    onMutate: async (patch) => {
      const previous = queryClient.getQueryData<NotificationPreferences>(['notificationPrefs']);
      queryClient.setQueryData(['notificationPrefs'], { ...previous, ...patch });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      queryClient.setQueryData(['notificationPrefs'], ctx?.previous);
      toast.error(t('saveFailed'));
    },
  });

  return (
    <section className="bg-bg-secondary/70 dark:bg-overlay/50 backdrop-blur-2xl shadow-2xl shadow-brand-500/15 dark:shadow-none rounded-2xl border border-brand-100 dark:border-white/5 p-4 sm:p-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-text">{t('title')}</h3>
        <p className="text-sm text-text-muted">{t('desc')}</p>
      </div>

      <WebPushSubscription />

      {prefs ? (
        <ul className="divide-y divide-border dark:divide-white/10">
          {TYPES.map((key) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <label htmlFor={`notif-${key}`} className="cursor-pointer">
                <span className="block text-sm font-semibold text-text">{t(`${key}`)}</span>
                <span className="block text-xs text-text-muted">{t(`${key}Sub`)}</span>
              </label>
              <Toggle id={`notif-${key}`} label={t(`${key}`)} checked={!!prefs[key]} onChange={(v) => mutation.mutate({ [key]: v })} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="h-40 rounded-xl bg-text-muted/10 animate-pulse" aria-busy="true" />
      )}
    </section>
  );
}
