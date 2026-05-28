import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useDayAvailability, useMonthAvailability } from '@/hooks/useAvailability';
import { type TimeSlot } from '@/lib/api';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DURATIONS = [60, 120, 180, 240, 300, 360, 420, 480];

export default function BookingScreen() {
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName: string }>();

  const today = new Date();
  const [viewDate, setViewDate] = React.useState(today);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<TimeSlot | null>(null);
  const [duration, setDuration] = React.useState(60);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { data: monthData, isLoading: loadingMonth } = useMonthAvailability(roomId, year, month);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const { data: dayData, isLoading: loadingDay } = useDayAvailability(roomId, selectedDateStr);

  const availabilityMap = React.useMemo(() => {
    const map: Record<string, { available: boolean; blocked: boolean }> = {};
    for (const day of monthData?.availability ?? []) {
      // Convert UTC date to local time before extracting YYYY-MM-DD,
      // so May 1st 00:00 Paris (= Apr 30 22:00 UTC) gets key "2026-05-01" not "2026-04-30"
      const key = format(parseISO(day.date), 'yyyy-MM-dd');
      map[key] = { available: day.is_available, blocked: day.blocker != null };
    }
    return map;
  }, [monthData]);

  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const availableTimeSlots = React.useMemo(() => {
    const slots = dayData?.availability?.[0]?.slots ?? [];
    if (slots.length === 0) return [];

    // Collect all open 1h blocks (available slots) and all booked ranges (unavailable slots).
    // Strategy: add every 1h block from available windows, then remove blocks that fall
    // inside any unavailable window. This handles the case where the API returns one large
    // slot as available:false after a partial booking (the booked range is excluded).
    const availableBlocks = new Set<number>();
    const bookedRanges: { start: number; end: number }[] = [];

    for (const slot of slots) {
      const startMs = new Date(slot.start).getTime();
      const endMs = new Date(slot.end).getTime();
      if (slot.available) {
        for (let t = startMs; t + 3600000 <= endMs; t += 3600000) {
          availableBlocks.add(t);
        }
      } else {
        bookedRanges.push({ start: startMs, end: endMs });
      }
    }

    // If no available blocks at all, the whole day slot is unavailable —
    // rebuild from the full window and remove booked ranges.
    if (availableBlocks.size === 0 && slots.length > 0) {
      const firstStart = Math.min(...slots.map((s) => new Date(s.start).getTime()));
      const lastEnd = Math.max(...slots.map((s) => new Date(s.end).getTime()));
      for (let t = firstStart; t + 3600000 <= lastEnd; t += 3600000) {
        const isBooked = bookedRanges.some((r) => t >= r.start && t < r.end);
        if (!isBooked) availableBlocks.add(t);
      }
    }

    // Remove any blocks that overlap a booked range.
    for (const r of bookedRanges) {
      for (let t = r.start; t < r.end; t += 3600000) {
        availableBlocks.delete(t);
      }
    }

    const blocksNeeded = duration / 60;
    const result: TimeSlot[] = [];
    for (const startMs of [...availableBlocks].sort((a, b) => a - b)) {
      let canBook = true;
      for (let i = 1; i < blocksNeeded; i++) {
        if (!availableBlocks.has(startMs + i * 3600000)) {
          canBook = false;
          break;
        }
      }
      if (canBook) {
        result.push({
          start: new Date(startMs).toISOString(),
          end: new Date(startMs + duration * 60000).toISOString(),
        });
      }
    }
    return result;
  }, [dayData, duration]);

  function handleDayPress(day: Date) {
    if (!isSameMonth(day, viewDate)) return;
    if (day < today && !isSameDay(day, today)) return;
    setSelectedDate(day);
    setSelectedSlot(null);
  }

  function handleDurationChange(d: number) {
    setDuration(d);
    setSelectedSlot(null);
  }

  function handleReserve() {
    if (!selectedSlot || !roomId) return;
    router.push({
      pathname: '/booking/confirm',
      params: {
        roomId,
        roomName,
        startAt: selectedSlot.start,
        endAt: selectedSlot.end,
        durationMinutes: String(duration),
      },
    });
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 pb-10">
      {/* Calendrier */}
      <Card className="mx-4 mt-4 gap-3 py-4">
        {/* Navigation mois */}
        <View className="flex-row items-center justify-between px-2">
          <Pressable
            onPress={() => setViewDate((d) => addMonths(d, -1))}
            className="rounded p-2 active:opacity-60">
            <ChevronLeftIcon size={18} color="#6b7280" />
          </Pressable>
          <Text className="font-semibold capitalize text-foreground">
            {format(viewDate, 'MMMM yyyy', { locale: fr })}
          </Text>
          <Pressable
            onPress={() => setViewDate((d) => addMonths(d, 1))}
            className="rounded p-2 active:opacity-60">
            <ChevronRightIcon size={18} color="#6b7280" />
          </Pressable>
        </View>

        {/* Jours de la semaine */}
        <View className="flex-row px-2">
          {DAYS_SHORT.map((d, i) => (
            <View key={i} className="flex-1 items-center">
              <Text className="text-xs font-medium text-muted-foreground">{d}</Text>
            </View>
          ))}
        </View>

        {/* Grille */}
        {loadingMonth ? (
          <View className="h-40 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <View className="flex-row flex-wrap px-2">
            {calendarDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const info = availabilityMap[key];
              const inMonth = isSameMonth(day, viewDate);
              const isPast = day < today && !isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              // Green = API confirms availability; tappable = all future in-month days
              const isAvailable = inMonth && !isPast && info?.available && !info.blocked;
              const isTappable = inMonth && !isPast;
              const isToday = isSameDay(day, today);

              return (
                <Pressable
                  key={key}
                  onPress={() => handleDayPress(day)}
                  disabled={!isTappable}
                  className="w-[14.28%] items-center py-0.5">
                  <View
                    className={`h-9 w-9 items-center justify-center rounded
                      ${isSelected ? 'bg-foreground' : ''}
                      ${isAvailable && !isSelected ? 'bg-green-100 dark:bg-green-900/30' : ''}
                    `}>
                    <Text
                      className={`text-sm ${
                        !inMonth
                          ? 'text-muted-foreground/20'
                          : isSelected
                            ? 'font-semibold text-background'
                            : isAvailable
                              ? 'font-medium text-green-700 dark:text-green-300'
                              : isTappable
                                ? 'text-foreground'
                                : 'text-muted-foreground/40'
                      }`}>
                      {format(day, 'd')}
                    </Text>
                    {isToday && !isSelected && (
                      <View className="absolute bottom-1 h-1 w-1 rounded-full bg-fightroom-ring" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {/* Sélection créneau */}
      {selectedDate && (
        <View className="px-4 gap-4">
          <Text className="font-semibold capitalize text-foreground">
            {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
          </Text>

          {/* Durée */}
          <View className="gap-2">
            <Text className="text-sm text-muted-foreground">Durée</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2 pr-4">
                {DURATIONS.map((d) => {
                  const active = duration === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => handleDurationChange(d)}
                      className={`rounded border px-5 py-3 active:opacity-70 ${
                        active ? 'border-foreground bg-foreground' : 'border-border bg-card'
                      }`}>
                      <Text
                        className={`text-sm font-medium ${active ? 'text-background' : 'text-foreground'}`}>
                        {d / 60}h
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <Separator />

          {/* Heure de début */}
          <View className="gap-2">
            <Text className="text-sm text-muted-foreground">Heure de début</Text>

            {loadingDay ? (
              <View className="h-12 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : availableTimeSlots.length === 0 ? (
              <Card className="py-4">
                <CardContent>
                  <Text className="text-center text-muted-foreground">
                    Aucun créneau disponible ce jour
                  </Text>
                </CardContent>
              </Card>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {availableTimeSlots.map((slot) => {
                  const isActive = selectedSlot?.start === slot.start;
                  return (
                    <Button
                      key={slot.start}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onPress={() => setSelectedSlot(isActive ? null : slot)}
                      style={{ width: '23%' }}>
                      <Text>{format(parseISO(slot.start), "HH'h'mm")}</Text>
                    </Button>
                  );
                })}
              </View>
            )}
          </View>

          {selectedSlot && (
            <Button onPress={handleReserve} className="mt-2">
              <Text>
                Réserver · {format(parseISO(selectedSlot.start), "HH'h'mm")} →{' '}
                {format(parseISO(selectedSlot.end), "HH'h'mm")}
              </Text>
            </Button>
          )}
        </View>
      )}
    </ScrollView>
  );
}
