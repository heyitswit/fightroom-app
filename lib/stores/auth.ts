import { create } from 'zustand';
import {
  fetchCustomer,
  getStoredJwt,
  isSessionValid,
  login as apiLogin,
  logout as apiLogout,
  reauthenticate,
  registerUnauthorizedHandler,
  SESSION_EXPIRED_ERROR,
  type Customer,
} from '@/lib/api';

interface AuthState {
  jwt: string | null;
  customer: Customer | null;
  isLoading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  revalidate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  let reauthInProgress = false;

  // Silently re-login with the stored credentials and refresh the customer.
  // Returns true if the session is valid afterwards. Guarded against re-entry.
  async function silentReauth(): Promise<boolean> {
    if (reauthInProgress) return !!get().jwt;
    reauthInProgress = true;
    try {
      const newJwt = await reauthenticate();
      if (newJwt) {
        set({ jwt: newJwt });
        try {
          const { customer } = await fetchCustomer();
          set({ customer });
        } catch {
          // customer stays as-is, session is valid
        }
        return true;
      }
      await apiLogout();
      set({ jwt: null, customer: null });
      return false;
    } finally {
      reauthInProgress = false;
    }
  }

  registerUnauthorizedHandler(async () => {
    // Don't fire during initialization — initialize() handles startup 401 itself
    if (!get().initialized) return;
    await silentReauth();
  });

  return {
    jwt: null,
    customer: null,
    isLoading: true,
    initialized: false,

    initialize: async () => {
      if (get().initialized) return;
      try {
        const jwt = await getStoredJwt();
        if (jwt) {
          set({ jwt });
          try {
            const { customer } = await fetchCustomer();
            set({ customer });
          } catch (e) {
            // JWT expired/invalid on startup: try a silent reauth before giving up.
            // (registerUnauthorizedHandler is inert until `initialized` is true.)
            if (e instanceof Error && e.message === SESSION_EXPIRED_ERROR) {
              await silentReauth();
            } else {
              await apiLogout();
              set({ jwt: null, customer: null });
            }
          }
        }
      } finally {
        set({ isLoading: false, initialized: true });
      }
    },

    login: async (email, password) => {
      const jwt = await apiLogin(email, password);
      const { customer } = await fetchCustomer();
      set({ jwt, customer });
    },

    logout: async () => {
      await apiLogout();
      set({ jwt: null, customer: null });
    },

    revalidate: async () => {
      if (!get().initialized || !get().jwt) return;
      // Proactively detect an expired Medusa session (307 → /sign-in) that the
      // API endpoints don't surface as a 401, and silently refresh the token.
      const valid = await isSessionValid();
      if (valid === false) {
        await silentReauth();
        return;
      }
      try {
        const { customer } = await fetchCustomer();
        set({ customer });
      } catch {
        // 401 already handled by registerUnauthorizedHandler; other errors are transient
      }
    },
  };
});
