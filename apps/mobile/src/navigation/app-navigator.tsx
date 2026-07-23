import React from 'react';
import { Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NavigatorScreenParams } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/ThemeContext';

// Screens
import LoginScreen from '../screens/login-screen';
import SignupScreen from '../screens/signup-screen';
import HomeDashboard from '../screens/home-dashboard';
import DropActive from '../screens/drop-active';
import LeaderboardScreen from '../screens/leaderboard-screen';
import HistoryScreen from '../screens/history-screen';
import ProfileScreen from '../screens/profile-screen';
import TermsScreen from '../screens/terms-screen';
import PrivacyScreen from '../screens/privacy-screen';
import SubscriptionScreen from '../screens/subscription-screen';
import NotificationsScreen from '../screens/notifications-screen';
import Preferences from '../screens/Preferences';
import FaqScreen from '../screens/faq-screen';
import ScoreHistoryScreen from '../screens/score-history-screen';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type HomeStackParamList = {
  HomeDashboard: undefined;
  DropActive: { dropId?: string };
  Notifications: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Subscription: undefined;
  Terms: undefined;
  Privacy: undefined;
  Notifications: undefined;
  Preferences: undefined;
  FAQ: undefined;
  ScoreHistory: undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Leaderboard: undefined;
  History: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Brand colour ─────────────────────────────────────────────────────────────
// Colors are now sourced dynamically from ThemeContext

// ─── Tab icons (inline SVG-style via Unicode / emoji fallback) ────────────────
// Using simple text icons for zero-dependency rendering.
// Swap for a real icon library (e.g. @expo/vector-icons) as desired.

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

// ─── Home stack (Home + DropActive modal) ─────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <HomeStack.Screen name="HomeDashboard" component={HomeDashboard} options={{ title: t('common.brandName') }} />
      <HomeStack.Screen
        name="DropActive"
        component={DropActive}
        options={{
          title: t('common.activeDrop'),
          presentation: 'modal',
          headerStyle: { backgroundColor: '#1e1b4b' },
        }}
      />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('common.notifications') }} />
    </HomeStack.Navigator>
  );
}

// ─── Profile stack (Profile + Terms + Privacy) ───────────────────────────────

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: t('common.profile') }} />
      <ProfileStack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: t('common.subscription') }} />
      <ProfileStack.Screen name="Terms" component={TermsScreen} options={{ title: t('profile.terms') }} />
      <ProfileStack.Screen name="Privacy" component={PrivacyScreen} options={{ title: t('profile.privacy') }} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('common.notifications') }} />
      <ProfileStack.Screen name="Preferences" component={Preferences} options={{ title: t('profile.preferences') }} />
      <ProfileStack.Screen name="FAQ" component={FaqScreen} options={{ title: t('profile.faq') }} />
      <ProfileStack.Screen name="ScoreHistory" component={ScoreHistoryScreen} options={{ title: t('profile.scoreHistory') }} />
    </ProfileStack.Navigator>
  );
}

// ─── Bottom tab navigator ─────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<RootTabParamList>();

function MainTabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.borderColor,
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
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: t('common.home'),
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: t('common.leaderboard'),
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="🏆" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: t('common.history'),
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: t('common.profile'),
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup">{({ navigation }) => <SignupScreen onNavigateToLogin={() => navigation.navigate('Login')} />}</AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a splash/loading screen
  }

  return <RootStack.Navigator screenOptions={{ headerShown: false }}>{user ? <RootStack.Screen name="Main" component={MainTabNavigator} /> : <RootStack.Screen name="Auth" component={AuthStackNavigator} />}</RootStack.Navigator>;
}
