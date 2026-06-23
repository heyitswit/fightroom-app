import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  respondToRequest,
  sendFriendRequest,
} from '@/lib/share-api';

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: fetchFriends,
    staleTime: 30 * 1000,
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: fetchFriendRequests,
    staleTime: 30 * 1000,
  });
}

// Refresh everything that a friend/request/share mutation can affect.
function useInvalidateFriends() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['friends'] });
    qc.invalidateQueries({ queryKey: ['friend-requests'] });
    qc.invalidateQueries({ queryKey: ['shares'] });
  };
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (email: string) => sendFriendRequest(email),
    onSuccess: invalidate,
  });
}

export function useRespondToRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) =>
      respondToRequest(id, action),
    onSuccess: invalidate,
  });
}

export function useCancelFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (id: string) => cancelFriendRequest(id),
    onSuccess: invalidate,
  });
}

export function useRemoveFriend() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (requestId: string) => removeFriend(requestId),
    onSuccess: invalidate,
  });
}
