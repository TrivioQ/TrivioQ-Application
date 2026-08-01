'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { FriendUser } from '../../hooks/use-friendships';

interface FriendCardProps {
  user: FriendUser;
  type: 'accepted' | 'incoming' | 'outgoing' | 'search';
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
  onSendRequest?: () => void;
  onBlock?: () => void;
  isLoading?: boolean;
}

export function FriendCard({ user, type, onAccept, onDecline, onRemove, onSendRequest, onBlock, isLoading }: FriendCardProps) {
  const t = useTranslations('friends');
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">{user.profilePicture ? <img src={user.profilePicture} alt={user.username} className="h-12 w-12 rounded-full object-cover" /> : user.displayName?.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}</div>
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{user.displayName || user.username}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</span>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {type === 'accepted' && (
          <>
            <button onClick={onRemove} disabled={isLoading} className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
              {t('remove')}
            </button>
            <button onClick={onBlock} disabled={isLoading} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-md transition-colors">
              {t('block')}
            </button>
          </>
        )}

        {type === 'incoming' && (
          <>
            <button onClick={onAccept} disabled={isLoading} className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors">
              {t('accept')}
            </button>
            <button onClick={onDecline} disabled={isLoading} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-md transition-colors">
              {t('decline')}
            </button>
          </>
        )}

        {type === 'outgoing' && <span className="px-3 py-1.5 text-sm font-medium text-gray-500 italic">{t('pending')}</span>}

        {type === 'search' && (
          <button onClick={onSendRequest} disabled={isLoading} className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors">
            {t('addFriend')}
          </button>
        )}
      </div>
    </div>
  );
}
