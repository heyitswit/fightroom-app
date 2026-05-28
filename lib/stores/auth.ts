import { create } from 'zustand';
import { fetchCustomer, getStoredJwt, login as apiLogin, logout as apiLogout, type Customer } from '@/lib/api';

interface AuthState {
  jwt: string | null;
  customer: Customer | null;
  isLoading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
        } catch {
          await apiLogout();
          set({ jwt: null, customer: null });
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
}));
