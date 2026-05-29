import { useQuery } from '@tanstack/react-query';
import { fetchVenues } from '@/lib/api';

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: fetchVenues,
    staleTime: 30 * 60 * 1000,
  });
}
