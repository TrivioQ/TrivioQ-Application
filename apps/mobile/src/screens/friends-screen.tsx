import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { fetchFriendships, acceptFriendRequest, declineFriendRequest, removeFriend, FriendshipsData } from '../api/friendships';

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const { data, isLoading, error } = useQuery<FriendshipsData>({
    queryKey: ['friendships', userId],
    queryFn: fetchFriendships,
    enabled: !!userId,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendships', userId] }),
  });

  const declineMutation = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendships', userId] }),
  });

  const removeMutation = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendships', userId] }),
  });

  const handleRemove = (friendshipId: string, name: string) => {
    Alert.alert(t('friends.removeFriend'), t('friends.removeFriendConfirmation', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('friends.remove'), style: 'destructive', onPress: () => removeMutation.mutate(friendshipId) },
    ]);
  };

  const renderFriendCard = ({ item }: { item: any }, type: 'accepted' | 'incoming' | 'outgoing') => {
    const user = type === 'accepted' ? item.friend : item.user;
    const name = user.displayName || user.username;

    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.nameText}>{name}</Text>
            <Text style={styles.usernameText}>@{user.username}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {type === 'accepted' && (
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.friendshipId, name)}>
              <Text style={styles.removeBtnText}>{t('friends.remove')}</Text>
            </TouchableOpacity>
          )}
          {type === 'incoming' && (
            <>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptMutation.mutate(item.requestId)}>
                <Text style={styles.acceptBtnText}>{t('friends.accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declineBtn} onPress={() => declineMutation.mutate(item.requestId)}>
                <Text style={styles.declineBtnText}>{t('friends.decline')}</Text>
              </TouchableOpacity>
            </>
          )}
          {type === 'outgoing' && <Text style={styles.pendingText}>{t('friends.pending')}</Text>}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('friends.failedToLoad')}</Text>
      </View>
    );
  }

  const accepted = data?.accepted || [];
  const incoming = data?.incomingRequests || [];
  const outgoing = data?.outgoingRequests || [];

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'friends' && styles.activeTab]} onPress={() => setActiveTab('friends')}>
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            {t('friends.title')} ({accepted.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'requests' && styles.activeTab]} onPress={() => setActiveTab('requests')}>
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            {t('friends.requests')} {incoming.length > 0 && `(${incoming.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'friends' && <FlatList data={accepted} keyExtractor={(item) => item.friendshipId} renderItem={(props) => renderFriendCard(props, 'accepted')} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>{t('friends.noFriendsYet')}</Text>} />}

      {activeTab === 'requests' && (
        <FlatList data={[...incoming.map((i) => ({ ...i, __type: 'incoming' })), ...outgoing.map((o) => ({ ...o, __type: 'outgoing' }))]} keyExtractor={(item) => item.requestId} renderItem={({ item }) => renderFriendCard({ item }, item.__type as 'incoming' | 'outgoing')} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>{t('friends.noRequests')}</Text>} />
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
    tabsContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderColor,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: colors.brand,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.brand,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: colors.bgSecondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.borderColor,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    nameText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    usernameText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    removeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.error + '20', // transparent error
    },
    removeBtnText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
    acceptBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: colors.brand,
    },
    acceptBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    declineBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: colors.surfaceElevated,
    },
    declineBtnText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    pendingText: {
      fontSize: 13,
      fontStyle: 'italic',
      color: colors.textSecondary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 40,
    },
  });
