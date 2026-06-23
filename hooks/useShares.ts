import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShare,
  deleteShare,
  fetchShares,
  type SharedBooking,
} from '@/lib/share-api';

export function useShares() {
  return useQuery({
    queryKey: ['shares'],
    queryFn: fetchShares,
    staleTime: 30 * 1000,
  });
}

export function useCreateShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ toEmail, booking }: { toEmail: string; booking: SharedBooking }) =>
      createShare(toEmail, booking),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shares'] }),
  });
}

export function useDeleteShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShare(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shares'] }),
  });
}
