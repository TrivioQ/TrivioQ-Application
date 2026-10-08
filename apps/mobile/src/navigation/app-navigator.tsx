import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
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
import FriendsScreen from '../screens/friends-screen';
import ReviewMistakesScreen from '../screens/review-mistakes-screen';
import AccountScreen from '../screens/account-screen';
import OnboardingScreen from '../screens/onboarding-screen';
import { fetchFriendships } from '../api/friendships';
import { queryKeys, useMe } from '../api/queries';
import apiClient from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
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
  Account: undefined;
};

export type HistoryStackParamList = {
  HistoryHome: undefined;
  ReviewMistakes: undefined;
};

export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Leaderboard: undefined;
  History: NavigatorScreenParams<HistoryStackParamList>;
  Friends: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Brand colour ─────────────────────────────────────────────────────────────
// Colors are now sourced dynamically from ThemeContext

// ─── Tab icons ───────────────────────────────────────────────────────────────

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
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
          headerStyle: { backgroundColor: colors.bgSecondary },
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
      <ProfileStack.Screen name="Account" component={AccountScreen} options={{ title: t('profile.accountSecurity') }} />
    </ProfileStack.Navigator>
  );
}

// ─── History stack (History + Review mistakes) ───────────────────────────────

const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function HistoryStackNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <HistoryStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <HistoryStack.Screen name="HistoryHome" component={HistoryScreen} options={{ title: t('history.title') }} />
      <HistoryStack.Screen name="ReviewMistakes" component={ReviewMistakesScreen} options={{ title: t('review.title') }} />
    </HistoryStack.Navigator>
  );
}

// ─── Bottom tab navigator ─────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<RootTabParamList>();

function MainTabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Badge counts: pending friend requests and unread notifications.
  const { data: friendships } = useQuery({ queryKey: queryKeys.friendships, queryFn: fetchFriendships, refetchInterval: 60_000 });
  const { data: unread } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => (await apiClient.get('/v1/notifications/inbox?limit=1')).data.unreadCount as number,
    refetchInterval: 60_000,
  });
  const incoming = friendships?.incomingRequests.length ?? 0;
  const badgeStyle = { backgroundColor: colors.error, color: colors.onAccent, fontSize: 10 };
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
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} size={size} />,
          tabBarBadge: unread ? unread : undefined,
          tabBarBadgeStyle: badgeStyle,
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: t('common.leaderboard'),
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <TabIcon name={focused ? 'trophy' : 'trophy-outline'} color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryStackNavigator}
        options={{
          tabBarLabel: t('common.history'),
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <TabIcon name={focused ? 'time' : 'time-outline'} color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarLabel: t('friends.title'),
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <TabIcon name={focused ? 'people' : 'people-outline'} color={color} size={size} />,
          tabBarBadge: incoming || undefined,
          tabBarBadgeStyle: badgeStyle,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: t('common.profile'),
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <TabIcon name={focused ? 'person' : 'person-outline'} color={color} size={size} />,
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

function SignedInNavigator() {
  const { data: me, isLoading } = useMe();
  if (isLoading && !me) return null; // splash stays up while the profile loads

  return <RootStack.Navigator screenOptions={{ headerShown: false }}>{me && me.onboardingComplete === false ? <RootStack.Screen name="Onboarding" component={OnboardingScreen} /> : <RootStack.Screen name="Main" component={MainTabNavigator} />}</RootStack.Navigator>;
}

export function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a splash/loading screen
  }

  if (user) return <SignedInNavigator />;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Auth" component={AuthStackNavigator} />
    </RootStack.Navigator>
  );
}
