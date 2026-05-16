import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  enableNativeCrashHandling: true,
  patchGlobalPromise: true,
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import './src/i18n';

import { AuthProvider } from './src/context/auth-context';
import { AppNavigator, RootStackParamList } from './src/navigation/app-navigator';
import { ConfirmProvider } from './src/components/confirm-modal';
import { ToastProvider } from './src/components/toast';

const queryClient = new QueryClient();

const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix],
  config: {
    screens: {
      Auth: 'login',
      Main: {
        screens: {
          Home: {
            screens: {
              HomeDashboard: 'home',
              DropActive: 'drop/:dropId',
            },
          },
          Leaderboard: 'leaderboard',
          History: 'history',
          Profile: {
            screens: {
              ProfileHome: 'profile',
            },
          },
        },
      },
    },
  },
  async getInitialURL() {
    let url = await Linking.getInitialURL();
    if (url != null) return url;

    // Check if the app was opened via an Expo Push Notification
    const response = await Notifications.getLastNotificationResponseAsync();
    const dropId = response?.notification.request.content.data?.dropId;
    if (dropId) {
      return `${prefix}drop/${dropId}`;
    }
    return null;
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    const linkingSubscription = Linking.addEventListener('url', onReceiveURL);

    // Listen to push notifications while app is in foreground/background
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const dropId = response.notification.request.content.data?.dropId;
      if (dropId) {
        listener(`${prefix}drop/${dropId}`);
      }
    });

    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
    };
  },
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <NavigationContainer linking={linking}>
              <AppNavigator />
            </NavigationContainer>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(App);
