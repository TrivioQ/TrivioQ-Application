'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { buildInviteLink } from '@trivioq/shared-types';
import { api } from '@/lib/queries';
import { useUserProfile } from '@/hooks/use-user-profile';
import { useConfirm } from '@/components/confirm-modal';
import { useFriendships } from '@/hooks/use-friendships';
import { FriendCard } from '@/components/friends/FriendCard';

export default function FriendsPage() {
  const t = useTranslations('friends');
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'find'>('friends');
  const { data, isLoading, acceptRequest, declineRequest, removeFriend, blockUser, sendRequest } = useFriendships();
  const { data: me } = useUserProfile();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const {
    data: results,
    isFetching: searching,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['userSearch', debounced],
    queryFn: () => api.searchUsers(debounced),
    enabled: activeTab === 'find' && debounced.length >= 2,
  });

  const inviteLink = me && typeof window !== 'undefined' ? buildInviteLink(window.location.origin, me.id) : null;

  const copyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.success(t('linkCopied'));
  };

  const shareInvite = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      await navigator.share({ text: t('inviteMessage', { link: inviteLink }) }).catch(() => undefined);
    } else {
      await copyInvite();
    }
  };

  const inviteCard = (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white">🎟️ {t('inviteTitle')}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('inviteBody')}</p>
      {inviteLink && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input readOnly value={inviteLink} aria-label={t('inviteLinkLabel')} className="flex-1 min-w-0 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-700 dark:text-gray-300" onFocus={(e) => e.currentTarget.select()} />
          <button onClick={copyInvite} className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            {t('copyLink')}
          </button>
          <button onClick={shareInvite} className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white">
            {t('shareInvite')}
          </button>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  const accepted = data?.accepted || [];
  const incoming = data?.incomingRequests || [];
  const outgoing = data?.outgoingRequests || [];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('description')}</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button aria-pressed={activeTab === 'friends'} onClick={() => setActiveTab('friends')} className={`${activeTab === 'friends' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}>
            {t('myFriends')} ({accepted.length})
          </button>
          <button aria-pressed={activeTab === 'requests'} onClick={() => setActiveTab('requests')} className={`${activeTab === 'requests' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}>
            {t('requests')}
            {incoming.length > 0 && <span className="ml-2 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">{incoming.length}</span>}
          </button>
          <button aria-pressed={activeTab === 'find'} onClick={() => setActiveTab('find')} className={`${activeTab === 'find' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}>
            {t('findFriends')}
          </button>
        </nav>
      </div>

      <div>
        {activeTab === 'friends' && (
          <div className="space-y-4">
            {accepted.length === 0 ? (
              <>
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">{t('noFriendsYet')}</p>
                  <button onClick={() => setActiveTab('find')} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    {t('findFriends')} →
                  </button>
                </div>
                {inviteCard}
              </>
            ) : (
              accepted.map((f) => (
                <FriendCard
                  key={f.friendshipId}
                  user={f.friend}
                  type="accepted"
                  onRemove={async () => {
                    const isConfirmed = await confirm({
                      title: t('confirmRemoveTitle'),
                      message: t('confirmRemove', { name: f.friend.displayName || f.friend.username }),
                      isDestructive: true,
                    });
                    if (isConfirmed) {
                      removeFriend.mutate(f.friendshipId);
                    }
                  }}
                  onBlock={async () => {
                    const isConfirmed = await confirm({
                      title: t('confirmBlockTitle'),
                      message: t('confirmBlock', { name: f.friend.displayName || f.friend.username }),
                      isDestructive: true,
                    });
                    if (isConfirmed) {
                      blockUser.mutate(f.friend.id);
                    }
                  }}
                  isLoading={removeFriend.isPending || blockUser.isPending}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'find' && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3">
              <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="sr-only">{t('searchPlaceholder')}</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} autoComplete="off" className="flex-1 bg-transparent py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none" />
              {searching && <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-hidden="true" />}
            </label>
            {debounced.length < 2 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('searchHint')}</p>
            ) : results && results.length === 0 && !searching ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noResults')}</p>
            ) : (
              <div className="space-y-3" aria-live="polite">
                {(results ?? []).map((u) =>
                  u.relationship === 'NONE' ? (
                    <FriendCard
                      key={u.id}
                      user={u}
                      type="search"
                      isLoading={sendRequest.isPending}
                      onSendRequest={() =>
                        sendRequest.mutate(u.id, {
                          onSuccess: () => {
                            toast.success(t('requestSent'));
                            refetchSearch();
                          },
                          onError: (err: any) => toast.error(err?.message || t('actionFailed')),
                        })
                      }
                    />
                  ) : (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {u.displayName || u.username} <span className="text-sm font-normal text-gray-500">@{u.username}</span>
                      </span>
                      <span className="text-sm italic text-gray-500">{t(`relationship.${u.relationship}`)}</span>
                    </div>
                  ),
                )}
              </div>
            )}
            {inviteCard}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('incomingRequests')}</h3>
              {incoming.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('noIncomingRequests')}</p>
              ) : (
                <div className="space-y-4">
                  {incoming.map((r) => (
                    <FriendCard key={r.requestId} user={r.user} type="incoming" onAccept={() => acceptRequest.mutate(r.requestId)} onDecline={() => declineRequest.mutate(r.requestId)} isLoading={acceptRequest.isPending || declineRequest.isPending} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('outgoingRequests')}</h3>
              {outgoing.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('noOutgoingRequests')}</p>
              ) : (
                <div className="space-y-4">
                  {outgoing.map((r) => (
                    <FriendCard key={r.requestId} user={r.user} type="outgoing" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
