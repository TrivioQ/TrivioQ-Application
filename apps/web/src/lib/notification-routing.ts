export const notificationTypeIcons: Record<string, string> = {
  TRIVIA_DROP: '📝',
  SYSTEM_ANNOUNCEMENT: '📢',
  SUBSCRIPTION_REMINDER: '⏰',
  OFFER_PROMOTION: '🎁',
  CREDIT_ALERT: '💎',
  ADMIN_MESSAGE: '💬',
  SOCIAL_ACTIVITY: '📈',
  STREAK_REMINDER: '🔥',
};

/** Where a notification should take the user (drop → dashboard, rank → leaderboard). */
export function notificationHref(data: Record<string, any> | null | undefined): string | null {
  if (!data) return null;
  if (data.dropId || data.screen === 'home') return '/dashboard';
  if (data.screen === 'leaderboard') return '/leaderboard';
  return null;
}
