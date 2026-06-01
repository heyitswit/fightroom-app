import { create } from 'zustand';
import {
  fetchCustomer,
  getStoredJwt,
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
  registerUnauthorizedHandler(async () => {
    // Don't fire during initialization — initialize() handles startup 401 itself
    if (reauthInProgress || !get().initialized) return;
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
      } else {
        await apiLogout();
        set({ jwt: null, customer: null });
      }
    } finally {
      reauthInProgress = false;
    }
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
            if (e instanceof Error && e.message === SESSION_EXPIRED_ERROR) {
              // JWT expired on startup: try silent reauth before giving up
              const newJwt = await reauthenticate();
              if (newJwt) {
                set({ jwt: newJwt });
                try {
                  const { customer } = await fetchCustomer();
                  set({ customer });
                } catch {
                  await apiLogout();
                  set({ jwt: null, customer: null });
                }
              } else {
                await apiLogout();
                set({ jwt: null, customer: null });
              }
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
      try {
        const { customer } = await fetchCustomer();
        set({ customer });
      } catch {
        // 401 already handled by registerUnauthorizedHandler; other errors are transient
      }
    },
  };
});
