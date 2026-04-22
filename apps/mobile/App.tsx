import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import HomeDashboard from './src/screens/HomeDashboard';
import DropActive from './src/screens/DropActive';
import Preferences from './src/screens/Preferences';
import { AuthProvider } from './src/context/AuthContext';

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator();

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix],
  config: {
    screens: {
      HomeDashboard: 'home',
      DropActive: 'drop/:dropId',
      Preferences: 'preferences',
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
          <Stack.Navigator initialRouteName='HomeDashboard'>
            <Stack.Screen name='HomeDashboard' component={HomeDashboard} options={{ title: 'Trivioq Dashboard' }} />
            <Stack.Screen name='Preferences' component={Preferences} options={{ title: 'Your Preferences' }} />
            <Stack.Screen name='DropActive' component={DropActive} options={{ title: 'Active Drop' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
