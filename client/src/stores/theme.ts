import { create } from 'zustand';
import { safeStorage } from '~/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'kodav:theme';

function resolve(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolve(preference);
}

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  hydrate: () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference(preference) {
    safeStorage.set(STORAGE_KEY, preference);
    apply(preference);
    set({ preference });
  },
  hydrate() {
    const stored = safeStorage.get(STORAGE_KEY);
    const preference: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system';
    apply(preference);
    set({ preference });
  },
}));

/**
 * Script inline exécuté avant l'affichage : évite un flash de thème clair en mode sombre.
 * Doit rester autonome (aucune dépendance) et tolérer un localStorage bloqué.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}');}catch(e){}var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';})();`;
