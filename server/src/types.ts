// Domain types shared by the store, routes and middleware.

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromId: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toId: string | null; // resolved once the recipient logs in at least once
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

// A single door access code (netcode) snapshot, captured at share time.
export interface SharedNetcode {
  deviceName: string;
  code: string | null;
  status: string;
  from: string; // ISO effective_from
  until: string; // ISO effective_until
}

// Snapshot of a booking's access info shared with a friend.
export interface SharedBooking {
  bookingId: string;
  room: string;
  date: string; // local_date (YYYY-MM-DD)
  startTime: string; // local_start_time (HH:MM:SS)
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

// Friend as surfaced to the client.
export interface Friend {
  requestId: string;
  id: string | null;
  email: string;
  name: string;
  since: string;
}
