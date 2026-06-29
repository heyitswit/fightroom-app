import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://fightroom.fr';

export const SESSION_EXPIRED_ERROR = 'Session expirée, veuillez vous reconnecter';

const SIGNIN_PATH = '/sign-in';

let _onUnauthorized: (() => void | Promise<void>) | null = null;

export function registerUnauthorizedHandler(handler: () => void | Promise<void>): void {
  _onUnauthorized = handler;
}

// An expired Medusa session does NOT reliably surface as a 401 on fightroom.fr.
// Protected routes (e.g. /account, /account/bookings) answer with a 307 redirect
// to /sign-in. Since fetch follows redirects by default, the final response is the
// sign-in page with status 200 — so we detect expiry via the redirect chain.
function isSignInRedirect(res: Response): boolean {
  if (res.type === 'opaqueredirect') return true; // redirect:'manual' on web
  if (res.status >= 300 && res.status < 400) return true; // redirect not followed
  if (res.redirected && res.url.includes(SIGNIN_PATH)) return true; // redirect followed
  return false;
}

function assertOk(res: Response, errMsg: string): void {
  if (res.status === 401 || isSignInRedirect(res)) {
    _onUnauthorized?.();
    throw new Error(SESSION_EXPIRED_ERROR);
  }
  if (!res.ok) throw new Error(`${errMsg}: ${res.status}`);
}

export const REGION_ID = 'reg_01KP9Z19XKXCGQC3HCH64EXA0R';
export const PLAN_ID = '01KP9Z1QHM0XT54E0KNV536B18';


const DEVICE_ID_KEY = 'fightroom_device_id';
export const JWT_KEY = 'fightroom_jwt';
const CART_KEY = 'fightroom_cart_id';
const CREDENTIALS_KEY = 'fightroom_credentials';

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

// Next.js Server Action hashes — update when fightroom.fr is redeployed
const NEXT_ACTION_HASH = '40ee68e67804a83b0025abe8b4881a8f93af166636';
const CANCELLATION_PREVIEW_HASH = '6042ed18fdda2a3d2c87d303c2b991c47fea0b826c';
const CANCEL_BOOKING_HASH = '60fdc212bcfd18e730947d6528f508cbc70ca15cd8';

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
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }));
  return jwt;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(JWT_KEY);
  await SecureStore.deleteItemAsync(CART_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}

export async function reauthenticate(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!raw) return null;
    const { email, password } = JSON.parse(raw) as { email: string; password: string };
    return await login(email, password);
  } catch {
    return null;
  }
}

export async function getStoredJwt(): Promise<string | null> {
  return SecureStore.getItemAsync(JWT_KEY);
}

// Probes whether the Medusa session is still valid.
// Returns null on network/transient error so callers don't log the user out spuriously.
export async function isSessionValid(): Promise<boolean | null> {
  try {
    const headers = await buildHeaders();
    const res = await fetch(`${BASE_URL}/api/storefront/customer`, { headers });
    if (res.status === 401 || isSignInRedirect(res)) return false;
    if (!res.ok) return null;
    const data = (await res.json()) as { customer: Customer | null };
    return data.customer != null;
  } catch {
    return null;
  }
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
  return {
    Cookie: await getSessionCookieString(),
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
  code: string | null;
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
  assertOk(res, 'Erreur disponibilité');
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
  assertOk(res, 'Erreur créneaux');
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
  assertOk(res, 'Erreur réservation');
  const data: SelectionResponse = await res.json();
  if (data.cart_id) {
    await SecureStore.setItemAsync(CART_KEY, data.cart_id);
  }
  return data;
}

async function fetchBookingsForTab(tab: string): Promise<Booking[]> {
  const headers = await buildHeaders({ RSC: '1', Accept: 'text/x-component' });
  const res = await fetch(
    `${BASE_URL}/account/bookings?tab=${tab}&sort=-start_time`,
    { headers }
  );
  assertOk(res, 'Erreur réservations');
  const text = await res.text();
  return (extractRscField(text, 'bookings') as Booking[] | null) ?? [];
}

export async function fetchCustomerBookings(): Promise<CustomerBookingsResponse> {
  const [active, past, cancelled] = await Promise.all([
    fetchBookingsForTab('active'),
    fetchBookingsForTab('past'),
    fetchBookingsForTab('cancelled'),
  ]);
  const bookings = [...active, ...past, ...cancelled]
    .sort((a, b) => b.local_date.localeCompare(a.local_date));
  return { bookings, count: bookings.length, offset: 0, limit: bookings.length };
}

export async function fetchCustomer(): Promise<{ customer: Customer }> {
  const headers = await buildHeaders();
  const res = await fetch(`${BASE_URL}/api/storefront/customer`, { headers });
  assertOk(res, 'Erreur client');
  const data = (await res.json()) as { customer: Customer | null };
  // An expired _medusa_jwt returns 200 with { customer: null } (no 401, no redirect).
  // Treat that as the session-expired signal so the reauth flow kicks in.
  if (!data.customer) {
    _onUnauthorized?.();
    throw new Error(SESSION_EXPIRED_ERROR);
  }
  return data as { customer: Customer };
}

// Extract a JSON field value from the RSC text payload.
// Scans all occurrences of the field key to handle RSC responses where the
// field appears multiple times (e.g. first as a count/null, later as the array).
function extractRscField(text: string, field: string): unknown {
  const marker = `"${field}":`;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = text.indexOf(marker, searchFrom);
    if (idx === -1) return null;
    const start = idx + marker.length;
    const opener = text[start];
    if (opener === '{' || opener === '[') {
      const closer = opener === '{' ? '}' : ']';
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === opener) depth++;
        else if (text[i] === closer && --depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch { break; }
        }
      }
    }
    searchFrom = idx + marker.length;
  }
  return null;
}

function extractRscChunk(text: string, id: string): unknown {
  const re = new RegExp(`(?:^|\\n)${id}:([^\\n]+)`);
  const m = text.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export interface Room {
  id: string;
  name: string;
  available: boolean;
}

export interface Venue {
  slug: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  rooms: Room[];
}

type VenueMeta = { slug: string; latitude: number | null; longitude: number | null };

async function fetchVenueMeta(): Promise<VenueMeta[]> {
  const headers = await buildHeaders({ RSC: '1', Accept: 'text/x-component' });
  const res = await fetch(`${BASE_URL}/booking`, { headers });
  assertOk(res, 'Erreur lieux');
  const text = await res.text();

  // Extract slugs from href="/booking/{slug}"
  const slugMatches = [...text.matchAll(/"href":"\/booking\/([a-z0-9-]+)"/g)];
  const slugs = [...new Set(slugMatches.map((m) => m[1]))].filter(
    (s) => s !== 'index' && !s.includes('/')
  );
  if (slugs.length === 0) throw new Error('Aucun lieu trouvé');

  // Extract coords: "aria-label":"Carte de NAME","data-latitude":"LAT","data-longitude":"LNG"
  const coordMap: Record<string, { lat: number; lng: number }> = {};
  const coordRe = /"aria-label":"Carte de ([^"]+)","data-latitude":"([^"]+)","data-longitude":"([^"]+)"/g;
  for (const m of text.matchAll(coordRe)) {
    coordMap[m[1]] = { lat: parseFloat(m[2]), lng: parseFloat(m[3]) };
  }

  return slugs.map((slug) => {
    // Match slug to venue name: "lille-valenciennes" → "Lille Valenciennes"
    const nameKey = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const coords = coordMap[nameKey] ?? null;
    return { slug, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null };
  });
}

async function fetchVenueData(meta: VenueMeta): Promise<Venue> {
  const headers = await buildHeaders({ RSC: '1', Accept: 'text/x-component' });
  const res = await fetch(`${BASE_URL}/booking/${meta.slug}`, { headers });
  assertOk(res, `Erreur lieu (${meta.slug})`);
  const text = await res.text();

  const featured = extractRscField(text, 'featuredResource') as Record<string, unknown> | null;
  const children = extractRscField(text, 'childResources') as Record<string, unknown>[] | null;

  if (!featured || !children?.length) throw new Error(`Données introuvables pour ${meta.slug}`);

  const addr = featured.effective_address as Record<string, unknown> | null;
  const address = addr
    ? [addr.address_1, addr.postal_code, addr.city].filter(Boolean).join(', ')
    : '';

  return {
    slug: meta.slug,
    name: String(featured.title ?? meta.slug),
    address,
    latitude: meta.latitude,
    longitude: meta.longitude,
    rooms: children
      .filter((r) => r.is_bookable !== false)
      .map((r) => ({
        id: String(r.id),
        name: String(r.short_name ?? r.title ?? ''),
        available: true,
      })),
  };
}

export async function fetchVenues(): Promise<Venue[]> {
  const metas = await fetchVenueMeta();
  const results = await Promise.allSettled(metas.map(fetchVenueData));
  return results
    .filter((r): r is PromiseFulfilledResult<Venue> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export interface CancellationPreview {
  can_cancel: boolean;
  can_refund: boolean;
  can_apply_contract_refund: boolean;
  booking_amount: number;
  contract_refund_amount: number;
  currency_code: string;
  cancellation_policy: {
    refund_percent: number;
    after_deadline: boolean;
    cancellation_allowed: boolean;
    block_reason: string | null;
    base_refund: number;
    stripe_fee: number;
    compensation_total: number;
    fees_total: number;
    refund_final: number;
    minutes_until_start: number;
  };
}

export async function fetchCancellationPreview(bookingId: string): Promise<CancellationPreview> {
  const headers = await buildHeaders({
    'Content-Type': 'text/plain;charset=UTF-8',
    'next-action': CANCELLATION_PREVIEW_HASH,
  });
  const res = await fetch(`${BASE_URL}/account/bookings/${bookingId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify([bookingId]),
  });
  assertOk(res, 'Erreur politique annulation');
  const text = await res.text();
  const preview = (extractRscField(text, 'preview') ?? extractRscChunk(text, '1')) as CancellationPreview | null;
  if (!preview) throw new Error('Données annulation introuvables');
  return preview;
}

export async function cancelBooking(bookingId: string, refundBooking: boolean): Promise<void> {
  const headers = await buildHeaders({
    'Content-Type': 'text/plain;charset=UTF-8',
    'next-action': CANCEL_BOOKING_HASH,
  });
  const res = await fetch(`${BASE_URL}/account/bookings/${bookingId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify([bookingId, { refund_booking: refundBooking }]),
  });
  assertOk(res, 'Erreur annulation');
}

export async function fetchBookingDetail(bookingId: string): Promise<BookingDetailData> {
  const headers = await buildHeaders({
    RSC: '1',
    Accept: 'text/x-component',
  });
  const res = await fetch(`${BASE_URL}/account/bookings/${bookingId}`, { headers });
  assertOk(res, 'Erreur');
  const text = await res.text();
  const data = extractRscField(text, 'netcodesData') as BookingDetailData | null;
  if (!data) throw new Error('Codes d\'accès introuvables dans la réponse');
  return data;
}
