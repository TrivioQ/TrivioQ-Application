import apiClient from './client';

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

export const fetchFriendships = async (): Promise<FriendshipsData> => {
  const response = await apiClient.get('/api/v1/friendships');
  return response.data;
};

export const sendFriendRequest = async (addresseeId: string) => {
  const response = await apiClient.post('/api/v1/friendships/request', { addresseeId });
  return response.data;
};

export const acceptFriendRequest = async (requestId: string) => {
  const response = await apiClient.post('/api/v1/friendships/accept', { requestId });
  return response.data;
};

export const declineFriendRequest = async (requestId: string) => {
  const response = await apiClient.post('/api/v1/friendships/decline', { requestId });
  return response.data;
};

export const removeFriend = async (friendshipId: string) => {
  const response = await apiClient.delete(`/api/v1/friendships/remove/${friendshipId}`);
  return response.data;
};

export const blockUser = async (userIdToBlock: string) => {
  const response = await apiClient.post('/api/v1/friendships/block', { userIdToBlock });
  return response.data;
};
