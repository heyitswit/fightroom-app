import { useQuery } from '@tanstack/react-query';
import { fetchBookingDetail } from '@/lib/api';

export function useBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: ['booking-detail', bookingId],
    queryFn: () => fetchBookingDetail(bookingId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
