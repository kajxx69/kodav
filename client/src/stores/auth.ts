import type { AuthSession, AuthUser } from '@kodav/shared';
import { create } from 'zustand';
import { safeStorage } from '~/lib/storage';

/** Indice non sensible : évite d'appeler /auth/refresh pour un visiteur jamais connecté. */
export const SESSION_HINT_KEY = 'kodav:session';

type AuthState = {
  status: 'unknown' | 'authenticated' | 'anonymous';
  user: AuthUser | null;
  /** Jeton d'accès gardé en mémoire uniquement (jamais dans localStorage). */
  accessToken: string | null;
  setSession: (session: AuthSession) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession({ accessToken, user }) {
    safeStorage.set(SESSION_HINT_KEY, '1');
    set({ status: 'authenticated', accessToken, user });
  },
  setUser(user) {
    set({ user });
  },
  clear() {
    safeStorage.remove(SESSION_HINT_KEY);
    set({ status: 'anonymous', accessToken: null, user: null });
  },
}));
