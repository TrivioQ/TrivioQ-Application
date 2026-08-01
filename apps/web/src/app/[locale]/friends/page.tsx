'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useConfirm } from '@/components/confirm-modal';
import { useFriendships } from '@/hooks/use-friendships';
import { FriendCard } from '@/components/friends/FriendCard';

export default function FriendsPage() {
  const t = useTranslations('friends');
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const { data, isLoading, acceptRequest, declineRequest, removeFriend, blockUser } = useFriendships();

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
          <button onClick={() => setActiveTab('friends')} className={`${activeTab === 'friends' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}>
            {t('myFriends')} ({accepted.length})
          </button>
          <button onClick={() => setActiveTab('requests')} className={`${activeTab === 'requests' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}>
            {t('requests')}
            {incoming.length > 0 && <span className="ml-2 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">{incoming.length}</span>}
          </button>
        </nav>
      </div>

      <div>
        {activeTab === 'friends' && (
          <div className="space-y-4">
            {accepted.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">{t('noFriendsYet')}</p>
              </div>
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
