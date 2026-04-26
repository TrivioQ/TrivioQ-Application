import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator, RootTabParamList } from './src/navigation/AppNavigator';

const queryClient = new QueryClient();

const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootTabParamList> = {
  prefixes: [prefix],
  config: {
    screens: {
      // Map deep-links into the nested Home stack
      Home: {
        screens: {
          HomeDashboard: 'home',
          DropActive: 'drop/:dropId',
        },
      },
      Leaderboard: 'leaderboard',
      History: 'history',
      Profile: 'profile',
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
