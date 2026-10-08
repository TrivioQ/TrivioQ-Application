import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Share, RefreshControl, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { toast } from 'sonner-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildInviteLink, type UserSearchResult } from '@trivioq/shared-types';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/colors';
import { env } from '../config/env';
import { useConfirm } from '../components/confirm-modal';
import { SkeletonList } from '../components/ui';
import { api, queryKeys, useMe } from '../api/queries';
import { fetchFriendships, acceptFriendRequest, declineFriendRequest, removeFriend, sendFriendRequest, blockUser, FriendshipsData, FriendUser } from '../api/friendships';

type Tab = 'friends' | 'requests' | 'find';

/** Debounces a fast-changing value (search box). */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const debouncedQuery = useDebounced(query.trim(), 350);

  const { data, isLoading, error, refetch } = useQuery<FriendshipsData>({
    queryKey: queryKeys.friendships,
    queryFn: fetchFriendships,
    enabled: !!me,
  });

  const { data: results, isFetching: searching } = useQuery<UserSearchResult[]>({
    queryKey: ['userSearch', debouncedQuery],
    queryFn: () => api.searchUsers(debouncedQuery),
    enabled: activeTab === 'find' && debouncedQuery.length >= 2,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.friendships });
    queryClient.invalidateQueries({ queryKey: ['userSearch'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
  };
  const onError = (err: any) => toast.error(err.response?.data?.error || t('friends.actionFailed'));

  const acceptMutation = useMutation({ mutationFn: acceptFriendRequest, onSuccess: invalidate, onError });
  const declineMutation = useMutation({ mutationFn: declineFriendRequest, onSuccess: invalidate, onError });
  const removeMutation = useMutation({ mutationFn: removeFriend, onSuccess: invalidate, onError });
  const blockMutation = useMutation({ mutationFn: blockUser, onSuccess: invalidate, onError });
  const requestMutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      toast.success(t('friends.requestSent'));
      invalidate();
    },
    onError,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const inviteLink = me ? buildInviteLink(env.WEB_URL, me.id) : null;

  const shareInvite = async () => {
    if (!inviteLink) return;
    await Share.share({ message: t('friends.inviteMessage', { link: inviteLink }) });
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    toast.success(t('friends.linkCopied'));
  };

  const handleRemove = async (friendshipId: string, name: string) => {
    const ok = await confirm({ title: t('friends.removeFriend'), message: t('friends.removeFriendConfirmation', { name }), confirmLabel: t('friends.remove'), isDestructive: true });
    if (ok) removeMutation.mutate(friendshipId);
  };

  const handleBlock = async (user: FriendUser) => {
    const name = user.displayName || user.username;
    const ok = await confirm({ title: t('friends.blockTitle'), message: t('friends.blockConfirmation', { name }), confirmLabel: t('friends.block'), isDestructive: true });
    if (ok) blockMutation.mutate(user.id);
  };

  const Avatar = ({ name }: { name: string }) => (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );

  const renderFriendCard = ({ item }: { item: any }, type: 'accepted' | 'incoming' | 'outgoing') => {
    const user: FriendUser = type === 'accepted' ? item.friend : item.user;
    const name = user.displayName || user.username;

    return (
      <View style={styles.card}>
        <View style={styles.cardInfo} accessible accessibilityLabel={`${name}, @${user.username}`}>
          <Avatar name={name} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.nameText} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.usernameText}>@{user.username}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {type === 'accepted' && (
            <>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('friends.remove')} ${name}`} style={styles.removeBtn} onPress={() => handleRemove(item.friendshipId, name)}>
                <Text style={styles.removeBtnText}>{t('friends.remove')}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('friends.block')} ${name}`} style={styles.declineBtn} onPress={() => handleBlock(user)}>
                <Text style={styles.declineBtnText}>{t('friends.block')}</Text>
              </TouchableOpacity>
            </>
          )}
          {type === 'incoming' && (
            <>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('friends.accept')} ${name}`} style={styles.acceptBtn} onPress={() => acceptMutation.mutate(item.requestId)}>
                <Text style={styles.acceptBtnText}>{t('friends.accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('friends.decline')} ${name}`} style={styles.declineBtn} onPress={() => declineMutation.mutate(item.requestId)}>
                <Text style={styles.declineBtnText}>{t('friends.decline')}</Text>
              </TouchableOpacity>
            </>
          )}
          {type === 'outgoing' && <Text style={styles.pendingText}>{t('friends.pending')}</Text>}
        </View>
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => {
    const name = item.displayName || item.username;
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo} accessible accessibilityLabel={`${name}, @${item.username}`}>
          <Avatar name={name} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.nameText} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.usernameText}>@{item.username}</Text>
          </View>
        </View>
        {item.relationship === 'NONE' ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('friends.add')} ${name}`} style={styles.acceptBtn} disabled={requestMutation.isPending} onPress={() => requestMutation.mutate(item.id)}>
            <Text style={styles.acceptBtnText}>{t('friends.add')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.pendingText}>{t(`friends.relationship.${item.relationship}`)}</Text>
        )}
      </View>
    );
  };

  if (isLoading) return <SkeletonList count={5} itemHeight={70} />;

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

  const inviteCard = (
    <View style={styles.inviteCard}>
      <Text style={styles.inviteTitle}>🎟️ {t('friends.inviteTitle')}</Text>
      <Text style={styles.inviteBody}>{t('friends.inviteBody')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity accessibilityRole="button" style={[styles.acceptBtn, { flex: 1, alignItems: 'center' }]} onPress={shareInvite}>
          <Text style={styles.acceptBtnText}>{t('friends.shareInvite')}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={[styles.declineBtn, { flex: 1, alignItems: 'center' }]} onPress={copyInvite}>
          <Text style={styles.declineBtnText}>{t('friends.copyLink')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'friends', label: `${t('friends.title')} (${accepted.length})` },
    { key: 'requests', label: `${t('friends.requests')}${incoming.length > 0 ? ` (${incoming.length})` : ''}` },
    { key: 'find', label: t('friends.find') },
  ];

  return (
    <View style={styles.container}>
      <View accessibilityRole="tablist" style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'friends' && (
        <FlatList
          data={accepted}
          keyExtractor={(item) => item.friendshipId}
          renderItem={(props) => renderFriendCard(props, 'accepted')}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          ListHeaderComponent={accepted.length === 0 ? inviteCard : null}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('friends.noFriendsYet')}</Text>}
          ListFooterComponent={accepted.length > 0 ? inviteCard : null}
        />
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={[...incoming.map((i) => ({ ...i, __type: 'incoming' })), ...outgoing.map((o) => ({ ...o, __type: 'outgoing' }))]}
          keyExtractor={(item) => item.requestId}
          renderItem={({ item }) => renderFriendCard({ item }, item.__type as 'incoming' | 'outgoing')}
          contentContainerStyle={styles.list}
          refreshControl={refresh}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('friends.noRequests')}</Text>}
        />
      )}

      {activeTab === 'find' && (
        <FlatList
          data={debouncedQuery.length >= 2 ? (results ?? []) : []}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchResult}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color={colors.textSecondary} />
              <TextInput accessibilityLabel={t('friends.searchPlaceholder')} value={query} onChangeText={setQuery} placeholder={t('friends.searchPlaceholder')} placeholderTextColor={colors.textSecondary} autoCapitalize="none" autoCorrect={false} style={styles.searchInput} />
              {searching && <ActivityIndicator size="small" color={colors.brand} />}
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>{debouncedQuery.length < 2 ? t('friends.searchHint') : searching ? '' : t('friends.noResults')}</Text>}
          ListFooterComponent={inviteCard}
        />
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
    inviteCard: {
      backgroundColor: colors.brandFaint,
      borderRadius: 12,
      padding: 16,
      marginVertical: 12,
      borderWidth: 1,
      borderColor: colors.brandSoft,
    },
    inviteTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    inviteBody: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.borderColor,
      borderRadius: 12,
      backgroundColor: colors.bgSecondary,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textPrimary,
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
