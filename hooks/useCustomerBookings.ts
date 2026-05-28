import { useQuery } from '@tanstack/react-query';
import { fetchCustomerBookings } from '@/lib/api';

export function useCustomerBookings() {
  return useQuery({
    queryKey: ['customer-bookings'],
    queryFn: fetchCustomerBookings,
    staleTime: 60 * 1000,
  });
}
