import React from 'react';
import { Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NavigatorScreenParams } from '@react-navigation/native';

// Screens
import HomeDashboard from '../screens/home-dashboard';
import DropActive from '../screens/drop-active';
import LeaderboardScreen from '../screens/leaderboard-screen';
import HistoryScreen from '../screens/history-screen';
import ProfileScreen from '../screens/profile-screen';
import TermsScreen from '../screens/terms-screen';
import PrivacyScreen from '../screens/privacy-screen';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HomeStackParamList = {
  HomeDashboard: undefined;
  DropActive: { dropId?: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Terms: undefined;
  Privacy: undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Leaderboard: undefined;
  History: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Brand colour ─────────────────────────────────────────────────────────────

const BRAND = '#6366f1'; // TrivioQ indigo
const TAB_BG = '#0f172a'; // Dark navy background
const INACTIVE = '#475569'; // Muted slate

// ─── Tab icons (inline SVG-style via Unicode / emoji fallback) ────────────────
// Using simple text icons for zero-dependency rendering.
// Swap for a real icon library (e.g. @expo/vector-icons) as desired.

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

// ─── Home stack (Home + DropActive modal) ─────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: TAB_BG },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <HomeStack.Screen name='HomeDashboard' component={HomeDashboard} options={{ title: 'TrivioQ' }} />
      <HomeStack.Screen
        name='DropActive'
        component={DropActive}
        options={{
          title: 'Active Drop ⚡',
          presentation: 'modal',
          headerStyle: { backgroundColor: '#1e1b4b' },
        }}
      />
    </HomeStack.Navigator>
  );
}

// ─── Profile stack (Profile + Terms + Privacy) ───────────────────────────────

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: TAB_BG },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <ProfileStack.Screen name='ProfileHome' component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name='Terms' component={TermsScreen} options={{ title: 'Terms of Service' }} />
      <ProfileStack.Screen name='Privacy' component={PrivacyScreen} options={{ title: 'Privacy Policy' }} />
    </ProfileStack.Navigator>
  );
}

// ─── Bottom tab navigator ─────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name='Home'
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon='🏠' focused={focused} />,
        }}
      />
      <Tab.Screen
        name='Leaderboard'
        component={LeaderboardScreen}
        options={{
          tabBarLabel: 'Leaderboard',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon='🏆' focused={focused} />,
        }}
      />
      <Tab.Screen
        name='History'
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon='📋' focused={focused} />,
        }}
      />
      <Tab.Screen
        name='Profile'
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon='👤' focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
