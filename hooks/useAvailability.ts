import { useQuery } from '@tanstack/react-query';
import { fetchDayAvailability, fetchMonthAvailability } from '@/lib/api';

export function useMonthAvailability(resourceId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['availability', 'month', resourceId, year, month],
    queryFn: () => fetchMonthAvailability(resourceId, year, month),
    staleTime: 5 * 60 * 1000,
    enabled: !!resourceId,
  });
}

export function useDayAvailability(resourceId: string, date: string | null) {
  return useQuery({
    queryKey: ['availability', 'day', resourceId, date],
    queryFn: () => fetchDayAvailability(resourceId, date!),
    staleTime: 2 * 60 * 1000,
    enabled: !!resourceId && !!date,
  });
}
