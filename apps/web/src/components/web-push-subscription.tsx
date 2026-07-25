'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, XCircle } from 'lucide-react';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, getPushSubscriptionStatus } from '@/lib/webpush';
import { useTranslations } from 'next-intl';

export function WebPushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);
  const t = useTranslations('webPush');

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    const status = await getPushSubscriptionStatus();
    setIsSupported(status.isSupported);
    setPermission(status.permission);
    setIsSubscribed(status.isSubscribed);
    setLoading(false);
  }

  async function handleSubscribe() {
    setLoading(true);
    const success = await subscribeToPushNotifications();
    if (success) {
      setIsSubscribed(true);
      setPermission('granted');
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    setLoading(true);
    const success = await unsubscribeFromPushNotifications();
    if (success) {
      setIsSubscribed(false);
    }
    setLoading(false);
  }

  if (!isSupported) {
    return (
      <div className="p-4 bg-bg rounded-lg">
        <p className="text-sm text-text-muted">{t('notSupported')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-bg-secondary rounded-lg border border-border">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isSubscribed ? 'bg-success/15' : 'bg-brand-100'}`}>{isSubscribed ? <CheckCircle className="h-5 w-5 text-success" /> : <Bell className="h-5 w-5 text-brand-600" />}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-text">{isSubscribed ? t('enabledTitle') : t('enableTitle')}</h3>
          <p className="text-sm text-text-muted mt-1">{isSubscribed ? t('enabledDesc') : t('enableDesc')}</p>

          <div className="mt-3">
            {isSubscribed ? (
              <button onClick={handleUnsubscribe} disabled={loading} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-border bg-bg-secondary px-3 py-1.5 text-error hover:text-error hover:bg-error/10 disabled:opacity-50 disabled:pointer-events-none">
                <BellOff className="h-4 w-4 mr-2" />
                {t('disableButton')}
              </button>
            ) : permission === 'denied' ? (
              <div className="flex items-center gap-2 text-sm text-error bg-error/10 px-3 py-2 rounded-lg">
                <XCircle className="h-4 w-4" />
                <span>{t('blockedMessage')}</span>
              </div>
            ) : (
              <button onClick={handleSubscribe} disabled={loading} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-text text-bg-secondary px-3 py-1.5 hover:bg-text/90 disabled:opacity-50 disabled:pointer-events-none">
                <Bell className="h-4 w-4 mr-2" />
                {loading ? t('enabling') : t('enableButton')}
              </button>
            )}
          </div>

          {permission === 'granted' && !isSubscribed && <p className="text-xs text-text-muted mt-2">{t('permissionGrantedNote')}</p>}
        </div>
      </div>
    </div>
  );
}
