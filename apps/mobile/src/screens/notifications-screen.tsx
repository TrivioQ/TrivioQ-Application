import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';

interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  pushDelivered: boolean;
  emailDelivered: boolean;
  readAt?: string;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  TRIVIA_DROP: '📝',
  SYSTEM_ANNOUNCEMENT: '📢',
  SUBSCRIPTION_REMINDER: '⏰',
  OFFER_PROMOTION: '🎁',
  CREDIT_ALERT: '💎',
  ADMIN_MESSAGE: '💬',
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: notifications,
    isLoading,
    refetch,
  } = useQuery<UserNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/notifications/inbox?limit=100');
      return response.data.notifications || [];
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/v1/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const filteredNotifications = filter === 'unread' ? (notifications || []).filter((n) => !n.isRead) : notifications || [];

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  const renderNotification = ({ item }: { item: UserNotification }) => (
    <TouchableOpacity style={[styles.notificationCard, !item.isRead && styles.unreadCard]} onPress={() => handleMarkAsRead(item.id)} activeOpacity={0.7}>
      <View style={styles.notificationRow}>
        <Text style={styles.typeIcon}>{typeIcons[item.type] || '🔔'}</Text>
        <View style={styles.notificationContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.metadataRow}>
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <View style={styles.deliveryIndicators}>
              {item.pushDelivered && <Ionicons name="wifi" size={12} color={colors.textSecondary} />}
              {item.emailDelivered && <Ionicons name="mail" size={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with filter tabs and mark all read */}
      <View style={styles.header}>
        <View style={styles.filterTabs}>
          <TouchableOpacity style={[styles.filterTab, filter === 'all' && styles.filterTabActive]} onPress={() => setFilter('all')}>
            <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
              {t('notifications.all')} ({(notifications || []).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]} onPress={() => setFilter('unread')}>
            <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
              {t('notifications.unread')} ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} disabled={markAllAsReadMutation.isPending}>
            <Text style={styles.markAllRead}>{markAllAsReadMutation.isPending ? t('notifications.markingAll') : t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>{t('notifications.loading')}</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{filter === 'unread' ? t('notifications.noUnread') : t('notifications.noNotifications')}</Text>
          <Text style={styles.emptySubtitle}>{filter === 'unread' ? t('notifications.noUnreadSub') : t('notifications.noNotificationsSub')}</Text>
        </View>
      ) : (
        <FlatList data={filteredNotifications} renderItem={renderNotification} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />} contentContainerStyle={styles.listContent} />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderColor,
    },
    filterTabs: {
      flexDirection: 'row',
      gap: 8,
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.bgSecondary,
    },
    filterTabActive: {
      backgroundColor: colors.brand,
    },
    filterTabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    filterTabTextActive: {
      color: '#fff',
    },
    markAllRead: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.brand,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    listContent: {
      padding: 16,
    },
    notificationCard: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.borderColor,
    },
    unreadCard: {
      backgroundColor: colors.brand + '10',
      borderColor: colors.brand,
      borderLeftWidth: 4,
    },
    notificationRow: {
      flexDirection: 'row',
      gap: 12,
    },
    typeIcon: {
      fontSize: 24,
    },
    notificationContent: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      flex: 1,
    },
    unreadTitle: {
      fontWeight: '700',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.brand,
    },
    body: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    metadataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    timestamp: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    deliveryIndicators: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });
