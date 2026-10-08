import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  enableNativeCrashHandling: true,
  patchGlobalPromise: true,
});

import React from 'react';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import './src/i18n';

import { AuthProvider } from './src/context/auth-context';
import { AppNavigator, RootStackParamList } from './src/navigation/app-navigator';
import { ConfirmProvider } from './src/components/confirm-modal';
import { OfflineBanner } from './src/components/offline-banner';
import './src/lib/push-notification-service'; // sets the foreground notification handler
import { Toaster } from 'sonner-native';

// Pause queries/mutations while offline and resume on reconnect.
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(!!state.isConnected)));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep cached data around long enough to be useful on the next cold start.
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: 'offlineFirst',
    },
  },
});

// Cached server data is restored on launch so screens render instantly (and
// offline) while fresh data loads. Bump `buster` when cached shapes change.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'trivioq-query-cache' });
const NEVER_PERSIST = new Set(['activeDrop', 'userSearch', 'publicStats']);

const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'trivioq://'],
  config: {
    screens: {
      Auth: 'login',
      Onboarding: 'welcome',
      Main: {
        screens: {
          Home: {
            screens: {
              HomeDashboard: 'home',
              DropActive: 'drop/:dropId',
              Notifications: 'notifications',
            },
          },
          Leaderboard: 'leaderboard',
          History: {
            screens: {
              HistoryHome: 'history',
              ReviewMistakes: 'review',
            },
          },
          Friends: 'friends',
          Profile: {
            screens: {
              ProfileHome: 'profile',
              Preferences: 'preferences',
              Subscription: 'subscription',
              ScoreHistory: 'score-history',
              Account: 'account',
            },
          },
        },
      },
    },
  },
  async getInitialURL() {
    let url = await Linking.getInitialURL();
    if (url != null) return url;

    // Check if the app was opened via a push notification
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      return urlForNotificationData(response.notification.request.content.data);
    }
    return null;
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

    // Tapping a notification opens the screen it points at (drop → question drop screen).
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = urlForNotificationData(response.notification.request.content.data);
      if (url) listener(url);
    });

    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
    };
  },
};

/** Maps push payload `data` to a deep link (drop, leaderboard, home). */
function urlForNotificationData(data: Record<string, any> | undefined): string | null {
  if (!data) return null;
  if (data.dropId) return `${prefix}drop/${data.dropId}`;
  if (data.screen === 'leaderboard') return `${prefix}leaderboard`;
  if (data.screen === 'home') return `${prefix}home`;
  return null;
}

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { DefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';

function RootNavigation() {
  const { colorScheme } = useTheme();

  return (
    <NavigationContainer linking={linking} theme={colorScheme === 'dark' ? NavDarkTheme : DefaultTheme}>
      <AppNavigator />
      <OfflineBanner />
    </NavigationContainer>
  );
}

function App() {
  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          buster: 'v2',
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && !NEVER_PERSIST.has(String(q.queryKey[0])) },
        }}
      >
        <AuthProvider>
          <ConfirmProvider>
            <RootNavigation />
            <Toaster />
          </ConfirmProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(App);
