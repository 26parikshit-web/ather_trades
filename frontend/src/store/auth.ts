// Auth store — session, profile, tier gating.
import { create } from 'zustand';
import {
  clearSession,
  getSessionUser,
  login as apiLogin,
  me as apiMe,
  setSession,
  signup as apiSignup,
  type SessionUser,
} from '../lib/api';
import { TIER_RANK, type Profile, type SubscriptionTier } from '../types';

interface AuthState {
  user: SessionUser | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  hasTier: (tier: SubscriptionTier) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: getSessionUser(),
  profile: null,
  loading: false,
  error: null,

  init: async () => {
    if (!getSessionUser()) return;
    set({ loading: true });
    try {
      const profile = await apiMe();
      set({
        profile,
        loading: false,
        user: {
          id: profile.id,
          email: profile.email ?? '',
          tier: profile.subscription_tier,
        },
      });
    } catch {
      // token invalid/expired → session already cleared by api.ts
      set({ user: null, profile: null, loading: false });
    }
  },

  signup: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const { user_id, token } = await apiSignup(email, password, name);
      setSession(token, { id: user_id, email, tier: 'BASIC' });
      set({ user: { id: user_id, email, tier: 'BASIC' }, loading: false });
      await get().init();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { user_id, tier, token } = await apiLogin(email, password);
      setSession(token, { id: user_id, email, tier });
      set({ user: { id: user_id, email, tier }, loading: false });
      await get().init();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  logout: () => {
    clearSession();
    set({ user: null, profile: null, error: null });
  },

  clearError: () => set({ error: null }),

  hasTier: (tier) => {
    const current = get().user?.tier ?? 'BASIC';
    return TIER_RANK[current] >= TIER_RANK[tier];
  },
}));
