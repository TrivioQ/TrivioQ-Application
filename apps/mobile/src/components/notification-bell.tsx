import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  navigation?: any;
}

const typeIcons: Record<string, string> = {
  TRIVIA_DROP: '📝',
  SYSTEM_ANNOUNCEMENT: '📢',
  SUBSCRIPTION_REMINDER: '⏰',
  OFFER_PROMOTION: '🎁',
  CREDIT_ALERT: '💎',
  ADMIN_MESSAGE: '💬',
};

export function NotificationBell({ navigation }: NotificationBellProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [isVisible, setIsVisible] = useState(false);

  const { data: notifications } = useQuery<UserNotification[]>({
    queryKey: ['notifications-preview'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/notifications/inbox?limit=5');
      return response.data.notifications || [];
    },
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/v1/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-preview'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsVisible(false);
    },
  });

  const unreadCount = (notifications || []).filter((n) => !n.isRead).length;

  const handleNotificationPress = (id: string) => {
    markAsReadMutation.mutate(id);
    setIsVisible(false);
    navigation?.navigate('Notifications');
  };

  const handleViewAll = () => {
    setIsVisible(false);
    navigation?.navigate('Notifications');
  };

  return (
    <>
      <TouchableOpacity style={styles.bellContainer} onPress={() => setIsVisible(true)}>
        <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={isVisible} transparent animationType="fade" onRequestClose={() => setIsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsVisible(false)}>
          <TouchableOpacity style={[styles.dropdown, { backgroundColor: colors.bgPrimary, borderColor: colors.borderColor }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
              <TouchableOpacity onPress={() => markAllAsReadMutation.mutate()}>
                <Text style={[styles.markAllRead, { color: colors.brand }]}>Mark all read</Text>
              </TouchableOpacity>
            </View>

            {/* Notifications list */}
            {!notifications || notifications.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.notificationItem, !item.isRead && { backgroundColor: colors.brand + '10' }]} onPress={() => handleNotificationPress(item.id)}>
                    <Text style={styles.typeIcon}>{typeIcons[item.type] || '🔔'}</Text>
                    <View style={styles.content}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.notificationTitle, { color: colors.textPrimary }, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />}
                      </View>
                      <Text style={[styles.notificationBody, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.body}
                      </Text>
                      <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.list}
              />
            )}

            {/* Footer */}
            <TouchableOpacity style={[styles.footer, { backgroundColor: colors.bgSecondary }]} onPress={handleViewAll}>
              <Text style={[styles.footerText, { color: colors.brand }]}>View all notifications →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bellContainer: {
      position: 'relative',
      padding: 8,
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-start',
      paddingTop: 60,
    },
    dropdown: {
      marginHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
      maxHeight: 400,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
    },
    markAllRead: {
      fontSize: 13,
      fontWeight: '600',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      marginTop: 12,
    },
    list: {
      maxHeight: 300,
    },
    notificationItem: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    typeIcon: {
      fontSize: 20,
    },
    content: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    notificationTitle: {
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
    },
    unreadTitle: {
      fontWeight: '700',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    notificationBody: {
      fontSize: 13,
      marginTop: 2,
      lineHeight: 18,
    },
    timestamp: {
      fontSize: 11,
      marginTop: 4,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.1)',
    },
    footerText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
