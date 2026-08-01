'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/auth-provider';
import { makeAPICallV1 } from '../lib/api';

export interface FriendUser {
  id: string;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
}

export interface AcceptedFriendship {
  friendshipId: string;
  friend: FriendUser;
  createdAt: string;
}

export interface PendingRequest {
  requestId: string;
  user: FriendUser;
  createdAt: string;
}

export interface FriendshipsData {
  accepted: AcceptedFriendship[];
  incomingRequests: PendingRequest[];
  outgoingRequests: PendingRequest[];
}

export function useFriendships() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<FriendshipsData>({
    queryKey: ['friendships', user?.uid],
    queryFn: () => makeAPICallV1<FriendshipsData>('friendships'),
    enabled: !!user,
  });

  const sendRequest = useMutation({
    mutationFn: (addresseeId: string) =>
      makeAPICallV1('friendships/request', {
        method: 'POST',
        body: { addresseeId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships', user?.uid] });
    },
  });

  const acceptRequest = useMutation({
    mutationFn: (requestId: string) =>
      makeAPICallV1('friendships/accept', {
        method: 'POST',
        body: { requestId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships', user?.uid] });
    },
  });

  const declineRequest = useMutation({
    mutationFn: (requestId: string) =>
      makeAPICallV1('friendships/decline', {
        method: 'POST',
        body: { requestId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships', user?.uid] });
    },
  });

  const removeFriend = useMutation({
    mutationFn: (friendshipId: string) =>
      makeAPICallV1(`friendships/remove/${friendshipId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships', user?.uid] });
    },
  });

  const blockUser = useMutation({
    mutationFn: (userIdToBlock: string) =>
      makeAPICallV1('friendships/block', {
        method: 'POST',
        body: { userIdToBlock },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships', user?.uid] });
    },
  });

  return {
    ...query,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    blockUser,
  };
}
