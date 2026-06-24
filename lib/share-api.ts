import { getStoredJwt } from '@/lib/api';

// Base URL of the Fight Room share server (the Lacis monorepo `server/` package).
// Override per-env with EXPO_PUBLIC_SHARE_API_URL.
export const SHARE_API_URL =
  process.env.EXPO_PUBLIC_SHARE_API_URL ?? 'http://localhost:3000';

// --- Types (mirror server/src/types.ts) ---

export interface ShareUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Friend {
  requestId: string;
  id: string | null;
  email: string;
  name: string;
  since: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromId: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toId: string | null;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface SharedNetcode {
  deviceName: string;
  code: string | null;
  status: string;
  from: string;
  until: string;
}

export interface SharedBooking {
  bookingId: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  netcodes: SharedNetcode[];
}

export interface Share {
  id: string;
  fromId: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toId: string | null;
  booking: SharedBooking;
  createdAt: string;
}

// --- HTTP helper ---

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const jwt = await getStoredJwt();
  const res = await fetch(`${SHARE_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt ?? ''}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Friends ---

export function fetchFriends(): Promise<{ friends: Friend[] }> {
  return request('/friends');
}

export function fetchFriendRequests(): Promise<{
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}> {
  return request('/friends/requests');
}

export function sendFriendRequest(email: string): Promise<{ request: FriendRequest }> {
  return request('/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function respondToRequest(
  id: string,
  action: 'accept' | 'decline'
): Promise<{ request: FriendRequest }> {
  return request(`/friends/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export function cancelFriendRequest(id: string): Promise<void> {
  return request(`/friends/requests/${id}`, { method: 'DELETE' });
}

export function removeFriend(requestId: string): Promise<void> {
  return request(`/friends/${requestId}`, { method: 'DELETE' });
}

// --- Shares ---

export function fetchShares(): Promise<{ received: Share[]; sent: Share[] }> {
  return request('/shares');
}

export function createShare(
  toEmail: string,
  booking: SharedBooking
): Promise<{ share: Share }> {
  return request('/shares', {
    method: 'POST',
    body: JSON.stringify({ toEmail, booking }),
  });
}

export function deleteShare(id: string): Promise<void> {
  return request(`/shares/${id}`, { method: 'DELETE' });
}
