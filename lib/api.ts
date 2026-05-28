import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://fightroom.fr';

export const REGION_ID = 'reg_01KP9Z19XKXCGQC3HCH64EXA0R';
export const PLAN_ID = '01KP9Z1QHM0XT54E0KNV536B18';

export const ROOMS = [
  { id: '01KP9Z1QT8DHH7D1NYG3MYH503', name: 'Ring', available: true },
  { id: '01KP9Z1QVMDQ4CK3X2ZX8T1JVJ', name: 'Percussions', available: true },
  { id: '01KP9Z1QTX2ZJ1P7H8HR1FSA5Q', name: 'Octogone', available: true },
] as const;

const DEVICE_ID_KEY = 'fightroom_device_id';
export const JWT_KEY = 'fightroom_jwt';
const CART_KEY = 'fightroom_cart_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

// Hash du Server Action Next.js — à mettre à jour si fightroom.fr est redéployé
const NEXT_ACTION_HASH = '40ee68e67804a83b0025abe8b4881a8f93af166636';

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/sign-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'next-action': NEXT_ACTION_HASH,
      Referer: BASE_URL,
      Origin: BASE_URL,
    },
    body: JSON.stringify([{ email, password }]),
  });

  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/_medusa_jwt=([^;]+)/);
  if (!match) throw new Error('Email ou mot de passe incorrect');

  const jwt = match[1];
  await SecureStore.setItemAsync(JWT_KEY, jwt);
  return jwt;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(JWT_KEY);
  await SecureStore.deleteItemAsync(CART_KEY);
}

export async function getStoredJwt(): Promise<string | null> {
  return SecureStore.getItemAsync(JWT_KEY);
}

export async function getSessionCookieString(): Promise<string> {
  const jwt = await SecureStore.getItemAsync(JWT_KEY);
  const cartId = await SecureStore.getItemAsync(CART_KEY);
  const deviceId = await getDeviceId();
  return [
    jwt ? `_medusa_jwt=${jwt}` : '',
    `_medusa_region_id=${REGION_ID}`,
    `_medusa_locale=fr-FR`,
    `_booking_device_id=${deviceId}`,
    cartId ? `_medusa_cart_id=${cartId}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

async function buildHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const jwt = await SecureStore.getItemAsync(JWT_KEY);
  const cartId = await SecureStore.getItemAsync(CART_KEY);
  const deviceId = await getDeviceId();

  const cookies = [
    jwt ? `_medusa_jwt=${jwt}` : '',
    `_medusa_region_id=${REGION_ID}`,
    `_medusa_locale=fr-FR`,
    `_booking_device_id=${deviceId}`,
    cartId ? `_medusa_cart_id=${cartId}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  return {
    Cookie: cookies,
    'Content-Type': 'application/json',
    Referer: BASE_URL,
    Origin: BASE_URL,
    ...extra,
  };
}

// --- Types ---

export interface AvailabilityDay {
  date: string;
  is_available: boolean;
  slots: Slot[];
  capacity: number;
  available_units: number;
  blocker: unknown;
}

export interface Slot {
  start: string;
  end: string;
  available: boolean;
  capacity: number;
  available_units: number;
  max_contiguous_duration_minutes: number;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  booking_resource: { id: string; timezone: string };
  booking_plan: {
    id: string;
    name: string;
    kind: string;
    min_duration_minutes: number;
    max_duration_minutes: number;
    start_time_increment_minutes: number;
    duration_increment_minutes: number;
  };
  availability: AvailabilityDay[];
}

export interface CartItem {
  id: string;
  cart_id: string;
  booking_resource_id: string;
  booking_plan_id: string;
  resource_title: string;
  plan_name: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  hold_expires_at: string;
  quoted_unit_price: number;
  currency_code: string;
}

export interface SelectionResponse {
  ok: boolean;
  cart_id: string;
  cart_line_item_id: string;
  booking_cart_item: {
    id: string;
    quoted_unit_price: number;
    currency_code: string;
    expires_at: string;
  };
  booking_cart_items: CartItem[];
}

export interface BookingLineItem {
  id: string;
  local_date: string;
  local_start_time: string;
  local_end_time: string;
  time_zone: string;
  currency_code: string;
  quoted_unit_price: number;
  resource_title: string;
  resource_id: string;
  plan_name: string;
}

export interface Netcode {
  id: string;
  code: string;
  status: string;
  effective_from: string;
  effective_until: string;
  device_name: string;
  resource_name: string;
}

export interface BookingDetailData {
  netcodes: Netcode[];
  smart_lock_state: { requires_smart_lock: boolean; state: string };
}

export interface DepositSummary {
  has_deposit: boolean;
  overall_status: string;
  total_amount: number;
  total_captured_amount: number;
  next_due_at: string | null;
  attention_message: string | null;
}

export interface Booking {
  id: string;
  booking_number: string;
  status: string;
  local_date: string;
  local_start_time: string;
  local_end_time: string;
  time_zone: string;
  created_at: string;
  booking_line_items: BookingLineItem[];
  deposit_summary: DepositSummary;
}

export interface CustomerBookingsResponse {
  bookings: Booking[];
  count: number;
  offset: number;
  limit: number;
}

export interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

// --- API functions ---

export function generateTimeSlots(slot: Slot, durationMin: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const durMs = durationMin * 60 * 1000;
  const incMs = 60 * 60 * 1000;
  let cursor = new Date(slot.start).getTime();
  const end = new Date(slot.end).getTime();

  while (cursor + durMs <= end) {
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(cursor + durMs).toISOString(),
    });
    cursor += incMs;
  }
  return slots;
}

export async function fetchMonthAvailability(
  resourceId: string,
  year: number,
  month: number
): Promise<AvailabilityResponse> {
  const anchor = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const headers = await buildHeaders();
  const res = await fetch(
    `${BASE_URL}/api/booking/availability?resource_id=${resourceId}&plan_id=${PLAN_ID}&view=month&anchor_date=${anchor}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Erreur disponibilité: ${res.status}`);
  return res.json();
}

export async function fetchDayAvailability(
  resourceId: string,
  date: string
): Promise<AvailabilityResponse> {
  const headers = await buildHeaders();
  const res = await fetch(
    `${BASE_URL}/api/booking/availability?resource_id=${resourceId}&plan_id=${PLAN_ID}&view=day&anchor_date=${date}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Erreur créneaux: ${res.status}`);
  return res.json();
}

export async function confirmSelection(
  resourceId: string,
  startAt: string,
  endAt: string,
  durationMinutes: number
): Promise<SelectionResponse> {
  const headers = await buildHeaders();
  const res = await fetch(`${BASE_URL}/api/booking/selections/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bookingResourceId: resourceId,
      bookingPlanId: PLAN_ID,
      payload: { kind: 'duration', start_at: startAt, end_at: endAt, duration_minutes: durationMinutes },
      regionId: REGION_ID,
      devCreateStaleBookingCartLine: false,
    }),
  });
  if (!res.ok) throw new Error(`Erreur réservation: ${res.status}`);
  const data: SelectionResponse = await res.json();
  if (data.cart_id) {
    await SecureStore.setItemAsync(CART_KEY, data.cart_id);
  }
  return data;
}

export async function fetchCustomerBookings(): Promise<CustomerBookingsResponse> {
  const headers = await buildHeaders();
  const res = await fetch(`${BASE_URL}/api/booking/customer-bookings`, { headers });
  if (!res.ok) throw new Error(`Erreur réservations: ${res.status}`);
  return res.json();
}

export async function fetchCustomer(): Promise<{ customer: Customer }> {
  const headers = await buildHeaders();
  const res = await fetch(`${BASE_URL}/api/storefront/customer`, { headers });
  if (!res.ok) throw new Error(`Erreur client: ${res.status}`);
  return res.json();
}

// Extraire la valeur JSON d'un champ dans le payload RSC texte
function extractRscField(text: string, field: string): unknown {
  const marker = `"${field}":`;
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  const opener = text[start];
  if (opener !== '{' && opener !== '[') return null;
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === opener) depth++;
    else if (text[i] === closer && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

export async function fetchBookingDetail(bookingId: string): Promise<BookingDetailData> {
  const headers = await buildHeaders({
    RSC: '1',
    Accept: 'text/x-component',
  });
  const res = await fetch(`${BASE_URL}/account/bookings/${bookingId}`, { headers });
  if (!res.ok) throw new Error(`Erreur: ${res.status}`);
  const text = await res.text();
  const data = extractRscField(text, 'netcodesData') as BookingDetailData | null;
  if (!data) throw new Error('Codes d\'accès introuvables dans la réponse');
  return data;
}
