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

/**
 * Opens the screen a notification points at (drop, leaderboard, home). Works
 * from any screen inside the tab navigator. Returns false if there's no target.
 */
export function openNotificationTarget(navigation: any, data: Record<string, any> | null | undefined): boolean {
  if (!navigation || !data) return false;
  // Walk up to the tab navigator so nested stacks can reach sibling tabs.
  const root = navigation.getParent?.() ?? navigation;
  if (data.dropId) {
    root.navigate('Home', { screen: 'DropActive', params: { dropId: data.dropId } });
    return true;
  }
  if (data.screen === 'leaderboard') {
    root.navigate('Leaderboard');
    return true;
  }
  if (data.screen === 'home') {
    root.navigate('Home', { screen: 'HomeDashboard' });
    return true;
  }
  return false;
}
